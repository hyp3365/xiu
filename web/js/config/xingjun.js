/* =====================================================================
 * ★ 数值设置 · 四界官位：界主 / 星君（各界殿君）/ 天将 ★
 * ---------------------------------------------------------------------
 * 改完把 index.html 里的 ?v=数字 加 1。
 * 仙界、冥界、魔界、神界每张地图：
 *   天宫（各界名字见 config/worldmaps.js 的 halls.tg）：挑战界主 —— 一场连战，先按倍率从小到大打完该图所有星君，
 *     最后打界主，全胜就任界主；连战开始时气血法力回满，中间不恢复，打完恢复成挑战前的状态
 *   星君殿（halls.xj）：挑战单个星君，胜即就任；天将不用打，满足条件直接就任
 * 每一界同时只能担任一个官位（四界合计最多四个），在同一界就任新官位会卸下旧的。
 *
 * 一、守关 NPC 属性（气血、攻击、防御、速度、命中、闪避；暴击 = 首领暴击，不乘）
 *   第 i 位星君 = 该地图北域首领属性 × 该地图怪物倍率 × NPC_MULT[i-1]（星君比 NPC_MULT 多时用最后一个）
 *   界主       = 该地图北域首领属性 × 该地图怪物倍率 × JZ_MULT
 *
 * 二、俸禄：每 HOUR 秒结算一次（离线也算），每次给 merit 功德、stone 灵石、hx 火髓
 *   先看 MAP_PAY[地图序号][官位]：写了就直接用里面的数值（不再乘 GROW / 灵石基数）；
 *   没写（该地图或该官位缺这一项）才按 PAY 算：
 *     功德 = PAY.merit × GROW.merit^(地图序号，第 1 张 = 0)      火髓 = PAY.hx × GROW.hx^(地图序号)
 *     灵石 = PAY.stone × 该地图北域怪物灵石基数（同历练掉落）
 *   星君最后都再 × SEAT_PAY[第几位-1]（位数比 SEAT_PAY 多时用最后一个）；结果取整
 *   注：目前每界 10 张地图的三种官位都写在 MAP_PAY 里，所以 PAY、GROW 只在地图超过 10 张或删掉 MAP_PAY 时才生效。
 *
 * 官位代号：jz 界主、xj 星君、tj 天将
 * ===================================================================== */
window.CFG = window.CFG || {};

CFG.xingjun = {
  HOUR: 3600,       // 俸禄结算间隔（秒），3600 = 每小时一次
  TIMES: 5,         // 每界每天（北京时间 0 点重置）可以挑战几次（单挑星君、连战界主都算 1 次，赢输都算）

  // 每界设置（xian 仙界、ming 冥界、mo 魔界、shen 神界，字段都一样）：
  //   JZ / SEAT / TJ：界主名、星君名、天将名的写法；{map} = 地图名，{short} = 地图名去掉最后的「天」，{seat} = SEATS 里的名字
  //   SEATS：各张地图的星君名单（按地图顺序一张一组；只写一组 = 所有地图都用这一组）；名单有几个名字就有几位星君
  //   NPC_MULT：第 1 个 = 第 1 位星君的属性倍率 ……（乘法见文件开头「一」）
  //   JZ_MULT：界主的属性倍率
  //   TJ_REALM：担任天将另需的境界序号（0 练气 1 筑基 ……，还要能进入该地图）；-1 = 不限
  //   PAY / GROW / SEAT_PAY / MAP_PAY：俸禄，乘法见文件开头「二」
  worlds: {
    xian: {
      JZ: "{short}大帝", SEAT: "{seat}星君", TJ: "天将",   // 界主如「玉皇大帝」，星君如「贪狼星君」
      SEATS: [   // 每张地图一组星君名
        ["贪狼", "巨门", "禄存", "文曲", "廉贞", "武曲", "破军"],   // 1 梵度天
        ["司命", "司禄", "延寿", "益算", "度厄", "上生"],           // 2 西极天
        ["岁星", "荧惑", "太白", "辰星", "镇星"],                   // 3 大焚天
        ["角木", "亢金", "氐土", "房日", "心月", "尾火", "箕水"],   // 4 朱雀天
        ["斗木", "牛金", "女土", "虚日", "危月", "室火", "壁水"],   // 5 七曜天
        ["太阳", "太阴", "火德", "水德", "木德", "金德", "土德"],   // 6 始皇天
        ["井木", "鬼金", "柳土", "星日", "张月", "翼火", "轸水"],   // 7 荣华天
        ["奎木", "娄金", "胃土", "昴日", "毕月", "觜火", "参水"],   // 8 妙成天
        ["紫微", "勾陈", "天皇", "南极", "长庚", "启明", "天喜"],   // 9 太皇天
        ["青龙", "白虎", "朱雀", "玄武", "麒麟", "腾蛇", "勾陈"],   // 10 玉皇天
      ],
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],   // 第 1 ~ 7 位星君的属性倍率（× 北域首领）
      JZ_MULT: 4,   // 界主属性倍率（× 北域首领）
      TJ_REALM: 0,   // 担任天将需要练气以上（还要能进入该地图）
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },   // 备用俸禄（MAP_PAY 没写时才用）：界主 / 星君 / 天将
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],   // 第 1 ~ 7 位星君的俸禄倍率
      GROW: { merit: 1.5, hx: 1.3 },   // 备用俸禄每张地图的成长：功德 ×1.5、火髓 ×1.3
      MAP_PAY: [   // 每张地图一行（按地图顺序），jz 界主 / xj 星君 / tj 天将 每次结算的 功德 merit、灵石 stone、火髓 hx
        { jz: { merit: 60, stone: 408456852, hx: 5 }, xj: { merit: 20, stone: 0, hx: 0 }, tj: { merit: 5, stone: 0, hx: 0 } },   // 1 梵度天
        { jz: { merit: 90, stone: 1652435779, hx: 6 }, xj: { merit: 30, stone: 0, hx: 0 }, tj: { merit: 7, stone: 0, hx: 0 } },   // 2 西极天
        { jz: { merit: 135, stone: 6685024348, hx: 8 }, xj: { merit: 45, stone: 0, hx: 0 }, tj: { merit: 11, stone: 0, hx: 0 } },   // 3 大焚天
        { jz: { merit: 202, stone: 27044651966, hx: 10 }, xj: { merit: 67, stone: 0, hx: 0 }, tj: { merit: 16, stone: 0, hx: 0 } },   // 4 朱雀天
        { jz: { merit: 303, stone: 109410700972, hx: 14 }, xj: { merit: 101, stone: 0, hx: 0 }, tj: { merit: 25, stone: 0, hx: 0 } },   // 5 七曜天
        { jz: { merit: 455, stone: 442627307688, hx: 18 }, xj: { merit: 151, stone: 0, hx: 0 }, tj: { merit: 37, stone: 0, hx: 0 } },   // 6 始皇天
        { jz: { merit: 683, stone: 1790674328653, hx: 24 }, xj: { merit: 227, stone: 0, hx: 0 }, tj: { merit: 56, stone: 0, hx: 0 } },   // 7 荣华天
        { jz: { merit: 1025, stone: 7244276382417, hx: 31 }, xj: { merit: 341, stone: 0, hx: 0 }, tj: { merit: 85, stone: 0, hx: 0 } },   // 8 妙成天
        { jz: { merit: 1537, stone: 29307138358495, hx: 40 }, xj: { merit: 512, stone: 0, hx: 0 }, tj: { merit: 128, stone: 0, hx: 0 } },   // 9 太皇天
        { jz: { merit: 2306, stone: 118563720297672, hx: 53 }, xj: { merit: 768, stone: 0, hx: 0 }, tj: { merit: 192, stone: 0, hx: 0 } },   // 10 玉皇天
      ],
    },
    ming: {
      JZ: "{map}冥帝", SEAT: "{seat}", TJ: "鬼将",   // 界主如「鬼门关冥帝」，星君直接用名单里的名字
      SEATS: [["秦广王", "楚江王", "宋帝王", "五官王", "阎罗王", "卞城王", "泰山王"]],   // 只写一组：所有地图共用这 7 位
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],   // 第 1 ~ 7 位星君的属性倍率（× 北域首领）
      JZ_MULT: 4,   // 界主属性倍率（× 北域首领）
      TJ_REALM: -1,   // 担任天将不限境界（能进入该地图即可）
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },   // 备用俸禄（MAP_PAY 没写时才用）：界主 / 星君 / 天将
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],   // 第 1 ~ 7 位星君的俸禄倍率
      GROW: { merit: 1.5, hx: 1.3 },   // 备用俸禄每张地图的成长：功德 ×1.5、火髓 ×1.3
      MAP_PAY: [   // 每张地图一行（按地图顺序），jz 界主 / xj 星君 / tj 天将 每次结算的 功德 merit、灵石 stone、火髓 hx
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
      JZ: "{map}魔尊", SEAT: "{seat}魔君", TJ: "魔将",   // 界主如「血魔谷魔尊」，星君如「血煞魔君」
      SEATS: [["血煞", "噬魂", "天罗", "幽冥", "焚天", "裂地", "万劫"]],   // 只写一组：所有地图共用这 7 位
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],   // 第 1 ~ 7 位星君的属性倍率（× 北域首领）
      JZ_MULT: 4,   // 界主属性倍率（× 北域首领）
      TJ_REALM: -1,   // 担任天将不限境界（能进入该地图即可）
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },   // 备用俸禄（MAP_PAY 没写时才用）：界主 / 星君 / 天将
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],   // 第 1 ~ 7 位星君的俸禄倍率
      GROW: { merit: 1.5, hx: 1.3 },   // 备用俸禄每张地图的成长：功德 ×1.5、火髓 ×1.3
      MAP_PAY: [   // 每张地图一行（按地图顺序），jz 界主 / xj 星君 / tj 天将 每次结算的 功德 merit、灵石 stone、火髓 hx
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
      JZ: "{map}神帝", SEAT: "{seat}神君", TJ: "神将",   // 界主如「钧天神帝」，星君如「青阳神君」
      SEATS: [["青阳", "赤明", "白藏", "玄冥", "黄枢", "太昊", "少昊"]],   // 只写一组：所有地图共用这 7 位
      NPC_MULT: [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8],   // 第 1 ~ 7 位星君的属性倍率（× 北域首领）
      JZ_MULT: 4,   // 界主属性倍率（× 北域首领）
      TJ_REALM: -1,   // 担任天将不限境界（能进入该地图即可）
      PAY: { jz: { merit: 60, stone: 200, hx: 5 }, xj: { merit: 20 }, tj: { merit: 5 } },   // 备用俸禄（MAP_PAY 没写时才用）：界主 / 星君 / 天将
      SEAT_PAY: [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0],   // 第 1 ~ 7 位星君的俸禄倍率
      GROW: { merit: 1.5, hx: 1.3 },   // 备用俸禄每张地图的成长：功德 ×1.5、火髓 ×1.3
      MAP_PAY: [   // 每张地图一行（按地图顺序），jz 界主 / xj 星君 / tj 天将 每次结算的 功德 merit、灵石 stone、火髓 hx
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
