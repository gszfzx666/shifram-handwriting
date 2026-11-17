# -*- coding: utf-8 -*-
"""把旧招牌全面改成「拾帧工具」，并重画 logo。幂等，可重复运行。"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FILES = [
    'index.html', 'guide.html', 'superdiy.html',
    'launcher.py', 'launcher_desktop.py',
    os.path.join('js', 'zxtrain.js'),
    'app.spec', 'app_desktop.spec',
    os.path.join('dist', '安装与使用说明.txt'),
]

# 顺序：长/特殊在前，通用在后
REPLS = [
    ('凹凸工坊官网复刻版-桌面版', '拾帧工具'),
    ('凹凸工坊官网复刻版 onefile', '拾帧工具 onefile'),
    ('凹凸工坊官网复刻版', '拾帧工具-浏览器版'),
    ('凹凸工坊 · 手写模拟器（官网复刻版）', '拾帧工具 · 手写文稿生成器'),
    ('凹凸工坊 · 手写模拟器', '拾帧工具 · 手写文稿生成器'),
    ('凹凸工坊 · 桌面版', '拾帧工具'),
    ('凹凸工坊 · 官网复刻版', '拾帧工具'),
    ('<span class="mark">凹</span>', '<span class="mark">拾</span>'),
    ('凹凸工坊', '拾帧工具'),
]

changed = []
for rel in FILES:
    p = os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        print('跳过(不存在):', rel)
        continue
    s = open(p, encoding='utf-8').read()
    o = s
    for a, b in REPLS:
        s = s.replace(a, b)
    # spec 排除所有 exe，避免把根目录 exe 当资源递归打进包（体积暴涨根因）
    if rel in ('app.spec', 'app_desktop.spec') and "'.exe'" not in s:
        s = s.replace("'.pyc', '.log',", "'.pyc', '.log', '.exe',")
    if s != o:
        open(p, 'w', encoding='utf-8').write(s)
        changed.append(rel)
        print('已改:', rel)
print('文本文件改动数:', len(changed))

# 重画 logo：500x500 透明底，黑色手写「拾帧工具」2x2
from PIL import Image, ImageDraw, ImageFont
font_path = os.path.join(ROOT, 'fonts', 'MaShanZheng_400Regular.ttf')
if not os.path.isfile(font_path):
    font_path = os.path.join(ROOT, 'fonts', 'official_recon.ttf')
font = ImageFont.truetype(font_path, 200)
im = Image.new('RGBA', (500, 500), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
chars = '拾帧工具'
pos = [(18, -18), (252, -18), (18, 214), (252, 214)]
for ch, (x, y) in zip(chars, pos):
    d.text((x, y), ch, font=font, fill=(0, 0, 0, 255))
logo = os.path.join(ROOT, 'img', 'logo.a5f914db.png')
im.save(logo)
print('logo 已重绘:', logo, im.size)
