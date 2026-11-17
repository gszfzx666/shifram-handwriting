# -*- coding: utf-8 -*-
"""拾帧工具 · 手写文稿生成器 官网复刻版【桌面版】
   双击 exe → 释放内置资源 → 起本地 HTTP 服务 → 打开原生桌面窗口（WebView2）
   → 关窗口即退出。没有地址栏、没有浏览器标签，就是一台独立的软件。
   对方电脑无需 Python / Node / 浏览器插件；依赖系统自带 WebView2（Win10/11 预装）。"""
import os
import sys
import socket
import threading
import ctypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

if sys.platform == 'win32':
    try:
        ctypes.windll.kernel32.SetConsoleOutputCP(65001)
        ctypes.windll.kernel32.SetConsoleTitleW('拾帧工具')
    except Exception:
        pass
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def web_root():
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'web')
    base = os.path.dirname(os.path.abspath(__file__))
    w = os.path.join(base, 'web')
    return w if os.path.isdir(w) else base


ROOT = web_root()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.wasm.js') or path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.gz'):
            return 'application/gzip'
        if path.endswith('.ttf'):
            return 'font/ttf'
        return super().guess_type(path)


def pick_port(start=8765):
    for p in range(start, start + 40):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', p)); s.close(); return p
        except OSError:
            s.close()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    if not os.path.isdir(ROOT):
        print('资源目录缺失：' + ROOT)
        return 1
    port = pick_port()
    url = 'http://127.0.0.1:%d/index.html' % port
    httpd = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print('服务已启动：' + url)

    # WebView2 依赖检测：Windows 上必须有 WebView2 Runtime（Win10/11 多预装）。
    # 缺失时弹系统 MessageBox 给出下载地址，避免对方双击后白屏。
    if sys.platform == 'win32':
        wv2 = [
            os.path.join(os.environ.get('ProgramFiles(x86)', ''), 'Microsoft', 'EdgeWebView', 'Application'),
            os.path.join(os.environ.get('ProgramFiles', ''), 'Microsoft', 'EdgeWebView', 'Application'),
        ]
        if not any(os.path.isdir(p) and os.listdir(p) for p in wv2):
            try:
                ctypes.windll.user32.MessageBoxW(
                    0,
                    '本软件需要 WebView2 运行库（微软出品，免费）。\n\n'
                    '请打开下面的地址下载安装「Evergreen Runtime」，装好后重新双击本软件即可：\n\n'
                    'https://developer.microsoft.com/microsoft-edge/webview2/\n\n'
                    '（Windows 11 / 较新的 Windows 10 一般已自带，可忽略本提示）',
                    '拾帧工具 · 缺少运行库',
                    0x40,
                )
            except Exception:
                pass
            return 2

    import webview
    window = webview.create_window(
        '拾帧工具 · 手写文稿生成器',
        url,
        width=1440,
        height=960,
        min_size=(1024, 700),
        resizable=True,
        fullscreen=False,
        background_color='#F5F7FA',
        text_select=True,
        confirm_close=False,
    )
    # 用系统 WebView2（Windows 走 Edge Chromium），无需浏览器插件
    webview.start(gui='edgechromium' if sys.platform == 'win32' else None)
    httpd.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main())
