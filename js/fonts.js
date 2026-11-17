/* 字体表：与官网一致的字体名称 + 真实可用的手写字体映射 */
(function (global) {
  'use strict';

  const CJK_FALLBACK = '"HW_KaiTi","KaiTi","楷体","Microsoft YaHei",serif';
  const LATIN_FALLBACK = '"HW_Caveat","Segoe Print","Comic Sans MS",cursive';

  function F(id, label, group, family, opt) {
    return Object.assign({
      id: id,
      label: label,
      group: group,
      family: family,
      fallback: CJK_FALLBACK,
      bold: 0,
      slant: 0,
      sizeScale: 1,
      tracking: 0,
      jitterScale: 1,
      ink: 1
    }, opt || {});
  }

  const BASE = [
    F('likelike', '栗壳坚坚体', '中文手写', '"HW_ZCOOLKuaiLe"', { tracking: 0.4 }),
    F('pingfang', '平方洒脱体 (适合中英文夹杂)', '中文手写', '"HW_MaShanZheng"', { sizeScale: 1.04, jitterScale: 1.1 }),
    F('yingbi', '硬笔楷书 (注意: 各汉语字体均默认支持英文)', '中文手写', '"HW_KleeOne"', { sizeScale: 0.94, bold: 0.2 }),
    F('xinnian', '新叶念体', '中文手写', '"HW_LongCang"', { slant: -0.03 }),
    F('shouxieti1', '手写体体1', '中文手写', '"HW_ZhiMangXing"', { sizeScale: 1.06, jitterScale: 1.25 }),
    F('wangqiang', '王强手写体', '中文手写', '"HW_LiuJianMaoCao"', { sizeScale: 1.02, ink: 0.92 }),
    F('ximaixihuan', '喜脉喜欢体', '中文手写', '"HW_ZCOOLXiaoWei"', { sizeScale: 0.98 }),
    F('chillzhuopig', 'ChillZhuopigtruman手写体', '其他语言', '"HW_Caveat"', { fallback: LATIN_FALLBACK, sizeScale: 1.18, slant: -0.04 }),
    F('fanti', '繁体-辰宇落雁体', '繁体 / 日文 / 韩文', '"HW_STXingkai"', { sizeScale: 1.02, jitterScale: 1.15 }),
    F('riwen', '日文-TekitouPoem', '繁体 / 日文 / 韩文', '"HW_YujiSyuku"', { sizeScale: 0.98 }),
    F('hanwen', '韩文-KimjungchulScript', '繁体 / 日文 / 韩文', '"HW_NanumPenScript"', { sizeScale: 1.05 }),
    F('en_caveat', '英文-Caveat 连笔', '其他语言', '"HW_Caveat"', { fallback: LATIN_FALLBACK, sizeScale: 1.18 }),
    F('en_kalam', '英文-Kalam 手札', '其他语言', '"HW_Kalam"', { fallback: LATIN_FALLBACK, sizeScale: 1.05 }),
    F('en_patrick', '英文-Patrick Hand', '其他语言', '"HW_PatrickHand"', { fallback: LATIN_FALLBACK }),
    F('en_gloria', '英文-Gloria Hallelujah', '其他语言', '"HW_GloriaHallelujah"', { fallback: LATIN_FALLBACK, jitterScale: 1.2 }),
    F('en_shadow', '英文-Shadows Into Light', '其他语言', '"HW_ShadowsIntoLight"', { fallback: LATIN_FALLBACK, sizeScale: 1.12 }),
    F('en_indie', '英文-Indie Flower', '其他语言', '"HW_IndieFlower"', { fallback: LATIN_FALLBACK }),
    F('en_dancing', '英文-Dancing Script', '其他语言', '"HW_DancingScript"', { fallback: LATIN_FALLBACK, sizeScale: 1.15 }),
    F('en_mistral', '英文-Mistral 花体', '其他语言', '"HW_Mistral"', { fallback: LATIN_FALLBACK, sizeScale: 1.12, slant: -0.06 }),
    F('en_pristina', '英文-Pristina 圆体', '其他语言', '"HW_Pristina"', { fallback: LATIN_FALLBACK, sizeScale: 1.16 })
  ];

  // 「真实-手写体 1~12」：不同真实笔迹字体 + 独立书写参数，加粗版叠加描边
  const REAL = [
    ['"HW_ZhiMangXing"', { sizeScale: 1.05, jitterScale: 1.3, slant: -0.02 }],
    ['"HW_MaShanZheng"', { sizeScale: 1.0, jitterScale: 1.0 }],
    ['"HW_LongCang"', { sizeScale: 1.02, jitterScale: 1.12, slant: 0.02 }],
    ['"HW_LiuJianMaoCao"', { sizeScale: 1.0, jitterScale: 1.2, ink: 0.9 }],
    ['"HW_KleeOne"', { sizeScale: 0.93, jitterScale: 0.8, bold: 0.25 }],
    ['"HW_ZCOOLKuaiLe"', { sizeScale: 0.98, jitterScale: 0.9 }],
    ['"HW_STXingkai"', { sizeScale: 1.03, jitterScale: 1.15 }],
    ['"HW_FZShuTi"', { sizeScale: 1.04, jitterScale: 1.1, slant: 0.03 }],
    ['"HW_YouYuan"', { sizeScale: 0.96, jitterScale: 0.85 }],
    ['"HW_XinWei"', { sizeScale: 1.02, jitterScale: 1.05, slant: -0.03 }],
    ['"HW_ZCOOLXiaoWei"', { sizeScale: 0.97, jitterScale: 0.95 }],
    ['"HW_STKaiti"', { sizeScale: 0.95, jitterScale: 0.9, bold: 0.2 }]
  ];

  const LIST = [];
  // 官网字形逆向库：从官网服务端渲染结果逐字抠出并矢量化，字形与官网平方洒脱体一致
  LIST.push(F('official', '平方洒脱体【官网字形逆向】', '官网逆向', '"HW_OfficialRecon"', {
    sizeScale: 1.0, jitterScale: 0.35, tracking: 0.1, ink: 1, bold: 0, slant: 0,
    narrowAscii: true, asciiFamily: '"HW_Caveat"'
  }));
  // 我的真迹字库：从 9 张真实手写照片提取笔迹，逐字随机取真迹变体
  LIST.push(F('zx', 'zx（我的手写 · 真迹字库）', '我的手写', '"HW_zx"', {
    sizeScale: 0.97, jitterScale: 1.18, tracking: -0.35, ink: 0.9, bold: 0, slant: 0
  }));
  // 前 5 项按官网顺序
  LIST.push(BASE[0], BASE[1], BASE[2], BASE[3], BASE[4]);
  for (let i = 1; i <= 12; i++) {
    const src = REAL[i - 1];
    LIST.push(F('real' + i, '真实-手写体' + i + (i === 4 ? ' (向下滑动查看更多字体)' : ''), '真实笔迹系列', src[0], src[1]));
    LIST.push(F('real' + i + 'b', '真实-手写体' + i + '-加粗', '真实笔迹系列', src[0], Object.assign({}, src[1], { bold: 1.6 })));
  }
  LIST.push(BASE[5], BASE[6], BASE[7]);
  LIST.push(BASE[8], BASE[9], BASE[10]);
  BASE.slice(11).forEach(function (f) { LIST.push(f); });

  const BY_ID = {};
  LIST.forEach(function (f) { BY_ID[f.id] = f; });

  const GROUPS = [];
  LIST.forEach(function (f) { if (GROUPS.indexOf(f.group) < 0) GROUPS.push(f.group); });

  const FILE_FAMILIES = [
    'HW_OfficialRecon',
    'HW_zx',
    'HW_MaShanZheng', 'HW_ZhiMangXing', 'HW_LongCang', 'HW_LiuJianMaoCao',
    'HW_ZCOOLKuaiLe', 'HW_ZCOOLXiaoWei', 'HW_KleeOne', 'HW_YujiSyuku',
    'HW_NanumPenScript', 'HW_Caveat', 'HW_Kalam', 'HW_PatrickHand',
    'HW_GloriaHallelujah', 'HW_ShadowsIntoLight', 'HW_IndieFlower', 'HW_DancingScript'
  ];

  async function preload(onProgress) {
    if (!document.fonts || !document.fonts.load) return;
    let done = 0;
    for (const fam of FILE_FAMILIES) {
      try { await document.fonts.load('32px "' + fam + '"', '手写测试稿纸ABCabc123'); } catch (e) { /* 单个字体失败不影响其余 */ }
      done++;
      if (onProgress) onProgress(done, FILE_FAMILIES.length, fam);
    }
    try { await document.fonts.ready; } catch (e) { }
  }

  global.HWFonts = {
    LIST: LIST,
    GROUPS: GROUPS,
    get: function (id) { return BY_ID[id] || LIST[0]; },
    preload: preload,
    fileFamilies: FILE_FAMILIES
  };
})(window);
