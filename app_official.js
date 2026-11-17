/* 官网一比一复刻 · 适配层：把官网 DOM 控件接到本地渲染引擎 */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  // 官网字体 value -> 本地 fonts.js 的 id
  var FONT_MAP = {
    '0': 'likelike', '7': 'official', '12': 'yingbi', '4': 'xinnian',
    '6': 'shouxieti1', '14': 'real2', '15': 'real3', '1015': 'real3b',
    '16': 'real4', '1016': 'real4b', '8': 'wangqiang', '1': 'ximaixihuan',
    '2': 'chillzhuopig', '3': 'likelike', '17': 'real5', '1017': 'real5b',
    '18': 'real6', '1018': 'real6b', '19': 'real7', '1019': 'real7b',
    '20': 'real8', '1020': 'real8b', '21': 'real9', '1021': 'real9b',
    '22': 'real10', '1022': 'real10b', '23': 'real11', '1023': 'real11b',
    '24': 'real12', '1024': 'real12b', '13': 'fanti', '9': 'riwen',
    '10': 'hanwen', '25': 'en_caveat'
  };
  // 官网纸张 value -> 本地 papers.js 的 key
  var PAPER_MAP = {
    '41': 'photo-redgrid', '42': 'print-blackgrid', '43': 'print-redgrid',
    '20': 'photo-redline', '30': 'print-redline-new', '0': 'photo-draft',
    '1': 'print-a4-v', '2': 'print-a4-h', '3': 'print-b5-v', '4': 'print-b5-h',
    '5': 'print-a3-v', '6': 'print-a3-h', '22': 'print-redline-old'
  };

  // 官网实拍纸张背景图（从官网渲染接口提取的纯纸张）
  var PAPER_BG = {
    'photo-redline': 'paper_bg/real-redline.webp',
    'photo-redgrid': 'paper_bg/real-redgrid.webp',
    'print-redgrid': 'paper_bg/real-print-redgrid.webp',
    'photo-draft': 'paper_bg/real-draft.webp'
  };
  var _bgCache = {};
  function loadPaperBg(key) {
    var url = PAPER_BG[key];
    if (!url) return Promise.resolve(null);
    if (_bgCache[url]) return _bgCache[url];
    _bgCache[url] = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = url;
    });
    return _bgCache[url];
  }

  var state = { text: '', layout: null, page: 0, busy: false, bg: null };

  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._tm); t._tm = setTimeout(function () { t.style.display = 'none'; }, 2600);
  }

  function collect() {
    var fontSel = $('#font-select'), paperSel = $('#paper-select');
    var fid = FONT_MAP[fontSel ? fontSel.value : '0'] || 'pingfang';
    var pk = PAPER_MAP[paperSel ? paperSel.value : '0'] || 'photo-redline';
    var v = function (id) { var e = $(id); return e ? parseFloat(e.value) || 0 : 0; };
    return {
      fontId: fid,
      paperKey: pk,
      fontSize: pk === 'photo-redline' ? 31 : 22,
      lineHeight: 1.9,
      letterSpacing: 0,
      paragraphIndent: 2,
      align: 'left',
      color: '#1a1a1a',
      penColor: '#1a1a1a',
      scribble: v('#mistake-rate'),
      posJitter: v('#messy-ratio'),
      strokeJitter: v('#char-random'),
      baseline: 2,
      inkVariance: 8,
      natural: 45,
      inkFeel: 45,
      seed: 20261115,
      maxPages: 12,
      autoFontSize: true,
      alignToRuling: pk === 'photo-redline',
      showPageNo: false,
      strictGlyph: false,
      noIndent: false,
      marginOverride: null
    };
  }

  function showPreview(layout) {
    var box = $('.preview-container'); if (!box) return;
    Array.prototype.slice.call(box.querySelectorAll('canvas,.pv-wrap,.file-info')).forEach(function (n) { box.removeChild(n); });
    var ph = box.querySelector('.preview-placeholder'); if (ph) ph.style.display = 'none';
    var total = layout.pages.length;
    for (var i = 0; i < total; i++) {
      var wrap = document.createElement('div'); wrap.className = 'pv-wrap';
      wrap.style.margin = '0 auto 16px'; wrap.style.textAlign = 'center';
      var tag = document.createElement('div');
      tag.className = 'file-info';
      tag.textContent = '第 ' + (i + 1) + ' / ' + total + ' 页 · 100dpi 预览';
      var c = HWEngine.renderPage(layout, i, 100, { bgImage: state.bg });
      c.style.width = '100%'; c.style.maxWidth = '680px'; c.style.height = 'auto';
      wrap.appendChild(tag); wrap.appendChild(c); box.appendChild(wrap);
    }
  }

  function buildPreview() {
    if (state.busy) return;
    if (!state.text) { toast('请先上传文件或输入文字'); return; }
    state.busy = true;
    var btn = $('.preview-button'); if (btn) btn.disabled = true;
    toast('正在生成预览…');
    loadPaperBg(collect().paperKey).then(function (bg) {
      state.bg = bg;
      try {
        var s = collect();
        var layout = HWEngine.buildLayout({ text: state.text, settings: s });
        state.layout = layout;
        showPreview(layout);
        var dl = $('.download-button'); if (dl) dl.disabled = false;
        toast('预览完成 · ' + HWFonts.get(s.fontId).label);
      } catch (e) {
        toast('生成失败：' + (e && e.message ? e.message : e));
      } finally {
        state.busy = false; if (btn) btn.disabled = false;
      }
    });
  }

  function download() {
    if (!state.layout || state.busy) { toast('请先点击预览'); return; }
    state.busy = true;
    var dl = $('.download-button'); if (dl) dl.disabled = true;
    toast('正在生成高清文件…');
    setTimeout(function () {
      try {
        HWExporter.run({
          layout: state.layout,
          format: 'zip',
          dpi: 600,
          pageIndex: 0,
          filename: '手写稿',
          customImage: null,
          bgImage: state.bg,
          quality: 0.92,
          onProgress: function () {}
        });
        toast('已生成 600dpi 高清 ZIP，按 Ctrl+J 查看下载');
      } catch (e) {
        toast('导出失败：' + (e && e.message ? e.message : e));
      } finally {
        state.busy = false; if (dl) dl.disabled = false;
      }
    }, 60);
  }

  // 文件解析
  function handleFile(file) {
    if (!file) return;
    toast('正在解析：' + file.name);
    HWParser.parse(file).then(function (res) {
      var text = (res && (res.text || res.content)) || '';
      if (!text) { toast('未从文件中识别到文字'); return; }
      state.text = text;
      var info = $('.file-upload');
      var tag = info.querySelector('.file-info');
      if (!tag) { tag = document.createElement('div'); tag.className = 'file-info'; info.appendChild(tag); }
      tag.textContent = '已载入：' + file.name + '（' + text.length + ' 字）';
      toast('文件已解析，共 ' + text.length + ' 字，点击「点击预览」查看');
    }).catch(function (e) { toast('解析失败：' + (e && e.message ? e.message : e)); });
  }

  function init() {
    // 绑定上传
    var input = $('#word-file');
    if (input) input.addEventListener('change', function (e) { handleFile(e.target.files[0]); });
    // 绑定按钮
    var pb = $('.preview-button'); if (pb) pb.addEventListener('click', buildPreview);
    var db = $('.download-button'); if (db) db.addEventListener('click', download);
    // 仅输入文字：显示 textarea
    var tb = $('.right-button');
    if (tb) tb.addEventListener('click', function () {
      var wrap = $('.file-upload-area');
      var ta = wrap.querySelector('textarea.ta');
      if (!ta) {
        ta = document.createElement('textarea'); ta.className = 'ta';
        ta.placeholder = '在这里粘贴要转换的文字，然后点「点击预览」…';
        wrap.appendChild(ta);
      }
      ta.style.display = 'block'; ta.focus();
      if (!ta._bound) {
        ta._bound = true;
        ta.addEventListener('input', function () { state.text = ta.value; });
      }
    });
    // 智能帮写：跳到示例文本
    var nb = $('.no-word-button');
    if (nb) nb.addEventListener('click', function () {
      state.text = '习题 3-1 微分中值定理\n第 3 题\n对函数 f(x)=sinx 及 F(x)=x+cosx 在区间 [0,π/2] 上验证柯西中值定理的正确性。\n解：函数在区间上连续且可导，满足条件，故定理成立。';
      toast('已填入示例文字，点「点击预览」查看');
    });
    // 滑块实时更新标签
    [['#mistake-rate', '随机勾画涂改概率'], ['#messy-ratio', '文字位置凌乱度'], ['#char-random', '字体笔画凌乱度']].forEach(function (p) {
      var el = $(p[0]); if (!el) return;
      function sync() {
        var lab = el.parentNode.querySelector('label');
        if (lab) lab.textContent = p[1] + ' (' + el.value + '%)';
        // 填充比例跟随 value：左紫右灰，圆点与填充对齐
        el.style.setProperty('--pct', el.value + '%');
      }
      el.addEventListener('input', sync);
      sync(); // 初始化填充，避免默认 3%/10%/5% 显示为满格
    });
    // 左侧导航：接本地页面（官网为 Vue 路由，本地用静态页）
    var NAV_TARGET = { '超级DIY': 'superdiy.html', '教程': 'guide.html', 'FAQ': 'guide.html', '分享': '#' };
    Array.prototype.slice.call(document.querySelectorAll('.nav-item')).forEach(function (item) {
      var txt = (item.querySelector('.nav-text') || {}).textContent || '';
      txt = txt.trim();
      item.style.cursor = 'pointer';
      item.addEventListener('click', function () {
        if (txt === '首页') { location.href = 'index.html'; return; }
        var t = NAV_TARGET[txt];
        if (t === '#') { toast('分享功能：本地版无需分享，导出文件即用'); return; }
        if (t) location.href = t;
      });
    });
    // PDF素材下载链接指向本地向导
    Array.prototype.slice.call(document.querySelectorAll('a[href="/superdiy"]')).forEach(function (a) {
      a.setAttribute('href', 'superdiy.html');
    });

    // 字体/纸张下拉默认对齐官网：栗壳坚坚体(0) + 实拍单红线(20)
    if ($('#font-select')) $('#font-select').value = '7';       // 平方洒脱体=图中标准手写体
    if ($('#paper-select')) $('#paper-select').value = '20';   // 实拍单红线信稿纸
    try { HWZX.load(); } catch (e) { }
    try { HWFonts.preload(); } catch (e) { }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
