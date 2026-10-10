/* =====================================================================
 * 数据：炼丹、炼丹炉/炼器炉、灵田（数值都在 js/config/numbers.js 第八~十一部分）
 * ---------------------------------------------------------------------
 * 材料都按「种类 kind + 品/阶 g（0~8）」区分：
 *   herb 药材（DATA.herbs[g]）  ore 矿石（DATA.ores[g]）
 *   core 内丹（g 阶内丹）        blood 灵血（g 阶灵血）
 * 属性丹在背包里是 { t: "dan", type: "atk", g: 阶, n: 数量 }
 * ===================================================================== */
const _AL = CFG.alchemy, _FU = CFG.furnace, _GA = CFG.garden, _TR = CFG.treasury;

// 材料名字（背包里存的 name）
DATA.matName = (kind, g) => kind === "herb" ? DATA.herbs[g] : kind === "ore" ? DATA.ores[g] : DATA.JIE[g] + DATA.matKinds[kind];
// 材料带品级的完整名字，如「三品赤血参」「二阶内丹」
DATA.matFull = (kind, g) => (kind === "herb" || kind === "ore" ? DATA.PIN[g] : "") + DATA.matName(kind, g);

/* ---------- 属性丹 ---------- */
DATA.dans = _AL.pills;                                              // { atk: {name, label, val, rate, limit, sub} }
DATA.danName = (type, g) => DATA.JIE[g] + _AL.pills[type].name;      // 一阶破军丹
DATA.danVal = (type, g) => _AL.pills[type].val * Math.pow(_AL.pills[type].rate, g); // 每枚增加的属性
DATA.danLimit = type => _AL.pills[type].limit;                       // 每阶服用上限
// 配方：主药同品 + 两味辅药
DATA.danRecipe = (type, g) => [
  { kind: "herb", g, n: _AL.MAIN_N },
  ..._AL.pills[type].sub.map(k => ({ kind: "herb", g: (g + k) % 9, n: _AL.SUB_N })),
];
DATA.danStone = g => Math.floor(_AL.STONE * Math.pow(_AL.STONE_RATE, g));
DATA.danTime = g => _AL.TIME[g] * 60000;                             // 毫秒（未算炉子加成）
DATA.danPrice = (type, g) => Math.floor(DATA.danStone(g) * 2);      // 出售价

/* ---------- 炼丹炉 / 炼器炉 ---------- */
DATA.furnaces = _FU;                                                 // dan / qi
DATA.furnaceName = (kind, g) => DATA.JIE[g] + _FU[kind].name;
DATA.furnaceMats = (kind, g) => Object.entries(_FU[kind].mats).map(([k, n]) => ({ kind: k, g, n }));
DATA.furnaceStone = g => Math.floor(_FU.STONE * Math.pow(_FU.STONE_RATE, g));
DATA.furnaceTime = g => _FU.TIME[g] * 60000;
DATA.furnaceBonus = g => g >= 0 ? _FU.BONUS[g] : 0;                  // 缩短时间 %
DATA.blueprintCost = g => _FU.BLUEPRINT_COST * (g + 1) * (g + 1);

/* ---------- 灵田 ---------- */
DATA.GARDEN_MAX = _GA.MAX;
DATA.fieldCost = i => Math.floor(_GA.OPEN_COST * Math.pow(_GA.OPEN_RATE, i)); // 第 i+1 块
DATA.growTime = g => _GA.GROW[g] * 60000;
DATA.growYield = g => _GA.YIELD[g];
DATA.seedCost = g => _GA.SEED_COST * (g + 1) * (g + 1);

/* ---------- 宗门宝库：材料 ---------- */
DATA.matContrib = g => Math.ceil(_TR.MAT_COST * Math.pow(_TR.MAT_RATE, g));
