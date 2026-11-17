# -*- coding: utf-8 -*-
"""
笔画级重建：把官网渲染的单字位图拆成笔画骨架，按笔压曲线重建变宽轮廓，生成 TTF。

区别于旧版 build_font_from_render.py 的「整字外轮廓 + 固定 FILL_RATIO 缩放」：
  1) skeletonize 得到单像素笔画中轴
  2) distance_transform 得到每个骨架点的墨迹半径（真实笔压）
  3) 骨架在分叉点处切成笔画段
  4) 每段沿法线按半径左右偏移，生成变宽多边形；起收笔收细形成笔锋
  5) 兜底：分解失败的字回退到整字轮廓法

用法:
  python tools/rebuild_stroke_font.py <charsDir> <out.ttf> <fontName> [template.ttf]
"""
import sys, os, json, glob, zipfile, math
import cv2, numpy as np
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._c_m_a_p import cmap_format_4
from skimage.morphology import skeletonize
from scipy.ndimage import distance_transform_edt

CHARS_DIR = sys.argv[1]
OUT_TTF = sys.argv[2]
FONT_NAME = sys.argv[3] if len(sys.argv) > 3 else "OfficialStroke"
def _find_template():
    here = os.path.dirname(os.path.abspath(__file__))
    for base in (os.path.dirname(here), os.path.dirname(os.path.dirname(here))):
        p = os.path.join(base, 'clone_official', 'fonts', 'MaShanZheng_400Regular.ttf')
        if os.path.exists(p): return p
        p2 = os.path.join(base, 'fonts', 'MaShanZheng_400Regular.ttf')
        if os.path.exists(p2): return p2
    return os.path.join(here, '..', 'fonts', 'MaShanZheng_400Regular.ttf')
TEMPLATE = sys.argv[4] if len(sys.argv) > 4 else _find_template()

UPM = 1000
THRESH = 170

# ---------- 1. 收集每字二值位图 ----------
def load_glyphs(chars_dir):
    glyphs = {}
    for zf in sorted(glob.glob(os.path.join(chars_dir, 'batch_*.zip'))):
        jf = zf[:-4] + '.json'
        if not os.path.exists(jf):
            continue
        chars = json.load(open(jf, encoding='utf8'))['chars']
        z = zipfile.ZipFile(zf)
        names = [n for n in z.namelist() if n.lower().endswith('.png')]
        if not names:
            continue
        arr = np.frombuffer(z.read(names[0]), np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
        if im is None:
            continue
        g = cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2GRAY)
        mask = (g < THRESH).astype(np.uint8)
        col = mask.sum(axis=0)
        occ = np.where(col > 0)[0]
        if len(occ) == 0:
            continue
        blocks = []
        s = p = occ[0]
        for v in occ[1:]:
            if v - p > 5:
                blocks.append((s, p)); s = v
            p = v
        blocks.append((s, p))
        n = len(chars)
        boxes = []
        if len(blocks) == n:
            for x0, x1 in blocks:
                sub = mask[:, x0:x1 + 1]
                ys = np.where(sub.sum(axis=1) > 0)[0]
                boxes.append(sub[ys.min():ys.max() + 1, :] if len(ys) else None)
        else:
            x0, x1 = occ.min(), occ.max()
            w = (x1 - x0 + 1) / n
            for k in range(n):
                a = int(x0 + k * w); b = int(x0 + (k + 1) * w)
                sub = mask[:, max(0, a):min(mask.shape[1], b + 1)]
                ys = np.where(sub.sum(axis=1) > 0)[0]
                boxes.append(sub[ys.min():ys.max() + 1, :] if len(ys) else None)
        for ch, box in zip(chars, boxes):
            if box is not None and box.size:
                glyphs[ch] = box
    return glyphs

# ---------- 2a. 骨架分解为笔画段 ----------
def skeleton_edges(mask):
    """返回笔画段列表：每段是 [(x,y,radius), ...] 的有序路径。
    策略：从每个端点出发，遇分叉选「与来向夹角最小(最直行)」的分支继续，
    直到另一个端点——一笔会跨过多个分叉点，不能见叉就切。"""
    m = (mask > 0)
    if m.sum() < 3:
        return []
    skel = skeletonize(m)
    if skel.sum() < 2:
        return []
    dist = distance_transform_edt(m)
    pix = set(zip(*np.where(skel)[::-1]))  # (x,y) 集合
    def nbrs(p):
        x, y = p
        return [(x+dx, y+dy) for dx in (-1,0,1) for dy in (-1,0,1)
                if (dx or dy) and (x+dx, y+dy) in pix]
    endpoints = [p for p in pix if len(nbrs(p)) == 1]
    used_edges = set()
    edges = []
    def ekey(a, b): return tuple(sorted([a, b]))
    def trace(start):
        path = [start]; cur = start; prev = None
        for _ in range(len(pix) + 4):
            cand = [q for q in nbrs(cur) if q != prev and ekey(cur, q) not in used_edges]
            if not cand:
                cand = [q for q in nbrs(cur) if ekey(cur, q) not in used_edges]
            if not cand:
                break
            if prev is None:
                nxt = cand[0]
            else:
                vx, vy = cur[0]-prev[0], cur[1]-prev[1]
                best, bs = None, -2
                for q in cand:
                    wx, wy = q[0]-cur[0], q[1]-cur[1]
                    dot = (vx*wx+vy*wy)/((math.hypot(vx,vy) or 1)*(math.hypot(wx,wy) or 1))
                    if dot > bs: bs, best = dot, q
                nxt = best
            used_edges.add(ekey(cur, nxt))
            path.append(nxt); prev, cur = cur, nxt
        return path
    for ep in endpoints:
        path = trace(ep)
        if len(path) >= 2:
            edges.append([(float(x), float(y), float(dist[y, x])) for (x, y) in path])
    # 剩余未走过的骨架（闭合环，如"口""日"内框）：整段作为一笔
    for p in list(pix):
        path = trace(p)
        if len(path) >= 4:
            edges.append([(float(x), float(y), float(dist[y, x])) for (x, y) in path])
    return edges

# ---------- 2b. 单笔 -> 变宽多边形点列 ----------
def edge_to_polygon(seq, scale, ox, oy, tip_shrink=0.35, width_gain=0.58):
    """沿路径法线按半径偏移，起收笔渐细；返回 (x,y) 点列(字体坐标)。
    width_gain 收窄笔宽，避免小字交叉处多条笔画叠加成墨团。"""
    n = len(seq)
    if n < 2:
        return []
    # 路径简化：点数多时每 2 点取 1，避免多边形过密
    if n > 24:
        idx = np.unique(np.linspace(0, n-1, 24).astype(int))
        seq = [seq[i] for i in idx]
        n = len(seq)
    left, right = [], []
    for i in range(n):
        x, y, r = seq[i]
        # 切线：用前后点差分
        if i == 0:
            tx, ty = seq[1][0]-x, seq[1][1]-y
        elif i == n-1:
            tx, ty = x-seq[n-2][0], y-seq[n-2][1]
        else:
            tx, ty = seq[i+1][0]-seq[i-1][0], seq[i+1][1]-seq[i-1][1]
        L = math.hypot(tx, ty) or 1.0
        nx, ny = -ty/L, tx/L                   # 法线
        # 笔压：起收收细，中间保留距离变换半径
        t = i/(n-1)
        taper = 1.0
        if t < 0.22: taper = tip_shrink + (1-tip_shrink)*(t/0.22)
        elif t > 0.78: taper = tip_shrink + (1-tip_shrink)*((1-t)/0.22)
        rr = max(0.45, r*width_gain*taper)
        fx, fy = x*scale+ox, UPM-(y*scale+oy)
        # 法线在字体坐标里 y 反向
        left.append((fx + nx*rr*scale, fy - ny*rr*scale))
        right.append((fx - nx*rr*scale, fy + ny*rr*scale))
    return left + right[::-1]

# ---------- 2c. 兜底：整字外轮廓（旧法） ----------
def mask_to_contours(mask, scale, ox, oy):
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    polys = []
    if not contours or hierarchy is None:
        return polys
    for i, cnt in enumerate(contours):
        if cv2.contourArea(cnt) < 1.0: continue
        ap = cv2.approxPolyDP(cnt, 1.1, True).reshape(-1, 2)
        if len(ap) < 3: continue
        pts = [(float(x*scale+ox), float(UPM-(y*scale+oy))) for x, y in ap]
        area = 0.5*sum(pts[j][0]*pts[(j+1)%len(pts)][1]-pts[(j+1)%len(pts)][0]*pts[j][1] for j in range(len(pts)))
        is_hole = hierarchy[0][i][3] != -1
        if is_hole and area > 0: pts = pts[::-1]
        elif not is_hole and area < 0: pts = pts[::-1]
        polys.append(pts)
    return polys

# ---------- 2. 位图 -> glyf ----------
def make_glyph(mask, codepoint=None):
    pen = TTGlyphPen(None)
    if codepoint == 0x3002:  # 句号：矢量圆环（旧法已验证有效）
        cx, cy, ro, ri = UPM*0.5, UPM*0.30, UPM*0.11, UPM*0.055
        n = 24; import math
        outer = [(cx+ro*math.cos(2*math.pi*i/n), cy+ro*math.sin(2*math.pi*i/n)) for i in range(n)]
        inner = [(cx+ri*math.cos(2*math.pi*i/n), cy+ri*math.sin(2*math.pi*i/n)) for i in range(n-1,-1,-1)]
        pen.moveTo(outer[0]); [pen.lineTo(p) for p in outer[1:]]; pen.closePath()
        pen.moveTo(inner[0]); [pen.lineTo(p) for p in inner[1:]]; pen.closePath()
        return pen.glyph()
    h, w = mask.shape
    scale = UPM*0.84/max(h, w)
    ox = (UPM-w*scale)/2
    oy = (UPM-h*scale)/2
    edges = skeleton_edges(mask)
    polys = []
    if 0 < len(edges) <= 40:
        # 把每笔变宽多边形在高分辨率画布上光栅化取并集，消除自交细缝，
        # 再对并集重新取轮廓（带孔洞），得到干净的笔画轮廓。
        R = 4  # 超采样倍率
        canvas = np.zeros((UPM*R, UPM*R), np.uint8)
        any_poly = False
        for seq in edges:
            poly = edge_to_polygon(seq, scale, ox, oy)
            if len(poly) < 6:
                continue
            pts_px = np.array([[int(round(x*R)), int(round(y*R))] for x, y in poly], np.int32)
            cv2.fillPoly(canvas, [pts_px], 255, lineType=cv2.LINE_AA)
            any_poly = True
        if any_poly:
            # 用字体坐标反算：mask 坐标 -> 字体坐标是 scale + 居中偏移；
            # 这里 canvas 已是字体坐标域(UPM)，直接按 UPM 取轮廓即可。
            contours, hierarchy = cv2.findContours(canvas, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            if hierarchy is not None:
                for i, cnt in enumerate(contours):
                    if cv2.contourArea(cnt) < (2*R)**2: continue
                    ap = cv2.approxPolyDP(cnt, 1.4*R, True).reshape(-1, 2)
                    if len(ap) < 3: continue
                    pts = [(float(x/R), float(y/R)) for x, y in ap]
                    area = 0.5*sum(pts[j][0]*pts[(j+1)%len(pts)][1]-pts[(j+1)%len(pts)][0]*pts[j][1] for j in range(len(pts)))
                    is_hole = hierarchy[0][i][3] != -1
                    if is_hole and area > 0: pts = pts[::-1]
                    elif not is_hole and area < 0: pts = pts[::-1]
                    polys.append(pts)
    # 兜底：骨架分解无有效结果，用整字轮廓（mask 坐标需经 scale 变换）
    if len(polys) < 1:
        polys = mask_to_contours(mask, scale, ox, oy)
    for pts in polys:
        pen.moveTo(pts[0])
        for p in pts[1:]: pen.lineTo(p)
        pen.closePath()
    return pen.glyph()

# ---------- 3. 组装 TTF（沿用已验证的模板替换法） ----------
def build_ttf(glyphs, out, name):
    font = TTFont(TEMPLATE)
    order = ['.notdef'] + [f'uni{ord(c):04X}' for c in glyphs]
    for tag in ('hmtx','glyf','loca','cmap','GSUB','GPOS','gasp','prep','GlyphOrder','post'):
        if tag in font: del font[tag]
    font.setGlyphOrder(order)
    post = newTable('post')
    post.formatType = 3.0
    post.italicAngle = 0; post.underlinePosition = -100; post.underlineThickness = 50
    post.isFixedPitch = 0; post.minMemType42 = 0; post.maxMemType42 = 0
    post.minMemType1 = 0; post.maxMemType1 = 0
    font['post'] = post
    loca = newTable('loca'); font['loca'] = loca
    font['head'].indexToLocFormat = 0
    glyf = newTable('glyf'); glyf.glyphs = {}; glyf.glyphOrder = order
    hmtx = newTable('hmtx'); hmtx.metrics = {'.notdef': (UPM, 0)}
    glyf.glyphs['.notdef'] = TTGlyphPen(None).glyph()
    cmap_table = {}
    for c in glyphs:
        gn = f'uni{ord(c):04X}'
        glyf.glyphs[gn] = make_glyph(glyphs[c], ord(c))
        hmtx.metrics[gn] = (UPM, 0)
        cmap_table[ord(c)] = gn
    font['glyf'] = glyf; font['hmtx'] = hmtx
    cmap = newTable('cmap'); cmap.tableVersion = 0
    sub = cmap_format_4(4); sub.platformID = 3; sub.platEncID = 1; sub.language = 0
    sub.cmap = cmap_table; cmap.tables = [sub]; font['cmap'] = cmap
    name_tbl = font['name']
    for rec in name_tbl.names:
        try: s = rec.toUnicode()
        except Exception: continue
        if rec.nameID == 1:
            rec.string = name.encode('utf-16-be') if rec.platformID==3 else name.encode('latin1','ignore')
        elif rec.nameID == 4:
            full = name+' Regular'
            rec.string = full.encode('utf-16-be') if rec.platformID==3 else full.encode('latin1','ignore')
        elif rec.nameID == 6:
            ps = name.replace(' ','')
            rec.string = ps.encode('utf-16-be') if rec.platformID==3 else ps.encode('latin1','ignore')
    font['maxp'].numGlyphs = len(order)
    font['hhea'].numberOfHMetrics = len(order)
    font.save(out)
    return len(glyphs)

if __name__ == '__main__':
    glyphs = load_glyphs(CHARS_DIR)
    print(f'提取字形 {len(glyphs)} 个')
    n = build_ttf(glyphs, OUT_TTF, FONT_NAME)
    v = TTFont(OUT_TTF)
    print(f'写出 {OUT_TTF} | 字形 {n} | cmap {len(v.getBestCmap())} | {os.path.getsize(OUT_TTF)} B')
