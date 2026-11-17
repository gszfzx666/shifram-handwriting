# -*- coding: utf-8 -*-
"""拾帧工具 · 手写文稿生成器 ZX 版 单文件启动器
   双击 exe → 释放内置资源 → 起本地 HTTP 服务 → 自动打开浏览器 → 关窗口即退出。
   对方电脑无需安装 Python / Node / 任何运行库，也不联网。"""
import os
import sys
import socket
import threading
import webbrowser
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
            s.bind(('127.0.0.1', p))
            s.close()
            return p
        except OSError:
            s.close()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def banner(url, port):
    line = '=' * 62
    print('')
    print(line)
    print('   拾帧工具 · 手写文稿生成器  官网复刻版')
    print(line)
    print('   状态   ：已启动，字体与纸张资源已就绪')
    print('   访问地址：' + url)
    print('   本机端口：' + str(port) + '（仅监听 127.0.0.1，不对外）')
    print('')
    print('   浏览器已自动打开。若没弹出，请手动复制上面的地址到浏览器。')
    print('')
    print('   · 首页 / 手写转换        index.html')
    print('   · 超级DIY 自定义背景     superdiy.html')
    print('   · 常见问题解答           guide.html')
    print('   · ZX 真迹字库扩充        zxtrain.html')
    print('')
    print('   使用完毕后，直接关闭本窗口即可退出；也可按 Q 再回车退出。')
    print(line)
    print('')


def main():
    if not os.path.isdir(ROOT):
        print('资源目录缺失：' + ROOT)
        try:
            input('按回车退出…')
        except Exception:
            pass
        return 1
    port = pick_port()
    url = 'http://127.0.0.1:%d/index.html' % port
    httpd = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    banner(url, port)
    if os.environ.get('HWZX_NO_BROWSER') != '1':
        try:
            webbrowser.open(url)
        except Exception:
            pass
    # 主线程常驻；只有用户输入 Q 或关闭窗口才退出。
    # stdin 不可用（重定向/后台）时保持服务运行，避免启动即退出。
    stop = threading.Event()

    def watcher():
        try:
            while not stop.is_set():
                v = input()
                if v.strip().lower() in ('q', 'quit', 'exit'):
                    stop.set()
                    return
                print('   输入 Q 回车退出；或关闭窗口。当前地址：' + url)
        except (EOFError, KeyboardInterrupt, OSError):
            return

    threading.Thread(target=watcher, daemon=True).start()
    try:
        stop.wait()
    except KeyboardInterrupt:
        pass
    httpd.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main())
