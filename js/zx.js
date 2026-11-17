/* ZX 真迹字库：从用户真实手写照片抠出的笔迹样本。
   官方图集 assets/zx/zx_atlas.png + .json 随软件分发；
   用户自行扩充的样本存 localStorage，逐字随机取变体，保证同一字每次写得不一样。 */
(function (global) {
  'use strict';

  var BASE = 'assets/zx/';
  var USER_KEY = 'HW_ZX_USER_V1';
  var DATA = null, IMG = null;
  var USER = {}, USER_IMGS = {};
  var tintCache = {};
  var _ready = false;
  var _id = 0;

  function imageOf(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  function prepareUserImages() {
    Object.keys(USER).forEach(function (ch) {
      var list = USER[ch] || [];
      USER_IMGS[ch] = list.map(function (it) {
        if (it.__img) return it.__img;
        var im = new Image();
        im.onload = function () { im.__ok = true; };
        im.src = it.src;
        it.__img = im;
        return im;
      });
    });
  }

  async function load() {
    try {
      var r = await fetch(BASE + 'zx_atlas.json', { cache: 'no-store' });
      DATA = await r.json();
      if (!DATA || typeof DATA !== 'object') DATA = null;
      if (DATA && (!DATA.glyphs || typeof DATA.glyphs !== 'object')) DATA.glyphs = {};
      IMG = await imageOf(BASE + ((DATA && DATA.atlas) || 'zx_atlas.png'));
      _ready = true;
    } catch (e) {
      _ready = false;
    }
    try {
      var u = global.localStorage && global.localStorage.getItem(USER_KEY);
      USER = u ? (JSON.parse(u) || {}) : {};
    } catch (e) { USER = {}; }
    if (!USER || typeof USER !== 'object') USER = {};
    prepareUserImages();
    return stats();
  }

  function tinted(img, color, g, user, weight) {
    if (!img || !img.width) return null;
    if (!img.__zxid) img.__zxid = 'z' + (++_id);
    // 缓存键含字符位置与笔压档位：官方图集是拼版，必须按单字裁开再上色
    var key = color + '|' + img.__zxid + '|'
      + (user ? 'u' : (g.x + '_' + g.y + '_' + g.w)) + '|' + weight;
    if (tintCache[key]) return tintCache[key];
    var cw = user ? (img.naturalWidth || img.width) : (g.w || 64);
    var ch = user ? (img.naturalHeight || img.height) : (g.h || 64);
    if (cw < 1 || ch < 1) return null;
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var x = c.getContext('2d');
    if (user) x.drawImage(img, 0, 0);
    else x.drawImage(img, g.x, g.y, cw, ch, 0, 0, cw, ch);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, cw, ch);
    x.globalCompositeOperation = 'source-over';
    // 笔压三档：重笔用 8 向低透明度扩散模拟用力与纸面洇墨，细笔整体稍淡
    if (weight === 2) {
      var copy = document.createElement('canvas');
      copy.width = cw; copy.height = ch;
      copy.getContext('2d').drawImage(c, 0, 0);
      x.globalAlpha = 0.22;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1],
        [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
      for (var d = 0; d < dirs.length; d++) {
        x.drawImage(copy, dirs[d][0] * 0.9, dirs[d][1] * 0.9);
      }
      x.globalAlpha = 1;
    }
    var out = { canvas: c, alpha: weight === 0 ? 0.87 : 1 };
    tintCache[key] = out;
    return out;
  }

  // 官方图集里的数字/字母/符号来自作业照片的粗笔连写，缩到正文小字号会糊成一团；
  // 且用户扩充的真迹字库是汉字字帖。故官方位图只对汉字生效，其余交给干净的 zx.ttf 轮廓。
  // 用户自己扩充的样本（含符号）仍按真迹位图绘制，不受此限制。
  var HAN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

  function variants(ch) {
    var out = [];
    if (HAN.test(ch) && DATA && DATA.glyphs && DATA.glyphs[ch]) {
      DATA.glyphs[ch].forEach(function (g) { out.push({ g: g, img: IMG, user: false }); });
    }
    var u = USER[ch] || [], imgs = USER_IMGS[ch] || [];
    for (var i = 0; i < u.length; i++) {
      if (imgs[i] && imgs[i].complete) out.push({ g: u[i], img: imgs[i], user: true });
    }
    return out;
  }

  function has(ch) { return variants(ch).length > 0; }

  function width(ch) {
    var v = variants(ch);
    if (!v.length) return 0;
    // 排版宽度取所有书写变体里最宽的一个：draw 每次随机取变体，
    // 若按首个变体排宽，遇到更宽的写法就会与后一个字重叠。
    var mx = 0;
    for (var i = 0; i < v.length; i++) {
      var w = v[i].g.emW || 860;
      if (w > mx) mx = w;
    }
    return mx;
  }

  function draw(ctx, ch, fontSize, color, rnd, opt) {
    opt = opt || {};
    var ink = opt.ink == null ? 0.6 : Math.max(0, Math.min(1, opt.ink));
    var v = variants(ch);
    if (!v.length) return false;
    var R = rnd || Math.random;
    var pick = v[Math.floor(R() * v.length) % v.length];
    var g = pick.g;
    // 每次落笔的笔压不同：细 / 中 / 重三档，重笔边缘洇开，细笔偏虚
    var rw = R();
    var weight = ink > 0 ? (rw < 0.28 ? 0 : (rw > 0.80 ? 2 : 1)) : 1;
    var col = color || '#1b2b45';
    var t = tinted(pick.img, col, g, pick.user, weight);
    if (!t) return false;
    // 图集每格是 CELL×CELL 正方形，字已按原始宽高比等比居中放入。
    // 绘制框必须保持正方形，不能按 emW×emH 拉伸，否则窄字符（1 | ( ) 等）
    // 会被横向压成细条并连成一团。emW 只用于排版间距，墨迹实际宽度
    // = aspect × dh = emW/1000 × fontSize，与排版宽度天然一致。
    var dh = (g.emH || 720) / 1000 * fontSize;
    var dw = dh;
    // 同一张真迹样本每次落笔都有轻微角度/大小差异，避免「盖章感」
    var r1 = R(), r2 = R();
    ctx.save();
    ctx.rotate((r1 - 0.5) * 0.032);
    ctx.scale(1 + (r2 - 0.5) * 0.055, 1 + (r2 - 0.5) * 0.042);
    ctx.globalAlpha *= t.alpha;
    // 洇墨底层：先于主笔画落下的一层极淡外晕
    if (ink > 0.05) {
      ctx.save();
      ctx.globalAlpha *= 0.16 * ink;
      ctx.shadowColor = col;
      ctx.shadowBlur = Math.max(0.5, fontSize * 0.020);
      ctx.drawImage(t.canvas, 0, -dh * 1.008, dw * 1.012, dh * 1.012);
      ctx.restore();
    }
    ctx.drawImage(t.canvas, 0, -dh, dw, dh);
    ctx.restore();
    return true;
  }

  function save() {
    try {
      var plain = {};
      Object.keys(USER).forEach(function (ch) {
        plain[ch] = (USER[ch] || []).map(function (it) {
          return { src: it.src, emW: it.emW, emH: it.emH, score: 1, ts: it.ts };
        });
      });
      global.localStorage.setItem(USER_KEY, JSON.stringify(plain));
      return true;
    } catch (e) { return false; }
  }

  function addUser(ch, dataURL, emW, emH) {
    if (!ch || !dataURL) return false;
    (USER[ch] = USER[ch] || []).push({ src: dataURL, emW: emW || 860, emH: emH || 860, ts: Date.now() });
    USER_IMGS[ch] = USER_IMGS[ch] || [];
    var im = new Image();
    im.onload = function () { im.__ok = true; };
    im.src = dataURL;
    USER[ch][USER[ch].length - 1].__img = im;
    USER_IMGS[ch].push(im);
    save();
    return true;
  }

  function removeUser(ch) {
    delete USER[ch]; delete USER_IMGS[ch]; save();
  }

  function clearUser() {
    USER = {}; USER_IMGS = {};
    try { global.localStorage.removeItem(USER_KEY); } catch (e) { }
  }

  function dump() {
    var plain = {};
    Object.keys(USER).forEach(function (ch) {
      plain[ch] = (USER[ch] || []).map(function (it) {
        return { src: it.src, emW: it.emW, emH: it.emH, ts: it.ts };
      });
    });
    return { version: 1, name: '我的ZX真迹字库', glyphs: plain };
  }

  function restore(obj) {
    if (!obj || !obj.glyphs) throw new Error('不是有效的字库文件');
    USER = {}; USER_IMGS = {};
    Object.keys(obj.glyphs).forEach(function (ch) {
      var list = Array.isArray(obj.glyphs[ch]) ? obj.glyphs[ch] : [];
      list.forEach(function (it) {
        if (!it || !it.src) return;
        (USER[ch] = USER[ch] || []).push({
          src: it.src, emW: it.emW || 860, emH: it.emH || 860, ts: it.ts || Date.now()
        });
      });
    });
    prepareUserImages(); save();
    var n = 0;
    Object.keys(USER).forEach(function (k) { n += USER[k].length; });
    return n;
  }

  function stats() {
    var D = DATA || {};
    var U = USER || {};
    var gl = D.glyphs || {};
    var official = D.glyphCount || 0;
    var offVar = D.variantCount || 0;
    var uCh = Object.keys(U).length;
    var uVar = 0;
    Object.keys(U).forEach(function (k) { uVar += (U[k] || []).length; });
    return {
      ready: _ready, officialChars: official, officialVariants: offVar,
      userChars: uCh, userVariants: uVar,
      params: D.params || null,
      chars: Object.keys(gl).sort()
    };
  }

  global.HWZX = {
    load: load,
    get ready() { return _ready; },
    has: has,
    width: width,
    draw: draw,
    variants: variants,
    addUser: addUser,
    removeUser: removeUser,
    clearUser: clearUser,
    stats: stats,
    dump: dump,
    restore: restore,
    save: save
  };
})(window);
