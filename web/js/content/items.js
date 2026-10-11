/* =====================================================================
 * ★ 自定义物品 · 坊市 · 宗门宝库 · 地图掉落 ★（v17 新增）
 * ---------------------------------------------------------------------
 * 这个文件不是数值文件：在这里可以
 *   1. list      添加任何物品，设置它的属性
 *   2. shop      设置坊市卖什么（原有的修炼丹、装备也在这里，可以删、改价格）
 *   3. treasury  设置宗门宝库「杂物」页兑换什么（原有的炉子、灵石也在这里）
 *   4. drops     把物品加进地图掉落
 * 改完把 index.html 里的 ?v=数字 加 1。
 * 物品名字就是物品的 id，不要重名；已经发给玩家的物品改名后，玩家背包里的会变成「失传之物」。
 * ===================================================================== */
window.ITEMS = {};

/* ---------------- 1. 物品 ----------------
 * 写法："名字": { type: 类型, q: 品质, desc: 说明, sell: 出售灵石(0 = 不能出售), ...属性 }
 *   q 品质（颜色）：0 凡品 1 灵品 2 宝品 3 仙品 4 神品 5 圣品
 *
 * type 类型：
 *   "use"    消耗品，点「使用」立即生效，用掉一个。可写：
 *              hp / mana 恢复气血、法力（固定数值）  hpPct / manaPct 恢复上限的百分比
 *              stone 灵石  ling 灵气  contrib 门派贡献  exp 修为
 *   "perm"   永久属性（像属性丹），limit = 最多使用几个（不写 = 不限）。属性见下面「属性」
 *   "equip"  装备，slot 部位：helmet 头盔 / armor 护甲 / weapon 武器 / legs 腿甲 / boots 靴 / pendant 吊坠 / ring 戒指
 *            realm 显示境界序号（0 练气 1 筑基 …，只影响出售价默认值、不影响属性）。属性见下面
 *   "fabao"  法宝（放进法宝栏生效）。属性见下面
 *   "box"    礼包，打开得到：stone 灵石、items { "物品名": 数量 }（可以放自定义物品，也可以放药材矿石，如 青灵草: 10）
 *   "misc"   杂物，只能出售（任务物品、收藏品等）
 *
 * 属性（perm / equip / fabao 通用，固定数值）：
 *   hp 气血  atk 攻击  def 防御  mana 法力  hit 命中  dodge 闪避  speed 速度  crit 暴击%
 *   res: { jin: 金抗, mu: 木抗, shui: 水抗, huo: 火抗, tu: 土抗, lei: 雷抗 }（只写需要的）
 */
// 下面 8 个是示例物品（只是定义，没放进坊市/宝库/掉落之前玩家拿不到），可以改、可以删
ITEMS.list = {
  "回春丹":   { type: "use",   q: 1, desc: "疗伤圣药，服下立刻恢复三成气血。", hpPct: 30, sell: 20 },
  "回灵丹":   { type: "use",   q: 1, desc: "恢复三成法力。", manaPct: 30, sell: 20 },
  "淬体灵液": { type: "perm",  q: 2, desc: "以灵液淬炼肉身，永久增强体魄。", hp: 50, def: 5, limit: 20, sell: 100 },
  "避火珠":   { type: "perm",  q: 3, desc: "含在口中，烈火不侵。", res: { huo: 20 }, limit: 5, sell: 300 },
  "青锋剑":   { type: "equip", q: 2, slot: "weapon", desc: "一柄锋利的青钢长剑。", atk: 30, crit: 2, sell: 200 },
  "玄龟盾":   { type: "fabao", q: 3, desc: "玄龟背甲所炼，可挡水火。", def: 40, res: { shui: 30, huo: 30 }, sell: 500 },
  "新手礼包": { type: "box",   q: 1, desc: "打开获得灵石和丹药。", stone: 500, items: { "回春丹": 3, "青灵草": 10 }, sell: 0 },
  "妖兽皮":   { type: "misc",  q: 0, desc: "妖兽身上剥下的皮，坊市有人收。", sell: 5 },
};

/* ---------------- 2. 坊市 ----------------
 * 每一行一种货品，从上到下显示，删掉一行就不卖了：
 *   { kind: "pill", type: "juqi" }        修炼丹（juqi 聚气丹 / juling 聚灵丹 / peiyuan 培元丹），品质 = 当前境界，价格自动
 *   { kind: "eq", slot: "weapon", q: 1 }  系统装备（当前境界），价格自动
 *   { item: "回春丹", price: 100 }        上面 list 里的物品，price 灵石
 *   任意一行都可以加：price 固定价格（覆盖自动价格）  realm 需要的境界序号（0 练气 1 筑基 …，不够就不显示）
 */
ITEMS.shop = [
  { kind: "pill", type: "juqi" , price: 100 },
  { kind: "pill", type: "juling", price: 400 },
  { kind: "pill", type: "peiyuan", price: 900 },
  { kind: "eq", slot: "helmet", q: 1, price: 600 },
  { kind: "eq", slot: "armor", q: 1, price: 600 },
  { kind: "eq", slot: "weapon", q: 1, price: 600 },
  { kind: "eq", slot: "legs", q: 1, price: 600 },
  { kind: "eq", slot: "boots", q: 1, price: 600 },
  { kind: "eq", slot: "pendant", q: 1, price: 600 },
  { kind: "eq", slot: "ring", q: 1, price: 600 },
  // 下面是示例：去掉行首的 // 就会上架
  // { item: "回春丹", price: 100 },
  // { item: "青锋剑", price: 2000, realm: 1 },
];

/* ---------------- 3. 宗门宝库 · 杂物 ----------------
 * 每一行一种，cost = 贡献（不乘星级），star = 需要门派星级（不写 = 1 星起）：
 *   { kind: "furnace", fk: "dan", g: 0, cost: 100 }   炉子（dan 炼丹炉 / qi 炼器炉，g 阶序号 0 = 一阶）
 *   { kind: "stone", n: 2000, cost: 100, name: "一袋灵石" }  灵石 n × 灵石成长^层序
 *   { kind: "pill", type: "juqi", cost: 50 }          修炼丹（当前境界品质）
 *   { item: "淬体灵液", cost: 300 }                   上面 list 里的物品
 * 这里写了就以这里为准；把整个 ITEMS.treasury 删掉，则用 config/sect.js 里的 treasury。
 */
ITEMS.treasury = [
  { kind: "furnace", fk: "dan", g: 0, cost: 100 },
  { kind: "furnace", fk: "qi",  g: 0, cost: 100 },
  { kind: "stone", n: 50, cost: 100, name: "一袋灵石" },
  // 示例：去掉行首的 // 就能兑换
  // { item: "淬体灵液", cost: 300 },
  // { item: "避火珠", cost: 1000, star: 2 },
];

/* ---------------- 4. 地图掉落 ----------------
 * 每一行一条掉落规则（在 drops.js 的药材矿石掉落之外额外掉）：
 *   item   物品名（list 里的物品）
 *   map    地图序号 0~8（0 = 第 1 张青云山林），写 "all" = 所有地图
 *   region 区域 0 东 1 西 2 南 3 北，写 "all" = 全部区域
 *   event  monster 普通怪 / elite 精英怪 / boss 首领 / herbEvent 灵药 / oreEvent 矿脉
 *   chance 掉落几率 %    n [最少, 最多] 数量
 */
ITEMS.drops = [
  // 示例：去掉行首的 // 就会掉落
  // { item: "妖兽皮", map: "all", region: "all", event: "monster", chance: 20, n: [1, 2] },
  // { item: "回春丹", map: "all", region: "all", event: "elite",   chance: 15, n: [1, 1] },
  // { item: "青锋剑", map: 0,     region: "all", event: "boss",    chance: 5,  n: [1, 1] },
];
