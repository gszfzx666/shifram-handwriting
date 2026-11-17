# -*- coding: utf-8 -*-
"""对比旧版整字轮廓字体 vs 新版笔画级重建字体（全量），含空字形统计。"""
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from PIL import Image, ImageDraw, ImageFont
import os

OLD = 'clone_official/fonts/official_recon.ttf'
NEW = 'site_dump/captured/crack/official_stroke_full.ttf'

for tag, path in [('旧版', OLD), ('新版', NEW)]:
    if not os.path.exists(path):
        print(tag, '不存在', path); continue
    f = TTFont(path)
    cm = f.getBestCmap()
    gs = f.getGlyphSet()
    empty, total = 0, 0
    for cp, gn in cm.items():
        bp = BoundsPen(gs)
        try: gs[gn].draw(bp)
        except Exception: pass
        total += 1
        if bp.bounds is None: empty += 1
    print(f'{tag}: cmap={len(cm)} numGlyphs={f["maxp"].numGlyphs} 空字形={empty}/{total} bytes={os.path.getsize(path)}')

# 对比渲染：用用户截图那句 + 混合文本
lines = [
    '任务名称/内容：一元二次方程',
    '今天天气很好，我在家里写字。',
    '手写体的真实感来自每一个字都不太一样。',
    '永字的一是在大小人山水日月微分中值定理',
]
txt_ok = True
for tag, path in [('旧版', OLD), ('新版', NEW)]:
    if not os.path.exists(path): continue
    cm = TTFont(path).getBestCmap()
    miss = sorted({c for ln in lines for c in ln if ord(c) not in cm})
    if miss:
        txt_ok = False
        print(tag, '测试句缺字:', ''.join(miss))
print('测试句全部覆盖' if txt_ok else '有缺字(PIL会回退)')

W = 1500
font_size = 50
ims = []
for tag, path in [('旧版-整字轮廓', OLD), ('新版-笔画级重建', NEW)]:
    if not os.path.exists(path): continue
    f = ImageFont.truetype(path, font_size)
    im = Image.new('RGB', (W, len(lines)*76 + 30), 'white')
    d = ImageDraw.Draw(im)
    y = 8
    d.text((16, y), tag, fill='red')
    y += 30
    for ln in lines:
        d.text((16, y), ln, font=f, fill='black')
        y += 76
    ims.append(im)

if ims:
    out = Image.new('RGB', (W, sum(i.height for i in ims)), 'white')
    yy = 0
    for i in ims:
        out.paste(i, (0, yy)); yy += i.height
    p = 'site_dump/captured/crack/stroke_full_compare.png'
    out.save(p); print('对比图:', p, out.size)
