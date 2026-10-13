/* =====================================================================
 * ★ 数值设置 · 凡界地图 · 东西南北四域怪物属性 ★
 * ---------------------------------------------------------------------
 * 所有数值文件都在 js/config/ 下，一个部分一个文件；改完把 index.html 里的 ?v=数字 加 1。
 * 写法：倍率 1.1 = 每次 ×1.1；概率 0.3 = 30%；时间单位见注释。
 *
 * 【凡界怪物属性怎么算】（代码：js/data/refstats.js 生成，js/modules/world.js 的 makeMob 遇怪时取用）
 *   第一步 · 参考人物属性（js/data/refstats.js 的 DATA.refStats）：
 *     人物属性 = 人物基础属性 × 成长^(地图境界 × 10 + LAYER[区域] − 1)
 *              + 该境界能进的全部宗门（所有门派 × 所有功法类别 × 天地玄黄四阶）功法都练到 GF[区域] 层的加成
 *     （地图境界 = 下面 MAP_REALM；不算丹药、肉身、灵根、装备）
 *   第二步 · 区域怪物基础属性（生成时算好，存进 CFG.monster.regions）：
 *     怪物基础属性 = 人物属性 × KIND[种类][属性]
 *     暴击% = KIND[种类].crit（直接就是数值，不乘人物属性）
 *   第三步 · 实际遇到时（每只怪单独随机）：
 *     气血/攻击/防御/速度/命中/闪避 = 怪物基础属性 × mapMult[地图][属性] × 随机(1 − RAND ~ 1 + RAND)
 *     暴击不受 mapMult 和 RAND 影响
 *   第四步 · 法力 / 抗性 / 法术 / 法宝：见下面 CFG.monster.magic
 *
 * 属性名：hp 气血  atk 攻击  def 防御  speed 速度（高者先手，相等时人物先手）
 *         hit 命中  dodge 闪避  crit 暴击%
 * 区域顺序：东 西 南 北（北域是本图首领所在区域）
 * ===================================================================== */
window.CFG = window.CFG || {};

/* ================= 四、凡界地图 · 东西南北四域怪物 ================= */
CFG.monster = {
  FAN: {
    // 下面三个数组都按区域排：[东域, 西域, 南域, 北域]
    LAYER: [1, 4, 7, 10],   // 参考人物在该地图境界的第几层（1~10）：东 1 层、西 4 层、南 7 层、北 10 层
    GF:    [2, 3, 4, 5],    // 参考人物的宗门功法都练到第几层（0 = 不算功法）：东 2、西 3、南 4、北 5
    L_STEP: [0, 3, 6, 9],   // 区域层序 L = 地图序号(0起) × 10 + 这个；只用来算灵石掉落（config/drops.js）和星君俸禄
    // 怪物种类倍率：怪物基础属性 = 人物属性 × 这里的倍率；crit 是暴击%，直接写数值
    KIND: {
      normal: { hp: 1,   atk: 1,   def: 1,   speed: 1,   hit: 1,   dodge: 1,   crit: 5 },    // 普通怪：与人物属性相同，暴击 5%
      elite:  { hp: 1.2, atk: 1.2, def: 1.2, speed: 1.2, hit: 1.2, dodge: 1.2, crit: 10 },   // 精英怪：人物属性 ×1.2，暴击 10%
      boss:   { hp: 1.5, atk: 1.5, def: 1.5, speed: 1.5, hit: 1.5, dodge: 1.5, crit: 15 },   // 首领：人物属性 ×1.5，暴击 15%
    },
  },
  RAND: 0.18,        // 随机浮动幅度：遇到时属性 × 随机(0.82 ~ 1.18)，即 ±18%（秘境怪物也用这个）
  regions: [],       // 不用手写：凡界 9 张地图的怪物属性按上面 FAN 自动生成（仙冥魔神的怪物见 config/worldmaps.js）
};

/* ---------- 怪物 法力 / 抗性 / 法术 / 法宝 ----------
 * 代码：js/modules/world.js 的 addMagic（生成怪物时）和 battle（战斗时）
 * 按怪物种类设置：normal 普通 / elite 精英 / boss 首领 / tower 试炼塔守关者和宗门晋升考官
 *   （凡界、秘境、仙冥魔神怪物都按 normal/elite/boss；星君挑战的首领按 boss；雷劫不受影响）
 * 数值相对怪物自身（已随机浮动后）的属性：
 *   法力上限 = 攻击 × MANA
 *   每系抗性 = 防御 × RES；怪物本属性（el）那一系再 × OWN_RES
 *   怪物属性 el：随机金木水火土雷之一（仙冥魔神 regions 里单个怪物可以直接写 el / mana / res 覆盖，
 *     例：mana: 500, el: "huo", res: { jin: 10, mu: 10, shui: 10, huo: 30, tu: 10, lei: 10 }）
 * 怪物每次出手的顺序：
 *   1. 法术 spell：法力够（≥ 法力上限 × cost）且掷中 chance% → 施放，扣法力 = 法力上限 × cost
 *   2. 法术没放出来，再按同样规则判定法宝 fabao
 *   3. 都没放出来 → 普通攻击
 *   法术 / 法宝伤害 = max(攻击 × 战斗.MIN_DMG, 攻击 × pct% − 人物该系抗性 × 战斗.DEF_RATE)
 *     人物该系抗性 = 人物防御 × 战斗.RES_RATE + 人物该系抗性（都是怪物本属性 el 那一系）
 *   之后同样判闪避、× 随机(RAND_MIN~RAND_MAX)、判暴击（见 config/battle.js） */
CFG.monster.magic = {
  OWN_RES: 2,   // 怪物本属性那一系抗性再 × 2
  // MANA 法力倍率  RES 抗性倍率
  // spell / fabao：chance 每回合施放几率%   pct 伤害 = 攻击 × pct%   cost 每次耗法力 = 法力上限 × cost
  normal: { MANA: 3, RES: 0.3, spell: { chance: 25, pct: 120, cost: 0.25 }, fabao: { chance: 10, pct: 150, cost: 0.4 } },   // 普通怪
  elite:  { MANA: 4, RES: 0.4, spell: { chance: 30, pct: 140, cost: 0.25 }, fabao: { chance: 15, pct: 170, cost: 0.4 } },   // 精英怪
  boss:   { MANA: 5, RES: 0.5, spell: { chance: 35, pct: 160, cost: 0.2 },  fabao: { chance: 20, pct: 200, cost: 0.35 } },  // 首领
  tower:  { MANA: 4, RES: 0.4, spell: { chance: 30, pct: 140, cost: 0.25 }, fabao: { chance: 15, pct: 170, cost: 0.4 } },   // 试炼塔守关者 / 宗门晋升考官
};

// ---------- 每张地图单独的怪物倍率 ----------
// 序号 = 地图（第 1 个 = 青云山林 …… 第 9 个 = 雷劫之地）。
// 该地图东西南北四域所有怪物遇到时：属性 = 怪物基础属性 × 这里的倍率 × 随机浮动；不写的属性按 1；不影响暴击
CFG.monster.mapMult = [
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 1 青云山林
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 2 黑风谷
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 3 万妖岭
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 4 幽冥沼泽
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 5 落星海
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 6 虚空裂隙
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 7 天魔战场
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 8 九幽深渊
  { hp: 1, atk: 1, def: 1, speed: 1, hit: 1, dodge: 1 },   // 9 雷劫之地
];

// ---------- 每张地图需要的境界 ----------
// 境界序号（js/data/realms.js）：0 练气 1 筑基 2 金丹 3 元婴 4 出窍 5 化神 6 练虚 7 合体 8 洞真 9 大乘 10 渡劫 ……
// 既是进入该地图需要的境界，也是生成怪物时参考人物的境界（见文件开头公式）
CFG.monster.MAP_REALM = [
  0,    // 1 青云山林：练气
  1,    // 2 黑风谷：筑基
  2,    // 3 万妖岭：金丹
  3,    // 4 幽冥沼泽：元婴
  5,    // 5 落星海：化神
  6,    // 6 虚空裂隙：练虚
  7,    // 7 天魔战场：合体
  9,    // 8 九幽深渊：大乘
  10,   // 9 雷劫之地：渡劫
];
