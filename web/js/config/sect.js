/* =====================================================================
 * ★ 数值设置 · 门派 ★
 * ---------------------------------------------------------------------
 * 所有数值文件都在 js/config/ 下，一个部分一个文件；改完把 index.html 里的 ?v=数字 加 1。
 * 写法：倍率 1.1 = 每次 ×1.1；概率 0.3 = 30%；时间单位见注释。
 * ===================================================================== */
window.CFG = window.CFG || {};

/* ================= 十三、门派 ================= */
CFG.sect = {
  // 星级倍率：第 1 个 = 1 星门派 …… 第 10 个 = 10 星。门派里的灵石、贡献、练功房等都乘它
  STAR_MULT: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  // 职务倍率：第 1 个 = 外门弟子 …… 第 7 个 = 宗主。俸禄、事务堂奖励再乘它
  RANK_MULT: [1, 1, 1, 1, 1, 1, 1],
  // 宗门大殿职务：cost 晋升贡献（× 星级倍率）、realm 需要境界 = 门派入门境界 + realm（0 = 同境界）、
  //   daily 每日俸禄灵石（× 星级倍率 × 职务倍率）
  ranks: [
    { name: "外门弟子", cost: 0,      realm: 0, daily: 20 },
    { name: "内门弟子", cost: 50,    realm: 1, daily: 30 },
    { name: "真传弟子", cost: 100,   realm: 2, daily: 40 },
    { name: "核心弟子", cost: 200,   realm: 3, daily: 50 },
    { name: "宗门长老", cost: 500,  realm: 4, daily: 60 },
    { name: "宗门供奉", cost: 1000,  realm: 5, daily: 80 },
    { name: "宗主",     cost: 2000, realm: 6, daily: 100 },
  ],
  // 事务堂：每个职务一个任务（rank = 需要的职务序号，0 = 外门弟子）。
  //   点任务后一直自动循环执行（离线也继续），一次只能执行一个
  //   time 每次用时（分钟）、contrib 每次贡献、stone 每次灵石（贡献、灵石都 × 星级倍率 × 职务倍率）
  affair: {
    tasks: [
      { name: "打扫山门",     rank: 0, time: 5,   contrib: 5,   stone: 1 },
      { name: "护送商队",     rank: 1, time: 5,  contrib: 8,  stone: 2 },
      { name: "镇守灵脉",     rank: 2, time: 5,  contrib: 12,  stone: 3 },
      { name: "斩杀魔修",     rank: 3, time: 5,  contrib: 16,  stone: 4 },
      { name: "传功讲道",     rank: 4, time: 5,  contrib: 20, stone: 5 },
      { name: "镇压魔窟",     rank: 5, time: 5,  contrib: 25, stone: 6 },
      { name: "统御宗门",     rank: 6, time: 5, contrib: 30, stone: 7 },
    ],
  },
  // 练功房：pct 修炼速度加成 %、cost 每次修炼消耗贡献（都 × 星级倍率）
  //   rank：需要的职务（0 外门 …… 6 宗主），不写 = 所有人可用
  rooms: [
    { name: "下品练功房", pct: 20,  cost: 1 },
    { name: "中品练功房", pct: 30,  cost: 2 },
    { name: "上品练功房", pct: 50, cost: 4 },
    { name: "天字练功房", pct: 80, cost: 6 },
    { name: "宗主练功房", pct: 120, cost: 1, rank: 6 },   // 宗主专用
  ],
  // 试炼塔：第 n 层守关者属性 = base × 星级倍率 × GROW^(n-1)（暴击不成长）；首通贡献 = REWARD × n
  tower: { MAX: 100, REWARD: 20, GROW: 1.1,
    base: { hp: 72, atk: 11, def: 3.6, speed: 10, hit: 10, dodge: 10, crit: 5 } },
  SECRET_COST: 200,  // 宗门秘境每次消耗贡献（× 星级倍率）
  // 宝库「杂物」页：cost 贡献（不乘星级）
  //   kind: "furnace" 炉子（fk: dan 炼丹炉 / qi 炼器炉，g: 阶序号 0 = 一阶），兑换后放进背包，点「使用」装到洞府
  //   kind: "stone"   灵石 n × 星级倍率
  //   kind: "pill"    修炼丹（type: juqi/juling/peiyuan，当前境界品质）
  treasury: [
    { kind: "furnace", fk: "dan", g: 0, cost: 100 },
    { kind: "furnace", fk: "qi",  g: 0, cost: 100 },
    { kind: "stone", n: 2000, cost: 100, name: "一袋灵石" },
  ],
};

// ---------- v13 新增 ----------
// 1~10 星门派入门需要的境界序号（0 练气、1 筑基、2 金丹 …… 17 大道圣人）
// -1 = 凡人即可；之后按 js/data/realms.js 的境界顺序：0 练气 1 筑基 2 金丹 3 元婴 4 出窍 5 化神 6 练虚 7 合体
//   8 洞真 9 大乘 10 渡劫 11 散仙 12 游仙 13 地仙 14 天仙 15 金仙 16 太乙金仙 17 大罗金仙 18 玄仙 19 仙君 20 帝仙 21 准圣 22 天道圣人 23 大道圣人
// 同星级的坊市功法、法术也用这里的境界要求
CFG.sect.REQ_REALM = [-1, 1, 3, 6, 9, 11, 13, 15, 17, 18];
// 宗门秘境：每次按顺序判定 chance（累计），都不中就一无所获
CFG.sect.secret = {
  stone: { chance: 0.4, mult: 30 },          // 灵石 = 30 × 星级倍率 × (1~2)
  pill:  { chance: 0.35, n: [2, 5] },        // 当前境界修炼丹 2~5 枚
  equip: { chance: 0.15, q: [2, 4] },        // 当前境界装备，品质 宝品~地品
};
