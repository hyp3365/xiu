/* =====================================================================
 * ★ 数值设置 · 四界官位：界主 / 星君（各界殿君）/ 天将（v50） ★
 * ---------------------------------------------------------------------
 * 仙界、冥界、魔界、神界每张地图：
 *   天宫（各界名字见 config/worldmaps.js 的 halls.tg）：挑战界主 —— 一场连战，先依次打完该图所有星君，最后打界主，全胜就任界主
 *   星君殿（halls.xj）：挑战单个星君，胜即就任；天将直接就任
 * 每一界同时只能担任一个官位（四界合计最多四个），在同一界就任新官位会卸下旧的。
 * 俸禄每 HOUR 秒结算一次（离线也算）。
 * ===================================================================== */
window.CFG = window.CFG || {};

CFG.xingjun = {
  HOUR: 3600,       // 俸禄结算间隔（秒）
  TIMES: 5,         // 每界每天（北京时间 0 点重置）可以挑战几次（单挑星君、连战界主都算 1 次，赢输都算）

  // 每界设置：
  //   JZ / SEAT / TJ：界主 NPC 名、星君名、天将名；{map} = 地图名，{short} = 地图名去掉最后的「天」，{seat} = SEATS 里的名字
  //   SEATS：各张地图的星君名单（按地图顺序；只写一组 = 所有地图都用这一组）
  //   NPC_MULT：第几位星君的属性 = 该地图北域首领 × 倍率（位数比这里多时用最后一个）；连战时从倍率小的打到大的
  //   JZ_MULT：界主 NPC 属性 = 北域首领 × 倍率
  //   TJ_REALM：担任天将另需的境界（还要能进入该地图）；-1 = 不限
  //   PAY：每次结算的俸禄 —— merit 功德、stone 灵石、hx 火髓（三种都可以给任意官位，不写 = 0）
  //        功德、火髓 = 数值 × GROW^(地图序号，第 1 张 = 0)
  //        灵石 = 数值 × 该地图北域怪物灵石基数（同历练掉落）
  //        星君再 × SEAT_PAY[第几位]
  //   MAP_PAY：每张地图单独设置俸禄（按地图顺序，第 1 张 = 第一行）—— 写了就直接用这里的数值（不再乘 GROW / 灵石基数），
  //        星君仍 × SEAT_PAY[第几位]；某张地图或某个官位没写就按上面 PAY 计算
  worlds: {
    xian: {
      JZ: "{short}大帝", SEAT: "{seat}星君", TJ: "天将",
      SEATS: [
        ["贪狼", "巨门", "禄存", "文曲", "廉贞", "武曲", "破军"],   // 1 玉皇天
        ["司命", "司禄", "延寿", "益算", "度厄", "上生"],           // 2 太皇天
        ["岁星", "荧惑", "太白", "辰星", "镇星"],                   // 3 妙成天
        ["角木", "亢金", "氐土", "房日", "心月", "尾火", "箕水"],   // 4 荣华天
        ["斗木", "牛金", "女土", "虚日", "危月", "室火", "壁水"],   // 5 始皇天
        ["太阳", "太阴", "火德", "水德", "木德", "金德", "土德"],   // 6 七曜天
        ["井木", "鬼金", "柳土", "星日", "张月", "翼火", "轸水"],   // 7 朱雀天
        ["奎木", "娄金", "胃土", "昴日", "毕月", "觜火", "参水"],   // 8 大焚天
        ["紫微", "勾陈", "天皇", "南极", "长庚", "启明", "天喜"],   // 9 西极天
        ["青龙", "白虎", "朱雀", "玄武", "麒麟", "腾蛇", "勾陈"],   // 10 梵度天
      ],
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],
      JZ_MULT: 4,
      TJ_REALM: 0,
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],
      GROW: { merit: 1.5, hx: 1.3 },
      MAP_PAY: [
        { jz: { merit: 60, stone: 408456852, hx: 5 }, xj: { merit: 20, stone: 0, hx: 0 }, tj: { merit: 5, stone: 0, hx: 0 } },   // 1 玉皇天
        { jz: { merit: 90, stone: 1652435779, hx: 6 }, xj: { merit: 30, stone: 0, hx: 0 }, tj: { merit: 7, stone: 0, hx: 0 } },   // 2 太皇天
        { jz: { merit: 135, stone: 6685024348, hx: 8 }, xj: { merit: 45, stone: 0, hx: 0 }, tj: { merit: 11, stone: 0, hx: 0 } },   // 3 妙成天
        { jz: { merit: 202, stone: 27044651966, hx: 10 }, xj: { merit: 67, stone: 0, hx: 0 }, tj: { merit: 16, stone: 0, hx: 0 } },   // 4 荣华天
        { jz: { merit: 303, stone: 109410700972, hx: 14 }, xj: { merit: 101, stone: 0, hx: 0 }, tj: { merit: 25, stone: 0, hx: 0 } },   // 5 始皇天
        { jz: { merit: 455, stone: 442627307688, hx: 18 }, xj: { merit: 151, stone: 0, hx: 0 }, tj: { merit: 37, stone: 0, hx: 0 } },   // 6 七曜天
        { jz: { merit: 683, stone: 1790674328653, hx: 24 }, xj: { merit: 227, stone: 0, hx: 0 }, tj: { merit: 56, stone: 0, hx: 0 } },   // 7 朱雀天
        { jz: { merit: 1025, stone: 7244276382417, hx: 31 }, xj: { merit: 341, stone: 0, hx: 0 }, tj: { merit: 85, stone: 0, hx: 0 } },   // 8 大焚天
        { jz: { merit: 1537, stone: 29307138358495, hx: 40 }, xj: { merit: 512, stone: 0, hx: 0 }, tj: { merit: 128, stone: 0, hx: 0 } },   // 9 西极天
        { jz: { merit: 2306, stone: 118563720297672, hx: 53 }, xj: { merit: 768, stone: 0, hx: 0 }, tj: { merit: 192, stone: 0, hx: 0 } },   // 10 梵度天
      ],
    },
    ming: {
      JZ: "{map}冥帝", SEAT: "{seat}", TJ: "鬼将",
      SEATS: [["秦广王", "楚江王", "宋帝王", "五官王", "阎罗王", "卞城王", "泰山王"]],
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],
      JZ_MULT: 4,
      TJ_REALM: -1,
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],
      GROW: { merit: 1.5, hx: 1.3 },
      MAP_PAY: [
        { jz: { merit: 60, stone: 408456852, hx: 5 }, xj: { merit: 20, stone: 0, hx: 0 }, tj: { merit: 5, stone: 0, hx: 0 } },   // 1 鬼门关
        { jz: { merit: 90, stone: 1652435779, hx: 6 }, xj: { merit: 30, stone: 0, hx: 0 }, tj: { merit: 7, stone: 0, hx: 0 } },   // 2 黄泉路
        { jz: { merit: 135, stone: 6685024348, hx: 8 }, xj: { merit: 45, stone: 0, hx: 0 }, tj: { merit: 11, stone: 0, hx: 0 } },   // 3 奈何桥
        { jz: { merit: 202, stone: 27044651966, hx: 10 }, xj: { merit: 67, stone: 0, hx: 0 }, tj: { merit: 16, stone: 0, hx: 0 } },   // 4 枉死城
        { jz: { merit: 303, stone: 109410700972, hx: 14 }, xj: { merit: 101, stone: 0, hx: 0 }, tj: { merit: 25, stone: 0, hx: 0 } },   // 5 拔舌地狱
        { jz: { merit: 455, stone: 442627307688, hx: 18 }, xj: { merit: 151, stone: 0, hx: 0 }, tj: { merit: 37, stone: 0, hx: 0 } },   // 6 刀山地狱
        { jz: { merit: 683, stone: 1790674328653, hx: 24 }, xj: { merit: 227, stone: 0, hx: 0 }, tj: { merit: 56, stone: 0, hx: 0 } },   // 7 油锅地狱
        { jz: { merit: 1025, stone: 7244276382417, hx: 31 }, xj: { merit: 341, stone: 0, hx: 0 }, tj: { merit: 85, stone: 0, hx: 0 } },   // 8 血池地狱
        { jz: { merit: 1537, stone: 29307138358495, hx: 40 }, xj: { merit: 512, stone: 0, hx: 0 }, tj: { merit: 128, stone: 0, hx: 0 } },   // 9 无间炼狱
        { jz: { merit: 2306, stone: 118563720297672, hx: 53 }, xj: { merit: 768, stone: 0, hx: 0 }, tj: { merit: 192, stone: 0, hx: 0 } },   // 10 轮回殿
      ],
    },
    mo: {
      JZ: "{map}魔尊", SEAT: "{seat}魔君", TJ: "魔将",
      SEATS: [["血煞", "噬魂", "天罗", "幽冥", "焚天", "裂地", "万劫"]],
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],
      JZ_MULT: 4,
      TJ_REALM: -1,
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],
      GROW: { merit: 1.5, hx: 1.3 },
      MAP_PAY: [
        { jz: { merit: 60, stone: 27044651966, hx: 5 }, xj: { merit: 20, stone: 0, hx: 0 }, tj: { merit: 5, stone: 0, hx: 0 } },   // 1 血魔谷
        { jz: { merit: 90, stone: 109410700972, hx: 6 }, xj: { merit: 30, stone: 0, hx: 0 }, tj: { merit: 7, stone: 0, hx: 0 } },   // 2 万魔窟
        { jz: { merit: 135, stone: 442627307688, hx: 8 }, xj: { merit: 45, stone: 0, hx: 0 }, tj: { merit: 11, stone: 0, hx: 0 } },   // 3 噬魂魔渊
        { jz: { merit: 202, stone: 1790674328653, hx: 10 }, xj: { merit: 67, stone: 0, hx: 0 }, tj: { merit: 16, stone: 0, hx: 0 } },   // 4 魔焰山
        { jz: { merit: 303, stone: 7244276382417, hx: 14 }, xj: { merit: 101, stone: 0, hx: 0 }, tj: { merit: 25, stone: 0, hx: 0 } },   // 5 骨魔荒原
        { jz: { merit: 455, stone: 29307138358495, hx: 18 }, xj: { merit: 151, stone: 0, hx: 0 }, tj: { merit: 37, stone: 0, hx: 0 } },   // 6 天魔宫
        { jz: { merit: 683, stone: 118563720297672, hx: 24 }, xj: { merit: 227, stone: 0, hx: 0 }, tj: { merit: 56, stone: 0, hx: 0 } },   // 7 罗刹海
        { jz: { merit: 1025, stone: 479656375824555, hx: 31 }, xj: { merit: 341, stone: 0, hx: 0 }, tj: { merit: 85, stone: 0, hx: 0 } },   // 8 阿修罗场
        { jz: { merit: 1537, stone: 1940477561698650, hx: 40 }, xj: { merit: 512, stone: 0, hx: 0 }, tj: { merit: 128, stone: 0, hx: 0 } },   // 9 魔神殿
        { jz: { merit: 2306, stone: 7850314010697592, hx: 53 }, xj: { merit: 768, stone: 0, hx: 0 }, tj: { merit: 192, stone: 0, hx: 0 } },   // 10 魔祖天
      ],
    },
    shen: {
      JZ: "{map}神帝", SEAT: "{seat}神君", TJ: "神将",
      SEATS: [["青阳", "赤明", "白藏", "玄冥", "黄枢", "太昊", "少昊"]],
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],
      JZ_MULT: 4,
      TJ_REALM: -1,
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],
      GROW: { merit: 1.5, hx: 1.3 },
      MAP_PAY: [
        { jz: { merit: 60, stone: 109410700972, hx: 5 }, xj: { merit: 20, stone: 0, hx: 0 }, tj: { merit: 5, stone: 0, hx: 0 } },   // 1 钧天
        { jz: { merit: 90, stone: 442627307688, hx: 6 }, xj: { merit: 30, stone: 0, hx: 0 }, tj: { merit: 7, stone: 0, hx: 0 } },   // 2 苍天
        { jz: { merit: 135, stone: 1790674328653, hx: 8 }, xj: { merit: 45, stone: 0, hx: 0 }, tj: { merit: 11, stone: 0, hx: 0 } },   // 3 变天
        { jz: { merit: 202, stone: 7244276382417, hx: 10 }, xj: { merit: 67, stone: 0, hx: 0 }, tj: { merit: 16, stone: 0, hx: 0 } },   // 4 玄天
        { jz: { merit: 303, stone: 29307138358495, hx: 14 }, xj: { merit: 101, stone: 0, hx: 0 }, tj: { merit: 25, stone: 0, hx: 0 } },   // 5 幽天
        { jz: { merit: 455, stone: 118563720297672, hx: 18 }, xj: { merit: 151, stone: 0, hx: 0 }, tj: { merit: 37, stone: 0, hx: 0 } },   // 6 颢天
        { jz: { merit: 683, stone: 479656375824555, hx: 24 }, xj: { merit: 227, stone: 0, hx: 0 }, tj: { merit: 56, stone: 0, hx: 0 } },   // 7 朱天
        { jz: { merit: 1025, stone: 1940477561698650, hx: 31 }, xj: { merit: 341, stone: 0, hx: 0 }, tj: { merit: 85, stone: 0, hx: 0 } },   // 8 炎天
        { jz: { merit: 1537, stone: 7850314010697592, hx: 40 }, xj: { merit: 512, stone: 0, hx: 0 }, tj: { merit: 128, stone: 0, hx: 0 } },   // 9 阳天
        { jz: { merit: 2306, stone: 31758898573713812, hx: 53 }, xj: { merit: 768, stone: 0, hx: 0 }, tj: { merit: 192, stone: 0, hx: 0 } },   // 10 昊天
      ],
    },
  },
};
