/* 文件解析：Word(.docx) / PDF / 图片(OCR) / 纯文本 */
(function (global) {
  'use strict';

  function ext(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  async function parseDocx(file) {
    if (!global.JSZip) throw new Error('JSZip 未加载');
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('docx 内缺少 word/document.xml，请另存为标准 .docx');
    const xml = await entry.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const paras = doc.getElementsByTagNameNS(WNS, 'p');
    const out = [];
    for (let i = 0; i < paras.length; i++) {
      out.push(nodeText(paras[i], WNS));
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function nodeText(node, WNS) {
    let s = '';
    const walk = function (n) {
      for (let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i];
        if (c.nodeType !== 1) continue;
        if (c.namespaceURI !== WNS) { walk(c); continue; }
        const local = c.localName || c.nodeName.replace(/^.*:/, '');
        if (local === 't') s += c.textContent;
        else if (local === 'tab') s += '    ';
        else if (local === 'br' || local === 'cr') s += '\n';
        else if (local === 'noBreakHyphen') s += '-';
        else if (local === 'softHyphen') s += '';
        else if (local === 'instrText' || local === 'delText') { /* 忽略域代码与修订删除 */ }
        else walk(c);
      }
    };
    walk(node);
    return s;
  }

  async function parsePdf(file, onProgress) {
    if (!global.pdfjsLib) throw new Error('pdf.js 未加载');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const data = new Uint8Array(await file.arrayBuffer());
    const task = pdfjsLib.getDocument({ data: data, useSystemFonts: true });
    const pdf = await task.promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      if (onProgress) onProgress('正在提取 PDF 第 ' + p + '/' + pdf.numPages + ' 页文字', p / pdf.numPages * 100);
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent({ normalizeWhitespace: false });
      const items = tc.items.filter(function (it) { return it.str && it.str.length; });
      items.sort(function (a, b) {
        const ay = -a.transform[5], by = -b.transform[5];
        if (Math.abs(ay - by) > 3) return ay - by;
        return a.transform[4] - b.transform[4];
      });
      let row = [], lastY = null, lastX = null, lastW = 0;
      const pageLines = [];
      items.forEach(function (it) {
        const y = -it.transform[5], x = it.transform[4];
        if (lastY != null && Math.abs(y - lastY) > 4) {
          pageLines.push(row.join('')); row = []; lastX = null; lastW = 0;
        }
        if (lastX != null && x - (lastX + lastW) > 2.2) row.push(' ');
        row.push(it.str);
        lastY = y; lastX = x; lastW = it.width || it.str.length * 6;
      });
      if (row.length) pageLines.push(row.join(''));
      lines.push(pageLines.join('\n'));
    }
    await pdf.destroy();
    return lines.join('\n\n');
  }

  async function parseImage(file, onProgress) {
    if (!global.Tesseract) throw new Error('OCR 组件未加载，请在「仅输入文字」中粘贴文字');
    if (onProgress) onProgress('正在加载 OCR 引擎与中英文语言包…', 5);
    let worker;
    const opts = {
      workerPath: 'vendor/worker.min.js',
      corePath: 'vendor/tesseract-core-simd-lstm.wasm.js',
      langPath: 'vendor/lang',
      gzip: true,
      logger: function (m) {
        if (m.status === 'recognizing text' && onProgress) onProgress('正在识别图片文字…', 20 + (m.progress || 0) * 75);
        else if (onProgress && m.status) onProgress('OCR：' + m.status, 10 + (m.progress || 0) * 10);
      }
    };
    try {
      worker = await Tesseract.createWorker('chi_sim+eng', 1, opts);
    } catch (e) {
      opts.corePath = 'vendor/';
      worker = await Tesseract.createWorker('chi_sim+eng', 1, opts);
    }
    const res = await worker.recognize(file);
    await worker.terminate();
    const text = (res && res.data && res.data.text || '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) throw new Error('图片中未识别到文字，请把图片作为「自定义纸张背景」使用，或直接粘贴文字');
    return text;
  }

  async function parseText(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (/\ufffd/.test(text)) {
      try { text = new TextDecoder('gbk').decode(buf); } catch (e) { }
    }
    return text;
  }

  async function parse(file, onProgress) {
    const e = ext(file.name);
    let text = '', kind = e;
    if (e === 'docx') { text = await parseDocx(file); }
    else if (e === 'pdf') { text = await parsePdf(file, onProgress); }
    else if (/^(png|jpe?g|webp|bmp|gif|tiff?)$/.test(e) || /^image\//.test(file.type)) { text = await parseImage(file, onProgress); }
    else if (e === 'doc') {
      text = await parseText(file).catch(function () { return ''; });
      text = (text.match(/[\u4e00-\u9fa5a-zA-Z0-9，。！？；：、\s]{2,}/g) || []).join('\n');
      if (!text) throw new Error('.doc 为老式二进制格式，请另存为 .docx 后重新上传');
    } else {
      text = await parseText(file);
    }
    return { text: text, name: file.name, kind: e, size: file.size, pages: 0 };
  }

  global.HWParser = { parse: parse, ext: ext, parsePdf: parsePdf, parseImage: parseImage };
})(window);
