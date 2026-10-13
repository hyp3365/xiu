/* =====================================================================
 * ★ 数值设置 · 秘境 ★
 * ---------------------------------------------------------------------
 * 改完把 index.html 里的 ?v=数字 加 1。
 *
 * 发现：在凡界地图历练 / 自动探索，每走完一次（不战败），有 find.chance% 几率发现一处还没发现的秘境
 *   （find.map = 在哪张地图能发现，0 = 青云山林 …… 8 = 雷劫之地）。发现后永久保留。
 * 进入：每处秘境每天只能进 DAILY 次（历练、探索都算），先历练通过（走完不战败）才能自动探索。
 *   「一键探索」= 把今天还没进过、已历练通过的秘境依次自动探索一遍。
 * 走路：一次 TIME 步，每步秒数和凡界地图一样（config/explore.js 的 STEP_SEC，宗门秘法「神行」可减少）。
 *
 * 每处秘境：
 *   name 名字   realm 需要的境界（0 练气 1 筑基 …… 9 大乘）   L 层序（只用来算灵石掉落）
 *   怪物属性按上面 REF 自动生成（遇到时 ±RAND 浮动，法力抗性同凡界怪物）
 *   monsters 普通怪名字   bossName 首领名字
 *   drops  普通掉落用哪张地图的掉落组（config/drops.js 的 mapDrops，0 = 青云山林），mat = 药材矿石数量倍率，stone = 灵石倍率
 *   extra  额外掉落：每个事件（monster 普通怪 elite 精英 boss 首领 herbEvent 灵药 oreEvent 矿脉）一个列表，
 *          每条 { item 物品名, chance 几率%, n [最少, 最多] }
 *          物品名：火髓、空间晶核、炼宝玄晶、法宝模具（随机一种）、某种模具（例 "飞剑模具"），
 *                  也可以写药材 / 矿石名字，或 content/items.js 里的自定义物品
 * ===================================================================== */
window.CFG = window.CFG || {};

CFG.mijing = {
  // v51：秘境怪物属性 = 人物属性（该秘境 realm 境界第 LAYER 层 + 全部宗门功法练到 GF 层）× MULT × KIND 倍率
  REF: {
    LAYER: 10, GF: 5,
    MULT: 1.05,         // 比人物属性高 5%
    KIND: {
      normal: { hp: 1,   atk: 1,   def: 1,   speed: 1,   hit: 1,   dodge: 1,   crit: 5 },
      elite:  { hp: 1.2, atk: 1.2, def: 1.2, speed: 1.2, hit: 1.2, dodge: 1.2, crit: 10 },
      boss:   { hp: 1.5, atk: 1.5, def: 1.5, speed: 1.5, hit: 1.5, dodge: 1.5, crit: 15 },
    },
  },
  DAILY: 1,          // 每处秘境每天能进几次
  TIME: 100,         // 一次走多少步
  // 一次固定遇到：普通怪、精英怪、首领（最后一步）、灵药、矿脉次数，其余步数无事发生
  MONSTERS: 12, ELITES: 5, BOSS: 1,
  HERB_MIN: 5, HERB_MAX: 10,
  ORE_MIN: 5, ORE_MAX: 10,

  // ---------- 秘境专用材料 ----------
  //   name 名字   sell 出售价（灵石）   desc 说明
  items: {
    kj:   { name: "空间晶核", sell: 20, desc: "炼制空间石的专用材料。" },
    jj:   { name: "炼宝玄晶", sell: 20, desc: "法宝强化的专用材料。" },
    qj:   { name: "淬器玄晶", sell: 20, desc: "装备、戒指强化的专用材料。" },
    lu:   { name: "养神灵露", sell: 20, desc: "修炼元婴出窍秘法的材料，元婴期秘境掉落。" },
    mold: { name: "模具",     sell: 50, desc: "炼制一阶法宝的模具，没有属性、不能装备。学会宗门一阶法宝图谱后，在洞府炼器室用它炼成同种法宝。" },
  },

  list: [
    // ---------- 1. 灵泉洞天（需练气） ----------
    { name: "灵泉洞天", realm: 0, find: { map: 0, chance: 5 }, drops: 0, mat: 2, stone: 2, L: 9,
      bossName: "灵泉守护·碧水灵蛟", monsters: ["灵泉水妖", "碧鳞鱼精", "水灵", "青藤妖"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 1] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [1, 3] }, { item: "空间晶核", chance: 50, n: [1, 1] }, { item: "炼宝玄晶", chance: 50, n: [1, 1] }, { item: "淬器玄晶", chance: 50, n: [1, 1] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 2. 古修洞府（需筑基） ----------
    { name: "古修洞府", realm: 1, find: { map: 1, chance: 5 }, drops: 1, mat: 2, stone: 2, L: 19,
      bossName: "古修残魂", monsters: ["守府傀儡", "古修残影", "石甲卫", "噬灵鼠"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 1] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [1, 3] }, { item: "空间晶核", chance: 50, n: [1, 1] }, { item: "炼宝玄晶", chance: 50, n: [1, 1] }, { item: "淬器玄晶", chance: 50, n: [1, 1] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 3. 赤炎火窟（需金丹） ----------
    { name: "赤炎火窟", realm: 2, find: { map: 2, chance: 5 }, drops: 2, mat: 2, stone: 2, L: 29,
      bossName: "火窟之主·赤炎魔君", monsters: ["火灵", "炎魔", "赤炎蜥", "熔岩巨人"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 2] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [2, 6] }, { item: "空间晶核", chance: 50, n: [1, 2] }, { item: "炼宝玄晶", chance: 50, n: [1, 2] }, { item: "淬器玄晶", chance: 50, n: [1, 2] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 4. 寒渊冰宫（需元婴） ----------
    { name: "寒渊冰宫", realm: 3, find: { map: 3, chance: 5 }, drops: 3, mat: 2, stone: 2, L: 39,
      bossName: "冰宫女帝·玄冰凤", monsters: ["冰魄妖", "寒霜狼", "冰傀儡", "雪妖"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 2] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [2, 6] }, { item: "空间晶核", chance: 50, n: [1, 2] }, { item: "炼宝玄晶", chance: 50, n: [1, 2] }, { item: "淬器玄晶", chance: 50, n: [1, 2] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 5. 万剑冢（需出窍） ----------
    { name: "万剑冢", realm: 4, find: { map: 3, chance: 5 }, drops: 3, mat: 2, stone: 2, L: 44,
      bossName: "剑冢剑灵", monsters: ["剑灵", "剑魂", "残剑傀儡", "剑奴"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 3] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [3, 9] }, { item: "空间晶核", chance: 50, n: [1, 3] }, { item: "炼宝玄晶", chance: 50, n: [1, 3] }, { item: "淬器玄晶", chance: 50, n: [1, 3] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 6. 上古战场（需化神） ----------
    { name: "上古战场", realm: 5, find: { map: 4, chance: 5 }, drops: 4, mat: 2, stone: 2, L: 49,
      bossName: "上古战魂·不灭战神", monsters: ["上古战魂", "骷髅战将", "战场怨灵", "血煞魔兵"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 3] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [3, 9] }, { item: "空间晶核", chance: 50, n: [1, 3] }, { item: "炼宝玄晶", chance: 50, n: [1, 3] }, { item: "淬器玄晶", chance: 50, n: [1, 3] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 7. 星陨秘境（需练虚） ----------
    { name: "星陨秘境", realm: 6, find: { map: 5, chance: 5 }, drops: 5, mat: 2, stone: 2, L: 59,
      bossName: "星陨之主·噬星兽", monsters: ["星兽", "陨星傀儡", "星芒灵", "噬星虫"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 4] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [4, 12] }, { item: "空间晶核", chance: 50, n: [1, 4] }, { item: "炼宝玄晶", chance: 50, n: [1, 4] }, { item: "淬器玄晶", chance: 50, n: [1, 4] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 8. 幽冥鬼域（需合体） ----------
    { name: "幽冥鬼域", realm: 7, find: { map: 6, chance: 5 }, drops: 6, mat: 2, stone: 2, L: 69,
      bossName: "鬼域之王·幽冥鬼帝", monsters: ["鬼将", "幽魂", "冥鬼", "骨魔"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 4] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [4, 12] }, { item: "空间晶核", chance: 50, n: [1, 4] }, { item: "炼宝玄晶", chance: 50, n: [1, 4] }, { item: "淬器玄晶", chance: 50, n: [1, 4] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 9. 太虚幻境（需洞真） ----------
    { name: "太虚幻境", realm: 8, find: { map: 6, chance: 5 }, drops: 6, mat: 2, stone: 2, L: 74,
      bossName: "太虚幻主", monsters: ["幻影修士", "心魔幻象", "虚空灵", "幻兽"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 5] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [5, 15] }, { item: "空间晶核", chance: 50, n: [1, 5] }, { item: "炼宝玄晶", chance: 50, n: [1, 5] }, { item: "淬器玄晶", chance: 50, n: [1, 5] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
    // ---------- 10. 混沌古界（需大乘） ----------
    { name: "混沌古界", realm: 9, find: { map: 7, chance: 5 }, drops: 7, mat: 2, stone: 2, L: 79,
      bossName: "混沌古兽", monsters: ["混沌兽", "太古魔灵", "混沌之灵", "古界巨人"],
      extra: {
        monster: [{ item: "火髓", chance: 2, n: [1, 1] }],
        elite:   [{ item: "火髓", chance: 10, n: [1, 5] }, { item: "空间晶核", chance: 10, n: [1, 1] }, { item: "炼宝玄晶", chance: 10, n: [1, 1] }, { item: "淬器玄晶", chance: 10, n: [1, 1] }],
        boss:    [{ item: "火髓", chance: 100, n: [5, 15] }, { item: "空间晶核", chance: 50, n: [1, 5] }, { item: "炼宝玄晶", chance: 50, n: [1, 5] }, { item: "淬器玄晶", chance: 50, n: [1, 5] }, { item: "法宝模具", chance: 30, n: [1, 1] }],
      } },
  ],
};
