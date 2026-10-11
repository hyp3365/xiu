/* =====================================================================
 * 数据：六界（open: false 表示暂未开放）
 * ===================================================================== */
DATA.worlds = [
  { id: "fan",   name: "凡界",   open: true,  desc: "凡人与修士杂居之地。" },
  { id: "xian",  name: "仙界",   open: false, desc: "飞升之后的仙人居所。" },
  { id: "mo",    name: "魔界",   open: false, desc: "魔气滔天，弱肉强食。" },
  { id: "ming",  name: "冥界",   open: false, desc: "亡魂归处，轮回之所。" },
  { id: "shen",  name: "神界",   open: false, desc: "诸神所居，至高天域。" },
  { id: "tianwai",name:"天外天", open: false, desc: "三界之外，混沌无垠。" },
];

/* =====================================================================
 * 数据：凡界地图（9 张，对应 练气 → 渡劫）
 * ---------------------------------------------------------------------
 * monsters：普通怪物名字（随机遇到，精英怪 = "精英·" + 名字）；boss：北域首领名字
 * 每张地图分 东 西 南 北 四个区域（DATA.regionDirs），每个区域的怪物属性在 numbers.js 的 monster.regions；
 *   东/西/南 三域首领名 = "X域·" + 普通怪名 + "王"，北域首领 = boss
 * 所有地图掉落的药材、矿石种类都一样（6 种药材、6 种矿石），只是数量不同：
 *   地图越高，掉得越多（第 1 张 ×1 → 第 9 张 ×10，见 js/config/numbers.js 的 explore 部分）
 * ===================================================================== */
DATA.maps = [
  { name: "青云山林", boss: "青云山君·吊睛白虎",
    monsters: ["野狼", "赤眼狐", "铁背熊", "山魈", "花斑豹", "毒蛛", "野猪精", "林间散修"] },
  { name: "黑风谷", boss: "黑风老妖",
    monsters: ["黑风狼", "血蝠", "邪修", "腐骨鹰", "黑鳞蟒", "石魔", "噬魂鼠", "风刃螳螂"] },
  { name: "万妖岭", boss: "万妖岭主·九尾天狐",
    monsters: ["三尾妖狐", "金甲蜈蚣", "魔道金丹", "赤炎狮", "碧眼蟾", "裂地犀", "铁翼鹏", "千年树妖"] },
  { name: "幽冥沼泽", boss: "沼泽之主·幽冥蛟王",
    monsters: ["幽冥蛟", "鬼王", "尸魔", "沼泽鳄", "腐毒蛙", "怨灵", "白骨将军", "血河蛭"] },
  { name: "落星海", boss: "落星海皇·玄冥鲲",
    monsters: ["深海妖龙", "星空巨兽", "化神魔修", "海妖", "碧波蛟", "雷鲸", "珊瑚精", "星纹巨蟹"] },
  { name: "虚空裂隙", boss: "虚空领主",
    monsters: ["虚空兽", "裂空魔", "噬界虫", "空间行者", "虚影魔", "混乱之眼", "界外游魂", "碎空蝎"] },
  { name: "天魔战场", boss: "天魔大将·罗睺",
    monsters: ["天魔", "魔将", "血神子", "魔兵", "战魂", "修罗", "魔狼骑", "噬血魔蝠"] },
  { name: "九幽深渊", boss: "九幽冥帝",
    monsters: ["九幽魔龙", "冥王", "骨皇", "幽冥鬼将", "黄泉魔蛇", "冥火妖", "无面鬼", "深渊巨口"] },
  { name: "雷劫之地", boss: "九天雷祖·心魔化身",
    monsters: ["雷灵", "劫雷兽", "心魔", "雷鹏", "紫电蛟", "天罚使者", "劫火灵", "雷霆巨人"] },
];

// 6 种药材、6 种矿石：名字和价格在 js/config/numbers.js 的 mats（序号 0~5，越往后越稀有）
DATA.herbs = Object.keys(CFG.mats.herb);
DATA.ores  = Object.keys(CFG.mats.ore);
DATA.PIN = ["一品", "二品", "三品", "四品", "五品", "六品", "七品", "八品", "九品"];
// 丹药、炉子、丹方分九阶
DATA.JIE = ["一阶", "二阶", "三阶", "四阶", "五阶", "六阶", "七阶", "八阶", "九阶"];
DATA.matKinds = { herb: "药材", ore: "矿石" };

/* ---------- 东西南北四域 ---------- */
DATA.regionDirs = ["东", "西", "南", "北"];
DATA.regionCount = 4;
DATA.region = (a, r) => CFG.monster.regions[a][r];          // 数值（numbers.js）
DATA.regionName = (a, r) => DATA.maps[a].name + "·" + DATA.regionDirs[r] + "域";
DATA.regionBoss = (a, r) => r === 3 ? DATA.maps[a].boss : DATA.regionDirs[r] + "域·" + DATA.maps[a].monsters[r * 2] + "王";

// 无事发生时的随机描述
DATA.exploreIdle = ["四下寂静，无事发生。", "山风拂过，草木沙沙。", "踏过一片乱石。", "远处传来几声兽吼。",
  "沿着小径继续前行。", "林间雾气渐浓。", "脚下泥泞难行。", "抬头望见一群飞鸟掠过。"];

// 以下数值来自 js/config/numbers.js
const _E = CFG.explore;
DATA.EXPLORE_STOP = _E.STOP;
DATA.EXPLORE_TIME = _E.TIME;
DATA.STONE_BASE = _E.STONE_BASE;
DATA.STONE_GROW = _E.STONE_GROW;
DATA.mapMult = a => 1 + (_E.MAP_MAX - 1) * a / (DATA.maps.length - 1); // 地图掉落倍率
// 材料出售价、宗门兑换贡献（numbers.js 的 mats）
DATA.matPrice = (kind, g) => CFG.mats[kind][DATA[kind === "herb" ? "herbs" : "ores"][g]][0];
DATA.matContrib = (kind, g) => CFG.mats[kind][DATA[kind === "herb" ? "herbs" : "ores"][g]][1];
