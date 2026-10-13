/* =====================================================================
 * ★ 数值设置 · 凡界地图 · 东西南北四域怪物属性 ★
 * ---------------------------------------------------------------------
 * 所有数值文件都在 js/config/ 下，一个部分一个文件；改完把 index.html 里的 ?v=数字 加 1。
 * 写法：倍率 1.1 = 每次 ×1.1；概率 0.3 = 30%；时间单位见注释。
 * ===================================================================== */
window.CFG = window.CFG || {};

/* ================= 四、凡界地图 · 东西南北四域怪物 ================= */
// v51：9 张地图 × 东西南北 4 个区域的怪物属性 = 人物属性（js/data/refstats.js 的 refStats）× 倍率：
//   人物属性 = 该地图境界（MAP_REALM）第 LAYER 层 + 能学的全部宗门功法练到 GF 层（不算丹药、肉身、灵根、装备）
//   普通 / 精英 / 首领 = 人物属性 × KIND 里的倍率，再 × 下面 mapMult（每张地图单独的倍率）
//   hp 气血  atk 攻击  def 防御  speed 速度（高者先手）  hit 命中  dodge 闪避  crit 暴击%（直接写数值）
//   实际遇到时，气血/攻击/防御/速度/命中/闪避 会在 ±RAND 范围内随机浮动
CFG.monster = {
  FAN: {
    LAYER: [1, 4, 7, 10],   // 东 西 南 北：人物境界第几层
    GF:    [2, 3, 4, 5],    // 东 西 南 北：宗门功法练到第几层
    L_STEP: [0, 3, 6, 9],   // 区域层序 = 地图序号 × 10 + 这个（只用来算灵石掉落）
    KIND: {
      normal: { hp: 1,   atk: 1,   def: 1,   speed: 1,   hit: 1,   dodge: 1,   crit: 5 },
      elite:  { hp: 1.2, atk: 1.2, def: 1.2, speed: 1.2, hit: 1.2, dodge: 1.2, crit: 10 },
      boss:   { hp: 1.5, atk: 1.5, def: 1.5, speed: 1.5, hit: 1.5, dodge: 1.5, crit: 15 },
    },
  },
  RAND: 0.18,         // 随机浮动 ±10%
  regions: [],       // v51：凡界 9 张地图的怪物属性按下面 FAN 自动生成（仙冥魔神见 config/worldmaps.js）
};

/* ---------- 怪物 法力 / 抗性 / 法术 / 法宝 ----------
 * 按怪物种类（普通 / 精英 / 首领）设置，数值相对怪物自身属性：
 *   MANA    法力上限 = 攻击 × MANA
 *   RES     每系抗性 = 防御 × RES；本属性（怪物的 el）抗性再 × OWN_RES
 *   spell   法术：chance 每回合施放几率 %，pct 伤害 = 攻击 × pct%，cost 每次耗法力 = 法力上限 × cost
 *           法术伤害 = 威力 - (对方防御 + 对方该属性抗性) × 战斗.DEF_RATE
 *   fabao   法宝：chance 每回合祭出几率 %（法术没放出时才判定），pct 伤害 = 攻击 × pct%，cost 同上
 *           法宝伤害只算防御
 * 怪物属性 el：没写就每次随机（金木水火土雷）。
 * （凡界怪物不再单独写数值；仙冥魔神 regions 里单个怪物可以直接写）：mana: 500, el: "huo", res: { jin: 10, mu: 10, shui: 10, huo: 30, tu: 10, lei: 10 }
 * 试炼塔守关者按 tower 种类；雷劫不受影响。 */
CFG.monster.magic = {
  OWN_RES: 2,
  normal: { MANA: 3, RES: 0.3, spell: { chance: 25, pct: 120, cost: 0.25 }, fabao: { chance: 10, pct: 150, cost: 0.4 } },
  elite:  { MANA: 4, RES: 0.4, spell: { chance: 30, pct: 140, cost: 0.25 }, fabao: { chance: 15, pct: 170, cost: 0.4 } },
  boss:   { MANA: 5, RES: 0.5, spell: { chance: 35, pct: 160, cost: 0.2 },  fabao: { chance: 20, pct: 200, cost: 0.35 } },
  tower:  { MANA: 4, RES: 0.4, spell: { chance: 30, pct: 140, cost: 0.25 }, fabao: { chance: 15, pct: 170, cost: 0.4 } },
};

// ---------- 每张地图单独的怪物倍率 ----------
// 第 1 个 = 第 1 张地图（青云山林）…… 第 9 个 = 雷劫之地。该地图东西南北四域所有怪物的属性再乘这里的倍率
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

// ---------- 每张地图需要的境界（序号见 config/sect.js 里的说明） ----------
// 第 1 张青云山林 练气 …… 第 9 张雷劫之地 渡劫
CFG.monster.MAP_REALM = [0, 1, 2, 3, 5, 6, 7, 9, 10];
