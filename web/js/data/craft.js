/* =====================================================================
 * 数据：丹方、炼丹炉/炼器炉、灵田（数值都在 js/config/ 下的数值文件 第八~十一部分）
 * ---------------------------------------------------------------------
 * 材料只有 药材 herb、矿石 ore（各 6 种），背包里按 名字 区分，g 是它在列表里的序号（0~5）。
 * 配方里直接写药材/矿石名字，这里把名字换成 { kind, g, n }。
 * 属性丹在背包里是 { t: "dan", type: "atk", g: 阶, n: 数量 }
 * 修炼速度丹（丹方 speed: true）炼出来是 { t: "pill", type: "juqi", g: 境界品质 }，一阶 = 练气期品质
 * 炉子 { t: "fu", kind: "dan"|"qi", g: 阶 }，图纸 { t: "bp", kind, g }，都在背包里点击使用/学习
 * ===================================================================== */
const _AL = CFG.alchemy, _FU = CFG.furnace, _GA = CFG.garden;

// 名字 → { kind, g }
DATA.matByName = {};
DATA.herbs.forEach((n, g) => DATA.matByName[n] = { kind: "herb", g });
DATA.ores.forEach((n, g) => DATA.matByName[n] = { kind: "ore", g });
DATA.matName = (kind, g) => (kind === "herb" ? DATA.herbs : DATA.ores)[g];
// 显示名：药材、矿石都不显示品阶
DATA.matFull = (kind, g) => DATA.matName(kind, g);
// [[名字, 数量], ...] → [{ kind, g, n }]，名字写错会在控制台报错
DATA.parseMats = list => list.map(([name, n]) => {
  const m = DATA.matByName[name];
  if (!m) { console.error("js/config/ 数值文件 里有不存在的材料名：" + name); return { kind: "herb", g: 0, n: 1e15 }; }
  return { kind: m.kind, g: m.g, n };
});

/* ---------- 丹方 / 属性丹 / 修炼速度丹 ---------- */
DATA.recipes = _AL.recipes;                                         // 全部丹方（含修炼速度丹）
DATA.dans = {};                                                      // 只含属性丹 { atk: {name, label, val[], ...} }
for (const t in _AL.recipes) if (!_AL.recipes[t].speed) DATA.dans[t] = _AL.recipes[t];
// v41：丹方分类（0 凡丹 1 仙丹 2 冥丹 3 魔丹 4 神丹）、学习需要的门派星级、加成的属性
DATA.danCat = type => (_AL.recipes[type] && _AL.recipes[type].cat) || 0;
DATA.danStar = (type, g) => ((_AL.CAT_STAR || [])[DATA.danCat(type)] || 1) + Math.floor(g / (_AL.STAR_TIERS || 1));
DATA.danStat = type => (_AL.recipes[type] && _AL.recipes[type].stat) || type;
// v42：仙冥魔神丹（cat ≥ 1）用炼丹仙炉、炼丹仙师；修炼丹的品质 = 阶 + REALM0
DATA.danFu = type => DATA.danCat(type) ? "xdan" : "dan";
DATA.danCraft = type => DATA.danCat(type) ? "xdan" : "dan";
DATA.pillGrade = (type, g) => g + ((_AL.recipes[type] && _AL.recipes[type].REALM0) || 0);
DATA.isSpeedRecipe = type => !!(_AL.recipes[type] && _AL.recipes[type].speed);
// 一阶破军丹；修炼速度丹显示为 一阶聚气丹（练气期）
// 上古丹名（不含阶）：上古 + 原名去掉「丹」+ 分类名（config/alchemy.js 的 SHANGGU）
DATA.sgDanBase = type => ((_AL.SHANGGU || {}).PREFIX || "上古") + _AL.recipes[type].name.replace(/丹$/, "") + (_AL.CATS[DATA.danCat(type)] || "丹");
DATA.danName = (type, g, sg) => DATA.JIE[g] + (sg ? DATA.sgDanBase(type) : _AL.recipes[type].name) + (DATA.isSpeedRecipe(type) ? `（${DATA.realmLabel(DATA.pillGrade(type, g))}）` : "");
// 丹方效果说明
DATA.recipeEffect = (type, g) => DATA.isSpeedRecipe(type) ? `修炼速度+${Math.round(DATA.pillPct(type, DATA.pillGrade(type, g)))}%` : `${_AL.recipes[type].label}+${U.num(_AL.recipes[type].val[g])}`;
DATA.danVal = (type, g) => _AL.recipes[type].val[g];
DATA.danLimit = (type, g) => _AL.recipes[type].limit[g];
DATA.danRecipe = (type, g) => DATA.parseMats(_AL.recipes[type].herbs[g]);
DATA.danTime = (type, g) => _AL.recipes[type].time[g] * 60000;     // 毫秒（未算炉子加成）
DATA.danLearnTime = (type, g) => _AL.recipes[type].learnTime[g] * 60000;
DATA.danLearnCost = (type, g) => _AL.recipes[type].learnCost[g];
DATA.danPrice = (type, g) => (_AL.recipes[type].price || [])[g] || 0;

/* ---------- 炼丹炉 / 炼器炉 ---------- */
DATA.furnaces = _FU;                                                // dan / qi
DATA.furnaceName = (kind, g) => DATA.JIE[g] + _FU[kind].name;
DATA.furnaceMats = (kind, g) => DATA.parseMats(_FU[kind].mats[g]);
DATA.furnaceTime = (kind, g) => _FU[kind].time[g] * 60000;
DATA.furnaceBonus = (kind, g) => g >= 0 ? _FU[kind].bonus[g] : 0;  // 缩短时间 %
DATA.furnaceKinds = { dan: "炼丹炉", qi: "炼器炉", xdan: "炼丹仙炉", xqi: "炼器仙炉" };
for (const k in DATA.furnaceKinds) if (_FU[k] && _FU[k].name) DATA.furnaceKinds[k] = _FU[k].name;   // 名字在 config/names.js 的 furnace
DATA.FURNACE_KINDS = Object.keys(DATA.furnaceKinds).filter(k => _FU[k]);
DATA.isDanFu = k => k === "dan" || k === "xdan";                                // 炼丹用的炉子
// v42：宗门宝库兑换第 g 阶图纸需要的门派星级
DATA.blueprintStar = (kind, g) => (_FU[kind].STAR || 1) + Math.floor(g / (_FU.STAR_TIERS || 1));
DATA.blueprintCost = (kind, g) => _FU[kind].blueprint[g];

/* ---------- 灵田 ---------- */
DATA.GARDEN_MAX = _GA.MAX;
DATA.fieldCost = i => Math.floor(_GA.OPEN_COST * Math.pow(_GA.OPEN_RATE, i)); // 第 i+1 块
DATA.herbGrow = g => _GA.herbs[DATA.herbs[g]] || { grow: 60, yield: [1, 1], ling: 0, seed: 100 };
DATA.growTime = g => DATA.herbGrow(g).grow * 60000;
DATA.seedCost = g => DATA.herbGrow(g).seed;
