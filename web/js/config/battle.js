/* =====================================================================
 * ★ 数值设置 · 战斗 ★
 * ---------------------------------------------------------------------
 * 所有数值文件都在 js/config/ 下，一个部分一个文件；改完把 index.html 里的 ?v=数字 加 1。
 *
 * 【伤害公式】（代码：js/modules/world.js 的 battle；雷劫在 js/modules/cultivate.js 的 advanceTrib）
 *   历练、秘境、试炼塔、宗门考核、星君挑战都用 battle；雷劫用同样的 MIN_DMG / DEF_RATE / RAND / CRIT_MULT。
 *   出手顺序：每场战斗人物速度 × 95%~105% 随机（SPEED_RAND），速度高者先手（相等时人物先手），双方轮流各出手一次为一回合，最多 MAX_ROUNDS 回合。
 *
 *   普通攻击：原始伤害 = max(保底伤害（MIN_BASE + 层 × MIN_STEP）, 攻击 − 对方防御 × DEF_RATE)
 *   法术    ：原始伤害 = max(保底伤害（MIN_BASE + 层 × MIN_STEP）, 攻击 × 法术% + 法术固定伤害 × 灵根加成 − 对方该系抗性 × DEF_RATE)
 *   法宝    ：原始伤害 = max(保底伤害（MIN_BASE + 层 × MIN_STEP）, 攻击 × 法宝% + 属性伤害 − 减免后该系抗性 × DEF_RATE) + 追加伤害
 *   怪物法术 / 法宝：原始伤害 = max(保底伤害（MIN_BASE + 层 × MIN_STEP）, 攻击 × pct% − 对方该系抗性 × DEF_RATE)（见 config/mobs.js 的 magic）
 *   其中 某系抗性 = 防御 × RES_RATE + 该系抗性
 *
 *   然后：先判命中（命中率 % = 80，相对差 (命中 − 对方闪避) ÷ (对方闪避 + 100) 每满 +6% 加 1%、每满 −5% 减 2.5%，限制 30 ~ 96，见下面 HIT_*），没命中 = 闪避
 *         没闪避 → 伤害 = 原始伤害 × 随机(RAND_MIN ~ RAND_MAX)
 *         再判暴击（几率 = min(暴击%, CRIT_CAP)）→ 暴击时伤害 × CRIT_MULT
 *   雷劫：伤害 = max(保底伤害（MIN_BASE + 层 × MIN_STEP）, 攻击 − 防御 × DEF_RATE) × 随机(RAND_MIN ~ RAND_MAX)，暴击 × CRIT_MULT；雷劫无法闪避
 * ===================================================================== */
window.CFG = window.CFG || {};

CFG.battle = {
  MIN_DMG: 0.01,     // （v171 起不用）
  MIN_BASE: 1,       // v171 保底伤害（防御再高也至少打这么多）= 练气一层 MIN_BASE，之后每层 + MIN_STEP（看出手方自己的境界层数；凡人 = 练气一层）
  MIN_STEP: 3,
  DEF_RATE: 0.9,     // 防御 / 抗性抵消比例：伤害 = 攻击 − 防御 × 0.9
  RAND_MIN: 0.9,     // 伤害随机下限（× 0.9）
  RAND_MAX: 1.1,     // 伤害随机上限（× 1.1）
  CRIT_MULT: 2,      // 暴击伤害倍率（× 2）
  MAX_ROUNDS: 100,
  TEST_ROUNDS: 500,   // v158 宗门「实力测试」最多打几回合（不扣生命，可随时关闭）   // 一场战斗最多回合数，打满还没击败对方算失败（雷劫不受此限）
  // v183：相对差 = (命中 − 对方闪避) ÷ (对方闪避 + HIT_PAD) × 100
  //   比对方高：每满 HIT_UP_STEP % 命中率 + HIT_UP_ADD %；比对方低：每满 HIT_DN_STEP % 命中率 − HIT_DN_ADD %；不满一档不变
  HIT_BASE: 80, HIT_UP_STEP: 6, HIT_UP_ADD: 1, HIT_DN_STEP: 5, HIT_DN_ADD: 2.5, HIT_MAX: 96, HIT_MIN: 30, HIT_PAD: 100,
  // v174 速度：每场战斗开始时人物速度 × 随机(SPEED_RAND[0] ~ SPEED_RAND[1]) %（怪物不随机，它的属性本身已随机），速度快的先出手
  SPEED_RAND: [95, 105],
  TOWER_HP_MIN: 0.3, // 生命低于上限这个比例（30%）不能挑战试炼塔、宗门晋升考验
};

// ---------- 属性抗性 ----------
// 战斗中某系抗性 = 防御 × RES_RATE + 该系抗性
// 被该系法术、法宝打中时按这个抗性减免（伤害 − 抗性 × DEF_RATE）；普通攻击只算防御
CFG.battle.RES_RATE = 1;   // 防御计入抗性的比例（1 = 防御全额算进每系抗性）

// ---------- 战斗画面播放速度 ----------
// 雷劫：每 ROUND_SEC 秒打一回合
CFG.battle.ROUND_SEC = 2;   // 秒
// 战斗过程画面（探索详情、试炼塔、晋升考验、星君）：每 ACT_SEC 秒播放一次出手（结果已算好，只是播放）
CFG.battle.ACT_SEC = 1.6;   // 秒
CFG.battle.ANIM_SLOW = 1.6; // v161 战斗动作动画放慢倍数（1 = 原速，越大越慢）
CFG.battle.SKIP_SEC = 3;    // 试炼塔等现场战斗几秒后可以跳过（看详情随时可跳过）
