/* =====================================================================
 * 数据：装备 & 法宝
 * ---------------------------------------------------------------------
 * 炼制装备 / 戒指 / 法宝见 data/forge.js；坊市品质戒指有 境界(g) 和 品质(q 0~5)（config/equip.js）。
 * 装备栏：头盔 护甲 武器 腿甲 靴 吊坠 + 6 个戒指
 * 法宝栏、法术栏：每个大境界开启 1 格，最多 12 格（练气 1 格、筑基 2 格……）
 * ===================================================================== */
// 物品部位（slot）：装备 + 法宝
DATA.slots = { helmet: "头盔", armor: "护甲", weapon: "武器", legs: "腿甲", boots: "靴", pendant: "吊坠", ring: "戒指", fabao: "法宝" };
for (const k in DATA.slots) DATA.slots[k] = DATA.nmPick(CFG.names.slot, k, DATA.slots[k]);   // 名字在 config/names.js 的 slot
// 装备栏位（ring0~ring5 都放戒指）
DATA.equipSlots = ["helmet", "armor", "weapon", "legs", "boots", "pendant", "ring0", "ring1", "ring2", "ring3", "ring4", "ring5"];
DATA.slotOf = key => key.startsWith("ring") ? "ring" : key; // 栏位 → 部位
DATA.SLOT_MAX = CFG.equip.SLOT_MAX;
DATA.SLOT_EVERY = CFG.equip.SLOT_EVERY || 1;   // 每隔几个大境界开 1 格
DATA.slotRealm = i => i * DATA.SLOT_EVERY;     // 第 i 格（0 起）开启的大境界 // 法宝栏、法术栏最多格数（config/equip.js）

DATA.quals = DATA.nmArr(CFG.names.quality, ["凡品", "灵品", "宝品", "玄品", "地品", "天品"]);
DATA.qualMult = CFG.equip.QUAL_MULT;   // 品质倍率（config/equip.js）
// 品质装备（坊市品质戒指，config/equip.js）的名字：每个品质一个
DATA.equipNames = {
  ring:    ["铁戒", "灵玉戒", "星辰戒", "凤鸣戒", "太虚戒", "鸿蒙戒"],
};
// 名字在 config/names.js 的 equip（上面是原名，读档对照用）
DATA.NM_DEF.equip = JSON.parse(JSON.stringify(DATA.equipNames));
for (const k in DATA.equipNames) DATA.equipNames[k] = DATA.nmArr((CFG.names.equip || {})[k], DATA.equipNames[k]);
DATA.equipK = CFG.equip.K;             // 数值在 config/equip.js

// 背包
DATA.BAG_START = CFG.bag.START; // 储物格初始数量（config/items.js 的 bag.START）
