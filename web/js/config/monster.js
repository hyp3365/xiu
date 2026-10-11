/* =====================================================================
 * ★ 数值设置 · 凡界地图 · 东西南北四域怪物属性 ★
 * ---------------------------------------------------------------------
 * 所有数值文件都在 js/config/ 下，一个部分一个文件；改完把 index.html 里的 ?v=数字 加 1。
 * 写法：倍率 1.1 = 每次 ×1.1；概率 0.3 = 30%；时间单位见注释。
 * ===================================================================== */
window.CFG = window.CFG || {};

/* ================= 四、凡界地图 · 东西南北四域怪物 ================= */
// 9 张地图 × 东西南北 4 个区域，每个区域的 普通怪 / 精英怪 / 首领 属性都可以单独改（直接写数值）。
//   L：怪物层序（0 = 练气一层，用来显示境界和计算灵石掉落）
//   hp 气血  atk 攻击  def 防御  speed 速度（高者先手）  hit 命中  dodge 闪避  crit 暴击%
//   实际遇到时，气血/攻击/防御/速度/命中/闪避 会在 ±RAND 范围内随机浮动
CFG.monster = {
  RAND: 0.18,         // 随机浮动 ±10%
  regions: [
    // ---------- 第 1 张：青云山林 ----------
    [
      { name: "东", L: 0,
        normal: { hp: 120, atk: 15, def: 6.0, speed: 9.0, hit: 9.0, dodge: 9.0, crit: 5 },
        elite:  { hp: 240, atk: 22, def: 8.0, speed: 10, hit: 10, dodge: 10, crit: 10 },
        boss:   { hp: 450, atk: 30, def: 10.0, speed: 12, hit: 12, dodge: 12, crit: 15 } },
      { name: "西", L: 3,
        normal: { hp: 160, atk: 24, def: 8.0, speed: 12, hit: 12, dodge: 12, crit: 5 },
        elite:  { hp: 320, atk: 32, def: 10.6, speed: 13, hit: 13, dodge: 13, crit: 10 },
        boss:   { hp: 583, atk: 38, def: 13.6, speed: 16, hit: 16, dodge: 15, crit: 15 } },
      { name: "南", L: 6,
        normal: { hp: 206, atk: 32, def: 10.3, speed: 16, hit: 16, dodge: 16, crit: 5 },
        elite:  { hp: 423, atk: 42, def: 14.1, speed: 18, hit: 18, dodge: 18, crit: 10 },
        boss:   { hp: 790, atk: 50, def: 19.8, speed: 21, hit: 21, dodge: 20, crit: 15 } },
      { name: "北", L: 9,
        normal: { hp: 285, atk: 42, def: 14.1, speed: 21, hit: 21, dodge: 21, crit: 5 },
        elite:  { hp: 592, atk: 56, def: 19.4, speed: 24, hit: 24, dodge: 24, crit: 10 },
        boss:   { hp: 854, atk: 60, def: 22, speed: 26, hit: 26, dodge: 25, crit: 15 } },
    ],
        // ---------- 第 2 张：黑风谷 ----------
    [
      { name: "东", L: 10,
        normal: { hp: 312, atk: 46, def: 15.6, speed: 23, hit: 23, dodge: 23, crit: 5 },
        elite:  { hp: 622, atk: 62, def: 20, speed: 26, hit: 26, dodge: 26, crit: 10 },
        boss:   { hp: 1142, atk: 72, def: 26, speed: 31, hit: 31, dodge: 30, crit: 15 } },
      { name: "西", L: 13,
        normal: { hp: 414, atk: 62, def: 20, speed: 31, hit: 31, dodge: 31, crit: 5 },
        elite:  { hp: 828, atk: 82, def: 28, speed: 35, hit: 35, dodge: 35, crit: 10 },
        boss:   { hp: 1518, atk: 96, def: 34, speed: 42, hit: 42, dodge: 40, crit: 15 } },
      { name: "南", L: 16,
        normal: { hp: 552, atk: 82, def: 28, speed: 41, hit: 41, dodge: 41, crit: 5 },
        elite:  { hp: 1102, atk: 110, def: 36, speed: 46, hit: 46, dodge: 46, crit: 10 },
        boss:   { hp: 2022, atk: 128, def: 46, speed: 56, hit: 56, dodge: 53, crit: 15 } },
      { name: "北", L: 19,
        normal: { hp: 734, atk: 110, def: 36, speed: 55, hit: 55, dodge: 55, crit: 5 },
        elite:  { hp: 1468, atk: 146, def: 48, speed: 61, hit: 61, dodge: 61, crit: 10 },
        boss:   { hp: 2446, atk: 156, def: 56, speed: 67, hit: 67, dodge: 64, crit: 15 } },
    ],
    // ---------- 第 3 张：万妖岭 ----------
    [
      { name: "东", L: 20,
        normal: { hp: 808, atk: 122, def: 40, speed: 61, hit: 61, dodge: 61, crit: 5 },
        elite:  { hp: 1614, atk: 162, def: 54, speed: 67, hit: 67, dodge: 67, crit: 10 },
        boss:   { hp: 2960, atk: 188, def: 66, speed: 81, hit: 81, dodge: 78, crit: 15 } },
      { name: "西", L: 23,
        normal: { hp: 1074, atk: 162, def: 54, speed: 81, hit: 81, dodge: 81, crit: 5 },
        elite:  { hp: 2150, atk: 214, def: 72, speed: 90, hit: 90, dodge: 90, crit: 10 },
        boss:   { hp: 3940, atk: 252, def: 88, speed: 108, hit: 108, dodge: 103, crit: 15 } },
      { name: "南", L: 26,
        normal: { hp: 1430, atk: 214, def: 72, speed: 107, hit: 107, dodge: 107, crit: 5 },
        elite:  { hp: 2860, atk: 286, def: 96, speed: 119, hit: 119, dodge: 119, crit: 10 },
        boss:   { hp: 5244, atk: 334, def: 118, speed: 144, hit: 144, dodge: 138, crit: 15 } },
      { name: "北", L: 29,
        normal: { hp: 1904, atk: 286, def: 96, speed: 143, hit: 143, dodge: 143, crit: 5 },
        elite:  { hp: 3808, atk: 380, def: 126, speed: 159, hit: 159, dodge: 159, crit: 10 },
        boss:   { hp: 6346, atk: 404, def: 142, speed: 174, hit: 174, dodge: 167, crit: 15 } },
    ],
    // ---------- 第 4 张：幽冥沼泽 ----------
    [
      { name: "东", L: 30,
        normal: { hp: 2094, atk: 314, def: 104, speed: 157, hit: 157, dodge: 157, crit: 5 },
        elite:  { hp: 4188, atk: 418, def: 140, speed: 174, hit: 174, dodge: 174, crit: 10 },
        boss:   { hp: 7678, atk: 490, def: 172, speed: 211, hit: 211, dodge: 202, crit: 15 } },
      { name: "西", L: 33,
        normal: { hp: 2788, atk: 418, def: 140, speed: 209, hit: 209, dodge: 209, crit: 5 },
        elite:  { hp: 5574, atk: 558, def: 186, speed: 232, hit: 232, dodge: 232, crit: 10 },
        boss:   { hp: 10220, atk: 652, def: 230, speed: 281, hit: 281, dodge: 268, crit: 15 } },
      { name: "南", L: 36,
        normal: { hp: 3710, atk: 556, def: 186, speed: 278, hit: 278, dodge: 278, crit: 5 },
        elite:  { hp: 7420, atk: 742, def: 248, speed: 309, hit: 309, dodge: 309, crit: 10 },
        boss:   { hp: 13602, atk: 868, def: 306, speed: 374, hit: 374, dodge: 357, crit: 15 } },
      { name: "北", L: 39,
        normal: { hp: 4938, atk: 740, def: 246, speed: 370, hit: 370, dodge: 370, crit: 5 },
        elite:  { hp: 9874, atk: 988, def: 330, speed: 411, hit: 411, dodge: 411, crit: 10 },
        boss:   { hp: 16458, atk: 1050, def: 370, speed: 453, hit: 453, dodge: 432, crit: 15 } },
    ],
    // ---------- 第 5 张：落星海 ----------
    [
      { name: "东", L: 40,
        normal: { hp: 5432, atk: 814, def: 272, speed: 407, hit: 407, dodge: 407, crit: 5 },
        elite:  { hp: 10862, atk: 1086, def: 362, speed: 453, hit: 453, dodge: 453, crit: 10 },
        boss:   { hp: 19914, atk: 1270, def: 448, speed: 548, hit: 548, dodge: 523, crit: 15 } },
      { name: "西", L: 43,
        normal: { hp: 7228, atk: 1084, def: 362, speed: 542, hit: 542, dodge: 542, crit: 5 },
        elite:  { hp: 14458, atk: 1446, def: 482, speed: 602, hit: 602, dodge: 602, crit: 10 },
        boss:   { hp: 26500, atk: 1690, def: 596, speed: 729, hit: 729, dodge: 696, crit: 15 } },
      { name: "南", L: 46,
        normal: { hp: 9622, atk: 1444, def: 482, speed: 722, hit: 722, dodge: 722, crit: 5 },
        elite:  { hp: 19244, atk: 1924, def: 642, speed: 802, hit: 802, dodge: 802, crit: 10 },
        boss:   { hp: 35280, atk: 2250, def: 794, speed: 970, hit: 970, dodge: 926, crit: 15 } },
      { name: "北", L: 49,
        normal: { hp: 12806, atk: 1920, def: 640, speed: 960, hit: 960, dodge: 960, crit: 5 },
        elite:  { hp: 25620, atk: 2562, def: 854, speed: 1067, hit: 1067, dodge: 1067, crit: 10 },
        boss:   { hp: 42680, atk: 2722, def: 960, speed: 1174, hit: 1174, dodge: 1121, crit: 15 } },
    ],
    // ---------- 第 6 张：虚空裂隙 ----------
    [
      { name: "东", L: 50,
        normal: { hp: 14086, atk: 2114, def: 704, speed: 1057, hit: 1057, dodge: 1057, crit: 5 },
        elite:  { hp: 28180, atk: 2818, def: 940, speed: 1174, hit: 1174, dodge: 1174, crit: 10 },
        boss:   { hp: 51660, atk: 3292, def: 1162, speed: 1420, hit: 1420, dodge: 1356, crit: 15 } },
      { name: "西", L: 53,
        normal: { hp: 18750, atk: 2812, def: 938, speed: 1406, hit: 1406, dodge: 1406, crit: 5 },
        elite:  { hp: 37500, atk: 3750, def: 1250, speed: 1562, hit: 1562, dodge: 1562, crit: 10 },
        boss:   { hp: 68740, atk: 4382, def: 1546, speed: 1891, hit: 1891, dodge: 1805, crit: 15 } },
      { name: "南", L: 56,
        normal: { hp: 24960, atk: 3744, def: 1248, speed: 1872, hit: 1872, dodge: 1872, crit: 5 },
        elite:  { hp: 49920, atk: 4992, def: 1664, speed: 2080, hit: 2080, dodge: 2080, crit: 10 },
        boss:   { hp: 91500, atk: 5834, def: 2058, speed: 2516, hit: 2516, dodge: 2402, crit: 15 } },
      { name: "北", L: 59,
        normal: { hp: 33220, atk: 4982, def: 1660, speed: 2491, hit: 2491, dodge: 2491, crit: 5 },
        elite:  { hp: 66440, atk: 6644, def: 2214, speed: 2768, hit: 2768, dodge: 2768, crit: 10 },
        boss:   { hp: 110720, atk: 7058, def: 2492, speed: 3045, hit: 3045, dodge: 2906, crit: 15 } },
    ],
    // ---------- 第 7 张：天魔战场 ----------
    [
      { name: "东", L: 60,
        normal: { hp: 36540, atk: 5480, def: 1826, speed: 2740, hit: 2740, dodge: 2740, crit: 5 },
        elite:  { hp: 73080, atk: 7308, def: 2436, speed: 3045, hit: 3045, dodge: 3045, crit: 10 },
        boss:   { hp: 133980, atk: 8540, def: 3014, speed: 3684, hit: 3684, dodge: 3517, crit: 15 } },
      { name: "西", L: 63,
        normal: { hp: 48640, atk: 7294, def: 2432, speed: 3647, hit: 3647, dodge: 3647, crit: 5 },
        elite:  { hp: 97260, atk: 9726, def: 3242, speed: 4053, hit: 4053, dodge: 4053, crit: 10 },
        boss:   { hp: 178320, atk: 11368, def: 4012, speed: 4904, hit: 4904, dodge: 4681, crit: 15 } },
      { name: "南", L: 66,
        normal: { hp: 64720, atk: 9710, def: 3236, speed: 4855, hit: 4855, dodge: 4855, crit: 5 },
        elite:  { hp: 129460, atk: 12946, def: 4316, speed: 5394, hit: 5394, dodge: 5394, crit: 10 },
        boss:   { hp: 237400, atk: 15130, def: 5340, speed: 6527, hit: 6527, dodge: 6230, crit: 15 } },
      { name: "北", L: 69,
        normal: { hp: 86160, atk: 12924, def: 4308, speed: 6462, hit: 6462, dodge: 6462, crit: 5 },
        elite:  { hp: 172300, atk: 17230, def: 5744, speed: 7180, hit: 7180, dodge: 7180, crit: 10 },
        boss:   { hp: 287200, atk: 18308, def: 6462, speed: 7897, hit: 7897, dodge: 7538, crit: 15 } },
    ],
    // ---------- 第 8 张：九幽深渊 ----------
    [
      { name: "东", L: 70,
        normal: { hp: 94760, atk: 14216, def: 4738, speed: 7108, hit: 7108, dodge: 7108, crit: 5 },
        elite:  { hp: 189540, atk: 18954, def: 6318, speed: 7897, hit: 7897, dodge: 7897, crit: 10 },
        boss:   { hp: 347400, atk: 22160, def: 7818, speed: 9556, hit: 9556, dodge: 9122, crit: 15 } },
      { name: "西", L: 73,
        normal: { hp: 126140, atk: 18920, def: 6306, speed: 9460, hit: 9460, dodge: 9460, crit: 5 },
        elite:  { hp: 252200, atk: 25220, def: 8410, speed: 10510, hit: 10510, dodge: 10510, crit: 10 },
        boss:   { hp: 462600, atk: 29480, def: 10406, speed: 12720, hit: 12720, dodge: 12140, crit: 15 } },
      { name: "南", L: 76,
        normal: { hp: 167900, atk: 25180, def: 8394, speed: 12590, hit: 12590, dodge: 12590, crit: 5 },
        elite:  { hp: 335800, atk: 33580, def: 11192, speed: 13990, hit: 13990, dodge: 13990, crit: 10 },
        boss:   { hp: 615600, atk: 39240, def: 13850, speed: 16930, hit: 16930, dodge: 16160, crit: 15 } },
      { name: "北", L: 79,
        normal: { hp: 223400, atk: 33520, def: 11174, speed: 16760, hit: 16760, dodge: 16760, crit: 5 },
        elite:  { hp: 447000, atk: 44700, def: 14898, speed: 18620, hit: 18620, dodge: 18620, crit: 10 },
        boss:   { hp: 744800, atk: 47480, def: 16760, speed: 20480, hit: 20480, dodge: 19550, crit: 15 } },
    ],
    // ---------- 第 9 张：雷劫之地 ----------
    [
      { name: "东", L: 80,
        normal: { hp: 245800, atk: 36880, def: 12290, speed: 18440, hit: 18440, dodge: 18440, crit: 5 },
        elite:  { hp: 491600, atk: 49160, def: 16388, speed: 20480, hit: 20480, dodge: 20480, crit: 10 },
        boss:   { hp: 901200, atk: 57460, def: 20280, speed: 24790, hit: 24790, dodge: 23660, crit: 15 } },
      { name: "西", L: 83,
        normal: { hp: 327200, atk: 49080, def: 16358, speed: 24540, hit: 24540, dodge: 24540, crit: 5 },
        elite:  { hp: 654400, atk: 65440, def: 21820, speed: 27260, hit: 27260, dodge: 27260, crit: 10 },
        boss:   { hp: 1199600, atk: 76480, def: 27000, speed: 32990, hit: 32990, dodge: 31490, crit: 15 } },
      { name: "南", L: 86,
        normal: { hp: 435400, atk: 65320, def: 21780, speed: 32660, hit: 32660, dodge: 32660, crit: 5 },
        elite:  { hp: 871000, atk: 87100, def: 29040, speed: 36290, hit: 36290, dodge: 36290, crit: 10 },
        boss:   { hp: 1596800, atk: 101780, def: 35920, speed: 43910, hit: 43910, dodge: 41910, crit: 15 } },
      { name: "北", L: 89,
        normal: { hp: 579600, atk: 86940, def: 28980, speed: 43470, hit: 43470, dodge: 43470, crit: 5 },
        elite:  { hp: 1159200, atk: 115920, def: 38640, speed: 48300, hit: 48300, dodge: 48300, crit: 10 },
        boss:   { hp: 1932000, atk: 123160, def: 43480, speed: 53130, hit: 53130, dodge: 50720, crit: 15 } },
    ],   
  ],
};

/* ---------- v15 新增：怪物 法力 / 抗性 / 法术 / 法宝 ----------
 * 按怪物种类（普通 / 精英 / 首领）设置，数值相对怪物自身属性：
 *   MANA    法力上限 = 攻击 × MANA
 *   RES     每系抗性 = 防御 × RES；本属性（怪物的 el）抗性再 × OWN_RES
 *   spell   法术：chance 每回合施放几率 %，pct 伤害 = 攻击 × pct%，cost 每次耗法力 = 法力上限 × cost
 *           法术伤害 = 威力 - (对方防御 + 对方该属性抗性) × 战斗.DEF_RATE
 *   fabao   法宝：chance 每回合祭出几率 %（法术没放出时才判定），pct 伤害 = 攻击 × pct%，cost 同上
 *           法宝伤害只算防御
 * 怪物属性 el：没写就每次随机（金木水火土雷）。
 * 也可以在上面 regions 里单个怪物直接写：mana: 500, el: "huo", res: { jin: 10, mu: 10, shui: 10, huo: 30, tu: 10, lei: 10 }
 * 试炼塔守关者按 tower 种类；雷劫不受影响。 */
CFG.monster.magic = {
  OWN_RES: 2,
  normal: { MANA: 3, RES: 0.3, spell: { chance: 25, pct: 120, cost: 0.25 }, fabao: { chance: 10, pct: 150, cost: 0.4 } },
  elite:  { MANA: 4, RES: 0.4, spell: { chance: 30, pct: 140, cost: 0.25 }, fabao: { chance: 15, pct: 170, cost: 0.4 } },
  boss:   { MANA: 5, RES: 0.5, spell: { chance: 35, pct: 160, cost: 0.2 },  fabao: { chance: 20, pct: 200, cost: 0.35 } },
  tower:  { MANA: 4, RES: 0.4, spell: { chance: 30, pct: 140, cost: 0.25 }, fabao: { chance: 15, pct: 170, cost: 0.4 } },
};
