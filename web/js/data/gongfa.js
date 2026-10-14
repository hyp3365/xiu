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
 *   伤害 = 攻击 × 伤害倍率% + 固定伤害；伤害倍率、法力消耗随 星级 × 阶 × 层数 × 人物境界 增长（config/gongfa.js）
 *
 * 【宗门秘法】悟道室学习，同星级门派共用，1~10 星每星 9 部（config/wudao.js），id "w星级:mf:种类"
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
// 名字在 config/names.js（gfTier / gfType / gfSource / element / gfWords / spellSuffix / shopGf / towerGf / mifa / mifaStar）
const _NM = CFG.names;
DATA.tiers.forEach(t => { t.name = DATA.nmPick(_NM.gfTier, t.id, t.name); });
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
  { id: "tijue",    name: "肉身秘诀", suffix: "炼体诀", stat: "body", label: "肉身修炼速度", sectOnly: true }, // 修炼肉身的前提；只在宗门功法殿学习
];

DATA.gongfaTypes.forEach(t => { const n = (_NM.gfType || {})[t.id]; if (n) { t.name = DATA.nmPick(n, 0, t.name); t.suffix = DATA.nmPick(n, 1, t.suffix); } });

/* 功法来源类型（内部标记）：sect 宗门功法、shop 凡界坊市功法；以后加新类型在这里加一行 + config 加一组 */
DATA.gfSources = {
  sect: { name: "宗门", cfg: () => _GF.sect },
  shop: { name: "坊市", cfg: () => _GF.shop },
  tower: { name: "试炼塔", cfg: () => _GF.tower || _GF.sect },   // v25：试炼塔秘诀
};

for (const k in DATA.gfSources) DATA.gfSources[k].name = DATA.nmPick(_NM.gfSource, k, DATA.gfSources[k].name);

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
DATA.elements.forEach(e => { e.name = DATA.nmPick(_NM.element, e.id, e.name); if ((_NM.gfWords || {})[e.id]) e.words = DATA.nmArr(_NM.gfWords[e.id], e.words); });
DATA.elById = Object.fromEntries(DATA.elements.map(e => [e.id, e]));
DATA.COMMON_WORDS = ["太虚", "混元", "归元", "无相", "紫府", "玄妙", "长生", "通天", "周天", "大衍", "两仪", "太乙",
  "玉清", "灵虚", "抱朴", "逍遥", "凌云", "浩然", "天罡", "北斗", "星河", "鸿蒙", "九转", "不灭"];
if ((_NM.gfWords || {}).common) DATA.COMMON_WORDS = DATA.nmArr(_NM.gfWords.common, DATA.COMMON_WORDS);
DATA.spellSuffix = ["术", "诀", "印", "神通"].map((x, i) => DATA.nmPick(_NM.spellSuffix, DATA.tiers[i].id, x)); // 法术后缀：黄 玄 地 天

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
// v25：改成更有修仙味道的名字（id 不变，旧存档已学的功法跟着改名）
DATA.SHOP_GF_PREFIX = [["青冥", "云笈"], ["琼华", "栖霞"], ["抱朴", "听松"], ["凌虚", "洞玄"], ["玄真", "星槎"], ["丹霞", "太微"]];
DATA.shopSources = [];
DATA.SHOP_GF_PREFIX.forEach((pair, i) => pair.forEach((prefix, n) => {
  const star = i + 1;
  const id = `f${star}_${n}`; prefix = DATA.nmPick(_NM.shopGf, id, prefix);
  DATA.shopSources.push({ id, src: "shop", star, prefix, name: prefix + DATA.nmPick(_NM, "shopGfSuffix", "传承"), el: DATA.elements[(star * 2 + n) % 6].id,
    reqRealm: DATA.sectReq(star) });   // 境界要求 = 同星级门派
}));
/* ---------- v25：试炼塔秘诀的「来源」（每星一个，id t星级，只有秘诀） ---------- */
DATA.TOWER_GF_PREFIX = ["问心", "登仙", "通玄", "摘星", "揽月", "踏虚", "擎天", "证道", "归真", "登极"];
DATA.towerSources = DATA.TOWER_GF_PREFIX.map((p0, i) => DATA.nmPick(_NM.towerGf, `t${i + 1}`, p0)).map((prefix, i) => ({ id: `t${i + 1}`, src: "tower", star: i + 1, prefix, name: prefix + DATA.nmPick(_NM, "towerGfSuffix", "塔"), el: DATA.elements[i % 6].id, reqRealm: -1 }));
// 第 star 星试炼塔秘诀某一阶的功法 id
DATA.towerMijueId = (star, tierId) => `t${star}:mijue:${tierId}`;
// 所有来源：门派（src = "sect"）+ 坊市 + 试炼塔
DATA.gfSrcById = Object.assign({}, ...DATA.sects.map(x => ({ [x.id]: x })), ...DATA.shopSources.map(x => ({ [x.id]: x })), ...DATA.towerSources.map(x => ({ [x.id]: x })));
DATA.srcType = o => o.src || "sect";
DATA.srcCfg = o => DATA.gfSources[DATA.srcType(o)].cfg();

/* 通用算法：基础数值 × 类型倍率 × 星级倍率 × 阶倍率 × EFFECT
 *   基础数值：所有来源共用 CFG.gongfa.base；学习价格另算（gfLearnCost）
 *   o 来源、typeId 类别 id（法术 = "spell"）、key = base 里的项、eff = EFFECT 名 */
DATA.gfBase = (C, key) => { const B = _GF.base || {}; return B[key] !== undefined ? B[key] : C[key] !== undefined ? C[key] : (C.base || {})[key] || 0; };
DATA.gfCalc = (o, typeId, tier, key, eff) => {
  const C = DATA.srcCfg(o), b = DATA.gfBase(C, key);
  const tm = (C.TYPE_MULT || {})[typeId], sm = (C.STAR_MULT || [])[o.star - 1], tr = (C.TIER_MULT || {})[tier.id], e = C[eff];
  return b * (tm === undefined ? 1 : tm) * (sm === undefined ? 1 : sm) * (tr === undefined ? 1 : tr) * (e === undefined ? 1 : e);
};

// 层数倍率：第 lv 层效果 = 每层效果 × LV_MULT[lv-1]（没写就是 lv）
DATA.lvMul = lv => { const m = (_GF.LV_MULT || [])[lv - 1]; return m === undefined ? lv : m; };
// 修炼：每 5 秒消耗修为 = STUDY_RATE × STUDY_STAR[星级-1] × STUDY_TIER[阶]（不乘层数）
DATA.studyPer = info => { const v = (x, d) => x === undefined ? d : x; if (info.per) return info.per;
  return Math.max(1, Math.floor(v(_GF.STUDY_RATE, 5) * v((_GF.STUDY_STAR || [])[info.star - 1], info.star) * v((_GF.STUDY_TIER || {})[info.tier.id], 1))); };
// 当前层 → 下一层一共消耗的修为 = 每 5 秒消耗 × 次数（由这一层的修炼时间决定）
DATA.studySteps = lv => Math.ceil(DATA.studyMin[lv - 1] * 60 / DATA.STUDY_STEP);
DATA.studyExp = info => DATA.studyPer(info) * DATA.studySteps(info.lv);
// 学习所需：宗门 = 贡献，坊市 = 灵石
DATA.gfLearnCost = (o, typeId, tier) => {
  if (DATA.srcType(o) !== "shop") {   // 宗门学习贡献单独设置：learn × LEARN_TYPE × LEARN_STAR × LEARN_TIER × EFFECT_LEARN（不用效果倍率）
    const C = DATA.srcCfg(o), v = (x, d = 1) => x === undefined ? d : x;
    return Math.floor(v(C.learn, 0) * v((C.LEARN_TYPE || {})[typeId]) * v((C.LEARN_STAR || [])[o.star - 1]) * v((C.LEARN_TIER || {})[tier.id]) * v(C.EFFECT_LEARN));
  }
  // 坊市售价单独设置：base.price × PRICE_TYPE × PRICE_STAR × PRICE_TIER × EFFECT_PRICE
  const C = _GF.shop, v = (x, d = 1) => x === undefined ? d : x;
  return Math.floor(v(C.price !== undefined ? C.price : (C.base || {}).price, 0) * v((C.PRICE_TYPE || {})[typeId]) * v((C.PRICE_STAR || [])[o.star - 1]) * v((C.PRICE_TIER || {})[tier.id]) * v(C.EFFECT_PRICE));
};
// 宗门功法学习需要的职务
DATA.tierRank = tier => ((_GF.sect.TIER_RANK || {})[tier.id]) || 0;

/* ---------- 功法 ----------
 * id 规则："来源id:类别id:阶id"，例如 "s1_0:mijue:huang"（门派）、"f1_0:mijue:huang"（坊市） */
DATA.gongfaId = (sectId, typeId, tierId) => `${sectId}:${typeId}:${tierId}`;
// 开局功法书（config/start.js 的 book）：id "start:mijue:huang"，无属性，层数上限 MAX
DATA.START_GF = "start:mijue:huang";
DATA.startGfInfo = (lv = 1) => {
  const B = CFG.start.book || {}, type = DATA.gongfaTypes.find(x => x.id === "mijue"), sp = B.SPEED || 0;
  return { kind: "gf", id: DATA.START_GF, src: "start", star: 0, type, tier: DATA.tierById.huang, lv, noEl: true, el: { id: "", name: "" },
    max: B.MAX || 1, studyMin: B.STUDY_MIN || [], per: B.STUDY_PER || 1,
    label: type.label, name: B.name || "练气诀", value: sp * lv, next: sp * (lv + 1), perLv: sp, cost: 0 };
};
DATA.gongfaInfo = (id, lv = 1) => {
  if (id === DATA.START_GF) return DATA.startGfInfo(lv);
  const [sectId, typeId, tierId] = id.split(":");
  const sect = DATA.gfSrcById[sectId], type = DATA.gongfaTypes.find(x => x.id === typeId), tier = DATA.tierById[tierId];
  if (!sect || !type || !tier) return null;
  const per = DATA.gfCalc(sect, type.id, tier, type.stat, "EFFECT_GONGFA");
  return {
    kind: "gf", id, sect, src: DATA.srcType(sect), star: sect.star, type, tier, lv, el: DATA.elById[sect.el],
    label: type.stat === "res" ? DATA.elById[sect.el].name + "抗性" : type.label, // 显示用：真诀写成「火抗性」等
    name: DATA.gongfaName(sect, type, tier),
    value: per * DATA.lvMul(lv),                  // 当前加成（固定数值）
    next: per * DATA.lvMul(lv + 1),               // 下一层的加成
    perLv: per,                                   // 每层加成
    cost: DATA.gfLearnCost(sect, type.id, tier),  // 首次学习：宗门 = 贡献，坊市 = 灵石
  };
};

/* ---------- 法术 ----------
 * id 规则："来源id:sp:系id:阶id"，例如 "s1_0:sp:huo:huang" */
DATA.spellId = (sectId, elId, tierId) => `${sectId}:sp:${elId}:${tierId}`;
DATA.isSpell = id => id.split(":")[1] === "sp";
DATA.spellInfo = (id, lv = 1, realm) => {
  const [sectId, , elId, tierId] = id.split(":");
  const sect = DATA.gfSrcById[sectId], el = DATA.elements.find(x => x.id === elId), tier = DATA.tierById[tierId];
  if (!sect || !el || !tier) return null;
  const per = DATA.gfCalc(sect, "spell", tier, "spell", "EFFECT_SPELL"); // 每层固定伤害
  const C = DATA.srcCfg(sect), v = (x, d = 1) => x === undefined ? d : x, tm = v((C.TYPE_MULT || {}).spell);
  const R = realm !== undefined ? realm : (typeof G !== "undefined" && G.s && !G.s.mortal ? Math.floor(G.s.L / DATA.LAYERS) : 0);
  const ri = Math.min(R, 23), last = a => a && a.length ? v(a[ri], a[a.length - 1]) : 1;
  return {
    kind: "sp", id, sect, src: DATA.srcType(sect), star: sect.star, el, tier, lv,
    name: DATA.spellName(sect, el, tier),
    // 伤害倍率% = SPELL_PCT × 星级 × 阶 × 层数 × 境界（× 来源倍率）
    pct: Math.round(v(_GF.SPELL_PCT, 100) * v((_GF.SPELL_STAR || [])[sect.star - 1]) * v((_GF.SPELL_TIER || {})[tier.id]) * lv * last(_GF.SPELL_REALM) * tm * v(C.EFFECT_PCT)),
    flat: per * DATA.lvMul(lv), next: per * DATA.lvMul(lv + 1), perLv: per,         // 固定伤害
    // 法力消耗 = SPELL_MANA × 阶 × 星级 × 层数倍率 × 境界 × 灵根倍率（灵根倍率 = 1 + 该系灵根等级 × MANA_LINGEN）
    mana: Math.max(1, Math.round(v(_GF.SPELL_MANA, 1) * v((_GF.MANA_TIER || {})[tier.id]) * v((_GF.MANA_STAR || [])[sect.star - 1])
      * (_GF.MANA_LV && _GF.MANA_LV.length ? v(_GF.MANA_LV[lv - 1], _GF.MANA_LV[_GF.MANA_LV.length - 1]) : lv) * last(_GF.MANA_REALM)
      * (1 + (typeof G !== "undefined" && G.s && G.s.lingen ? G.s.lingen[el.id] || 0 : 0) * v(_GF.MANA_LINGEN, 0)))),
    cost: DATA.gfLearnCost(sect, "spell", tier),
  };
};

// 通用：功法、法术或秘法
DATA.skillInfo = (id, lv) => DATA.isSpell(id) ? DATA.spellInfo(id, lv) : DATA.isMifa(id) ? DATA.mifaInfo(id, lv) : DATA.gongfaInfo(id, lv);

/* ---------- 宗门秘法 ----------
 * id 规则："w星级:mf:种类"，例如 "w3:mf:expSpeed"。el 只用来选图片，灵根对秘法无效 */
DATA.mifaKinds = [
  { id: "mpBattle",  name: "斗灵秘法", label: "战斗法力恢复", unit: "%", sign: "+", el: "shui" },
  { id: "mpIdle",    name: "养灵秘法", label: "平时法力恢复", unit: "%", sign: "+", el: "shui" },
  { id: "hpBattle",  name: "斗血秘法", label: "战斗气血恢复", unit: "%", sign: "+", el: "mu" },
  { id: "hpIdle",    name: "养血秘法", label: "平时气血恢复", unit: "%", sign: "+", el: "mu" },
  { id: "spStudy",   name: "悟法秘法", label: "法术修炼时间", unit: "秒", sign: "-", el: "lei" },
  { id: "gfStudy",   name: "悟道秘法", label: "功法修炼时间", unit: "秒", sign: "-", el: "jin" },
  { id: "expSpeed",  name: "聚元秘法", label: "修为修炼速度", unit: "", sign: "+", el: "huo" },
  { id: "bodySpeed", name: "炼体秘法", label: "气血修炼速度", unit: "", sign: "+", el: "tu" },
  { id: "explore",   name: "神行秘法", label: "历练探索每步", unit: "秒", sign: "-", el: "jin" },
  { id: "danTime",   name: "丹火秘法", label: "炼丹时间", unit: "%", sign: "-", el: "huo" },
  { id: "danRate",   name: "丹心秘法", label: "炼丹成功率", unit: "%", sign: "+", el: "huo" },
  { id: "danExtra",  name: "丹灵秘法", label: "炼丹额外一颗几率", unit: "%", sign: "+", el: "huo" },
  { id: "qiTime",    name: "器火秘法", label: "炼器时间", unit: "%", sign: "-", el: "jin" },
  { id: "qiRate",    name: "器心秘法", label: "炼器成功率", unit: "%", sign: "+", el: "jin" },
  { id: "plantTime", name: "育灵秘法", label: "灵药生长时间", unit: "%", sign: "-", el: "mu" },
  { id: "plantYield",name: "丰灵秘法", label: "灵药收获数量", unit: "%", sign: "+", el: "mu" },
  { id: "lianxing",  name: "连星秘法", label: "连续出手几率", unit: "%", sign: "+", el: "lei", full: true },   // 圆满才生效（config/wudao.js LIANXING）
];
DATA.mifaKinds.forEach(k => { k.name = DATA.nmPick(_NM.mifa, k.id, k.name); });
DATA.mifaKindById = Object.fromEntries(DATA.mifaKinds.map(k => [k.id, k]));
DATA.MIFA_PREFIX = ["一元", "两仪", "三才", "四象", "五行", "六合", "七星", "八荒", "九宫", "十方"].map((x, i) => DATA.nmPick(_NM.mifaStar, i + 1, x));
DATA.MIFA_TIER = { id: "mifa", name: "秘法", idx: 0 };
DATA.mifaId = (star, kind) => `w${star}:mf:${kind}`;
DATA.isMifa = id => id.split(":")[1] === "mf";
DATA.mifaLearnCost = star => { const W = CFG.wudao, m = (W.STAR_COST || [])[star - 1] || 1; return { stone: Math.floor(W.LEARN_STONE * m), contrib: Math.floor(W.LEARN_CONTRIB * m) }; };
DATA.mifaInfo = (id, lv = 1) => {
  const [w, , kind] = id.split(":"), star = +w.slice(1), K = DATA.mifaKindById[kind], W = CFG.wudao;
  if (!K || !(star >= 1 && star <= 10)) return null;
  const per = kind === "lianxing" ? (((W.LIANXING || {}).STAR || [])[star - 1] || 0) : kind === "explore" && W.SHENXING ? (W.SHENXING[star - 1] || 0) : (W.base[kind] || 0) * ((W.STAR_MULT || [])[star - 1] || 1), max = DATA.GONGFA_MAX;
  // 神行：修到圆满才生效一次（不乘层数）
  const val = l => kind === "explore" || K.full ? (l >= max ? per : 0) : per * DATA.lvMul(l);
  return { kind: "mf", id, star, mk: K, tier: DATA.MIFA_TIER, lv, el: DATA.elById[K.el], label: K.label,
    name: `${DATA.MIFA_PREFIX[star - 1] || star + "星"}·${K.name}`, value: val(lv), next: val(lv + 1), perLv: per,
    cost: DATA.mifaLearnCost(star),
    stonePer: Math.floor((W.STUDY_STONE || 0) * ((W.STAR_COST || [])[star - 1] || 1)) };   // 修炼每 5 秒灵石
};
