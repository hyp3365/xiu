/* =====================================================================
 * 数据：装备 & 法宝
 * ---------------------------------------------------------------------
 * 装备有 境界(grade) 和 品质(q 0~5)。属性按境界成长，品质越高倍率越大。
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
DATA.equipNames = {
  helmet:  ["布帽", "青云冠", "玄铁盔", "紫金冠", "凤翅盔", "混元冠"],
  armor:   ["布衣", "青云袍", "玄龟甲", "紫霞衣", "金乌战甲", "混沌道衣"],
  weapon:  ["铁剑", "青锋剑", "赤霄剑", "玄冥刀", "斩仙剑", "诛仙剑"],
  legs:    ["布裤", "青云护腿", "玄铁腿甲", "紫霞护膝", "金乌腿甲", "混沌护腿"],
  boots:   ["草鞋", "踏云靴", "追风靴", "紫电靴", "凌霄靴", "缩地成寸靴"],
  pendant: ["木坠", "灵玉坠", "星辰坠", "凤鸣佩", "太虚佩", "鸿蒙坠"],
  ring:    ["铁戒", "灵玉戒", "星辰戒", "凤鸣戒", "太虚戒", "鸿蒙戒"],
  fabao:   ["铜镜", "聚宝盆", "乾坤袋", "镇魂钟", "昊天塔", "造化玉碟"],
};
// 名字在 config/names.js 的 equip（上面是原名，读档对照用）
DATA.NM_DEF.equip = JSON.parse(JSON.stringify(DATA.equipNames));
for (const k in DATA.equipNames) DATA.equipNames[k] = DATA.nmArr((CFG.names.equip || {})[k], DATA.equipNames[k]);
/* 各部位属性系数（× 玩家同境界基础属性 × 品质倍率）
 * atk/hp/def/mana：按基础属性倍数；crit/speed/hpPct：× (品质+1)
 * hit/dodge（命中、闪避，数值）：× (品质+1) × (境界+1) */
DATA.equipK = CFG.equip.K;             // 数值在 config/equip.js

// 背包
DATA.BAG_START = CFG.bag.START; // 储物格初始数量（config/items.js 的 bag.START）
