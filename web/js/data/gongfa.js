/* =====================================================================
 * 数据：功法 & 法术
 * ---------------------------------------------------------------------
 * 【功法】六大类，每类加成一种属性（固定数值，不是百分比）：
 *   心法 → 防御      功诀 → 攻击      真经 → 气血上限
 *   秘诀 → 修炼速度  身法 → 命中      遁术 → 闪避      法诀 → 法力上限
 *   真诀 → 本门派属性的抗性（金木水火土雷之一，v15）
 * 每个门派每类功法分 天、地、玄、黄 四阶，名字如：青阳心法（黄阶）
 * 必须学会至少一部秘诀才能修炼。
 *
 * 【法术】每个门派有 金木水火土雷 六系法术，同样分 天地玄黄 四阶。
 *   施放消耗法力。伤害 = 攻击 × 百分比 + 固定伤害；修炼法术层数只增加固定伤害
 *
 * 【来源类型】功法内部标记来源：sect 宗门功法（功法殿，贡献）、shop 凡界坊市功法（坊市，灵石）
 *   所有数值 = 基础属性 × 类型倍率 × 星级倍率 × 阶倍率 × 各自 EFFECT（config/gongfa.js）
 *
 * 功法、法术都是 12 层：功法殿首次学习消耗贡献，学会即第 1 层；
 * 之后在“功法”页修炼升层：需要时间（见 studyMin），修炼期间每 5 秒消耗一次修为；
 * 可排队，队列最多 GF_QUEUE 个。
 * ===================================================================== */

// 四阶（顺序：黄 → 天，越往后越强）；倍率在 config/gongfa.js 各来源的 TIER_MULT
const _GF = CFG.gongfa;
DATA.tiers = [
  { id: "huang", name: "黄阶" }, { id: "xuan", name: "玄阶" }, { id: "di", name: "地阶" }, { id: "tian", name: "天阶" },
];
DATA.tierById = Object.fromEntries(DATA.tiers.map((t, i) => [t.id, Object.assign(t, { idx: i })]));

// 功法类别：stat = 加成的属性（数值见 config/gongfa.js 的 base）
DATA.gongfaTypes = [
  { id: "xinfa",    name: "心法", suffix: "心法", stat: "def",       label: "防御" },
  { id: "gongjue",  name: "功诀", suffix: "诀",   stat: "atk",       label: "攻击" },
  { id: "zhenjing", name: "真经", suffix: "真经", stat: "hp",        label: "气血上限" },
  { id: "mijue",    name: "秘诀", suffix: "秘诀", stat: "cultivate", label: "修炼速度" },
  { id: "shenfa",   name: "身法", suffix: "身法", stat: "hit",       label: "命中" },
  { id: "dunshu",   name: "遁术", suffix: "遁术", stat: "dodge",     label: "闪避" },
  { id: "fajue",    name: "法诀", suffix: "法诀", stat: "mana",      label: "法力上限" },
  { id: "zhenjue",  name: "真诀", suffix: "真诀", stat: "res",       label: "抗性" }, // 抗性属性 = 来源属性
];

/* 功法来源类型（内部标记）：sect 宗门功法、shop 凡界坊市功法；以后加新类型在这里加一行 + config 加一组 */
DATA.gfSources = {
  sect: { name: "宗门", cfg: () => _GF.sect },
  shop: { name: "坊市", cfg: () => _GF.shop },
};

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
DATA.GONGFA_MAX = _GF.MAX;
DATA.GF_QUEUE = _GF.QUEUE;
DATA.STUDY_STEP = _GF.STUDY_STEP;
DATA.studyMin = _GF.STUDY_MIN;

/* ---------- 凡界坊市功法的「来源」（相当于一个门派，每星 2 个，id f星级_序号） ---------- */
DATA.SHOP_GF_PREFIX = [["凡尘", "游侠"], ["市井", "散修"], ["江湖", "野狐"], ["云游", "隐士"], ["山野", "苦行"], ["红尘", "天涯"]];
DATA.shopSources = [];
DATA.SHOP_GF_PREFIX.forEach((pair, i) => pair.forEach((prefix, n) => {
  const star = i + 1;
  DATA.shopSources.push({ id: `f${star}_${n}`, src: "shop", star, prefix, name: prefix + "传承", el: DATA.elements[(star * 2 + n) % 6].id,
    reqRealm: (_GF.shop.REQ_REALM || [])[i] || 0 });
}));
// 所有来源：门派（src = "sect"）+ 坊市
DATA.gfSrcById = Object.assign({}, ...DATA.sects.map(x => ({ [x.id]: x })), ...DATA.shopSources.map(x => ({ [x.id]: x })));
DATA.srcType = o => o.src || "sect";
DATA.srcCfg = o => DATA.gfSources[DATA.srcType(o)].cfg();

/* 通用算法：基础属性 × 类型倍率 × 星级倍率 × 阶倍率 × EFFECT
 *   o 来源（门派或坊市）、typeId 类别 id（法术 = "spell"）、key = base 里的项、eff = EFFECT 名 */
DATA.gfCalc = (o, typeId, tier, key, eff) => {
  const C = DATA.srcCfg(o), b = (C.base || {})[key] || 0;
  const tm = (C.TYPE_MULT || {})[typeId], sm = (C.STAR_MULT || [])[o.star - 1], tr = (C.TIER_MULT || {})[tier.id], e = C[eff];
  return b * (tm === undefined ? 1 : tm) * (sm === undefined ? 1 : sm) * (tr === undefined ? 1 : tr) * (e === undefined ? 1 : e);
};

// 修炼升层（当前层 → 下一层）消耗的修为（分摊到每 STUDY_STEP 秒扣）
DATA.studyExp = info => {
  const C = DATA.srcCfg(info.sect), lvm = (C.STUDY_LV || [])[info.lv - 1];
  return Math.max(1, Math.floor(DATA.gfCalc(info.sect, info.kind === "sp" ? "spell" : info.type.id, info.tier, "study", "EFFECT_STUDY") * (lvm === undefined ? 1 : lvm)));
};
// 学习所需：宗门 = 贡献，坊市 = 灵石
DATA.gfLearnCost = (o, typeId, tier) => DATA.srcType(o) === "shop"
  ? Math.floor(DATA.gfCalc(o, typeId, tier, "price", "EFFECT_PRICE"))
  : Math.floor(DATA.gfCalc(o, typeId, tier, "learn", "EFFECT_LEARN"));
// 宗门功法学习需要的职务
DATA.tierRank = tier => ((_GF.sect.TIER_RANK || {})[tier.id]) || 0;

/* ---------- 功法 ----------
 * id 规则："来源id:类别id:阶id"，例如 "s1_0:mijue:huang"（门派）、"f1_0:mijue:huang"（坊市） */
DATA.gongfaId = (sectId, typeId, tierId) => `${sectId}:${typeId}:${tierId}`;
DATA.gongfaInfo = (id, lv = 1) => {
  const [sectId, typeId, tierId] = id.split(":");
  const sect = DATA.gfSrcById[sectId], type = DATA.gongfaTypes.find(x => x.id === typeId), tier = DATA.tierById[tierId];
  if (!sect || !type || !tier) return null;
  const per = DATA.gfCalc(sect, type.id, tier, type.stat, "EFFECT_GONGFA");
  return {
    kind: "gf", id, sect, src: DATA.srcType(sect), star: sect.star, type, tier, lv, el: DATA.elById[sect.el],
    label: type.stat === "res" ? DATA.elById[sect.el].name + "抗性" : type.label, // 显示用：真诀写成「火抗性」等
    name: DATA.gongfaName(sect, type, tier),
    value: per * lv,                              // 当前加成（固定数值）
    perLv: per,                                   // 每层加成
    cost: DATA.gfLearnCost(sect, type.id, tier),  // 首次学习：宗门 = 贡献，坊市 = 灵石
  };
};

/* ---------- 法术 ----------
 * id 规则："来源id:sp:系id:阶id"，例如 "s1_0:sp:huo:huang" */
DATA.spellId = (sectId, elId, tierId) => `${sectId}:sp:${elId}:${tierId}`;
DATA.isSpell = id => id.split(":")[1] === "sp";
DATA.spellInfo = (id, lv = 1) => {
  const [sectId, , elId, tierId] = id.split(":");
  const sect = DATA.gfSrcById[sectId], el = DATA.elements.find(x => x.id === elId), tier = DATA.tierById[tierId];
  if (!sect || !el || !tier) return null;
  const per = DATA.gfCalc(sect, "spell", tier, "spell", "EFFECT_SPELL"); // 每层固定伤害
  return {
    kind: "sp", id, sect, src: DATA.srcType(sect), star: sect.star, el, tier, lv,
    name: DATA.spellName(sect, el, tier),
    pct: Math.round(DATA.gfCalc(sect, "spell", tier, "pct", "EFFECT_PCT")),        // 攻击百分比
    flat: per * lv, perLv: per,                                                    // 固定伤害
    mana: Math.max(0, Math.floor(DATA.gfCalc(sect, "spell", tier, "spellMana", "EFFECT_MANA"))), // 法力消耗
    cost: DATA.gfLearnCost(sect, "spell", tier),
  };
};

// 通用：功法或法术
DATA.skillInfo = (id, lv) => DATA.isSpell(id) ? DATA.spellInfo(id, lv) : DATA.gongfaInfo(id, lv);
