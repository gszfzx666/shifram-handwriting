# -*- coding: utf-8 -*-
"""
从官网渲染的单字 PNG 逆向矢量字形，生成可用 TTF。
以现成规范 TTF 为模板（继承 head/hhea/maxp/name/post/OS2 等完整表），
只替换 glyf/cmap/hmtx 与 glyph order。

流程：解 batch ZIP -> 按列块切字 -> 二值化 -> cv2.findContours(RETR_CCOMP)
      -> 轮廓缩放/平滑 -> TTGlyphPen 构建 glyf -> 写 TTF。

用法:
  python tools/build_font_from_render.py <charsDir> <out.ttf> <fontName> [template.ttf]
"""
import sys, os, json, glob, zipfile
import cv2, numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen

CHARS_DIR = sys.argv[1]
OUT_TTF = sys.argv[2]
FONT_NAME = sys.argv[3] if len(sys.argv) > 3 else "OfficialHand"
def _find_template():
    here = os.path.dirname(os.path.abspath(__file__))
    for base in (os.path.dirname(here), os.path.dirname(os.path.dirname(here))):
        for rel in (os.path.join('clone_official','fonts'), 'fonts'):
            p = os.path.join(base, rel, 'MaShanZheng_400Regular.ttf')
            if os.path.exists(p): return p
    return os.path.join(here, '..', 'fonts', 'MaShanZheng_400Regular.ttf')
TEMPLATE = sys.argv[4] if len(sys.argv) > 4 else _find_template()

UPM = 1000
THRESH = 170
EPS_SMOOTH = 1.1
FILL_RATIO = 0.84

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

# ---------- 2. 位图轮廓 -> glyf ----------
def make_glyph(mask, codepoint=None):
    pen = TTGlyphPen(None)
    # 句号 U+3002：官网是空心小圆圈，位图抠字易和邻字粘连成实心方块，
    # 直接用矢量圆环重建，落在字面框中下部。
    if codepoint == 0x3002:
        cx, cy, r_out, r_in = UPM*0.5, UPM*0.30, UPM*0.11, UPM*0.055
        n = 24
        import math
        outer = [(cx + r_out*math.cos(2*math.pi*i/n), cy + r_out*math.sin(2*math.pi*i/n)) for i in range(n)]
        inner = [(cx + r_in*math.cos(2*math.pi*i/n), cy + r_in*math.sin(2*math.pi*i/n)) for i in range(n-1, -1, -1)]
        pen.moveTo(outer[0])
        for p in outer[1:]: pen.lineTo(p)
        pen.closePath()
        pen.moveTo(inner[0])
        for p in inner[1:]: pen.lineTo(p)
        pen.closePath()
        return pen.glyph()
    h, w = mask.shape
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if not contours or hierarchy is None:
        return pen.glyph()
    scale = UPM * FILL_RATIO / max(h, w)
    ox = (UPM - w * scale) / 2
    oy = (UPM - h * scale) / 2
    for i, cnt in enumerate(contours):
        if cv2.contourArea(cnt) < 1.2:
            continue
        ap = cv2.approxPolyDP(cnt, EPS_SMOOTH, True).reshape(-1, 2)
        if len(ap) < 3:
            continue
        pts = [(float(x * scale + ox), float(UPM - (y * scale + oy))) for x, y in ap]
        area = 0.5 * sum(pts[j][0] * pts[(j + 1) % len(pts)][1] -
                         pts[(j + 1) % len(pts)][0] * pts[j][1] for j in range(len(pts)))
        is_hole = hierarchy[0][i][3] != -1
        if is_hole and area > 0:
            pts = pts[::-1]
        elif not is_hole and area < 0:
            pts = pts[::-1]
        pen.moveTo(pts[0])
        for p in pts[1:]:
            pen.lineTo(p)
        pen.closePath()
    return pen.glyph()

# ---------- 3. 以模板组装 TTF ----------
def build_ttf(glyphs, out, name):
    from fontTools.ttLib import newTable
    from fontTools.ttLib.tables._c_m_a_p import cmap_format_4

    font = TTFont(TEMPLATE)
    order = ['.notdef'] + [f'uni{ord(c):04X}' for c in glyphs]

    # 先移除依赖 glyphOrder/旧字形索引的表，避免 decompile/compile 越界
    # GlyphOrder 是 fontTools 内部表，必须一并删除，否则 setGlyphOrder 会被它覆盖
    for tag in ('hmtx', 'glyf', 'loca', 'cmap', 'GSUB', 'GPOS', 'gasp', 'prep', 'GlyphOrder', 'post'):
        if tag in font:
            del font[tag]
    font.setGlyphOrder(order)

    # post 表 format 2.0 会内嵌模板的 glyphOrder（A/B/C/space/uni77XX），
    # 保存时覆盖回模板顺序，导致 uniFF0C/uni4E00 等映射错位。
    # 重建为 format 3.0（不含字形名），彻底切断污染。
    post = newTable('post')
    post.formatType = 3.0
    post.italicAngle = 0
    post.underlinePosition = -100
    post.underlineThickness = 50
    post.isFixedPitch = 0
    post.minMemType42 = 0
    post.maxMemType42 = 0
    post.minMemType1 = 0
    post.maxMemType1 = 0
    font['post'] = post

    # loca 必须在 glyf 之前挂上（glyf.compile 会填充它）
    loca = newTable('loca')
    font['loca'] = loca
    font['head'].indexToLocFormat = 0

    glyf = newTable('glyf')
    glyf.glyphs = {}
    glyf.glyphOrder = order
    hmtx = newTable('hmtx')
    hmtx.metrics = {'.notdef': (UPM, 0)}

    pen0 = TTGlyphPen(None)
    glyf.glyphs['.notdef'] = pen0.glyph()

    cmap_table = {}
    for c in glyphs:
        gname = f'uni{ord(c):04X}'
        glyf.glyphs[gname] = make_glyph(glyphs[c], ord(c))
        hmtx.metrics[gname] = (UPM, 0)
        cmap_table[ord(c)] = gname

    font['glyf'] = glyf
    font['hmtx'] = hmtx

    cmap = newTable('cmap')
    cmap.tableVersion = 0
    sub = cmap_format_4(4)
    sub.platformID = 3; sub.platEncID = 1; sub.language = 0
    sub.cmap = cmap_table
    cmap.tables = [sub]
    font['cmap'] = cmap

    # name 表改名
    name_tbl = font['name']
    fam = name
    for rec in name_tbl.names:
        try:
            s = rec.toUnicode()
        except Exception:
            continue
        if rec.nameID == 1:
            rec.string = fam.encode('utf-16-be') if rec.platformID == 3 else fam.encode('latin1', 'ignore')
        elif rec.nameID == 4:
            full = fam + ' Regular'
            rec.string = full.encode('utf-16-be') if rec.platformID == 3 else full.encode('latin1', 'ignore')
        elif rec.nameID == 6:
            ps = fam.replace(' ', '')
            rec.string = ps.encode('utf-16-be') if rec.platformID == 3 else ps.encode('latin1', 'ignore')

    # maxp / hhea 数量同步
    font['maxp'].numGlyphs = len(order)
    font['hhea'].numberOfHMetrics = len(order)

    font.save(out)
    return len(glyphs)

if __name__ == '__main__':
    glyphs = load_glyphs(CHARS_DIR)
    print(f'提取字形 {len(glyphs)} 个: {"".join(list(glyphs)[:40])}')
    n = build_ttf(glyphs, OUT_TTF, FONT_NAME)
    # 验证可读
    v = TTFont(OUT_TTF)
    cmap = v.getBestCmap()
    print(f'写出 TTF: {OUT_TTF} | 字形 {n} | cmap {len(cmap)} | {os.path.getsize(OUT_TTF)} B')
