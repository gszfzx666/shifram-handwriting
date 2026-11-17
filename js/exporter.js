/* 导出：100dpi 预览 / 600dpi 高清 PNG / 多页 ZIP / 高清 PDF */
(function (global) {
  'use strict';

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
  }

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      try { canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('图像编码失败')); }, type, quality); }
      catch (e) { reject(e); }
    });
  }

  function release(canvas) { try { canvas.width = 1; canvas.height = 1; } catch (e) { } }

  function pageName(base, i, total, extn) {
    return base + (total > 1 ? '_第' + String(i + 1).padStart(2, '0') + '页' : '') + '.' + extn;
  }

  async function renderPreviews(layout, dpi, customImage, maxPages, watermark, bgImage) {
    const n = Math.min(layout.pages.length, maxPages || layout.pages.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(HWEngine.renderPage(layout, i, dpi || 100, { customImage: customImage, bgImage: bgImage, watermark: watermark }));
    }
    return out;
  }

  async function exportPNG(layout, i, opts) {
    opts = opts || {};
    const canvas = HWEngine.renderPage(layout, i, opts.dpi || 600, { customImage: opts.customImage, bgImage: opts.bgImage });
    const blob = await toBlob(canvas, 'image/png');
    download(blob, pageName(opts.filename || '手写稿', i, layout.pages.length, 'png'));
    release(canvas);
  }

  async function exportZIP(layout, opts) {
    opts = opts || {};
    if (!global.JSZip) throw new Error('JSZip 未加载');
    const zip = new JSZip();
    const total = layout.pages.length;
    for (let i = 0; i < total; i++) {
      if (opts.onProgress) opts.onProgress('正在生成第 ' + (i + 1) + '/' + total + ' 页高清图…', (i / total) * 78);
      const canvas = HWEngine.renderPage(layout, i, opts.dpi || 600, { customImage: opts.customImage, bgImage: opts.bgImage });
      const blob = await toBlob(canvas, 'image/png');
      zip.file(pageName(opts.filename || '手写稿', i, total, 'png'), blob);
      release(canvas);
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    if (opts.onProgress) opts.onProgress('正在打包 ZIP…', 80);
    const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, function (meta) {
      if (opts.onProgress) opts.onProgress('正在打包 ZIP…', 80 + meta.percent * 0.2);
    });
    download(out, (opts.filename || '手写稿') + '.zip');
  }

  function strBytes(s) {
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255;
    return a;
  }

  function jpegBytes(dataURL) {
    const b64 = dataURL.slice(dataURL.indexOf(',') + 1);
    const bin = atob(b64);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }

  /* 最小 PDF 1.4 写入器：每页一张 DCTDecode(JPEG) 图像，物理尺寸按纸张 mm 换算为 pt */
  function buildPDF(images, mmW, mmH) {
    const chunks = [];
    let len = 0;
    const offsets = [];
    function push(b) { chunks.push(b); len += b.length; }
    function pushS(s) { push(strBytes(s)); }
    function obj(n, head, stream) {
      offsets[n] = len;
      pushS(n + ' 0 obj\n' + head + '\n');
      if (stream) {
        pushS('stream\n');
        push(stream);
        pushS('\nendstream\n');
      }
      pushS('endobj\n');
    }
    const N = images.length;
    const pw = (mmW / 25.4 * 72).toFixed(2);
    const ph = (mmH / 25.4 * 72).toFixed(2);

    pushS('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = [];
    for (let i = 0; i < N; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + N + ' >>');

    for (let i = 0; i < N; i++) {
      const im = images[i];
      const pageObj = 3 + i * 3, contentObj = pageObj + 1, imageObj = pageObj + 2;
      obj(pageObj, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] ' +
        '/Resources << /XObject << /Im0 ' + imageObj + ' 0 R >> /ProcSet [/PDF /ImageC] >> ' +
        '/Contents ' + contentObj + ' 0 R >>');
      const cmds = 'q\n' + pw + ' 0 0 ' + ph + ' 0 0 cm\n/Im0 Do\nQ\n';
      obj(contentObj, '<< /Length ' + cmds.length + ' >>', strBytes(cmds));
      obj(imageObj, '<< /Type /XObject /Subtype /Image /Width ' + im.width + ' /Height ' + im.height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>', im.bytes);
    }

    const xref = len;
    const maxObj = 2 + N * 3;
    pushS('xref\n0 ' + (maxObj + 1) + '\n');
    pushS('0000000000 65535 f \n');
    for (let n = 1; n <= maxObj; n++) {
      pushS(String(offsets[n] || 0).padStart(10, '0') + ' 00000 n \n');
    }
    pushS('trailer\n<< /Size ' + (maxObj + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function exportPDF(layout, opts) {
    opts = opts || {};
    const images = [];
    const total = layout.pages.length;
    for (let i = 0; i < total; i++) {
      if (opts.onProgress) opts.onProgress('正在生成第 ' + (i + 1) + '/' + total + ' 页高清图…', (i / total) * 88);
      const canvas = HWEngine.renderPage(layout, i, opts.dpi || 600, { customImage: opts.customImage, bgImage: opts.bgImage });
      const url = canvas.toDataURL('image/jpeg', opts.quality || 0.92);
      images.push({ width: canvas.width, height: canvas.height, bytes: jpegBytes(url) });
      release(canvas);
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    if (opts.onProgress) opts.onProgress('正在合成 PDF…', 92);
    const blob = buildPDF(images, layout.paper.mmW, layout.paper.mmH);
    download(blob, (opts.filename || '手写稿') + '.pdf');
  }

  async function run(opts) {
    const f = opts.format || 'zip';
    if (f === 'png') return exportPNG(opts.layout, opts.pageIndex || 0, opts);
    if (f === 'pdf') return exportPDF(opts.layout, opts);
    return exportZIP(opts.layout, opts);
  }

  global.HWExporter = {
    run: run,
    download: download,
    renderPreviews: renderPreviews,
    exportPNG: exportPNG,
    exportZIP: exportZIP,
    exportPDF: exportPDF,
    buildPDF: buildPDF,
    toBlob: toBlob
  };
})(window);
