/* 超级DIY：上传背景 → 框选区域 → 逐区域填写 → 自动扩页 → 导出 */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const S = {
    bg: null, mmW: 210, mmH: 297,
    regions: [], pages: [], selecting: false,
    dragging: false, start: null, dispScale: 1,
    fontsReady: false, busy: false, seed: 20261115
  };

  function toast(msg, err) {
    const el = $('diyToast'); el.textContent = msg;
    el.className = 'toast on' + (err ? ' err' : '');
    setTimeout(function () { el.className = 'toast'; }, err ? 6000 : 3200);
  }
  function prog(p, text) {
    $('diyProgress').classList.toggle('on', p > 0 && p < 100);
    $('diyProgressBar').style.width = Math.max(0, Math.min(100, p)) + '%';
    if (text) $('diyStatus').textContent = text;
  }

  function fillFonts() {
    const sel = $('diyFont');
    HWFonts.GROUPS.forEach(function (g) {
      const og = document.createElement('optgroup'); og.label = g;
      HWFonts.LIST.filter(function (f) { return f.group === g; }).forEach(function (f) {
        const o = document.createElement('option'); o.value = f.id; o.textContent = f.label; og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.value = 'pingfang';
  }

  /* ---------- 背景载入 ---------- */
  function bindUpload() {
    const drop = $('diyDrop'), input = $('diyFile');
    drop.addEventListener('click', function () { input.click(); });
    ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
    input.addEventListener('change', function () { if (input.files[0]) load(input.files[0]); input.value = ''; });
  }

  async function load(file) {
    if (S.busy) return;
    S.busy = true; prog(5, '正在载入背景…');
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      let canvas;
      if (isPdf) {
        if (!window.pdfjsLib) throw new Error('pdf.js 未加载');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const page = await pdf.getPage(1);
        const vp0 = page.getViewport({ scale: 1 });
        const scale = Math.min(2.2, 1100 / vp0.width);
        const vp = page.getViewport({ scale: scale });
        canvas = document.createElement('canvas');
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        S.mmW = vp0.width / 72 * 25.4;
        S.mmH = vp0.height / 72 * 25.4;
        await pdf.destroy();
      } else {
        const url = URL.createObjectURL(file);
        const img = await new Promise(function (res, rej) {
          const im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = url;
        });
        const scale = Math.min(1, 1400 / img.width);
        canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        S.mmW = 210; S.mmH = 210 * canvas.height / canvas.width;
        URL.revokeObjectURL(url);
      }
      S.bg = canvas;
      S.regions = []; S.pages = [];
      $('diyFileList').innerHTML = '<div class="filetag"><span>📎 ' + file.name + '（' + canvas.width + '×' + canvas.height + '）</span></div>';
      showStage();
      renderRegions();
      prog(100, '背景已载入，可开始框选');
      setTimeout(function () { prog(0, '等待框选…'); }, 500);
      toast('背景载入成功，点击「开始框选」后拖出填写区域');
    } catch (e) {
      prog(0, '载入失败'); toast('背景载入失败：' + (e && e.message ? e.message : e), true);
    } finally { S.busy = false; }
  }

  function showStage() {
    const stage = $('diyStage'), cv = $('diyCanvas');
    const empty = stage.querySelector('.empty');
    if (empty) empty.style.display = 'none';
    cv.style.display = 'block';
    cv.width = S.bg.width; cv.height = S.bg.height;
    cv.getContext('2d').drawImage(S.bg, 0, 0);
    cv.classList.remove('selecting');
    S.dispScale = cv.clientWidth / cv.width || 1;
    $('diyStageTitle').textContent = '背景预览 / 框选区';
    updateRegionDOM();
  }

  /* ---------- 框选 ---------- */
  function bindSelect() {
    $('btnStartSelect').addEventListener('click', function () {
      if (!S.bg) { toast('请先上传背景文件', true); return; }
      showStage();
      S.selecting = true;
      $('diyCanvas').classList.add('selecting');
      toast('框选模式已开启：在图上按住鼠标拖出矩形');
      $('diyStatus').textContent = '框选模式：拖拽画区域';
    });
    $('btnClearRegions').addEventListener('click', function () {
      S.regions = []; S.pages = []; renderRegions(); updateRegionDOM();
      $('diyPages').textContent = '0 页';
    });
    $('btnDiyBack').addEventListener('click', function () { showStage(); });

    const cv = $('diyCanvas'), ov = $('diyOverlay');
    function local(e) {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) / (r.width / cv.width), y: (e.clientY - r.top) / (r.height / cv.height) };
    }
    cv.addEventListener('mousedown', function (e) {
      if (!S.selecting) return;
      e.preventDefault();
      S.dragging = true; S.start = local(e);
      ov.style.display = 'block';
      positionOverlay(S.start.x, S.start.y, 0, 0);
    });
    window.addEventListener('mousemove', function (e) {
      if (!S.dragging) return;
      const p = local(e);
      const x = Math.min(S.start.x, p.x), y = Math.min(S.start.y, p.y);
      positionOverlay(x, y, Math.abs(p.x - S.start.x), Math.abs(p.y - S.start.y));
    });
    window.addEventListener('mouseup', function (e) {
      if (!S.dragging) return;
      S.dragging = false;
      ov.style.display = 'none';
      const p = local(e);
      const x = Math.max(0, Math.min(S.start.x, p.x)), y = Math.max(0, Math.min(S.start.y, p.y));
      const w = Math.abs(p.x - S.start.x), h = Math.abs(p.y - S.start.y);
      if (w < 14 || h < 12) return;
      S.regions.push({
        x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
        text: '', fontId: $('diyFont').value, fontSize: parseFloat($('diyFontSize').value),
        color: $('diyColor').value, mode: $('diyMode').value, jitter: parseFloat($('diyJitter').value),
        rows: parseInt($('diyRows').value, 10) || 3, cols: parseInt($('diyCols').value, 10) || 6
      });
      renderRegions(); updateRegionDOM();
      toast('已添加区域 ' + S.regions.length + '，请在左侧填入文字');
    });
  }

  function positionOverlay(x, y, w, h) {
    const cv = $('diyCanvas'), ov = $('diyOverlay');
    const sc = cv.clientWidth / cv.width;
    ov.style.left = (cv.offsetLeft + x * sc) + 'px';
    ov.style.top = (cv.offsetTop + y * sc) + 'px';
    ov.style.width = (w * sc) + 'px';
    ov.style.height = (h * sc) + 'px';
  }

  function updateRegionDOM() {
    const box = $('diyRegions');
    box.innerHTML = '';
    if (!S.bg) return;
    const cv = $('diyCanvas'), sc = cv.clientWidth / cv.width;
    S.regions.forEach(function (r, i) {
      const d = document.createElement('div');
      d.className = 'region';
      d.style.left = (cv.offsetLeft + r.x * sc) + 'px';
      d.style.top = (cv.offsetTop + r.y * sc) + 'px';
      d.style.width = (r.w * sc) + 'px';
      d.style.height = (r.h * sc) + 'px';
      d.innerHTML = '<i>区域 ' + (i + 1) + '</i>';
      box.appendChild(d);
    });
  }
  window.addEventListener('resize', function () { if (S.bg) { S.dispScale = $('diyCanvas').clientWidth / S.bg.width; updateRegionDOM(); } });

  /* ---------- 区域列表 ---------- */
  function renderRegions() {
    $('diyRegionCount').textContent = S.regions.length + ' 个区域';
    const box = $('regionList');
    if (!S.regions.length) {
      box.innerHTML = '<p class="help">还没有区域。点击「开始框选」，然后在右侧底图上按住鼠标拖出一个矩形。</p>';
      return;
    }
    box.innerHTML = '';
    S.regions.forEach(function (r, i) {
      const d = document.createElement('div');
      d.className = 'regionitem'; d.dataset.i = i;
      const opts = HWFonts.LIST.map(function (f) {
        return '<option value="' + f.id + '"' + (f.id === r.fontId ? ' selected' : '') + '>' + f.label + '</option>';
      }).join('');
      d.innerHTML =
        '<div class="rh"><span>区域 ' + (i + 1) + '　' + r.w + '×' + r.h + ' px</span><button data-del="' + i + '">删除 ×</button></div>' +
        '<textarea data-f="text" placeholder="填入这一区域要写的文字…">' + escapeHtml(r.text) + '</textarea>' +
        '<div class="r2">' +
        '<select data-f="fontId">' + opts + '</select>' +
        '<select data-f="mode"><option value="flow"' + (r.mode === 'flow' ? ' selected' : '') + '>自定义背景（连续书写）</option><option value="table"' + (r.mode === 'table' ? ' selected' : '') + '>填表格（逐格填字）</option></select>' +
        '<input type="number" data-f="fontSize" value="' + r.fontSize + '" min="8" max="80" title="字号">' +
        '<input type="color" data-f="color" value="' + r.color + '" title="颜色">' +
        '<input type="number" data-f="rows" value="' + r.rows + '" min="1" max="60" title="行数">' +
        '<input type="number" data-f="cols" value="' + r.cols + '" min="1" max="60" title="列数">' +
        '</div>';
      box.appendChild(d);
    });
  }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function bindRegionList() {
    $('regionList').addEventListener('click', function (e) {
      const b = e.target.closest('button[data-del]');
      if (!b) return;
      S.regions.splice(parseInt(b.dataset.del, 10), 1);
      renderRegions(); updateRegionDOM();
    });
    $('regionList').addEventListener('input', regionChange);
    $('regionList').addEventListener('change', regionChange);
    ['diyFontSize', 'diyJitter'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        $('diyFsVal').textContent = $('diyFontSize').value + ' px';
        $('diyJitterVal').textContent = $('diyJitter').value + '%';
      });
    });
  }
  function regionChange(e) {
    const item = e.target.closest('.regionitem');
    if (!item) return;
    const i = parseInt(item.dataset.i, 10), f = e.target.dataset.f;
    if (!f || !S.regions[i]) return;
    const v = e.target.value;
    S.regions[i][f] = /^(fontSize|rows|cols|jitter)$/.test(f) ? parseFloat(v) : v;
  }

  /* ---------- 渲染 ---------- */
  function drawChar(ctx, ch, x, y, font, fs, color, jit, rnd) {
    if (ch === ' ' || ch === '\u3000') return;
    ctx.save();
    ctx.translate(x + (rnd() - 0.5) * fs * 0.34 * jit, y + (rnd() - 0.5) * fs * 0.28 * jit);
    ctx.rotate((rnd() - 0.5) * 0.22 * jit);
    ctx.globalAlpha = 0.82 + rnd() * 0.18;
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 0.3;
    ctx.fillText(ch, 0, 0);
    if (font.bold > 0) {
      ctx.lineWidth = 0.25 + font.bold * 0.3; ctx.strokeStyle = color; ctx.strokeText(ch, 0, 0);
    }
    ctx.restore();
  }

  function drawRegion(ctx, r, start, pageNo) {
    const font = HWFonts.get(r.fontId);
    const fs = r.fontSize || 22;
    const text = String(r.text || '').replace(/\r/g, '');
    const rnd = HWEngine.rng(S.seed + pageNo * 7919 + Math.round(r.x) * 31);
    const jit = (r.jitter || 0) / 100;
    let consumed = 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.font = HWEngine.fontString(font, fs);
    ctx.textBaseline = 'alphabetic';
    if (r.mode === 'table') {
      const cw = r.w / (r.cols || 1), chh = r.h / (r.rows || 1);
      outer:
      for (let row = 0; row < (r.rows || 1); row++) {
        for (let col = 0; col < (r.cols || 1); col++) {
          const idx = start + consumed;
          if (idx >= text.length) break outer;
          const ch = text[idx]; consumed++;
          if (ch === '\n') { col--; continue; }
          const w = ctx.measureText(ch).width;
          drawChar(ctx, ch, r.x + col * cw + (cw - w) / 2, r.y + row * chh + chh / 2 + fs * 0.34, font, fs, r.color, jit, rnd);
        }
      }
    } else {
      const lineH = fs * 1.5;
      let x = r.x + 2, y = r.y + fs * 0.95;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\n') {
          x = r.x + 2; y += lineH; consumed++;
          if (y > r.y + r.h + fs * 0.3) break;
          continue;
        }
        const w = ch === ' ' ? fs * 0.42 : ctx.measureText(ch).width;
        if (x + w > r.x + r.w - 2) {
          x = r.x + 2; y += lineH;
          if (y > r.y + r.h + fs * 0.3) break;
        }
        drawChar(ctx, ch, x, y, font, fs, r.color, jit, rnd);
        x += w + 0.6; consumed++;
      }
    }
    ctx.restore();
    return consumed;
  }

  function buildPages() {
    if (!S.bg) throw new Error('请先上传背景文件');
    if (!S.regions.length) throw new Error('请至少框选一个区域');
    const maxPages = parseInt($('diyMaxPages').value, 10) || 10;
    const cursors = S.regions.map(function () { return 0; });
    const total = S.regions.map(function (r) { return String(r.text || '').length; });
    const pages = [];
    for (let p = 0; p < maxPages; p++) {
      const c = document.createElement('canvas');
      c.width = S.bg.width; c.height = S.bg.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(S.bg, 0, 0);
      let any = false;
      S.regions.forEach(function (r, i) {
        if (cursors[i] >= total[i]) return;
        const used = drawRegion(ctx, r, cursors[i], p);
        cursors[i] += used;
        any = true;
      });
      pages.push(c);
      const left = cursors.some(function (v, i) { return v < total[i]; });
      if (!left || !any) break;
    }
    return pages;
  }

  function showPages(pages) {
    const stage = $('diyStage');
    Array.prototype.slice.call(stage.querySelectorAll('.tablepreview, .pvpage')).forEach(function (n) { stage.removeChild(n); });
    const box = document.createElement('div');
    box.className = 'tablepreview';
    box.style.width = '100%';
    pages.forEach(function (c, i) {
      const w = document.createElement('div');
      w.className = 'pvpage'; w.style.textAlign = 'center';
      const tag = document.createElement('div');
      tag.className = 'pgno'; tag.style.position = 'static'; tag.textContent = '第 ' + (i + 1) + ' / ' + pages.length + ' 页（预览已压缩）';
      c.style.maxWidth = '100%'; c.style.height = 'auto'; c.style.boxShadow = '0 6px 22px rgba(40,35,25,.22)';
      w.appendChild(tag); w.appendChild(c); box.appendChild(w);
    });
    $('diyCanvas').style.display = 'none';
    $('diyRegions').innerHTML = '';
    stage.appendChild(box);
    $('diyStageTitle').textContent = '转换结果预览';
    $('diyPages').textContent = pages.length + ' 页';
  }

  /* ---------- 按钮 ---------- */
  function bindActions() {
    $('btnDiyConvert').addEventListener('click', function () {
      if (!S.fontsReady) { toast('字体仍在加载，请稍候', true); return; }
      prog(10, '正在生成预览…');
      try {
        S.pages = buildPages();
        showPages(S.pages);
        prog(100, '预览生成完成');
        setTimeout(function () { prog(0, '共 ' + S.pages.length + ' 页，可下载'); }, 400);
        toast('已生成 ' + S.pages.length + ' 页预览，确认效果后点击「下载文件」');
      } catch (e) { prog(0, '生成失败'); toast(e.message, true); }
    });

    $('btnDiyDownload').addEventListener('click', async function () {
      if (S.busy) return;
      let pages = S.pages;
      if (!pages || !pages.length) {
        try { pages = buildPages(); S.pages = pages; showPages(pages); } catch (e) { toast(e.message, true); return; }
      }
      S.busy = true; prog(4, '正在生成高清文件…');
      const fmt = $('diyFormat').value;
      const base = ($('diyName').value || '超级DIY手写稿').replace(/[\\/:*?"<>|]/g, '_');
      try {
        if (fmt === 'png') {
          const blob = await HWExporter.toBlob(pages[0], 'image/png');
          HWExporter.download(blob, base + '_第01页.png');
        } else if (fmt === 'zip') {
          const zip = new JSZip();
          for (let i = 0; i < pages.length; i++) {
            prog(6 + (i / pages.length) * 80, '正在打包第 ' + (i + 1) + '/' + pages.length + ' 页…');
            zip.file(base + '_第' + String(i + 1).padStart(2, '0') + '页.png', await HWExporter.toBlob(pages[i], 'image/png'));
          }
          const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, function (m) { prog(88 + m.percent * 0.12, '正在打包 ZIP…'); });
          HWExporter.download(out, base + '.zip');
        } else {
          const imgs = [];
          for (let i = 0; i < pages.length; i++) {
            prog(6 + (i / pages.length) * 84, '正在合成 PDF 第 ' + (i + 1) + '/' + pages.length + ' 页…');
            const url = pages[i].toDataURL('image/jpeg', 0.92);
            const bin = atob(url.slice(url.indexOf(',') + 1));
            const bytes = new Uint8Array(bin.length);
            for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
            imgs.push({ width: pages[i].width, height: pages[i].height, bytes: bytes });
          }
          const blob = HWExporter.buildPDF(imgs, S.mmW, S.mmH);
          HWExporter.download(blob, base + '.pdf');
        }
        prog(100, '下载已开始');
        toast('文件已生成，按 Ctrl+J 查看下载记录');
      } catch (e) { toast('导出失败：' + e.message, true); prog(0, '导出失败'); }
      finally { S.busy = false; setTimeout(function () { prog(0, '就绪'); }, 700); }
    });
  }

  async function init() {
    if (location.protocol === 'file:') toast('请用 start.bat 启动后访问本页，file:// 下字体与 PDF 组件会被拦截', true);
    fillFonts();
    bindUpload();
    bindSelect();
    bindRegionList();
    bindActions();
    renderRegions();
    await HWFonts.preload(function (d, t) { $('diyStatus').textContent = '正在加载手写字体 ' + d + '/' + t + '…'; });
    if (window.HWZX) { try { await HWZX.load(); } catch (e) { } }
    S.fontsReady = true;
    $('diyStatus').textContent = '字体就绪 · 等待上传背景…';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
