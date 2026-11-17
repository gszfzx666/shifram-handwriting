/* 纸张背景库：尺寸、格子、程序化纸纹与实拍质感 */
(function (global) {
  'use strict';

  const MM = 100 / 25.4; // 1mm 对应 100dpi 下的像素

  function P(key, label, group, opt) {
    return Object.assign({
      key: key, label: label, group: group,
      mmW: 210, mmH: 297,
      type: 'plain', tone: 'white',
      gridColor: '#c0392b', gridWidth: 0.7,
      cols: 0, rows: 0, cellMode: false,
      margin: { l: 72, t: 82, r: 72, b: 74 },
      lineStep: 38,
      photo: false,
      header: true
    }, opt || {});
  }

  const A4 = { mmW: 210, mmH: 297 };
  const B5 = { mmW: 176, mmH: 250 };
  const A3 = { mmW: 297, mmH: 420 };

  const LIST = [
    P('photo-redgrid', '实拍-红格子稿纸(400字/页)', '实拍系列（有纸张纹理）', Object.assign({}, A4, {
      type: 'grid', tone: 'cream', photo: true, gridColor: '#c2453a', cols: 20, rows: 20, cellMode: true,
      imgW: 810, imgH: 1440,
      margin: { l: 40, t: 60, r: 40, b: 50 }
    })),
    P('photo-redline', '实拍-单红线信稿纸(点击展开|新增格子纸)', '实拍系列（有纸张纹理）', Object.assign({}, A4, {
      type: 'ruled', tone: 'cream', photo: true, gridColor: '#cf6b62', lineStep: 59,
      imgW: 1279, imgH: 1706,
      margin: { l: 100, t: 176, r: 238, b: 74 }
    })),
    P('photo-draft', '草稿纸-高清实拍', '实拍系列（有纸张纹理）', Object.assign({}, A4, {
      type: 'math', tone: 'cream', photo: true, gridColor: '#a9c4d6', lineStep: 26,
      imgW: 1120, imgH: 1494,
      margin: { l: 80, t: 90, r: 70, b: 74 }
    })),
    P('photo-kraft', '实拍-牛皮纸笔记本', '实拍系列（有纸张纹理）', Object.assign({}, A4, {
      type: 'ruled', tone: 'kraft', photo: true, gridColor: '#9d7b56', lineStep: 40,
      margin: { l: 88, t: 92, r: 68, b: 74 }
    })),

    P('print-blackgrid', '可打印-黑格子稿纸(400字/页)-高清', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'grid', tone: 'white', gridColor: '#4a4a4a', cols: 20, rows: 20, cellMode: true,
      margin: { l: 68, t: 86, r: 68, b: 70 }
    })),
    P('print-redgrid', '可打印-红格子稿纸(400字/页)-高清', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'grid', tone: 'white', gridColor: '#cf4a40', cols: 20, rows: 20, cellMode: true,
      imgW: 826, imgH: 1169,
      margin: { l: 40, t: 60, r: 40, b: 50 }
    })),
    P('print-redline-new', '可打印-单红线A4信稿纸-新', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'ruled', tone: 'white', gridColor: '#d2685f', lineStep: 38,
      margin: { l: 88, t: 90, r: 68, b: 72 }
    })),
    P('print-redline-old', '可打印-单红线信稿纸-宽边距-老', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'ruled', tone: 'white', gridColor: '#c98d84', lineStep: 42,
      margin: { l: 118, t: 104, r: 108, b: 96 }
    })),
    P('print-a4-v', '可打印-A4纸-纵向-600dpi高清(4960x7015分辨率)', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'plain', tone: 'white', margin: { l: 84, t: 92, r: 84, b: 88 }
    })),
    P('print-a4-h', '可打印-A4纸-横向-600dpi高清(7015x4960分辨率)', '可打印系列（600dpi 高清）', {
      mmW: 297, mmH: 210, type: 'plain', tone: 'white', margin: { l: 92, t: 84, r: 92, b: 84 }
    }),
    P('print-b5-v', '可打印-B5纸-纵向-600dpi高清(4157x5905分辨率)', '可打印系列（600dpi 高清）', Object.assign({}, B5, {
      type: 'plain', tone: 'white', margin: { l: 70, t: 80, r: 70, b: 76 }
    })),
    P('print-b5-h', '可打印-B5纸-横向-600dpi高清(5905x4157分辨率)', '可打印系列（600dpi 高清）', {
      mmW: 250, mmH: 176, type: 'plain', tone: 'white', margin: { l: 80, t: 70, r: 80, b: 70 }
    }),
    P('print-a3-v', '可打印-A3纸-纵向-600dpi高清(7015x9921分辨率)', '可打印系列（600dpi 高清）', Object.assign({}, A3, {
      type: 'plain', tone: 'white', margin: { l: 118, t: 128, r: 118, b: 122 }
    })),
    P('print-a3-h', '可打印-A3纸-横向-600dpi高清(9921x7015分辨率)', '可打印系列（600dpi 高清）', {
      mmW: 420, mmH: 297, type: 'plain', tone: 'white', margin: { l: 128, t: 118, r: 128, b: 118 }
    }),
    P('print-tian', '可打印-田字格练字纸', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'tian', tone: 'white', gridColor: '#d96a60', lineStep: 76, cellMode: false,
      margin: { l: 76, t: 86, r: 76, b: 76 }
    })),
    P('print-mi', '可打印-米字格练字纸', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'mi', tone: 'white', gridColor: '#d96a60', lineStep: 76,
      margin: { l: 76, t: 86, r: 76, b: 76 }
    })),
    P('print-math', '可打印-方格数学纸', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'math', tone: 'white', gridColor: '#b9d3e2', lineStep: 26,
      margin: { l: 72, t: 82, r: 72, b: 74 }
    })),
    P('print-notebook', '可打印-横线笔记本', '可打印系列（600dpi 高清）', Object.assign({}, A4, {
      type: 'notebook', tone: 'white', gridColor: '#a7c4dc', lineStep: 38,
      margin: { l: 96, t: 88, r: 70, b: 72 }
    })),
    P('custom', '自定义纸张背景（上传图片）', '自定义', Object.assign({}, A4, {
      type: 'custom', tone: 'white', margin: { l: 84, t: 92, r: 84, b: 88 }
    }))
  ];

  const BY_KEY = {};
  LIST.forEach(function (p) { BY_KEY[p.key] = p; });

  function metrics(paper) {
    // 实拍背景纸：画布尺寸直接对齐官网原图，文字行才能落在实拍横线上
    const w = paper.imgW || (paper.mmW * MM);
    const h = paper.imgH || (paper.mmH * MM);
    const m = paper.margin;
    const contentW = w - m.l - m.r;
    const contentH = h - m.t - m.b;
    let cellW = 0, cellH = 0, cols = paper.cols, rows = paper.rows, cellMode = !!paper.cellMode;
    if (paper.type === 'tian' || paper.type === 'mi') {
      cellW = cellH = paper.lineStep;
      cols = Math.max(1, Math.floor(contentW / cellW));
      rows = Math.max(1, Math.floor(contentH / cellH));
      cellMode = true;
    } else if (paper.cellMode) {
      cellW = contentW / paper.cols;
      cellH = contentH / paper.rows;
    }
    return {
      w: w, h: h, contentW: contentW, contentH: contentH,
      left: m.l, top: m.t, right: m.r, bottom: m.b,
      cellW: cellW, cellH: cellH, cols: cols, rows: rows, cellMode: cellMode,
      lineStep: paper.lineStep
    };
  }

  let _noise = null;
  function noisePattern(ctx) {
    if (_noise) return ctx.createPattern(_noise, 'repeat');
    const c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    const g = c.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      const dark = v < 0.5;
      img.data[i] = dark ? 90 : 255;
      img.data[i + 1] = dark ? 78 : 253;
      img.data[i + 2] = dark ? 62 : 246;
      img.data[i + 3] = Math.floor(Math.random() * 16);
    }
    g.putImageData(img, 0, 0);
    _noise = c;
    return ctx.createPattern(c, 'repeat');
  }

  function toneColor(tone) {
    if (tone === 'cream') return '#f6f0df';
    if (tone === 'kraft') return '#e8d3ad';
    return '#ffffff';
  }

  function drawPaper(ctx, paper, m, rnd, opt) {
    opt = opt || {};
    const W = m.w, H = m.h;
    ctx.save();
    // 官网实拍纸张底图：若提供，直接铺满替代程序化纸张（横线/纹理/页脚图里自带）
    if (opt.bgImage && opt.bgImage.width) {
      ctx.drawImage(opt.bgImage, 0, 0, W, H);
      ctx.restore();
      return;
    }
    ctx.fillStyle = toneColor(paper.tone);
    ctx.fillRect(0, 0, W, H);

    if (paper.tone !== 'white' || paper.photo) {
      ctx.save();
      ctx.globalAlpha = paper.photo ? 0.85 : 0.45;
      ctx.fillStyle = noisePattern(ctx);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (paper.photo) {
      // 实拍纸：纤维短线 + 四角暗角 + 轻微折痕
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = '#8a7a5e';
      ctx.lineWidth = 0.35;
      for (let i = 0; i < 260; i++) {
        const x = rnd() * W, y = rnd() * H, len = 3 + rnd() * 12, a = rnd() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();

      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(78,60,36,0.16)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = '#5b4a32';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(W * 0.02, H * 0.33);
      ctx.bezierCurveTo(W * 0.35, H * 0.335, W * 0.65, H * 0.328, W * 0.98, H * 0.337);
      ctx.stroke();
      ctx.restore();
    }

    if (paper.type === 'custom' && opt.customImage) {
      const im = opt.customImage;
      const scale = Math.max(W / im.width, H / im.height);
      const dw = im.width * scale, dh = im.height * scale;
      ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      drawRuling(ctx, paper, m, W, H);
    }

    if (paper.header && (paper.type === 'grid')) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = paper.gridColor;
      ctx.font = '11px "KaiTi","楷体",serif';
      ctx.textAlign = 'right';
      ctx.fillText('20 × 20 = 400', W - m.right, m.top - 16);
      ctx.textAlign = 'left';
      ctx.fillText('稿 纸', m.left, m.top - 16);
      ctx.restore();
    }
    if (paper.header && opt.pageIndex != null && (paper.type === 'grid' || paper.type === 'ruled')) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#6b5a44';
      ctx.font = '11px "KaiTi","楷体",serif';
      ctx.textAlign = 'center';
      ctx.fillText('第 ' + (opt.pageIndex + 1) + ' 页', W / 2, H - m.bottom / 2 + 4);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRuling(ctx, paper, m, W, H) {
    const c = paper.gridColor;
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = paper.gridWidth;
    ctx.globalAlpha = paper.tone === 'white' ? 0.78 : 0.72;

    if (paper.type === 'grid') {
      const cw = m.cellW, ch = m.cellH;
      const x0 = m.left, y0 = m.top;
      for (let i = 0; i <= paper.cols; i++) {
        ctx.globalAlpha = (i === 0 || i === paper.cols) ? 0.92 : 0.62;
        ctx.lineWidth = (i === 0 || i === paper.cols) ? 1.3 : 0.7;
        ctx.beginPath();
        ctx.moveTo(x0 + i * cw, y0);
        ctx.lineTo(x0 + i * cw, y0 + paper.rows * ch);
        ctx.stroke();
      }
      for (let j = 0; j <= paper.rows; j++) {
        ctx.globalAlpha = (j === 0 || j === paper.rows) ? 0.92 : 0.62;
        ctx.lineWidth = (j === 0 || j === paper.rows) ? 1.3 : 0.7;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + j * ch);
        ctx.lineTo(x0 + paper.cols * cw, y0 + j * ch);
        ctx.stroke();
      }
    } else if (paper.type === 'ruled' || paper.type === 'notebook') {
      const step = m.lineStep;
      const x0 = m.left - 12, x1 = W - m.right + 8;
      for (let y = m.top + step * 0.15; y < H - m.bottom + 4; y += step) {
        ctx.globalAlpha = paper.tone === 'white' ? 0.7 : 0.62;
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      }
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = paper.type === 'notebook' ? '#d98a80' : c;
      ctx.beginPath(); ctx.moveTo(m.left - 24, m.top - 10); ctx.lineTo(m.left - 24, H - m.bottom + 12); ctx.stroke();
      if (paper.type === 'notebook') {
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 0.5;
        for (let x = m.left; x < W - m.right; x += step) {
          ctx.beginPath(); ctx.moveTo(x, m.top); ctx.lineTo(x, H - m.bottom); ctx.stroke();
        }
      }
    } else if (paper.type === 'math') {
      const step = m.lineStep;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 0.55;
      for (let x = m.left; x <= W - m.right + 1; x += step) {
        ctx.beginPath(); ctx.moveTo(x, m.top); ctx.lineTo(x, H - m.bottom); ctx.stroke();
      }
      for (let y = m.top; y <= H - m.bottom + 1; y += step) {
        ctx.beginPath(); ctx.moveTo(m.left, y); ctx.lineTo(W - m.right, y); ctx.stroke();
      }
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1;
      ctx.strokeRect(m.left, m.top, W - m.left - m.right, H - m.top - m.bottom);
    } else if (paper.type === 'tian' || paper.type === 'mi') {
      const step = m.lineStep;
      const x0 = m.left, x1 = W - m.right;
      let idx = 0;
      for (let y = m.top; y + step <= H - m.bottom + 1; y += step) {
        for (let x = x0; x + step <= x1 + 1; x += step) {
          ctx.globalAlpha = 0.68; ctx.lineWidth = 0.8;
          ctx.strokeRect(x, y, step, step);
          ctx.save();
          ctx.globalAlpha = 0.30; ctx.lineWidth = 0.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(x + step / 2, y); ctx.lineTo(x + step / 2, y + step); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y + step / 2); ctx.lineTo(x + step, y + step / 2); ctx.stroke();
          if (paper.type === 'mi') {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + step, y + step); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + step, y); ctx.lineTo(x, y + step); ctx.stroke();
          }
          ctx.restore();
          idx++;
        }
      }
    }
    ctx.restore();
  }

  global.HWPapers = {
    LIST: LIST,
    GROUPS: (function () { const g = []; LIST.forEach(function (p) { if (g.indexOf(p.group) < 0) g.push(p.group); }); return g; })(),
    get: function (key) { return BY_KEY[key] || LIST[0]; },
    metrics: metrics,
    draw: drawPaper,
    MM: MM
  };
})(window);
