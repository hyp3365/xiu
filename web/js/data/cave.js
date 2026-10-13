/* =====================================================================
 * 数据：洞府 · 聚灵阵
 * ---------------------------------------------------------------------
 * 聚灵阵的聚灵速度、修炼加成只由聚灵阵等级决定，与境界无关。
 * 每 STEP 级为一段，每段的每级效果、消耗单独设置（config/array.js）：
 *   - 每 10 秒聚集灵气 = GATHER_BASE + 已升各级的 GATHER 相加
 *   - 修炼速度加成%   = 已升各级的 SPEED 相加；factor = 1 + 加成% / 100
 *   - 1 灵石换灵气     = STONE_LING（固定）
 * cost(lv)：从 lv 升到 lv+1 需要的灵石 = 第 lv+1 级所在段的 COST
 * ===================================================================== */
// 数值在 js/config/ 下的数值文件 的 array 部分
const _A = CFG.array;
// 分段数值：第 lv 级（1 起）所在段的数值；超出数组用最后一段
DATA.segVal = (C, key, lv) => { const a = C[key] || [0], i = Math.floor((Math.max(1, lv) - 1) / (C.STEP || 15)); return a[Math.min(i, a.length - 1)] || 0; };
// 1 级到 lv 级每级数值相加（lv 超过 MAX 按 MAX 算）
DATA.segSum = (C, key, lv) => { let t = 0; lv = Math.min(lv, C.MAX); for (let l = 1; l <= lv; l++) t += DATA.segVal(C, key, l); return t; };
DATA.array = {
  MAX: _A.MAX,
  GATHER_BASE: _A.GATHER_BASE,
  STONE_LING: _A.STONE_LING,
  factor: lv => 1 + DATA.segSum(_A, "SPEED", lv) / 100,
  gather: lv => _A.GATHER_BASE + DATA.segSum(_A, "GATHER", lv),
  cost: lv => DATA.segVal(_A, "COST", lv + 1),
};
DATA.LING_CAP_GATHER = _A.CAP_GATHER;
DATA.LING_CAP_SPEED = _A.CAP_SPEED;

/* 洞府各房间（open: false 表示暂未开放，只显示入口） */
DATA.caveRooms = [
  { id: "array",   name: "聚灵阵",   open: true,  desc: "聚集天地灵气，供修炼使用。" },
  { id: "alchemy", name: "炼丹房",   open: true,  desc: "以灵药炼制丹药。" },
  { id: "forge",   name: "炼器室",   open: true,  desc: "锻造法器、法宝。" },
  { id: "talisman",name: "画符室",   open: false, desc: "绘制各类符箓。" },
  { id: "garden",  name: "灵药园",   open: true,  desc: "种植灵草灵药。" },
  { id: "beast",   name: "灵兽室",   open: false, desc: "豢养、培育灵兽。" },
  { id: "formation",name:"洞府阵法", open: false, desc: "布置护府大阵。" },
  { id: "servant", name: "道童居",   open: false, desc: "招募道童，代为打理洞府。" },
];
