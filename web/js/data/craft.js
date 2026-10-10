/* =====================================================================
 * 数据：丹方、炼丹炉/炼器炉、灵田（数值都在 js/config/numbers.js 第八~十一部分）
 * ---------------------------------------------------------------------
 * 材料只有 药材 herb、矿石 ore，背包里按 名字 区分，g 是它在列表里的序号（0~8）。
 * 配方里直接写药材/矿石名字，这里把名字换成 { kind, g, n }。
 * 属性丹在背包里是 { t: "dan", type: "atk", g: 阶, n: 数量 }
 * ===================================================================== */
const _AL = CFG.alchemy, _FU = CFG.furnace, _GA = CFG.garden;

// 名字 → { kind, g }
DATA.matByName = {};
DATA.herbs.forEach((n, g) => DATA.matByName[n] = { kind: "herb", g });
DATA.ores.forEach((n, g) => DATA.matByName[n] = { kind: "ore", g });
DATA.matName = (kind, g) => (kind === "herb" ? DATA.herbs : DATA.ores)[g];
// 显示名：药材不显示品阶；矿石显示「三品赤铜精」
DATA.matFull = (kind, g) => (kind === "ore" ? DATA.PIN[g] : "") + DATA.matName(kind, g);
// [[名字, 数量], ...] → [{ kind, g, n }]，名字写错会在控制台报错
DATA.parseMats = list => list.map(([name, n]) => {
  const m = DATA.matByName[name];
  if (!m) { console.error("numbers.js 里有不存在的材料名：" + name); return { kind: "herb", g: 0, n: 1e15 }; }
  return { kind: m.kind, g: m.g, n };
});

/* ---------- 丹方 / 属性丹 ---------- */
DATA.dans = _AL.recipes;                                            // { atk: {name, label, val[], ...} }
DATA.danName = (type, g) => DATA.JIE[g] + _AL.recipes[type].name;  // 一阶破军丹
DATA.danVal = (type, g) => _AL.recipes[type].val[g];
DATA.danLimit = (type, g) => _AL.recipes[type].limit[g];
DATA.danRecipe = (type, g) => DATA.parseMats(_AL.recipes[type].herbs[g]);
DATA.danTime = (type, g) => _AL.recipes[type].time[g] * 60000;     // 毫秒（未算炉子加成）
DATA.danLearnTime = (type, g) => _AL.recipes[type].learnTime[g] * 60000;
DATA.danLearnCost = (type, g) => _AL.recipes[type].learnCost[g];
DATA.danPrice = (type, g) => _AL.recipes[type].price[g];

/* ---------- 炼丹炉 / 炼器炉 ---------- */
DATA.furnaces = _FU;                                                // dan / qi
DATA.furnaceName = (kind, g) => DATA.JIE[g] + _FU[kind].name;
DATA.furnaceMats = (kind, g) => DATA.parseMats(_FU[kind].mats[g]);
DATA.furnaceTime = (kind, g) => _FU[kind].time[g] * 60000;
DATA.furnaceBonus = (kind, g) => g >= 0 ? _FU[kind].bonus[g] : 0;  // 缩短时间 %
DATA.blueprintCost = (kind, g) => _FU[kind].blueprint[g];

/* ---------- 灵田 ---------- */
DATA.GARDEN_MAX = _GA.MAX;
DATA.fieldCost = i => Math.floor(_GA.OPEN_COST * Math.pow(_GA.OPEN_RATE, i)); // 第 i+1 块
DATA.herbGrow = g => _GA.herbs[DATA.herbs[g]] || { grow: 60, yield: [1, 1], ling: 0, seed: 100 };
DATA.growTime = g => DATA.herbGrow(g).grow * 60000;
DATA.seedCost = g => DATA.herbGrow(g).seed;
