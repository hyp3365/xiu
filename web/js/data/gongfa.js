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
DATA.tiers = [
  { id: "huang", name: "黄阶", mult: 1,   cost: 1 },
  { id: "xuan",  name: "玄阶", mult: 1.8, cost: 3 },
  { id: "di",    name: "地阶", mult: 3.2, cost: 10 },
  { id: "tian",  name: "天阶", mult: 5.5, cost: 30 },
];
DATA.tierById = Object.fromEntries(DATA.tiers.map((t, i) => [t.id, Object.assign(t, { idx: i })]));

/* k：每层加成系数。攻防血法修速 = k × 门派强度 × 阶倍率；命中/闪避 = k × 星级 × 阶倍率 */
DATA.gongfaTypes = [
  { id: "xinfa",    name: "心法", suffix: "心法", stat: "def",       k: DATA.playerBase.def * 0.25,       label: "防御" },
  { id: "gongjue",  name: "功诀", suffix: "诀",   stat: "atk",       k: DATA.playerBase.atk * 0.25,       label: "攻击" },
  { id: "zhenjing", name: "真经", suffix: "真经", stat: "hp",        k: DATA.playerBase.hp * 0.25,        label: "气血上限" },
  { id: "mijue",    name: "秘诀", suffix: "秘诀", stat: "cultivate", k: DATA.playerBase.cultivate * 0.25, label: "修炼速度" },
  { id: "shenfa",   name: "身法", suffix: "身法", stat: "hit",       k: 3,                                label: "命中" },
  { id: "dunshu",   name: "遁术", suffix: "遁术", stat: "dodge",     k: 3,                                label: "闪避" },
  { id: "fajue",    name: "法诀", suffix: "法诀", stat: "mana",      k: DATA.playerBase.mana * 0.25,      label: "法力上限" },
];
DATA.FLAT_STATS = ["hit", "dodge"]; // 只随星级、不随门派强度成长的属性

// 六系法术（name 为法术名后缀，如 青阳·金光剑诀）
DATA.elements = [
  { id: "jin",  name: "金", spell: "金光剑诀" },
  { id: "mu",   name: "木", spell: "青藤缚灵" },
  { id: "shui", name: "水", spell: "玄水箭" },
  { id: "huo",  name: "火", spell: "烈焰焚天" },
  { id: "tu",   name: "土", spell: "落石术" },
  { id: "lei",  name: "雷", spell: "掌心雷" },
];

DATA.GONGFA_MAX = 12;
DATA.GF_QUEUE = 15;   // 修炼队列上限
DATA.STUDY_STEP = 5;  // 每 5 秒扣一次修为
// 修炼升层所需时间（分钟）：第 1→2 层 3 分钟 …… 第 11→12 层 15 小时
DATA.studyMin = [3, 10, 30, 60, 120, 240, 360, 480, 600, 720, 900];

// 门派强度：星级越高，数值越大
DATA.sectL = sect => sect.reqRealm * DATA.LAYERS;
DATA.sectPower = sect => Math.pow(DATA.GROW, DATA.sectL(sect) + 5);

// 修炼升层总共消耗修为：0.5 × 修为需求(门派入门层序 + 当前层 - 1) × 阶倍率（分摊到每 5 秒扣）
DATA.studyExp = info => Math.floor(0.5 * DATA.needExp(DATA.sectL(info.sect) + info.lv - 1) * info.tier.cost);

/* ---------- 功法 ----------
 * id 规则："门派id:类别id:阶id"，例如 "s1_0:mijue:huang" */
DATA.gongfaId = (sectId, typeId, tierId) => `${sectId}:${typeId}:${tierId}`;
DATA.gongfaInfo = (id, lv = 1) => {
  const [sectId, typeId, tierId] = id.split(":");
  const sect = DATA.sectById[sectId], type = DATA.gongfaTypes.find(x => x.id === typeId), tier = DATA.tierById[tierId];
  if (!sect || !type || !tier) return null;
  const per = DATA.FLAT_STATS.includes(type.stat) ? type.k * sect.star * tier.mult : type.k * DATA.sectPower(sect) * tier.mult;
  return {
    kind: "gf", id, sect, type, tier, lv,
    name: sect.prefix + type.suffix,
    value: per * lv,                              // 当前加成（固定数值）
    perLv: per,                                   // 每层加成
    cost: Math.floor(10 * sect.star * sect.star * tier.cost), // 功法殿首次学习所需贡献
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
  const per = DATA.playerBase.atk * P * 0.3 * tier.mult;     // 每层固定伤害
  return {
    kind: "sp", id, sect, el, tier, lv,
    name: `${sect.prefix}·${el.spell}`,
    pct: 100 + 30 * (sect.star - 1),                          // 攻击百分比
    flat: per * lv, perLv: per,                               // 固定伤害
    mana: Math.floor(DATA.playerBase.mana * P * 0.15 * (1 + tier.idx * 0.4)), // 法力消耗
    cost: Math.floor(15 * sect.star * sect.star * tier.cost), // 首次学习所需贡献
  };
};

// 通用：功法或法术
DATA.skillInfo = (id, lv) => DATA.isSpell(id) ? DATA.spellInfo(id, lv) : DATA.gongfaInfo(id, lv);
