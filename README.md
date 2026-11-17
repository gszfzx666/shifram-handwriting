# 拾帧工具 · 手写文稿生成器

一款完全本地运行的手写文稿生成工具：把 Word / PDF / 图片 / 纯文字，转换成逼真的手写稿图片，可导出 PNG / PDF / ZIP。全程在浏览器内完成，**不联网、不上传任何文字**，无水印。

## ✨ 功能

- **文档转手写**：上传 `.docx` / `.pdf` / 图片（自动 OCR）/ 直接粘贴文字，一键转手写稿。
- **40+ 手写字体**：中文、繁体、日文、韩文、英文多种风格；包含从官网渲染结果逐字逆向的手写字形库。
- **实拍纸张背景**：红格子稿纸、单红线信纸、草稿纸等实拍纹理，以及 A4/B5/A3 600dpi 可打印版。
- **真实手写细节**：文字位置凌乱、笔画抖动、基线波动、墨色浓淡、随机勾画涂改、书写自然度。
- **ZX 真迹字库**：可上传自己的手写照片，训练专属手写字体（样本仅存本地浏览器）。
- **超级 DIY**：上传自己的稿纸/表格，框选区域逐块填写，支持自动扩页。
- **双版本**：桌面版（原生窗口，双击即用）与浏览器版。

## 🚀 运行

**桌面版**：双击 `拾帧工具.exe`，弹出独立软件窗口即可使用（需 Windows 10/11 64 位，自带或安装 WebView2 运行库）。

**源码版**（需 Python 3）：

```bash
python -m http.server 8765
```

浏览器打开 `http://127.0.0.1:8765/`。

> 请勿直接双击 `index.html`（`file://` 协议下浏览器会拦截字体与 OCR/PDF 组件）。

**重新打包 exe**（需 PyInstaller）：

```bash
pip install pyinstaller pywebview
python -m PyInstaller app_desktop.spec --noconfirm   # 桌面版
python -m PyInstaller app.spec --noconfirm           # 浏览器版
```

## 🧩 技术栈

纯前端 Canvas 渲染（HTML/CSS/JS），无后端。核心模块：

| 文件 | 作用 |
|---|---|
| `js/engine.js` | 排版与字形渲染引擎 |
| `js/fonts.js` | 字体定义与加载 |
| `js/papers.js` | 纸张背景绘制 |
| `js/parser.js` | Word/PDF/图片/OCR 解析 |
| `js/exporter.js` | PNG/PDF/ZIP 导出 |
| `js/zx.js` | 真迹字库渲染 |
| `app_official.js` | 界面交互适配层 |
| `launcher_desktop.py` | 桌面版原生窗口启动器（pywebview + WebView2） |

## ⚖️ 说明

- 本项目为个人学习与本地使用目的开源。
- 内置字体中，`zx.ttf` 及真迹字库由个人手写样本生成；部分手写字体来自公开可获取的开源字体；`official_recon.ttf` 为对渲染结果的字形逆向研究产物。
- 原始手写照片、字库中间数据等隐私文件已通过 `.gitignore` 排除，不会进入本仓库。
- 生成的手写稿仅供个人合法使用。

## 📄 License

MIT License — 详见 [LICENSE](LICENSE)。
