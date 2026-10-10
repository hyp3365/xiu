/* =====================================================================
 * 数据：洞府 · 聚灵阵
 * ---------------------------------------------------------------------
 * 聚灵阵的聚灵速度、修炼加成只由聚灵阵等级决定，与境界无关。
 * factor(lv)：聚灵阵倍率，0 级为 1（初始 0 级）
 *   - 每 10 秒聚集灵气 = gather(lv) = GATHER_BASE × (1 + 0.2×lv) × factor（开关不影响聚灵）
 *   - 修炼速度加成     = factor - 1，即 +(factor-1)×100%（只有开启时生效）
 *   - 1 灵石换灵气     = STONE_LING × factor
 * cost(lv)：从 lv 升到 lv+1 需要的灵石
 * ===================================================================== */
DATA.array = {
  MAX: 3000,
  GATHER_BASE: 10,
  STONE_LING: 10,
  factor: lv => Math.pow(1.03, lv),
  gather: lv => DATA.array.GATHER_BASE * (1 + 0.2 * lv) * Math.pow(1.03, lv), // 每级都明显增加
  cost: lv => Math.floor(100 * Math.pow(1.032, lv)),
};

// 灵气上限 = 聚灵 × CAP_GATHER + 修炼速度 × CAP_SPEED
DATA.LING_CAP_GATHER = 360;
DATA.LING_CAP_SPEED = 60;

/* 洞府各房间（open: false 表示暂未开放，只显示入口） */
DATA.caveRooms = [
  { id: "array",   name: "聚灵阵",   open: true,  desc: "聚集天地灵气，供修炼使用。" },
  { id: "alchemy", name: "炼丹房",   open: false, desc: "以灵药炼制丹药。" },
  { id: "forge",   name: "炼器室",   open: false, desc: "锻造法器、法宝。" },
  { id: "talisman",name: "画符室",   open: false, desc: "绘制各类符箓。" },
  { id: "garden",  name: "灵药园",   open: false, desc: "种植灵草灵药。" },
  { id: "beast",   name: "灵兽室",   open: false, desc: "豢养、培育灵兽。" },
  { id: "formation",name:"洞府阵法", open: false, desc: "布置护府大阵。" },
  { id: "servant", name: "道童居",   open: false, desc: "招募道童，代为打理洞府。" },
];
