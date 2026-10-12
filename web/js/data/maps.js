/* =====================================================================
 * 数据：六界（open: false 表示暂未开放；仙冥魔神什么时候能进见 config/worldmaps.js 的 open）
 * ===================================================================== */
DATA.worlds = [
  { id: "fan",   name: "凡界",   open: true,  desc: "凡人与修士杂居之地。" },
  { id: "xian",  name: "仙界",   open: true , desc: "飞升之后的仙人居所。" },
  { id: "mo",    name: "魔界",   open: true , desc: "魔气滔天，弱肉强食。" },
  { id: "ming",  name: "冥界",   open: true , desc: "亡魂归处，轮回之所。" },
  { id: "shen",  name: "神界",   open: true , desc: "诸神所居，至高天域。" },
  { id: "tianwai",name:"天外天", open: false, desc: "三界之外，混沌无垠。" },
];

/* =====================================================================
 * 数据：凡界地图（9 张，对应 练气 → 渡劫）
 * ---------------------------------------------------------------------
 * monsters：普通怪物名字（随机遇到，精英怪 = "精英·" + 名字）；boss：北域首领名字
 * 每张地图分 东 西 南 北 四个区域（DATA.regionDirs），每个区域的怪物属性在 js/config/ 数值文件 的 monster.regions；
 *   东/西/南 三域首领名 = "X域·" + 普通怪名 + "王"，北域首领 = boss
 * 所有地图掉落的药材、矿石种类都一样（6 种药材、6 种矿石），只是数量不同：
 *   各地图掉落见 js/config/drops.js
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

// v45：仙界 / 冥界 / 魔界 / 神界各 10 张地图（config/worldmaps.js）接在凡界后面，序号 9 起
//   DATA.maps[a].w = 所在界；DATA.worldMapIdx[界] = 这一界的地图序号列表
DATA.FAN_MAP_N = DATA.maps.length;
DATA.maps.forEach(m => { m.w = "fan"; });
DATA.worldMapIdx = { fan: DATA.maps.map((m, a) => a) };
// v50：每界第 10 张起的地图排在所有界前 9 张之后（老存档的地图序号不变）
DATA.WORLD_MAP_OLD = 9;
for (const pass of [0, 1]) for (const w of ["xian", "ming", "mo", "shen"]) {
  const W = (CFG.worldMaps || {})[w]; if (!pass) DATA.worldMapIdx[w] = [];
  if (!W) continue;
  W.maps.forEach((m, i) => {
    if ((i < DATA.WORLD_MAP_OLD) === !!pass) return;
    const a = DATA.maps.length, D = CFG.worldDrops[w] || {}, K = CFG.worldDrop || {};
    DATA.maps.push({ name: m.name, boss: m.boss, monsters: m.monsters, w, wi: i });
    DATA.worldMapIdx[w].push(a);
    CFG.monster.regions[a] = W.regions[i];
    CFG.monster.mapMult[a] = m.mult || {};
    CFG.monster.MAP_REALM[a] = m.realm;
    const g = (items, ev) => ({ items, kinds: (K[ev] || {}).kinds || [1, 2], n: (K[ev] || {}).n || [1, 2] });
    CFG.mapDrops[a] = { stone: m.stone === undefined ? 1 : m.stone, mat: m.mat === undefined ? 1 : m.mat,
      herbEvent: [g(D.herb, "herbEvent")], oreEvent: [g(D.ore, "oreEvent")],
      monster: [g(D.herb, "monster"), g(D.ore, "monster")], elite: [g(D.herb, "elite"), g(D.ore, "elite")], boss: [g(D.herb, "boss"), g(D.ore, "boss")] };
  });
}

// 6 种药材、6 种矿石：名字和价格在 js/config/ 下的数值文件 的 mats（序号 0~5，越往后越稀有）
// v41：仙界 / 冥界 / 魔界 / 神界的药材、矿石（config/items.js 的 matsOther）接在凡界后面，序号 6 起
DATA.FAN_HERB_N = Object.keys(CFG.mats.herb).length;
DATA.FAN_ORE_N = Object.keys(CFG.mats.ore).length;
DATA.herbs = [...Object.keys(CFG.mats.herb), ...Object.keys((CFG.matsOther || {}).herb || {})];
DATA.ores  = [...Object.keys(CFG.mats.ore), ...Object.keys((CFG.matsOther || {}).ore || {})];
DATA.matCfg = (kind, name) => (CFG.mats[kind] || {})[name] || ((CFG.matsOther || {})[kind] || {})[name] || [0, 0];
DATA.PIN = ["一品", "二品", "三品", "四品", "五品", "六品", "七品", "八品", "九品"];
// 丹药、炉子、丹方分十阶（一星门派对应一阶 …… 十星对应十阶）
DATA.JIE = ["一阶", "二阶", "三阶", "四阶", "五阶", "六阶", "七阶", "八阶", "九阶", "十阶"];
DATA.matKinds = { herb: "药材", ore: "矿石" };

/* ---------- 东西南北四域 ---------- */
DATA.regionDirs = ["东", "西", "南", "北"];
DATA.regionCount = 4;
DATA.region = (a, r) => CFG.monster.regions[a][r];          // 数值（js/config/ 数值文件）
DATA.regionName = (a, r) => DATA.maps[a].name + "·" + DATA.regionDirs[r] + "域";
DATA.regionBoss = (a, r) => r === 3 ? DATA.maps[a].boss : DATA.regionDirs[r] + "域·" + DATA.maps[a].monsters[r * 2] + "王";

// 无事发生时的随机描述
DATA.exploreIdle = ["四下寂静，无事发生。", "山风拂过，草木沙沙。", "踏过一片乱石。", "远处传来几声兽吼。",
  "沿着小径继续前行。", "林间雾气渐浓。", "脚下泥泞难行。", "抬头望见一群飞鸟掠过。"];

// 以下数值来自 js/config/ 下的数值文件（explore.js 探索流程，drops.js 掉落）
const _E = CFG.explore;
DATA.EXPLORE_STOP = _E.STOP;
DATA.EXPLORE_TIME = _E.TIME;
DATA.STONE_BASE = CFG.drop.STONE_BASE;
DATA.STONE_GROW = CFG.drop.STONE_GROW;
DATA.mapDrop = (a, ev) => { const m = (CFG.mapDrops || [])[a]; return m && m[ev]; };  // 该地图的掉落组
DATA.mapStone = a => { const m = (CFG.mapDrops || [])[a]; return m && m.stone !== undefined ? m.stone : 1; };
DATA.mapMat = a => { const m = (CFG.mapDrops || [])[a]; return m && m.mat !== undefined ? m.mat : 1; };
DATA.mapReq = a => { const v = (CFG.monster.MAP_REALM || [])[a]; return v === undefined ? a : v; }; // 该地图需要的境界
DATA.mapMob = a => (CFG.monster.mapMult || [])[a] || {};   // 该地图怪物属性倍率
// 凡界地图会掉的全部药材、矿石名字（坊市只卖这些）
DATA.fanMats = () => {
  const set = new Set();
  for (const m of (CFG.mapDrops || []).slice(0, DATA.FAN_MAP_N)) for (const ev in m) if (Array.isArray(m[ev])) m[ev].forEach(gr => Object.keys(gr.items || {}).forEach(n => set.add(n)));
  return set;
};
// 材料出售价、宗门兑换贡献（js/config/ 数值文件 的 mats）
DATA.matPrice = (kind, g) => DATA.matCfg(kind, DATA[kind === "herb" ? "herbs" : "ores"][g])[0];
DATA.matContrib = (kind, g) => DATA.matCfg(kind, DATA[kind === "herb" ? "herbs" : "ores"][g])[1];
