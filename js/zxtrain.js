/* ZX 真迹字库扩充：字帖 → 手写照片 → 四角透视校正 → 切格 → 入库 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var COLS = 10, ROWS = 10, CELL = 64;
  // 高频汉字表：留空时按频次分页出字帖，写满 6 页即可覆盖 600 个常用字。
  // 若粘贴自己的文章，字帖直接用文章里的字，生成时全文都是真迹。
  var DEFAULT_CHARS = (
    '的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日想那相资与只没结解问重最已并间月长给受务正新些意明看知条比或但质气第向道命此变只没结解问重最已并间月长合给受务正新' +
    '手并听水太全才书心又回且见先老员及世放设光立几计场东做处皮必口北车白身名 tea'.replace(/[^一-龥]/g, '') +
    '华南海口市区县村街路号楼单元室姓名班级学号日期页第题号答错对批改老师同学朋友父母家兄弟姐妹孩男女衣食住行钱价买售卖店商厂公室办公司医院学校图书馆车站机场码头公园山河湖海天云风雨雪雷电春夏秋冬早午晚夜今明昨后前左右上下内外东南西北中' +
    '看见听说读写听说想知记忘爱恨喜悲怒哀乐笑哭怕惊急慢快忙闲累困睡醒坐立走跑跳站躺趴拿放开关推拉抬举提抱背扛提打拍摸擦洗刷扫整理收拾打扫清洁干净整齐漂亮美丽丑陋新旧老少大小长短高矮胖瘦粗细宽窄厚薄轻重软硬冷热温凉酸甜苦辣咸淡香臭' +
    '工作学习生活休息吃饭喝水睡觉起床洗脸刷牙穿衣脱鞋出门回家上班下班加班请假迟到早退开会讨论研究分析报告总结计划安排准备开始结束继续停止等待寻找发现解决处理完成成功失败错误正确大概可能应该必须一定肯定也许或许或者但是因为所以如果虽然即使' +
    '时间时候年月日分钟秒星期季度世纪现在过去未来刚才马上立刻忽然突然渐渐慢慢常常往往总是一起一块单独全部整个部分有些没有很多非常特别十分比较更最很太挺quite'.replace(/[^一-龥]/g, '') +
    '这里那里哪里这里那些这样那样怎么什么为什么谁多少几个第一第二第三第四最后首先然后接着于是因此而且并且不过只是还有就是也是不不是没别再又还也才就都总又再可却倒偏竟' +
    '字句段篇行文章课本笔记作业考试分数成绩题目内容意思方法道理原因结果过程情况问题办法方式条件环境关系作用影响变化发展提高降低增加减少出现发生存在问题需要希望愿意打算' +
    '请麻烦谢谢对不起没关系再见您好你们他们我们咱们大家自己别人谁的每个各另某一切所有任何某些部分其余剩下另外同时另外此外另外以及与其不如宁可' +
    '见字如面收信平安顺利身体健康万事如意心想事成工作顺利学习进步天天开心一切安好勿念盼复此致敬礼祝好问候想念挂念惦记记得曾经从前如今以后将来永远暂时偶尔时常从来向来一直' +
    '春夏秋冬风花雪月梅兰竹菊笔墨纸砚琴棋书画诗词歌赋山水田园城乡街巷楼台亭阁门窗桌椅床柜灯烛杯盘碗筷刀尺针线布帛衣帽鞋袜' +
    '红橙黄绿青蓝紫黑白灰粉 brown'.replace(/[^一-龥]/g, '') + '深浅明暗浓淡鲜艳素雅' +
    '一二三四五六七八九十百千万亿零半两双对群批套组行列排层叠片块条根颗粒点滴丝缕' +
    '听说读写算记背抄默练复习预习听讲发言提问回答讨论交流分享合作帮助照顾关心体贴理解体谅原谅感谢道歉祝福庆祝纪念回忆忘记记得认识熟悉陌生'
  );

  var S = { chars: [], img: null, pts: [], cells: [], scale: 1, page: 0 };

  function toast(msg, bad) {
    var e = $('zxResult');
    e.textContent = msg;
    e.style.color = bad ? '#b3372c' : '#4a5b70';
  }

  function uniq(str, max) {
    var seen = {}, out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (/[\s\u3000]/.test(c) || seen[c]) continue;
      seen[c] = 1; out.push(c);
      if (out.length >= max) break;
    }
    return out;
  }

  // ---------- 字帖 ----------
  function makePaper() {
    var txt = $('zxText').value.trim();
    var pool = uniq(txt || DEFAULT_CHARS, 100000);
    var pages = Math.max(1, Math.ceil(pool.length / 100));
    if (S.page >= pages) S.page = 0;
    S.chars = pool.slice(S.page * 100, S.page * 100 + 100);
    while (S.chars.length < 100) S.chars.push('　');
    var info = $('zxPageInfo');
    if (info) info.textContent = '第 ' + (S.page + 1) + ' / ' + pages + ' 页 · 共 ' + pool.length + ' 字';
    var W = 1240, H = 1754, cv = $('zxPaper');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#333'; c.font = 'bold 34px "Microsoft YaHei",sans-serif';
    c.fillText('ZX 真迹字帖 · 用黑色笔在每格内照着写', 60, 62);
    c.fillStyle = '#888'; c.font = '19px "Microsoft YaHei",sans-serif';
    c.fillText('写满格子，不要写出格；写完拍一张光线均匀、拍满整张纸的照片上传。', 60, 96);
    var ox = 60, oy = 140, cell = 112;
    for (var r = 0; r < ROWS; r++) {
      for (var col = 0; col < COLS; col++) {
        var x = ox + col * cell, y = oy + r * cell;
        c.strokeStyle = '#c9c4b8'; c.lineWidth = 1.4;
        c.strokeRect(x, y, cell, cell);
        var ch = S.chars[r * COLS + col];
        c.fillStyle = '#e2ded4';
        c.font = '68px "KaiTi","楷体","Microsoft YaHei",serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(ch, x + cell / 2, y + cell / 2 + 3);
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.fillStyle = '#bbb'; c.font = '11px sans-serif';
        c.fillText(String(r * COLS + col + 1), x + 4, y + 13);
      }
    }
    c.fillStyle = '#999'; c.font = '17px "Microsoft YaHei",sans-serif';
    c.fillText('拾帧工具 · ZX 真迹字库扩充 · 第 ' + (S.page + 1) + ' / ' + pages + ' 页 · 本页可打印',
      60, oy + ROWS * cell + 46);
    toast('字帖第 ' + (S.page + 1) + '/' + pages + ' 页：' +
      S.chars.filter(function (c) { return c !== '　'; }).length +
      ' 个字。打印手写 → 拍照上传 → 入库；换下一页重复一次，同一字会自动累积多个写法。');
  }

  function downloadPaper() {
    var a = document.createElement('a');
    a.download = 'ZX真迹字帖_第' + (S.page + 1) + '页.png';
    a.href = $('zxPaper').toDataURL('image/png');
    a.click();
  }

  function printPaper() {
    var w = window.open('', '_blank');
    if (!w) { toast('浏览器拦截了打印窗口，请改用「下载字帖 PNG」后打印', true); return; }
    w.document.write('<!doctype html><title>ZX 字帖</title><body style="margin:0">' +
      '<img src="' + $('zxPaper').toDataURL('image/png') + '" style="width:100%;display:block" onload="setTimeout(function(){window.print()},250)"></body>');
    w.document.close();
  }

  // ---------- 上传与四角 ----------
  function loadPhoto(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        S.img = im; S.pts = [];
        var cv = $('zxShot');
        var w = Math.min(760, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth);
        cv.width = w; cv.height = h;
        S.scale = im.naturalWidth / w;
        drawShot();
        toast('照片已载入。依次点击纸张的 左上 → 右上 → 右下 → 左下 四个角（已点 ' + S.pts.length + '/4）。');
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  function drawShot() {
    var cv = $('zxShot'), c = cv.getContext('2d');
    if (!S.img) { c.clearRect(0, 0, cv.width, cv.height); return; }
    c.drawImage(S.img, 0, 0, cv.width, cv.height);
    if (S.pts.length) {
      c.strokeStyle = 'rgba(214,54,42,.9)'; c.lineWidth = 2;
      c.beginPath();
      S.pts.forEach(function (p, i) { if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); });
      if (S.pts.length === 4) c.closePath();
      c.stroke();
      S.pts.forEach(function (p, i) {
        c.fillStyle = '#d6362a'; c.beginPath(); c.arc(p.x, p.y, 6, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.fillText(String(i + 1), p.x - 3, p.y + 4);
      });
    }
  }

  function defaultPts() {
    var cv = $('zxShot'), w = cv.width, h = cv.height;
    return [
      { x: w * 0.03, y: h * 0.03 }, { x: w * 0.97, y: h * 0.03 },
      { x: w * 0.97, y: h * 0.97 }, { x: w * 0.03, y: h * 0.97 }
    ];
  }

  // ---------- 透视变换 ----------
  function solve(A, b) {
    var n = b.length, M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (var k = 0; k < n; k++) {
      var p = k;
      for (var i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      var t = M[k]; M[k] = M[p]; M[p] = t;
      if (Math.abs(M[k][k]) < 1e-12) continue;
      for (var j = k + 1; j < n; j++) {
        var f = M[j][k] / M[k][k];
        for (var q = k; q <= n; q++) M[j][q] -= f * M[k][q];
      }
    }
    var x = new Array(n).fill(0);
    for (var i2 = n - 1; i2 >= 0; i2--) {
      var s = M[i2][n];
      for (var j2 = i2 + 1; j2 < n; j2++) s -= M[i2][j2] * x[j2];
      x[i2] = Math.abs(M[i2][i2]) < 1e-12 ? 0 : s / M[i2][i2];
    }
    return x;
  }

  function homography(src, dst) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i].x, y = src[i].y, u = dst[i].x, v = dst[i].y;
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = solve(A, b);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  function mapH(H, x, y) {
    var d = H[6] * x + H[7] * y + H[8];
    return { x: (H[0] * x + H[1] * y + H[2]) / d, y: (H[3] * x + H[4] * y + H[5]) / d };
  }

  function warpGray(img, src4, W, H) {
    var sc = document.createElement('canvas');
    sc.width = img.naturalWidth; sc.height = img.naturalHeight;
    var sx = sc.getContext('2d'); sx.drawImage(img, 0, 0);
    var sd = sx.getImageData(0, 0, sc.width, sc.height).data;
    var SW = sc.width, SH = sc.height;
    var dst4 = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    var Hi = homography(dst4, src4);
    var out = new Uint8Array(W * H);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var p = mapH(Hi, x, y);
        var fx = p.x, fy = p.y;
        if (fx < 0 || fy < 0 || fx >= SW - 1 || fy >= SH - 1) { out[y * W + x] = 255; continue; }
        var x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
        var i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
        var g = 0;
        for (var k = 0; k < 3; k++) {
          var v = sd[i00 + k] * (1 - ax) * (1 - ay) + sd[i10 + k] * ax * (1 - ay) +
            sd[i01 + k] * (1 - ax) * ay + sd[i11 + k] * ax * ay;
          g += v * (k === 1 ? 0.6 : 0.2);
        }
        out[y * W + x] = g;
      }
    }
    return out;
  }

  function otsu(gray) {
    var hist = new Float64Array(256);
    for (var i = 0; i < gray.length; i++) hist[gray[i]]++;
    var total = gray.length, sum = 0;
    for (var t = 0; t < 256; t++) sum += t * hist[t];
    var wB = 0, sumB = 0, best = 0, thr = 150;
    for (var t2 = 0; t2 < 256; t2++) {
      wB += hist[t2]; if (!wB) continue;
      var wF = total - wB; if (!wF) break;
      sumB += t2 * hist[t2];
      var d = sumB / wB - (sum - sumB) / wF;
      var v = wB * wF * d * d;
      if (v > best) { best = v; thr = t2; }
    }
    return Math.max(70, Math.min(215, thr));
  }

  function cellToDataURL(gray, W, H, x0, y0, cw, ch, thr) {
    var pad = Math.round(cw * 0.07);
    var ax = x0 + pad, ay = y0 + pad, aw = cw - pad * 2, ah = ch - pad * 2;
    var minx = aw, miny = ah, maxx = -1, maxy = -1, cnt = 0;
    var buf = new Uint8Array(aw * ah);
    for (var y = 0; y < ah; y++) {
      for (var x = 0; x < aw; x++) {
        var gx = ax + x, gy = ay + y;
        if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
        var v = gray[gy * W + gx];
        var ink = v < thr * 0.96 ? Math.min(255, Math.round((thr * 0.96 - v) * 3.0)) : 0;
        buf[y * aw + x] = ink;
        if (ink > 55) {
          cnt++; if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
      }
    }
    if (cnt < 12 || maxx < minx || maxy < miny) return null;
    var bw = maxx - minx + 1, bh = maxy - miny + 1;
    var s = Math.min((CELL - 8) / bw, (CELL - 8) / bh);
    var dw = Math.max(2, Math.round(bw * s)), dh = Math.max(2, Math.round(bh * s));
    var ox = Math.floor((CELL - dw) / 2), oy = Math.floor((CELL - dh) / 2);
    var cv = document.createElement('canvas'); cv.width = CELL; cv.height = CELL;
    var c = cv.getContext('2d');
    var id = c.createImageData(CELL, CELL), d = id.data;
    for (var yy = 0; yy < dh; yy++) {
      for (var xx = 0; xx < dw; xx++) {
        var srcx = minx + Math.floor(xx / s), srcy = miny + Math.floor(yy / s);
        var a = buf[srcy * aw + srcx];
        var px = ox + xx, py = oy + yy;
        if (px < 0 || py < 0 || px >= CELL || py >= CELL) continue;
        var o = (py * CELL + px) * 4;
        d[o] = 28; d[o + 1] = 34; d[o + 2] = 46; d[o + 3] = a;
      }
    }
    c.putImageData(id, 0, 0);
    var ratio = bw / bh;
    return { url: cv.toDataURL('image/png'), emW: Math.max(160, Math.min(1180, 860 * ratio)), emH: 860 };
  }

  function cut() {
    if (!S.img) { toast('先上传手写照片', true); return; }
    if (!S.chars.length) makePaper();
    var pts = S.pts.length === 4 ? S.pts.map(function (p) { return { x: p.x * S.scale, y: p.y * S.scale }; }) :
      defaultPts().map(function (p) { return { x: p.x * S.scale, y: p.y * S.scale }; });
    toast('正在做透视校正与切格…');
    var W = 1000, H = 1414;
    var gray = warpGray(S.img, pts, W, H);
    var thr = otsu(gray);
    var gx0 = W * 0.0484, gy0 = H * 0.0798, gside = W * 0.9032;
    var cw = gside / COLS, ch = gside / ROWS;
    S.cells = [];
    for (var r = 0; r < ROWS; r++) {
      for (var col = 0; col < COLS; col++) {
        var idx = r * COLS + col, ch2 = S.chars[idx];
        var g = cellToDataURL(gray, W, H, gx0 + col * cw, gy0 + r * ch, cw, ch, thr);
        S.cells.push({ ch: ch2, data: g, on: !!g && ch2 !== '　' });
      }
    }
    renderCells();
    var ok = S.cells.filter(function (c) { return c.data; }).length;
    toast('切格完成：识别到 ' + ok + ' / 100 个有笔迹的格子（阈值 ' + Math.round(thr) + '）。核对后点「把勾选的字入库」。');
  }

  function renderCells() {
    var box = $('zxCells'); box.innerHTML = '';
    S.cells.forEach(function (c, i) {
      var d = document.createElement('div'); d.className = 'zxcell' + (c.on ? '' : ' off');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = c.on;
      cb.onchange = function () { c.on = cb.checked; d.className = 'zxcell' + (c.on ? '' : ' off'); };
      var im = document.createElement('img'); im.src = c.data ? c.data.url : '';
      var sp = document.createElement('span'); sp.textContent = c.ch + ' · ' + (i + 1);
      d.appendChild(cb); d.appendChild(im); d.appendChild(sp);
      box.appendChild(d);
    });
  }

  function saveCells() {
    var n = 0;
    S.cells.forEach(function (c) {
      if (!c.on || !c.data || c.ch === '　') return;
      if (window.HWZX.addUser(c.ch, c.data.url, c.data.emW, c.data.emH)) n++;
    });
    refreshStat();
    toast('已入库 ' + n + ' 个真迹样本。回到首页选择 zx 字体即可使用，刷新后依然有效。');
  }

  function refreshStat() {
    var s = window.HWZX ? HWZX.stats() : { officialChars: 0, officialVariants: 0, userChars: 0, userVariants: 0 };
    $('zxStat').innerHTML = '当前 zx 字库：内置真迹 <b>' + s.officialChars + '</b> 字 / <b>' + s.officialVariants +
      '</b> 个笔迹变体（从 9 张真实手写照片提取）；你补充 <b>' + s.userChars + '</b> 字 / <b>' + s.userVariants +
      '</b> 个变体。未覆盖的汉字由按你字迹参数重绘的 zx.ttf 补全，整篇可正常成稿。' +
      (s.params ? ' 实测参数：右倾 ' + s.params.slantDeg + '°、宽高比 ' + s.params.aspect + '、笔画 ' + s.params.strokeWidth + 'px。' : '');
  }

  function exportUser() {
    if (!window.HWZX) return;
    var d = HWZX.dump();
    var blob = new Blob([JSON.stringify(d)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '我的ZX真迹字库.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function importUser(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var n = HWZX.restore(JSON.parse(rd.result));
        refreshStat(); toast('导入完成，共 ' + n + ' 个真迹样本。');
      } catch (e) { toast('字库文件解析失败：' + e.message, true); }
    };
    rd.readAsText(file);
  }

  function bind() {
    $('zxMake').onclick = function () { S.page = 0; makePaper(); };
    $('zxPrev').onclick = function () { S.page = Math.max(0, S.page - 1); makePaper(); };
    $('zxNext').onclick = function () { S.page = S.page + 1; makePaper(); };
    $('zxText').addEventListener('input', function () { S.page = 0; });
    $('zxDownload').onclick = downloadPaper;
    $('zxPrint').onclick = printPaper;
    $('zxPhoto').onchange = function () { if (this.files[0]) loadPhoto(this.files[0]); };
    $('zxResetPts').onclick = function () { S.pts = []; drawShot(); toast('四角已重置，请重新依次点击 4 个角。'); };
    $('zxShot').onclick = function (e) {
      if (!S.img) return;
      var b = this.getBoundingClientRect();
      var x = (e.clientX - b.left) * (this.width / b.width);
      var y = (e.clientY - b.top) * (this.height / b.height);
      if (S.pts.length >= 4) S.pts = [];
      S.pts.push({ x: x, y: y }); drawShot();
      toast('已点 ' + S.pts.length + '/4 个角' + (S.pts.length === 4 ? '，可以点「切格并识别」了。' : '。'));
    };
    $('zxCut').onclick = function () { setTimeout(cut, 20); };
    $('zxSave').onclick = saveCells;
    $('zxAll').onclick = function () { S.cells.forEach(function (c) { c.on = !!c.data && c.ch !== '　'; }); renderCells(); };
    $('zxNone').onclick = function () { S.cells.forEach(function (c) { c.on = false; }); renderCells(); };
    $('zxExport').onclick = exportUser;
    $('zxImport').onclick = function () { $('zxImportFile').click(); };
    $('zxImportFile').onchange = function () { if (this.files[0]) importUser(this.files[0]); };
    $('zxClear').onclick = function () {
      if (!confirm('确定清空自己补充的全部真迹样本？内置 9 张照片提取的字库不受影响。')) return;
      HWZX.clearUser(); refreshStat(); toast('已清空我的补充。');
    };
  }

  async function init() {
    bind();
    if (window.HWZX) { try { await HWZX.load(); } catch (e) { } }
    refreshStat();
    makePaper();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
