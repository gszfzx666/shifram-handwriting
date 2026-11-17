/* 主控：UI 绑定、参数收集、预览、下载 */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const state = {
    tab: 'file',
    fileName: '',
    customImage: null,
    layout: null,
    page: 0,
    showAll: false,
    scale: 0.65,
    busy: false,
    fontsReady: false
  };

  let toastTimer = null;
  function toast(msg, err) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, err ? 6000 : 3200);
  }
  function setProgress(pct, text) {
    $('progress').classList.toggle('on', pct > 0 && pct < 100);
    $('progressBar').style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (text) $('statusLeft').textContent = text;
  }
  function setStatus(l, r) {
    if (l != null) $('statusLeft').textContent = l;
    if (r != null) $('statusRight').textContent = r;
  }

  /* ---------- 下拉框填充 ---------- */
  function fillSelects() {
    const fs = $('fontSel');
    HWFonts.GROUPS.forEach(function (g) {
      const og = document.createElement('optgroup'); og.label = g;
      HWFonts.LIST.filter(function (f) { return f.group === g; }).forEach(function (f) {
        const o = document.createElement('option'); o.value = f.id; o.textContent = f.label; og.appendChild(o);
      });
      fs.appendChild(og);
    });
    fs.value = 'pingfang';
    $('fontCount').textContent = HWFonts.LIST.length + ' 款可选';

    const ps = $('paperSel');
    HWPapers.GROUPS.forEach(function (g) {
      const og = document.createElement('optgroup'); og.label = g;
      HWPapers.LIST.filter(function (p) { return p.group === g; }).forEach(function (p) {
        const o = document.createElement('option'); o.value = p.key; o.textContent = p.label; og.appendChild(o);
      });
      ps.appendChild(og);
    });
    ps.value = 'photo-redline';

    const ts = $('aiTopic');
    HWAI.TOPICS.forEach(function (t) {
      const o = document.createElement('option'); o.value = t.id; o.textContent = t.label; ts.appendChild(o);
    });
  }

  /* ---------- 参数 ---------- */
  function num(id) { return parseFloat($(id).value); }
  function collectSettings() {
    const paperKey = $('paperSel').value;
    const p = HWPapers.get(paperKey);
    const delta = num('marginVal');
    const s = {
      fontId: $('fontSel').value,
      paperKey: paperKey,
      fontSize: num('fontSize'),
      lineHeight: num('lineHeight'),
      letterSpacing: num('letterSpacing'),
      paragraphIndent: num('paragraphIndent'),
      align: $('alignSel').value,
      color: $('colorPicker').value,
      penColor: $('chkRedPen').checked ? '#b03a2e' : $('penPicker').value,
      scribble: num('scribble'),
      posJitter: num('posJitter'),
      strokeJitter: num('strokeJitter'),
      baseline: num('baseline'),
      inkVariance: num('inkVariance'),
      natural: num('natural'),
      inkFeel: num('inkFeel'),
      seed: (parseInt($('seed').value, 10) || 20261115) >>> 0,
      maxPages: parseInt($('maxPages').value, 10) || 12,
      autoFontSize: $('chkAutoFontSize').checked,
      alignToRuling: $('chkAlignToRuling').checked,
      showPageNo: $('chkShowPageNo').checked,
      strictGlyph: $('chkStrictGlyph').checked,
      noIndent: false,
      marginOverride: delta > 0 ? {
        l: p.margin.l + delta, r: p.margin.r + delta,
        t: p.margin.t + delta, b: p.margin.b + delta
      } : null
    };
    return s;
  }

  function getText() { return $('textInput').value || ''; }
  function setText(t) {
    $('textInput').value = t;
    updateWordCount();
  }
  function updateWordCount() {
    const t = getText().replace(/\s/g, '');
    $('wordCount').textContent = t.length + ' 字';
  }

  /* ---------- Tab ---------- */
  function bindTabs() {
    $('tabs').addEventListener('click', function (e) {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      state.tab = b.dataset.tab;
      Array.prototype.forEach.call($('tabs').children, function (x) { x.classList.toggle('on', x === b); });
      ['file', 'text', 'ai'].forEach(function (k) { $('pane-' + k).classList.toggle('on', k === state.tab); });
    });
  }

  /* ---------- 文件上传 ---------- */
  function bindUpload() {
    const drop = $('dropZone'), input = $('fileInput');
    drop.addEventListener('click', function () { input.click(); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
      input.value = '';
    });
    $('fileList').addEventListener('click', function (e) {
      if (e.target.dataset.clear != null) {
        state.fileName = '';
        renderFileList();
      }
    });
  }

  function renderFileList() {
    const el = $('fileList');
    if (!state.fileName) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="filetag"><span>📎 ' + escapeHtml(state.fileName) + '</span><b data-clear="1" title="清除">×</b></div>';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  async function handleFile(file) {
    if (state.busy) { toast('正在处理上一个任务，请稍候'); return; }
    state.busy = true;
    setProgress(3, '正在解析 ' + file.name + ' …');
    try {
      const res = await HWParser.parse(file, function (msg, pct) { setProgress(pct || 5, msg); });
      if (!res.text || !res.text.trim()) throw new Error('未从文件中提取到文字');
      state.fileName = file.name + '（' + res.text.replace(/\s/g, '').length + ' 字）';
      renderFileList();
      setText(res.text);
      setProgress(100, '解析完成');
      toast('已提取 ' + res.text.replace(/\s/g, '').length + ' 字，可在「仅输入文字」中修改');
      setTimeout(function () { setProgress(0, '就绪 · 点击预览查看效果'); }, 300);
      schedulePreview(200);
    } catch (e) {
      setProgress(0, '解析失败');
      toast('解析失败：' + (e && e.message ? e.message : e), true);
    } finally {
      state.busy = false;
    }
  }

  /* ---------- 自定义背景 ---------- */
  function bindCustomBg() {
    $('paperSel').addEventListener('change', function () {
      $('customBgRow').style.display = $('paperSel').value === 'custom' ? '' : 'none';
    });
    $('customBgInput').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = function () {
        state.customImage = img;
        toast('自定义背景已载入：' + img.width + '×' + img.height);
        schedulePreview(150);
      };
      img.onerror = function () { toast('背景图片读取失败', true); };
      img.src = url;
    });
  }

  /* ---------- AI ---------- */
  function bindAI() {
    $('aiWords').addEventListener('input', function () { $('aiWordsVal').textContent = this.value + ' 字'; });
    $('btnAiGen').addEventListener('click', async function () {
      const topic = $('aiTopic').value, subject = $('aiSubject').value.trim(), words = num('aiWords');
      const cfg = getApiCfg();
      if (cfg.url && cfg.key) {
        setProgress(10, '正在调用大模型生成文章…');
        try {
          const prompt = '请写一篇「' + (HWAI.TOPICS.filter(function (t) { return t.id === topic; })[0] || {}).label + '」' +
            (subject ? '，主题是「' + subject + '」' : '') + '，约 ' + words + ' 字，分 4—6 个自然段，语言自然，适合手抄。';
          const t = await HWAI.apiGenerate(cfg, prompt, function (m, p) { setProgress(p, m); });
          setText(t); switchToText(); toast('已生成并填入文字框'); schedulePreview(200);
        } catch (e) { toast('接口调用失败，已改用本地写作引擎：' + e.message, true); localGenerate(topic, subject, words); }
        finally { setProgress(0, '就绪'); }
      } else localGenerate(topic, subject, words);
    });
    $('btnAiPolish').addEventListener('click', function () {
      if (!getText().trim()) { toast('文字框是空的', true); return; }
      setText(HWAI.polish(getText())); switchToText(); toast('润色完成'); schedulePreview(200);
    });
    $('btnAiContinue').addEventListener('click', function () {
      if (!getText().trim()) { toast('文字框是空的', true); return; }
      setText(HWAI.continueText(getText(), num('aiWords'))); switchToText(); toast('续写完成'); schedulePreview(200);
    });
  }
  function getApiCfg() {
    return { url: $('aiUrl').value.trim(), key: $('aiKey').value.trim(), model: $('aiModel').value.trim() };
  }
  function localGenerate(topic, subject, words) {
    setText(HWAI.generate(topic, subject, words));
    switchToText();
    toast('已用内置写作引擎生成文章（离线可用）');
    schedulePreview(200);
  }
  function switchToText() {
    const b = $('tabs').querySelector('button[data-tab="text"]');
    b.click();
  }

  /* ---------- 滑块联动 ---------- */
  const BINDS = [
    ['fontSize', 'fontSizeVal', function (v) { return v + ' px'; }],
    ['lineHeight', 'lineHeightVal', function (v) { return v + ' 倍'; }],
    ['letterSpacing', 'letterSpacingVal', function (v) { return v + ' px'; }],
    ['marginVal', 'marginValVal', function (v) { return v > 0 ? '+ ' + v + ' px' : '按纸张默认'; }],
    ['scribble', 'scribbleVal', function (v) { return v + '%'; }],
    ['posJitter', 'posJitterVal', function (v) { return v + '%'; }],
    ['strokeJitter', 'strokeJitterVal', function (v) { return v + '%'; }],
    ['baseline', 'baselineVal', function (v) { return v + '%'; }],
    ['inkVariance', 'inkVal', function (v) { return v + '%'; }],
    ['natural', 'naturalVal', function (v) { return v + '%'; }],
    ['inkFeel', 'inkFeelVal', function (v) { return v + '%'; }],
    ['paragraphIndent', 'indentVal', function (v) { return v; }]
  ];
  let previewTimer = null;
  function schedulePreview(delay) {
    clearTimeout(previewTimer);
    if (!state.fontsReady) return;
    previewTimer = setTimeout(function () { doPreview(true); }, delay == null ? 380 : delay);
  }
  function bindRanges() {
    BINDS.forEach(function (b) {
      const el = $(b[0]), out = $(b[1]);
      const upd = function () { out.textContent = b[2](el.value); };
      el.addEventListener('input', function () { upd(); schedulePreview(); });
      upd();
    });
    ['fontSel', 'paperSel', 'alignSel', 'maxPages', 'colorPicker', 'penPicker'].forEach(function (id) {
      $(id).addEventListener('change', function () { schedulePreview(120); });
    });
    ['chkAutoFontSize', 'chkAlignToRuling', 'chkShowPageNo', 'chkStrictGlyph', 'chkRedPen'].forEach(function (id) {
      $(id).addEventListener('change', function () { schedulePreview(120); });
    });
    $('seed').addEventListener('change', function () { schedulePreview(120); });
    $('btnNewSeed').addEventListener('click', function () {
      $('seed').value = Math.floor(Math.random() * 90000000) + 10000000;
      schedulePreview(80);
      toast('已更换随机笔迹种子：' + $('seed').value);
    });
    $('textInput').addEventListener('input', function () { updateWordCount(); schedulePreview(700); });
    $('btnSample').addEventListener('click', function () { setText(HWAI.SAMPLE); toast('已填入示例文本'); schedulePreview(120); });
    $('btnClearText').addEventListener('click', function () { setText(''); schedulePreview(120); });
  }

  /* ---------- 预览 ---------- */
  async function buildLayout(silent) {
    const text = getText();
    if (!text.trim()) {
      if (!silent) toast('请先上传文件或输入文字', true);
      return null;
    }
    const settings = collectSettings();
    const layout = HWEngine.buildLayout({ text: text, settings: settings });
    state.layout = layout;
    return layout;
  }

  async function doPreview(silent) {
    if (state.busy) return;
    const layout = await buildLayout(silent);
    if (!layout) return;
    state.layout = layout;
    const total = layout.pages.length;
    if (state.page >= total) state.page = 0;
    updateJump(total);

    const indices = state.showAll
      ? Array.from({ length: total }, function (_, i) { return i; })
      : [state.page];
    const body = $('pvBody');
    $('pvEmpty').style.display = 'none';
    Array.prototype.slice.call(body.querySelectorAll('.pvpage')).forEach(function (n) { body.removeChild(n); });

    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const c = HWEngine.renderPage(layout, i, 100, {
        customImage: state.customImage
      });
      c.style.width = Math.round(c.width * state.scale) + 'px';
      const wrap = document.createElement('div');
      wrap.className = 'pvpage';
      wrap.dataset.page = i;
      const tag = document.createElement('div');
      tag.className = 'pgno';
      tag.textContent = '第 ' + (i + 1) + ' / ' + total + ' 页　100dpi 预览';
      wrap.appendChild(tag);
      wrap.appendChild(c);
      body.appendChild(wrap);
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    setStatus(
      '预览完成 · ' + HWFonts.get($('fontSel').value).label + ' · ' + HWPapers.get($('paperSel').value).label,
      total + ' 页 / ' + layout.totalChars + ' 字' + (layout.truncated ? ' · 已截断至 ' + $('maxPages').value + ' 页' : '')
    );
    if (layout.truncated && !silent) toast('内容超过单次 ' + $('maxPages').value + ' 页上限，已截断。可在输出设置里提高上限。', true);
  }

  function updateJump(total) {
    const sel = $('pvJump');
    sel.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const o = document.createElement('option'); o.value = i; o.textContent = '第 ' + (i + 1) + ' 页'; sel.appendChild(o);
    }
    sel.value = state.page;
  }

  function bindPreviewTools() {
    $('btnPreview').addEventListener('click', function () { doPreview(false); });
    $('btnRefresh').addEventListener('click', function () { doPreview(false); toast('已按当前参数重新生成'); });
    $('pvJump').addEventListener('change', function () {
      state.page = parseInt(this.value, 10) || 0;
      state.showAll = false;
      doPreview(true);
      setTimeout(function () {
        const n = $('pvBody').querySelector('.pvpage');
        if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });
    $('pvScale').addEventListener('change', function () {
      state.scale = parseFloat(this.value) || 0.65;
      Array.prototype.forEach.call($('pvBody').querySelectorAll('canvas'), function (c) {
        c.style.width = Math.round(c.width * state.scale) + 'px';
      });
    });
    $('btnPreviewAll').addEventListener('click', function () {
      state.showAll = !state.showAll;
      this.textContent = state.showAll ? '只看当前页' : '显示所有页';
      doPreview(true);
    });
  }

  /* ---------- 下载 ---------- */
  function safeName() {
    return ($('outName').value || '我的手写稿').replace(/[\\/:*?"<>|]/g, '_').trim() || '我的手写稿';
  }
  function bindDownload() {
    $('btnDownload').addEventListener('click', async function () {
      if (state.busy) return;
      let layout = state.layout;
      if (!layout) { layout = await buildLayout(false); if (!layout) return; }
      state.busy = true;
      const btn = this; btn.disabled = true;
      setProgress(2, '正在生成高清文件…');
      try {
        const opts = {
          layout: layout,
          format: $('outFormat').value,
          dpi: parseInt($('outDpi').value, 10) || 600,
          pageIndex: state.page,
          filename: safeName(),
          customImage: state.customImage,
          quality: 0.92,
          onProgress: function (msg, pct) { setProgress(pct, msg); }
        };
        await HWExporter.run(opts);
        setProgress(100, '下载已开始');
        toast('已生成 ' + (opts.format === 'zip' ? 'ZIP 高清图片包' : opts.format === 'pdf' ? '高清 PDF' : 'PNG 单页') + '，按 Ctrl+J 查看下载记录');
      } catch (e) {
        toast('导出失败：' + (e && e.message ? e.message : e), true);
        setProgress(0, '导出失败');
      } finally {
        setTimeout(function () { setProgress(0, '就绪'); }, 900);
        btn.disabled = false;
        state.busy = false;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); doPreview(false); }
    });
  }

  /* ---------- 启动 ---------- */
  async function init() {
    if (location.protocol === 'file:') {
      toast('检测到以 file:// 直接打开：浏览器会拦截字体与 PDF/OCR 组件，请双击 start.bat 启动后使用', true);
    }
    fillSelects();
    bindTabs();
    bindUpload();
    bindCustomBg();
    bindAI();
    bindRanges();
    bindPreviewTools();
    bindDownload();
    setText(HWAI.SAMPLE);
    updateWordCount();
    setStatus('正在加载手写字体…', '0 页 / 0 字');

    const zxTask = (window.HWZX ? HWZX.load() : Promise.resolve(null)).catch(function () { return null; });
    await HWFonts.preload(function (done, total, fam) {
      setStatus('正在加载手写字体 ' + done + '/' + total + '（' + fam + '）…', '');
    });
    await zxTask;
    state.fontsReady = true;
    const zs = window.HWZX ? HWZX.stats() : null;
    setStatus('字体就绪 · zx 真迹 ' + (zs ? (zs.officialChars + zs.userChars) : 0) + ' 字 / '
      + (zs ? (zs.officialVariants + zs.userVariants) : 0) + ' 个笔迹变体 · 点击「预览」或改参数自动生成', '');
    doPreview(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
