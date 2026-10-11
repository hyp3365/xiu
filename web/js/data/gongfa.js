/* =====================================================================
 * 数据：功法 & 法术
 * ---------------------------------------------------------------------
 * 【功法】六大类，每类加成一种属性（固定数值，不是百分比）：
 *   心法 → 防御      功诀 → 攻击      真经 → 气血上限
 *   秘诀 → 修炼速度  身法 → 命中      遁术 → 闪避      法诀 → 法力上限
 * 每个门派每类功法分 天、地、玄、黄 四阶，名字如：青阳心法（黄阶）
 * 必须学会至少一部秘诀才能修炼。
 *
 * 【法术】每个门派有 金木水火土雷 六系法术，同样分 天地玄黄 四阶。
 *   施放消耗法力。伤害 = 攻击 × 百分比 + 固定伤害
 *   百分比：1 星门派 100%，每多 1 星 +30%（9 星 340%）
 *   修炼法术层数只增加固定伤害（不加百分比）
 *
 * 功法、法术都是 12 层：功法殿首次学习消耗贡献，学会即第 1 层；
 * 之后在“功法”页修炼升层：需要时间（见 studyMin），修炼期间每 5 秒消耗一次修为；
 * 可排队，队列最多 GF_QUEUE 个。
 * ===================================================================== */

// 四阶：mult 数值倍率，cost 学习/修炼消耗倍率（顺序：黄 → 天，越往后越强）
// （倍率在 js/config/ 下的数值文件 的 gongfa.tiers）
const _GF = CFG.gongfa;
DATA.tiers = [
  { id: "huang", name: "黄阶" }, { id: "xuan", name: "玄阶" }, { id: "di", name: "地阶" }, { id: "tian", name: "天阶" },
].map(t => Object.assign(t, _GF.tiers[t.id]));
DATA.tierById = Object.fromEntries(DATA.tiers.map((t, i) => [t.id, Object.assign(t, { idx: i })]));

/* k：每层基础加成（config/gongfa.js 的 base；没写的项按 基础属性 × EFFECT / HIT_DODGE_K） */
const _GB = _GF.base || {};
const _gk = (stat, dflt) => _GB[stat] !== undefined ? _GB[stat] : dflt;
DATA.gongfaTypes = [
  { id: "xinfa",    name: "心法", suffix: "心法", stat: "def",       k: _gk("def", DATA.playerBase.def * _GF.EFFECT),       label: "防御" },
  { id: "gongjue",  name: "功诀", suffix: "诀",   stat: "atk",       k: _gk("atk", DATA.playerBase.atk * _GF.EFFECT),       label: "攻击" },
  { id: "zhenjing", name: "真经", suffix: "真经", stat: "hp",        k: _gk("hp", DATA.playerBase.hp * _GF.EFFECT),        label: "气血上限" },
  { id: "mijue",    name: "秘诀", suffix: "秘诀", stat: "cultivate", k: _gk("cultivate", DATA.playerBase.cultivate * _GF.EFFECT), label: "修炼速度" },
  { id: "shenfa",   name: "身法", suffix: "身法", stat: "hit",       k: _gk("hit", _GF.HIT_DODGE_K),                           label: "命中" },
  { id: "dunshu",   name: "遁术", suffix: "遁术", stat: "dodge",     k: _gk("dodge", _GF.HIT_DODGE_K),                           label: "闪避" },
  { id: "fajue",    name: "法诀", suffix: "法诀", stat: "mana",      k: _gk("mana", DATA.playerBase.mana * _GF.EFFECT),      label: "法力上限" },
];
DATA.FLAT_STATS = ["hit", "dodge"]; // 只随星级、不随门派强度成长的属性

/* 六种属性。words：起名用的词（门派前缀 + 随机词 + 后缀，如 青阳 + 赤炎 + 心法）
 * 每个门派从 本属性词 + 通用词 里随机（按门派固定）选，保证同门派功法不重名。 */
DATA.elements = [
  { id: "jin",  name: "金", words: ["庚金", "太白", "锐金", "金罡", "白虎", "破军", "金乌", "裂空", "万剑", "斩月", "天锋", "铁骨", "金鳞", "兵煞", "金光", "断岳"] },
  { id: "mu",   name: "木", words: ["青木", "长春", "乙木", "苍藤", "万木", "青帝", "枯荣", "建木", "灵椿", "碧叶", "回春", "扶桑", "青莲", "生生", "翠微", "古藤"] },
  { id: "shui", name: "水", words: ["玄水", "癸水", "寒潭", "沧溟", "弱水", "碧波", "冰魄", "玄冥", "潮生", "天河", "凝霜", "北海", "流泉", "雪魄", "九渊", "沧浪"] },
  { id: "huo",  name: "火", words: ["赤炎", "离火", "丙火", "焚天", "朱雀", "烈阳", "红莲", "三昧", "金乌", "炎龙", "流火", "焚心", "火鸦", "南明", "赤霄", "炽阳"] },
  { id: "tu",   name: "土", words: ["厚土", "戊土", "镇岳", "玄黄", "息壤", "磐石", "山河", "后土", "不动", "大地", "坤元", "黄庭", "撼山", "岩甲", "千仞", "载物"] },
  { id: "lei",  name: "雷", words: ["紫霄", "神霄", "九霄", "惊雷", "奔雷", "天罚", "雷音", "掌心", "五雷", "玄雷", "雷霆", "紫电", "天劫", "震霄", "破虚", "引雷"] },
];
DATA.elById = Object.fromEntries(DATA.elements.map(e => [e.id, e]));
DATA.COMMON_WORDS = ["太虚", "混元", "归元", "无相", "紫府", "玄妙", "长生", "通天", "周天", "大衍", "两仪", "太乙",
  "玉清", "灵虚", "抱朴", "逍遥", "凌云", "浩然", "天罡", "北斗", "星河", "鸿蒙", "九转", "不灭"];
DATA.spellSuffix = ["术", "诀", "印", "神通"]; // 法术后缀：黄 玄 地 天

// 同一门派固定的随机词表（按门派 id 洗牌，结果每次都一样）
DATA._words = {};
DATA.sectWords = sect => {
  if (DATA._words[sect.id]) return DATA._words[sect.id];
  const el = DATA.elById[sect.el] || DATA.elements[0];
  const list = [...el.words, ...DATA.COMMON_WORDS].filter(w => w !== sect.prefix);
  let h = 0; for (const c of sect.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = list.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [list[i], list[j]] = [list[j], list[i]]; }
  return (DATA._words[sect.id] = list);
};
// 功法名：门派前缀 + 随机词 + 类别后缀（每个 类别×阶 用不同的词）
DATA.gongfaName = (sect, type, tier) => {
  const w = DATA.sectWords(sect), ti = DATA.gongfaTypes.indexOf(type);
  return sect.prefix + w[(ti * 4 + tier.idx) % w.length] + type.suffix;
};
// 法术名：门派前缀 + 随机词 + 阶后缀（用本属性的词）
DATA.spellName = (sect, el, tier) => {
  const w = DATA.sectWords(sect), d = (DATA.elements.indexOf(el) - DATA.elements.indexOf(DATA.elById[sect.el]) + 6) % 6;
  return sect.prefix + w[(28 + (d * 4 + tier.idx) % 12) % w.length] + DATA.spellSuffix[tier.idx];
};
DATA.starMult = sect => _GF.STAR_MULT[sect.star - 1] || 1;

DATA.GONGFA_MAX = _GF.MAX;
DATA.GF_QUEUE = _GF.QUEUE;
DATA.STUDY_STEP = _GF.STUDY_STEP;
DATA.studyMin = _GF.STUDY_MIN;

// 门派强度：星级越高，数值越大
DATA.sectL = sect => sect.reqRealm * DATA.LAYERS;
DATA.sectPower = sect => Math.pow(DATA.GROW, DATA.sectL(sect) + (_GF.POWER_OFFSET !== undefined ? _GF.POWER_OFFSET : 5));

// 修炼升层总共消耗修为：0.5 × 修为需求(门派入门层序 + 当前层 - 1) × 阶倍率（分摊到每 5 秒扣）
DATA.studyExp = info => Math.floor(_GF.STUDY_EXP_RATE * DATA.needExp(DATA.sectL(info.sect) + info.lv - 1) * info.tier.cost);

/* ---------- 功法 ----------
 * id 规则："门派id:类别id:阶id"，例如 "s1_0:mijue:huang" */
DATA.gongfaId = (sectId, typeId, tierId) => `${sectId}:${typeId}:${tierId}`;
DATA.gongfaInfo = (id, lv = 1) => {
  const [sectId, typeId, tierId] = id.split(":");
  const sect = DATA.sectById[sectId], type = DATA.gongfaTypes.find(x => x.id === typeId), tier = DATA.tierById[tierId];
  if (!sect || !type || !tier) return null;
  const per = (DATA.FLAT_STATS.includes(type.stat) ? type.k * sect.star : type.k * DATA.sectPower(sect)) * tier.mult * DATA.starMult(sect);
  return {
    kind: "gf", id, sect, type, tier, lv, el: DATA.elById[sect.el],
    name: DATA.gongfaName(sect, type, tier),
    value: per * lv,                              // 当前加成（固定数值）
    perLv: per,                                   // 每层加成
    cost: Math.floor(_GF.LEARN_GF * sect.star * sect.star * tier.cost), // 功法殿首次学习所需贡献
  };
};

/* ---------- 法术 ----------
 * id 规则："门派id:sp:系id:阶id"，例如 "s1_0:sp:huo:huang" */
DATA.spellId = (sectId, elId, tierId) => `${sectId}:sp:${elId}:${tierId}`;
DATA.isSpell = id => id.split(":")[1] === "sp";
DATA.spellInfo = (id, lv = 1) => {
  const [sectId, , elId, tierId] = id.split(":");
  const sect = DATA.sectById[sectId], el = DATA.elements.find(x => x.id === elId), tier = DATA.tierById[tierId];
  if (!sect || !el || !tier) return null;
  const P = DATA.sectPower(sect);
  const per = DATA.playerBase.atk * P * _GF.SPELL_FLAT * tier.mult * DATA.starMult(sect); // 每层固定伤害
  return {
    kind: "sp", id, sect, el, tier, lv,
    name: DATA.spellName(sect, el, tier),
    pct: _GF.PCT_BASE + _GF.PCT_PER_STAR * (sect.star - 1),                         // 攻击百分比
    flat: per * lv, perLv: per,                               // 固定伤害
    mana: Math.floor(DATA.playerBase.mana * P * _GF.SPELL_MANA * (1 + tier.idx * (_GF.SPELL_MANA_TIER !== undefined ? _GF.SPELL_MANA_TIER : 0.4))), // 法力消耗
    cost: Math.floor(_GF.LEARN_SP * sect.star * sect.star * tier.cost), // 首次学习所需贡献
  };
};

// 通用：功法或法术
DATA.skillInfo = (id, lv) => DATA.isSpell(id) ? DATA.spellInfo(id, lv) : DATA.gongfaInfo(id, lv);
