# -*- mode: python ; coding: utf-8 -*-
"""拾帧工具 onefile 打包：把整个站点作为 web/ 资源嵌入单个 exe。"""
import os

ROOT = os.path.abspath(SPECPATH)  # noqa: F821
SKIP_DIRS = {
    '.git', 'tools', '__pycache__', 'build', 'dist', 'web', 'source',
    '_edge_profile', '.edge', 'site_dump'
}
SKIP_PARTS = (
    '_body.html', 'shot.mjs', 'shot_final.mjs', 'tools_render.mjs',
    'tools_compare.html', 'clone_home.png', 'local_render.png', 'final_page.png',
    'capture.mjs', 'api_probe', 'batch_papers',
    'server.py', 'app.spec', 'app_desktop.spec', 'launcher.py', 'launcher_desktop.py', '.pyc', '.log', '.exe',
    'url.txt', 'zx_cells.npz', 'zx_atlas_frozen', 'zx_build_info',
    'manifest.json', 's0.jpg', 's1.jpg', 's2.jpg', 's3.jpg', 's4.jpg',
    's5.jpg', 's6.jpg', 's7.jpg', 's8.jpg',
    'chunk-vendors.css', 'app.css', '328.css', 'rename_brand.py'
)


def keep(name):
    low = name.lower()
    return not any(p.lower() in low for p in SKIP_PARTS)


datas = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.edge') and not d.startswith('_edge')]
    rel = os.path.relpath(dirpath, ROOT)
    dst = 'web' if rel == '.' else os.path.join('web', rel)
    for f in filenames:
        if not keep(f):
            continue
        src = os.path.join(dirpath, f)
        if os.path.isfile(src):
            datas.append((src, dst))

a = Analysis(  # noqa: F821
    ['launcher_desktop.py'],
    pathex=[ROOT],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'webview', 'webview.platforms', 'webview.platforms.edgechromium',
        'webview.dom', 'webview.js', 'webview.util', 'webview.http',
        'webview.window', 'webview.menu', 'webview.event',
        'clr', 'clr_loader', 'pythonnet', 'bottle', 'proxy_tools',
        'cffi', 'pycparser',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'PyQt5', 'numpy', 'cv2', 'PIL'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)  # noqa: F821
exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='拾帧工具',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
