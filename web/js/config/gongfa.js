/* =====================================================================
 * ★ 数值设置 · 功法 & 法术 ★
 * ---------------------------------------------------------------------
 * 改完把 index.html 里的 ?v=数字 加 1。
 *
 * 效果和获得消耗是两套公式，互不影响：
 *   效果用 base、TYPE_MULT、STAR_MULT、TIER_MULT、EFFECT_*；
 *   宗门学习贡献用 learn、LEARN_*；坊市售价用 price、PRICE_*；修炼消耗用 STUDY_*
 *
 * 一、所有功法、法术共用一套基础数值（base）
 *   每层效果 = 基础数值 × 来源的类型倍率 × 星级倍率 × 阶倍率 × EFFECT
 *   第 n 层效果 = 每层效果 × 层数倍率 LV_MULT[n-1]
 *
 * 二、修炼升层
 *   每 5 秒消耗修为 = STUDY_RATE × STUDY_STAR[星级-1] × STUDY_TIER[阶]（不乘层数）
 *   每层需要的时间 = STUDY_MIN，时间到就升层
 *   所以每层一共消耗的修为 = 每 5 秒消耗 × (时间 ÷ 5 秒)，由修炼时间决定
 *
 * 三、来源（各自的倍率、学习价格）
 *   sect   宗门功法（门派功法殿，用贡献学习）
 *   shop   凡界坊市功法（坊市「功法」页，用灵石购买，1~6 星）
 *   tower  试炼塔秘诀（试炼塔奖励，每星一部）
 * ===================================================================== */
window.CFG = window.CFG || {};

CFG.gongfa = {
  MAX: 10,           // 最高层数
  QUEUE: 15,         // 修炼队列上限
  STUDY_STEP: 5,     // 修炼期间每几秒扣一次修为

  // ---------- 修炼 ----------
  // 每层修炼所需时间（分钟）：第 1 个 = 1→2 层 …… 第 11 个 = 11→12 层
  STUDY_MIN: [2, 5, 10, 30, 60, 120, 180, 240, 300],
  // 每 5 秒消耗修为 = STUDY_RATE × STUDY_STAR[星级-1] × STUDY_TIER[阶]（不乘层数）
  //   例：3 星玄阶功法：10 × 400 × 3 = 12000 修为 / 5 秒（每层都一样，层数越高只是时间越长）
  STUDY_RATE: 10,
  STUDY_STAR: [3, 50, 400, 1200, 4000, 8000, 15000, 24000, 35000, 50000],   // 1 ~ 10 星
  STUDY_TIER: { huang: 1, xuan: 3, di: 6, tian: 10 },   // 黄 玄 地 天

  // ---------- 基础数值（所有功法、法术通用） ----------
  base: {
    def: 5,          // 心法 → 每层防御
    atk: 5,          // 功诀 → 每层攻击
    hp: 10,          // 真经 → 每层气血
    cultivate: 5,    // 秘诀 → 每层修炼速度
    hit: 5,          // 身法 → 每层命中
    dodge: 5,        // 遁术 → 每层闪避
    mana: 5,         // 法诀 → 每层法力
    res: 5,          // 真诀 → 每层本门属性抗性
    body: 5,         // 肉身秘诀 → 每层肉身修炼速度
    spell: 6,       // 法术 → 每层固定伤害
  },
  // 层数倍率：第 n 层效果 = 每层效果 × LV_MULT[n-1]（第 1 个 = 第 1 层 …… 第 12 个 = 第 12 层）
  LV_MULT: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],

  // ---------- 法术：伤害倍率、法力消耗 ----------
  // 法术伤害 = 攻击 × 伤害倍率% + 固定伤害
  // 伤害倍率% = SPELL_PCT × SPELL_STAR[星级-1] × SPELL_TIER[阶] × 法术层数 × SPELL_REALM[人物大境界]
  // 法力消耗 = SPELL_MANA × MANA_STAR[星级-1] × MANA_TIER[阶] × MANA_REALM[人物大境界]
  //   （再 × 来源的 TYPE_MULT.spell 和 EFFECT_PCT / EFFECT_MANA，坊市法术就是 0.8）
  //   人物大境界：第 1 个 = 练气（凡人也按练气）…… 第 24 个 = 大道圣人
  SPELL_PCT: 100,
  SPELL_STAR: [1, 1.3, 1.6, 1.9, 2.2, 2.5, 2.7, 3, 3.3, 3.6],
  SPELL_TIER: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  SPELL_REALM: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3, 3.1, 3.2, 3.3],
  SPELL_MANA: 0.5,
  MANA_STAR: [1, 1.3, 1.6, 1.9, 2.2, 2.5, 2.7, 3, 3.3, 3.6],
  MANA_TIER: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  // 默认 = 人物法力的境界成长（1.12^10 ≈ 3.11 倍 / 境界），这样消耗占法力的比例不随境界变化
  MANA_REALM: [1, 3.11, 9.65, 30, 93.1, 289, 898, 2790, 8660, 26900, 83500, 259000, 806000, 2500000, 7770000, 24100000,
    75000000, 233000000, 723000000, 2250000000, 6980000000, 21700000000, 67300000000, 209000000000],
};

/* ================= 宗门功法 & 法术 ================= */
CFG.gongfa.sect = {
  // ---- 效果（只影响功法效果、法术伤害和法力，不影响学习消耗）----
  // 类型倍率：每类功法 / 法术单独一个
  TYPE_MULT: { xinfa: 1, gongjue: 1, zhenjing: 1, mijue: 1, shenfa: 1, dunshu: 1, fajue: 1, zhenjue: 1, spell: 1, tijue: 1 },
  // 星级倍率：第 1 个是 1 星门派 …… 第 10 个是 10 星
  STAR_MULT: [1, 1.3, 1.6, 1.9, 2.2, 2.5, 2.7, 3, 3.3, 3.6],
  // 天地玄黄四阶倍率
  TIER_MULT: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  // 各项自己的 EFFECT（互不影响）
  EFFECT_GONGFA: 1,  // 功法效果
  EFFECT_SPELL: 1,   // 法术固定伤害
  EFFECT_PCT: 1,  // 法术攻击百分比
  EFFECT_MANA: 1,    // 法术耗法力
  // ---- 学习消耗（不受上面的倍率影响）----
  // 首次学习消耗贡献 = learn × LEARN_TYPE × LEARN_STAR × LEARN_TIER × EFFECT_LEARN
  learn: 100,
  LEARN_TYPE: { xinfa: 1.3, gongjue: 1.2, zhenjing: 1, mijue: 1.1, shenfa: 1, dunshu: 1, fajue: 1, zhenjue: 1, spell: 1.2, tijue: 1.1 },
  LEARN_STAR: [1, 5, 10, 20, 40, 60, 80, 110, 150, 200],   // 1 ~ 10 星门派
  LEARN_TIER: { huang: 1, xuan: 1.5, di: 2, tian: 3 },
  EFFECT_LEARN: 1,
  // 学习需要的门派职务（0 外门 1 内门 2 真传 3 核心 4 长老 5 供奉 6 宗主）
  TIER_RANK: { huang: 0, xuan: 2, di: 4, tian: 6 },
};

/* ================= 凡界坊市功法 & 法术 ================= */
// 1~6 星，每星 4 阶，每类功法 2 本、法术 2 本；用灵石购买，买下即学会第 1 层
CFG.gongfa.shop = {
  TYPE_MULT: { xinfa: 0.8, gongjue: 0.8, zhenjing: 0.8, mijue: 0.8, shenfa: 0.8, dunshu: 0.8, fajue: 0.8, zhenjue: 0.8, spell: 0.8 },
  STAR_MULT: [1, 1.3, 1.6, 1.9, 2.2, 2.5],
  TIER_MULT: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  EFFECT_GONGFA: 1,
  EFFECT_SPELL: 1,
  EFFECT_PCT: 1,
  EFFECT_MANA: 1,
  // ---- 售价（不受上面的倍率影响）----
  // 售价 = price × PRICE_TYPE × PRICE_STAR × PRICE_TIER × EFFECT_PRICE
  price: 500,
  PRICE_TYPE: { xinfa: 1, gongjue: 1, zhenjing: 1, mijue: 1, shenfa: 1, dunshu: 1, fajue: 1, zhenjue: 1, spell: 1 },
  PRICE_STAR: [1, 30, 60, 100, 180, 300],     // 1~6 星
  PRICE_TIER: { huang: 1, xuan: 3, di: 6, tian: 10 },
  EFFECT_PRICE: 1,
  // 需要的境界：和同星级门派一样（config/sect.js 的 REQ_REALM）
};

/* ================= 试炼塔秘诀 ================= */
// 每星一部，试炼塔每 10 层奖励 +1 层，也可以在功法页用修为修炼
CFG.gongfa.tower = {
  TYPE_MULT: { mijue: 1.3 },
  STAR_MULT: [1.1, 1.4, 1.7, 2, 2.3, 2.6, 2.9, 3.2, 3.5, 3.8],
  TIER_MULT: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  EFFECT_GONGFA: 1,
};
