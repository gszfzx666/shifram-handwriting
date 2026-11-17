/* 手写渲染引擎：排版 → 逐字扰动 → 涂改装饰 → Canvas 绘制
   所有坐标以 100dpi 设计单位表示，导出时整体缩放，保证预览与 600dpi 成品完全一致 */
(function (global) {
  'use strict';

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 逐字非刚性形变：静态 TTF 同一个字每次长得一模一样，这是「电脑字体感」的根源。
     把单字先画到共享离屏 canvas，再按 12 条水平条带做不同的横向位移贴回主画布，
     位移由 (种子, 页码, 字序) 派生的相位决定 → 预览与 600dpi 导出严格一致，
     且同一个字在不同位置/不同种子下笔画走向都不同，模拟手腕逐笔抖动。 */
  const _warpCanvas = document.createElement('canvas');
  const _warpCtx = _warpCanvas.getContext('2d');

  function renderGlyphWarped(ctx, W, H, padX, padY, amp, rnd, drawer, inkS) {
    if (amp <= 0.01) { drawer(ctx); return; }
    if (_warpCanvas.width !== W || _warpCanvas.height !== H) {
      _warpCanvas.width = W; _warpCanvas.height = H;
    }
    const sc = _warpCtx;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalAlpha = 1;
    sc.globalCompositeOperation = 'source-over';
    sc.shadowBlur = 0;
    sc.clearRect(0, 0, W, H);
    sc.save();
    sc.translate(padX, padY);
    drawer(sc);
    sc.restore();

    // 飞白：中性笔快写时笔画中段偶有断白，用 destination-out 在本字图层挖细线，
    // 只作用于离屏单字，不会挖穿整页纸张与格线。
    if (inkS > 0 && rnd() < 0.42 * inkS) {
      sc.save();
      sc.globalCompositeOperation = 'destination-out';
      sc.strokeStyle = 'rgba(0,0,0,0.62)';
      const n = 1 + Math.floor(rnd() * 2);
      for (let q = 0; q < n; q++) {
        sc.lineWidth = 0.45 + rnd() * 0.8;
        const yy = padY - H * (0.05 + rnd() * 0.48);
        const x0 = padX + W * (0.06 + rnd() * 0.20);
        const x1 = padX + W * (0.48 + rnd() * 0.30);
        sc.beginPath();
        sc.moveTo(x0, yy);
        sc.lineTo(x1, yy + (rnd() - 0.5) * 1.8);
        sc.stroke();
      }
      sc.restore();
    }

    // 条带错位：相邻条带重叠，避免拼接缝；位移用连续低频函数，
    // 逐带随机必须远小于相邻条带位移差，否则会错成阶梯或重影。
    // 带数与重叠量随字号自适应：小字号时 H 很小，若仍用固定 overlap=2.6px，
    // bandH 会小于 overlap，同一像素被相邻条带反复叠画 -> 糊成一团且墨色叠加变黑。
    const N = Math.max(5, Math.min(14, Math.round(H / 2.2)));
    const bandH = H / N;
    const overlap = Math.min(2.6, bandH * 0.28);
    const phase = rnd() * Math.PI * 2;
    const k = 2.0 + rnd() * 1.8;
    const shear = (rnd() - 0.5) * amp * 1.6;
    const wob = amp * 0.06;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.shadowBlur = 0;
    for (let i = 0; i < N; i++) {
      const sy = i * bandH;
      const t = (sy + bandH * 0.5) / H;
      const dx = amp * Math.sin(t * Math.PI * k + phase)
        + shear * (t - 0.5) * 2 + (rnd() - 0.5) * wob;
      ctx.drawImage(_warpCanvas, 0, sy, W, bandH + overlap,
        -padX + dx, -padY + sy, W, bandH + overlap);
    }
    ctx.restore();
  }

  const NO_LINE_START = /^[，。！？；：、）〕】》」』〉”,.!?;:)\]}>%’”]/;
  const NO_LINE_END = /^[（〔【《「『〈“‘(\[{<]/;
  const CJK = /[\u2E80-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF00-\uFFEF]/;

  function normalize(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]{1,}/g, function (s) { return s === '\u3000' ? '\u3000' : ' '; })
      .replace(/\t/g, '    ')
      .replace(/[\ufeff\u200e\u200f]/g, '');
  }

  function fontString(font, size) {
    const weight = font.bold >= 1.5 ? '700 ' : (font.bold >= 0.5 ? '600 ' : '');
    return weight + size.toFixed(2) + 'px ' + font.family + ', ' + font.fallback;
  }

  const _measureCanvas = document.createElement('canvas');
  const _measureCtx = _measureCanvas.getContext('2d');

  function charWidth(ctx, ch, fontSize, font) {
    if (ch === ' ') return fontSize * 0.42;
    if (ch === '\u3000') return fontSize;
    // zx 真迹字库：用真实笔迹样本的宽度排版，避免与轮廓字体宽度不一致
    if (font && font.id === 'zx' && global.HWZX && HWZX.has(ch)) {
      var zw = HWZX.width(ch) / 1000 * fontSize;
      if (zw > 0) return zw;
    }
    return ctx.measureText(ch).width || fontSize * 0.5;
  }

  function buildLayout(input) {
    const text = normalize(input.text);
    const settings = input.settings;
    const paper = HWPapers.get(settings.paperKey);
    const font = HWFonts.get(settings.fontId);
    const rnd = rng(settings.seed);
    const m = HWPapers.metrics(paper);

    // 用户可覆盖页边距（单位：100dpi 像素）
    if (settings.marginOverride) {
      const o = settings.marginOverride;
      m.left = o.l; m.right = o.r; m.top = o.t; m.bottom = o.b;
      m.contentW = m.w - m.left - m.right;
      m.contentH = m.h - m.top - m.bottom;
      if (m.cellW) {
        m.cellW = m.w > 0 ? (m.contentW / m.cols) : m.cellW;
        m.cellH = m.contentH / m.rows;
      }
    }

    const cellMode = !!m.cellW && !!m.cellMode;
    const aligned = ['ruled', 'notebook', 'math'].indexOf(paper.type) >= 0;
    let fontSize = settings.fontSize * font.sizeScale;
    if (cellMode && settings.autoFontSize) {
      fontSize = Math.min(m.cellW, m.cellH) * 0.76;
    }
    fontSize = clamp(fontSize, 8, 120);

    let lineH = settings.lineHeight * fontSize;
    if (cellMode) lineH = m.cellH;
    else if (aligned && settings.alignToRuling) lineH = m.lineStep;
    lineH = Math.max(lineH, fontSize * 1.05);

    const maxLines = cellMode
      ? m.rows
      : Math.max(1, Math.floor((m.contentH - (aligned ? 4 : 0)) / lineH));
    const maxPages = clamp(settings.maxPages || 12, 1, 30);

    _measureCtx.font = fontString(font, fontSize);
    const tracking = (settings.letterSpacing || 0) + (font.tracking || 0);
    const indentChars = settings.paragraphIndent == null ? 2 : settings.paragraphIndent;

    const paragraphs = text.split('\n');
    const pages = [];
    let page = newPage();
    let lineIdx = 0;
    let colIdx = 0;
    let truncated = false;
    let totalChars = 0;

    function newPage() {
      const p = { lines: [], decorations: [] };
      pages.push(p);
      return p;
    }
    function nextLine() {
      lineIdx++; colIdx = 0;
      if (lineIdx >= maxLines) {
        if (pages.length >= maxPages) { truncated = true; return false; }
        page = newPage(); lineIdx = 0;
      }
      return true;
    }
    function baseY() {
      if (cellMode) return m.top + lineIdx * m.cellH + m.cellH / 2 + fontSize * 0.34;
      if (aligned && settings.alignToRuling) return m.top + m.lineStep * 0.15 + lineIdx * lineH - 2;
      return m.top + lineIdx * lineH + fontSize * 0.86;
    }

    function pushChar(ch, x, w) {
      const pj = (settings.posJitter || 0) / 100;
      const sj = (settings.strokeJitter || 0) / 100;
      const bl = (settings.baseline || 0) / 100;
      const iv = (settings.inkVariance == null ? 12 : settings.inkVariance) / 100;
      const js = font.jitterScale || 1;
      const dx = (rnd() - 0.5) * fontSize * 0.42 * pj * js;
      const dy = (rnd() - 0.5) * fontSize * 0.34 * pj * js + (rnd() - 0.5) * fontSize * 0.30 * bl;
      const rot = (rnd() - 0.5) * 0.28 * sj * js;
      const sx = 1 + (rnd() - 0.5) * 0.14 * sj;
      const sy = 1 + (rnd() - 0.5) * 0.16 * sj;
      let alpha = 1 - rnd() * 0.30 * iv;
      if (rnd() < 0.02) alpha *= 0.72;
      return { ch: ch, x: x, y: baseY(), w: w, dx: dx, dy: dy, rot: rot, sx: sx, sy: sy, alpha: clamp(alpha, 0.45, 1) };
    }

    function addLine(line, paragraphStart) {
      // 必须 push 快照：调用方随后会 Object.assign 复用同一 line 对象清空 chars，
      // 若直接 push 引用，所有行最终都会变成最后一行的内容。
      page.lines.push({
        chars: line.chars.slice(),
        y: line.y || baseY(),
        paragraphStart: paragraphStart,
        cell: line.cell, col: line.col, row: line.row
      });
    }

    for (let pi = 0; pi < paragraphs.length && !truncated; pi++) {
      const para = paragraphs[pi];
      if (cellMode) {
        // 稿纸模式：一格一字
        if (para === '') { if (!nextLine()) break; continue; }
        let indent = paragraphStartIndent(para) ? indentChars : 0;
        for (let k = 0; k < indent; k++) colIdx++;
        if (colIdx >= m.cols) { if (!nextLine()) break; }
        for (let i = 0; i < para.length; i++) {
          const ch = para[i];
          if (ch === ' ') { colIdx++; }
          else {
            const w = charWidth(_measureCtx, ch, fontSize, font);
            const x = m.left + colIdx * m.cellW + (m.cellW - w) / 2;
            page.lines.push({
              chars: [pushChar(ch, x, w)],
              y: baseY(), paragraphStart: false, cell: true, col: colIdx, row: lineIdx
            });
            colIdx++; totalChars++;
          }
          if (colIdx >= m.cols) { if (!nextLine()) break; }
        }
        if (colIdx > 0 && pi < paragraphs.length - 1) { if (!nextLine()) break; }
      } else {
        // 连续排版模式
        let x = m.left + (paragraphStartIndent(para) ? indentChars * charWidth(_measureCtx, '中', fontSize, font) : 0);
        const line = { chars: [], y: 0, paragraphStart: paragraphStartIndent(para) };
        for (let i = 0; i < para.length; i++) {
          const ch = para[i];
          // 英文单词整体换行
          if (/[A-Za-z0-9]/.test(ch)) {
            let j = i;
            while (j < para.length && /[A-Za-z0-9'\-.]/.test(para[j])) j++;
            const word = para.slice(i, j);
            let ww = 0;
            for (const c of word) ww += charWidth(_measureCtx, c, fontSize, font) + tracking;
            if (x + ww > m.left + m.contentW && line.chars.length) {
              line.y = baseY(); addLine(line, line.paragraphStart);
              if (!nextLine()) { truncated = true; break; }
              x = m.left;
              Object.assign(line, { chars: [], paragraphStart: false });
            }
            for (const c of word) {
              const w = charWidth(_measureCtx, c, fontSize, font);
              line.chars.push(pushChar(c, x, w));
              x += w + tracking; totalChars++;
            }
            i = j - 1;
            continue;
          }
          const w = charWidth(_measureCtx, ch, fontSize, font);
          let over = x + w > m.left + m.contentW;
          if (over && NO_LINE_START.test(ch) && line.chars.length) over = false; // 标点不落行首
          if (over && NO_LINE_END.test(ch) && line.chars.length) over = true;
          if (over && line.chars.length) {
            if (NO_LINE_END.test(ch)) {
              const moved = line.chars.pop();
              line.y = baseY(); addLine(line, line.paragraphStart);
              if (!nextLine()) { truncated = true; break; }
              x = m.left;
              Object.assign(line, { chars: [], paragraphStart: false });
              const nw = moved.w;
              const nc = Object.assign({}, moved, { x: x });
              nc.y = baseY();
              line.chars.push(nc);
              x += nw + tracking;
            } else {
              line.y = baseY(); addLine(line, line.paragraphStart);
              if (!nextLine()) { truncated = true; break; }
              x = m.left;
              Object.assign(line, { chars: [], paragraphStart: false });
            }
          }
          if (settings.align === 'justify' && line.chars.length) {
            // 两端对齐：把余量摊到字距，在渲染前统一处理
          }
          line.chars.push(pushChar(ch, x, w));
          x += w + tracking; totalChars++;
        }
        if (!truncated) {
          line.y = baseY(); addLine(line, line.paragraphStart);
          if (pi < paragraphs.length - 1) { if (!nextLine()) break; }
        }
      }
    }

    function paragraphStartIndent(para) { return para.length > 0 && !/^\s/.test(para) && indentChars > 0 && !settings.noIndent; }

    // 两端对齐修正
    if (settings.align === 'justify' && !cellMode) {
      pages.forEach(function (pg) {
        pg.lines.forEach(function (ln, li) {
          if (!ln.chars.length) return;
          const last = ln.chars[ln.chars.length - 1];
          const used = last.x + last.w - m.left;
          const rest = m.contentW - used;
          const isLast = li === pg.lines.length - 1 || ln.paragraphStart === 'end';
          if (isLast || rest <= 0 || rest > fontSize * 3 || ln.chars.length < 4) return;
          const extra = rest / (ln.chars.length - 1);
          ln.chars.forEach(function (c, i) { c.x += extra * i; });
        });
      });
    }

    // 随机勾画 / 涂改装饰
    const rate = (settings.scribble || 0) / 100;
    if (rate > 0) {
      pages.forEach(function (pg, pgi) {
        pg.lines.forEach(function (ln) {
          for (let i = 0; i < ln.chars.length; i++) {
            if (rnd() >= rate * 0.5) continue;
            const c = ln.chars[i];
            if (c.ch === ' ' || c.ch === '\u3000') continue;
            const span = 1 + Math.floor(rnd() * 3);
            const end = ln.chars[Math.min(ln.chars.length - 1, i + span - 1)];
            const x0 = c.x - 2, x1 = end.x + end.w + 2;
            const y = c.y;
            const t = rnd();
            let d;
            if (t < 0.32) d = { type: 'strike', x: x0, y: y, w: x1 - x0, h: fontSize, n: 2 + Math.floor(rnd() * 2) };
            else if (t < 0.48) d = { type: 'circle', x: x0 - 2, y: y, w: x1 - x0 + 4, h: fontSize * 1.35 };
            else if (t < 0.68) d = { type: 'blot', x: x0, y: y, w: x1 - x0, h: fontSize * 1.05 };
            else if (t < 0.80) d = { type: 'insert', x: (x0 + x1) / 2, y: y, w: fontSize, h: fontSize, text: ['的', '了', '在', '和', '是', '就', '也', '把'][Math.floor(rnd() * 8)] };
            else if (t < 0.90) d = { type: 'wave', x: x0, y: y + fontSize * 0.28, w: x1 - x0, h: fontSize * 0.2 };
            else d = { type: 'underline', x: x0, y: y + fontSize * 0.22, w: x1 - x0, h: 1 };
            d.page = pgi;
            d.seed = Math.floor(rnd() * 1e9);
            pg.decorations.push(d);
            i += span - 1;
          }
          if (rnd() < rate * 0.18) {
            pg.decorations.push({
              type: 'dot', x: m.left + rnd() * m.contentW, y: ln.y - fontSize * (0.3 + rnd()),
              w: 1 + rnd() * 2, h: 1 + rnd() * 2, page: pgi, seed: Math.floor(rnd() * 1e9)
            });
          }
        });
      });
    }

    // 书写节奏：真人一行字不是逐字独立随机，而是随书写位置连续变化。
    // 字高、基线、倾角、墨量都按行内进度 t 缓慢起伏；一行写完墨变淡，换行重新变浓。
    // 用 (页码, 行号, seed) 派生独立随机相位，预览与 600dpi 导出严格一致。
    const PUNCT_TIGHT = /[，。！？；：、）〕】》」』〉”,.!?;:)\]}>%’]/;
    function applyWritingRhythm() {
      const strength = clamp((settings.natural == null ? 70 : settings.natural) / 100, 0, 1);
      if (strength <= 0) return;
      pages.forEach(function (pg, pi) {
        pg.lines.forEach(function (ln, li) {
          const cs = ln.chars;
          if (!cs.length) return;
          const N = cs.length;
          const rr = rng((settings.seed ^ (pi * 7919) ^ (li * 104729) ^ 0x5f3a) >>> 0);
          const p1 = rr() * Math.PI * 2, p2 = rr() * Math.PI * 2, p3 = rr() * Math.PI * 2;
          // 整行斜率：人手写字一行会整体越写越往上飘或往下坠，不是水平线。
          // 这是最容易被认出「人写的」特征，稿纸格子模式保留对齐故减半。
          const lineSlope = (rr() * 2 - 1) * 0.013 * strength * (cellMode ? 0.45 : 1);
          const lineLift = (rr() - 0.5) * 1.5 * strength;
          const x0 = cs[0].x;
          for (let i = 0; i < N; i++) {
            const c = cs[i];
            const t = N > 1 ? i / (N - 1) : 0;
            // 行首写得慢、字略大且正；行尾加快、字略小略飘
            const sizeWave = 1 + strength * (0.078 * Math.sin(t * Math.PI * 1.65 + p1) - 0.032 * t);
            const baseWave = strength * (1.90 * Math.sin(t * Math.PI * 2.15 + p2) + 0.55 * (t - 0.5));
            const slantWave = strength * (0.024 * Math.sin(t * Math.PI * 1.28 + p3) + 0.012 * t);
            // 笔尖墨量：一行内由浓到淡，偶尔某个字特别淡（笔迹变虚）
            const inkWave = 1 - strength * 0.21 * t;
            c.waveS = sizeWave;
            c.waveY = baseWave + lineSlope * (c.x - x0) + lineLift;
            c.waveR = slantWave;
            c.waveA = clamp(inkWave, 0.66, 1);
            // 字距呼吸：连续书写时词组内紧、标点前收、行内低频起伏；格子模式保持对齐
            if (!cellMode) {
              c.x += strength * 0.42 * Math.sin(t * Math.PI * 3.1 + p2);
              if (PUNCT_TIGHT.test(c.ch)) c.x -= strength * 0.55;
            }
            // 每字独立的形变相位种子，供渲染层做逐字非刚性形变
            c.warpSeed = ((settings.seed ^ (pi * 7919) ^ (li * 65537)
              ^ ((i + 1) * 2654435761) ^ 0x9e3779b9) >>> 0);
          }
        });
      });
    }
    applyWritingRhythm();

    return {
      pages: pages, m: m, paper: paper, font: font, settings: settings,
      fontSize: fontSize, lineH: lineH, cellMode: cellMode,
      truncated: truncated, totalChars: totalChars, seed: settings.seed
    };
  }

  function renderPage(layout, pageIndex, dpi, opts) {
    opts = opts || {};
    const m = layout.m, s = layout.settings, font = layout.font;
    const scale = dpi / 100;
    const canvas = opts.canvas || document.createElement('canvas');
    canvas.width = Math.round(m.w * scale);
    canvas.height = Math.round(m.h * scale);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.setTransform(canvas.width / m.w, 0, 0, canvas.height / m.h, 0, 0);
    ctx.textBaseline = 'alphabetic';

    HWPapers.draw(ctx, layout.paper, m, rng(s.seed + 7919 + pageIndex * 131), {
      customImage: opts.customImage || null,
      bgImage: opts.bgImage || null,
      pageIndex: pageIndex
    });

    const pg = layout.pages[pageIndex];
    if (!pg) return canvas;

    _measureCtx.font = fontString(font, layout.fontSize);
    ctx.font = fontString(font, layout.fontSize);
    ctx.fillStyle = s.color || '#1b2b45';

    // 行楷牵丝：写得快时相邻汉字之间带出极细的连带，先画在字下面避免盖住笔画
    const nat = (s.natural == null ? 70 : s.natural) / 100;
    if (nat > 0 && !layout.cellMode) {
      const lr = rng(s.seed + 5501 + pageIndex * 7919);
      ctx.save();
      ctx.strokeStyle = s.color || '#1b2b45';
      ctx.lineWidth = 0.55;
      for (const ln of pg.lines) {
        const cs = ln.chars;
        for (let i = 0; i < cs.length - 1; i++) {
          const a = cs[i], b = cs[i + 1];
          if (!CJK.test(a.ch) || !CJK.test(b.ch)) continue;
          if (lr() > 0.15 * nat) continue;
          ctx.globalAlpha = 0.22 * a.alpha * (a.waveA == null ? 1 : a.waveA);
          ctx.beginPath();
          ctx.moveTo(a.x + a.dx + a.w * 0.80, a.y + a.dy + (a.waveY || 0) - layout.fontSize * 0.06);
          ctx.quadraticCurveTo(
            (a.x + b.x) * 0.5, a.y + (a.waveY || 0) - layout.fontSize * 0.22,
            b.x + b.dx + b.w * 0.14, b.y + b.dy + (b.waveY || 0) - layout.fontSize * 0.10);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    let ci = 0;
    const inkS = clamp((s.inkFeel == null ? 60 : s.inkFeel) / 100, 0, 1);
    const color = s.color || '#1b2b45';
    // 共享离屏画布按整页字号预算一次，逐字只 clearRect，不做 resize
    const PAD = Math.ceil(layout.fontSize * 0.30);
    const GH = Math.ceil(layout.fontSize * 1.00);
    const SCR_W = Math.ceil(layout.fontSize * 1.75 + PAD * 2);
    const SCR_H = Math.ceil(GH + layout.fontSize * 0.30 + PAD * 2);
    const PADY = PAD + GH;
    for (const ln of pg.lines) {
      for (const c of ln.chars) {
        ci++;
        if (c.ch === ' ' || c.ch === '\u3000') continue;
        var zxHas = font.id === 'zx' && global.HWZX && HWZX.has(c.ch);
        if (s.strictGlyph && !hasGlyph(_measureCtx, c.ch) && !zxHas) continue;
        ctx.save();
        var wS = c.waveS == null ? 1 : c.waveS;
        var wY = c.waveY || 0;
        var wR = c.waveR || 0;
        var wA = c.waveA == null ? 1 : c.waveA;
        var warpRnd = rng((c.warpSeed == null ? (s.seed + ci * 911) : c.warpSeed) >>> 0);
        var zxRnd = rng(s.seed + 3301 + pageIndex * 104729 + ci * 911);
        var isZX = font.id === 'zx' && global.HWZX && HWZX.ready;
        ctx.translate(c.x + c.dx, c.y + c.dy + wY);
        ctx.rotate(c.rot + wR);
        // 逐字独立斜切：真人写每个字的倾角都不完全一致，且方向与大小逐字变化
        ctx.transform(1, 0, (warpRnd() - 0.5) * 0.085 * nat * (isZX ? 1.2 : 0.75), 1, 0, 0);
        if (font.slant) ctx.transform(1, 0, font.slant, 1, 0, 0);
        ctx.scale(c.sx * wS, c.sy * wS);
        ctx.globalAlpha = c.alpha * wA * 0.92;
        ctx.fillStyle = color;
        var drawer = function (g) {
          g.font = fontString(font, layout.fontSize);
          g.textBaseline = 'alphabetic';
          g.textAlign = 'left';
          g.fillStyle = color;
          g.shadowColor = color;
          // 洇墨底层：纸纤维吸墨形成的极淡外晕，先于主笔画落下
          if (inkS > 0.05) {
            g.save();
            g.globalAlpha = 0.17 * inkS;
            g.shadowBlur = Math.max(0.6, layout.fontSize * 0.022);
            g.fillText(c.ch, 0, 0);
            g.restore();
          }
          g.shadowBlur = 0.25 + inkS * 0.35;
          // zx：优先贴用户真实笔迹，未覆盖字符回退 zx.ttf 轮廓
          var drawn = isZX
            ? HWZX.draw(g, c.ch, layout.fontSize, color, zxRnd, { ink: inkS })
            : false;
          if (!drawn) {
            g.fillText(c.ch, 0, 0);
            if (font.bold > 0) {
              g.lineWidth = 0.25 + font.bold * 0.3;
              g.strokeStyle = color;
              g.strokeText(c.ch, 0, 0);
            }
          }
        };
        // 逐字非刚性形变幅度：zx 真迹体系幅度最大，其余字体减半以免糊字
        var amp = layout.fontSize * 0.062 * nat * (isZX ? 1.12 : 0.80);
        renderGlyphWarped(ctx, SCR_W, SCR_H, PAD, PADY, amp, warpRnd, drawer, inkS);
        // 收笔出锋：行楷撇捺末端带出的极细尖锋，低概率落在字右下
        if (nat > 0.15 && CJK.test(c.ch) && warpRnd() < 0.11 * nat) {
          ctx.save();
          ctx.globalAlpha = c.alpha * wA * (0.28 + 0.26 * inkS);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.35, layout.fontSize * 0.018);
          ctx.lineCap = 'round';
          var ex = c.w * (0.72 + warpRnd() * 0.20);
          var ey = -layout.fontSize * (0.02 + warpRnd() * 0.12);
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.quadraticCurveTo(ex + layout.fontSize * 0.045, ey - layout.fontSize * 0.012,
            ex + layout.fontSize * (0.07 + warpRnd() * 0.05), ey - layout.fontSize * 0.02);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }
    }

    drawDecorations(ctx, pg.decorations, s, layout.fontSize);

    if (s.showPageNo) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = s.color || '#1b2b45';
      ctx.font = Math.max(10, layout.fontSize * 0.55).toFixed(1) + 'px ' + font.family + ', ' + font.fallback;
      ctx.textAlign = 'center';
      ctx.fillText('— ' + (pageIndex + 1) + ' —', m.w / 2, m.h - m.bottom / 2 + 4);
      ctx.restore();
    }

    if (opts.watermark) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = '#333';
      ctx.font = 'bold ' + Math.round(m.w / 12) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.translate(m.w / 2, m.h / 2);
      ctx.rotate(-0.42);
      ctx.fillText(opts.watermark, 0, 0);
      ctx.restore();
    }
    return canvas;
  }

  const _glyphCache = {};
  function hasGlyph(ctx, ch) {
    if (_glyphCache[ch] != null) return _glyphCache[ch];
    const w = ctx.measureText(ch).width;
    const tofu = ctx.measureText('\uFFFF').width;
    const ok = Math.abs(w - tofu) > 0.3 || ch === '\uFFFF';
    _glyphCache[ch] = ok;
    return ok;
  }

  function drawDecorations(ctx, decs, s, fs) {
    const r = rng(20261115);
    const pen = s.penColor || s.color || '#1b2b45';
    ctx.save();
    ctx.strokeStyle = pen;
    ctx.fillStyle = pen;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const d of decs) {
      const rr = rng(d.seed || 12345);
      ctx.globalAlpha = 0.78;
      if (d.type === 'strike') {
        ctx.lineWidth = Math.max(0.9, fs * 0.055);
        for (let k = 0; k < d.n; k++) {
          const y = d.y - fs * 0.32 + k * fs * 0.13 + (rr() - 0.5) * fs * 0.09;
          ctx.beginPath();
          ctx.moveTo(d.x - 2 - rr() * 3, y);
          ctx.bezierCurveTo(d.x + d.w * 0.3, y - fs * 0.08, d.x + d.w * 0.7, y + fs * 0.08, d.x + d.w + 3 + rr() * 3, y + (rr() - 0.5) * fs * 0.07);
          ctx.stroke();
        }
      } else if (d.type === 'circle') {
        ctx.lineWidth = Math.max(0.9, fs * 0.05);
        ctx.beginPath();
        ctx.ellipse(d.x + d.w / 2, d.y - fs * 0.32, d.w * 0.62, d.h * 0.52, (rr() - 0.5) * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        if (rr() < 0.45) {
          ctx.beginPath();
          ctx.ellipse(d.x + d.w / 2 + 1, d.y - fs * 0.32 - 1, d.w * 0.6, d.h * 0.5, 0, 0, Math.PI * 1.85);
          ctx.stroke();
        }
      } else if (d.type === 'blot') {
        ctx.globalAlpha = 0.9;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          const steps = 9;
          for (let i = 0; i <= steps; i++) {
            const px = d.x + (d.w * i / steps) + (rr() - 0.5) * fs * 0.18;
            const py = d.y - fs * 0.85 + k * fs * 0.24 + (rr() - 0.5) * fs * 0.3;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          for (let i = steps; i >= 0; i--) {
            const px = d.x + (d.w * i / steps) + (rr() - 0.5) * fs * 0.18;
            const py = d.y - fs * 0.55 + k * fs * 0.24 + (rr() - 0.5) * fs * 0.3;
            ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill();
        }
      } else if (d.type === 'insert') {
        ctx.lineWidth = Math.max(0.8, fs * 0.045);
        ctx.beginPath();
        ctx.moveTo(d.x - fs * 0.26, d.y - fs * 0.92);
        ctx.lineTo(d.x, d.y - fs * 1.22);
        ctx.lineTo(d.x + fs * 0.26, d.y - fs * 0.92);
        ctx.stroke();
        ctx.font = (fs * 0.62).toFixed(1) + 'px ' + (HWFonts.get(s.fontId).family) + ', ' + HWFonts.get(s.fontId).fallback;
        ctx.fillText(d.text, d.x - fs * 0.28, d.y - fs * 1.28);
      } else if (d.type === 'wave') {
        ctx.lineWidth = Math.max(0.8, fs * 0.045);
        ctx.beginPath();
        const seg = Math.max(4, Math.floor(d.w / 7));
        for (let i = 0; i <= seg; i++) {
          const px = d.x + d.w * i / seg;
          const py = d.y + Math.sin(i * 1.35) * fs * 0.09;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (d.type === 'underline') {
        ctx.lineWidth = Math.max(0.8, fs * 0.045);
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.w, d.y + (rr() - 0.5) * 2); ctx.stroke();
      } else if (d.type === 'dot') {
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.w, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  global.HWEngine = {
    buildLayout: buildLayout,
    renderPage: renderPage,
    rng: rng,
    normalize: normalize,
    fontString: fontString
  };
})(window);
