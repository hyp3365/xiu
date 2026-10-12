/* =====================================================================
 * ★ 数值设置 · 功法 & 法术 ★
 * ---------------------------------------------------------------------
 * 所有数值文件都在 js/config/ 下，一个部分一个文件；改完把 index.html 里的 ?v=数字 加 1。
 * 写法：倍率 1.1 = 每次 ×1.1；概率 0.3 = 30%；时间单位见注释。
 *
 * 功法、法术按「来源类型」分开设置，现在有两种：
 *   sect  宗门功法（门派功法殿，用贡献学习）
 *   shop  凡界坊市功法（坊市「功法」页，用灵石购买）
 * 以后加新类型，照着 sect / shop 再写一组即可。
 *
 * 每种来源的所有数值都是同一个算法：
 *   数值 = 基础属性(base) × 类型倍率(TYPE_MULT) × 星级倍率(STAR_MULT) × 阶倍率(TIER_MULT) × 该项自己的 EFFECT
 *   功法效果、法术伤害 是「每层」的加成，第 n 层 = 每层 × n
 *   修炼升层消耗的修为 再 × 层数倍率 STUDY_LV（第 1→2 层用第 1 个）
 * ===================================================================== */
window.CFG = window.CFG || {};

/* ================= 六、功法 & 法术（通用） ================= */
CFG.gongfa = {
  MAX: 12,           // 最高层数
  QUEUE: 15,         // 修炼队列上限
  STUDY_STEP: 5,     // 修炼期间每几秒扣一次修为
  // 每层修炼所需时间（分钟）：1→2 层 3 分钟 …… 11→12 层
  STUDY_MIN: [2, 5, 10, 30, 60, 120, 160, 240, 320, 420, 600],
};

/* ================= 宗门功法 & 法术 ================= */
CFG.gongfa.sect = {
  // 基础属性（1 星、黄阶、类型倍率 1、EFFECT 1 时的数值）
  base: {
    def: 5,        // 心法 → 每层防御
    atk: 5,        // 功诀 → 每层攻击
    hp: 10,           // 真经 → 每层气血
    cultivate: 5,    // 秘诀 → 每层修炼速度
    hit: 5,          // 身法 → 每层命中
    dodge: 5,        // 遁术 → 每层闪避
    mana: 5,         // 法诀 → 每层法力
    res: 4,       // 真诀 → 每层本门属性抗性
    spell: 10,        // 法术 → 每层固定伤害
    pct: 100,        // 法术 → 攻击百分比（不随层数变化）
    spellMana: 10,    // 法术 → 每次施放消耗法力
    study: 100,      // 修炼升一层消耗的修为
    learn: 100,      // 功法殿首次学习消耗的贡献
  },
  // 类型倍率：每类功法 / 法术单独一个
  TYPE_MULT: { xinfa: 1, gongjue: 1, zhenjing: 1, mijue: 1, shenfa: 1, dunshu: 1, fajue: 1, zhenjue: 1, spell: 1 },
  // 星级倍率：第 1 个是 1 星门派 …… 第 10 个是 10 星
  STAR_MULT: [1, 1.3, 1.6, 1.9, 2.2, 2.5, 2.7, 3, 3.3, 3.6],
  // 天地玄黄四阶倍率
  TIER_MULT: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  // 各项自己的 EFFECT（互不影响）
  EFFECT_GONGFA: 1,  // 功法效果
  EFFECT_SPELL: 1,   // 法术固定伤害
  EFFECT_PCT: 1.12,     // 法术攻击百分比
  EFFECT_MANA: 1,    // 法术耗法力
  EFFECT_STUDY: 1,   // 修炼消耗修为
  EFFECT_LEARN: 1,   // 学习消耗贡献
  // 修炼升层修为的层数倍率：第 1 个 = 1→2 层 …… 第 11 个 = 11→12 层
  STUDY_LV: [1, 2, 3, 5, 8, 12, 18, 27, 40, 60, 90],
  // 学习需要的门派职务（0 外门 1 内门 2 真传 3 核心 4 长老 5 供奉 6 宗主）
  TIER_RANK: { huang: 0, xuan: 2, di: 4, tian: 6 },
};

/* ================= 凡界坊市功法 & 法术 ================= */
// 1~6 星，每星 4 阶，每类功法 2 本、法术 2 本；用灵石购买，买下即学会第 1 层
CFG.gongfa.shop = {
  base: {
    def: 5, atk: 5, hp: 10, cultivate: 5, hit: 5, dodge: 5, mana: 5, res: 4,
    spell: 10, pct: 100, spellMana: 10,
    study: 100,      // 修炼升一层消耗的修为
    price: 500,      // 坊市售价基础（灵石）
  },
  TYPE_MULT: { xinfa: 0.8, gongjue: 0.8, zhenjing: 0.8, mijue: 0.8, shenfa: 0.8, dunshu: 0.8, fajue: 0.8, zhenjue: 0.8, spell: 0.8 },
  STAR_MULT: [1, 1.3, 1.6, 1.9, 2.2, 2.5],
  TIER_MULT: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  EFFECT_GONGFA: 1,
  EFFECT_SPELL: 1,
  EFFECT_PCT: 1,
  EFFECT_MANA: 1,
  EFFECT_STUDY: 1,
  STUDY_LV: [1, 2, 3, 5, 8, 12, 18, 27, 40, 60, 90],
  // ---- 售价单独设置（不受上面的类型/星级/阶倍率影响）----
  // 售价 = base.price × PRICE_TYPE × PRICE_STAR × PRICE_TIER × EFFECT_PRICE
  PRICE_TYPE: { xinfa: 1, gongjue: 1, zhenjing: 1, mijue: 1, shenfa: 1, dunshu: 1, fajue: 1, zhenjue: 1, spell: 1 },
  PRICE_STAR: [1, 10, 30, 50, 100, 200],     // 1~6 星
  PRICE_TIER: { huang: 1, xuan: 3, di: 6, tian: 10 },
  EFFECT_PRICE: 1,
  // 需要的境界：和同星级门派一样（config/sect.js 的 REQ_REALM）
};

/* ================= v25 新增：试炼塔秘诀（每星一部，试炼塔每 10 层奖励升层，也可以在功法页用修为修炼） ================= */
CFG.gongfa.tower = {
  base: { cultivate: 8, study: 100 },
  TYPE_MULT: { mijue: 1 },
  STAR_MULT: [1.1, 1.4, 1.7, 2, 2.3, 2.6, 2.9, 3.2, 3.5, 3.8],
  TIER_MULT: { huang: 1, xuan: 1.3, di: 1.6, tian: 1.9 },
  EFFECT_GONGFA: 1,
  EFFECT_STUDY: 1,
  STUDY_LV: [1, 2, 3, 5, 8, 12, 18, 27, 40, 60, 90],
};

/* ---------- v27 新增：功法修炼升层消耗修为（所有来源通用，替代上面各来源的 study / EFFECT_STUDY / STUDY_LV） ----------
 * 升一层消耗修为 = STAR[星级-1] × LV[当前层-1]
 *   例：3 星功法 第 2→3 层 = STAR[2] × LV[1] = 160 × 2 = 320 修为
 * 修炼期间每 5 秒扣一点，扣完正好升层 */
CFG.gongfa.STUDY_COST = {
  STAR: [100, 130, 160, 190, 220, 250, 270, 300, 330, 360],   // 1 ~ 10 星
  LV:   [1, 2, 3, 5, 8, 12, 18, 27, 40, 60, 90],              // 消耗倍率：第 1 个 = 1→2 层 …… 第 11 个 = 11→12 层
};
