/* =====================================================================
 * 数据：炼器（装备、空间石）（v21）
 * ---------------------------------------------------------------------
 * 数值在 js/config/forge.js，这里是名字和计算。
 * 炼制的装备在背包里是 { t: "eq", e: { slot, g: 阶, name, q: 最好的颜色品质, attrs: [{ k, c, r, m }] } }
 *   attrs：k 属性、c 颜色(0 白 1 绿 2 紫 3 金)、r 随机系数、m 1 = 主属性 / 0 = 附加属性
 *   数值按 config 实时计算，改了 config 已有装备也会跟着变
 * 空间石在背包里是 { t: "ss", g: 阶, n: 数量 }
 * ===================================================================== */
const _FG = CFG.forge;

// 每阶每部位一种装备（一阶 ~ 十阶）
DATA.forgeNames = {
  helmet:  ["青铜盔", "玄铁盔", "赤炎冠", "寒玉冠", "紫金冠", "星辰冠", "太虚冠", "混元冠", "鸿蒙冠", "道源冠"],
  armor:   ["青铜甲", "玄铁甲", "赤炎袍", "寒玉衣", "紫金甲", "星辰战衣", "太虚道袍", "混元宝甲", "鸿蒙仙衣", "道源圣衣"],
  weapon:  ["青铜剑", "玄铁剑", "赤炎刀", "寒玉剑", "紫金锏", "星辰剑", "太虚剑", "混元戟", "鸿蒙剑", "道源剑"],
  legs:    ["青铜护腿", "玄铁护腿", "赤炎护膝", "寒玉腿甲", "紫金腿甲", "星辰护腿", "太虚护腿", "混元腿甲", "鸿蒙护腿", "道源护腿"],
  boots:   ["青铜靴", "玄铁靴", "赤炎靴", "寒玉靴", "紫金靴", "星辰靴", "太虚靴", "混元靴", "鸿蒙靴", "道源靴"],
  pendant: ["青铜坠", "玄铁坠", "赤炎佩", "寒玉佩", "紫金坠", "星辰佩", "太虚佩", "混元坠", "鸿蒙佩", "道源佩"],
};
DATA.forgeSlots = Object.keys(DATA.forgeNames);            // 能炼的部位
DATA.attrNames = { hp: "气血", atk: "攻击", def: "防御", mana: "法力", speed: "速度", hit: "命中", dodge: "闪避", crit: "暴击%" };
DATA.COLOR_Q = [0, 1, 3, 4];                                // 颜色 → 品质样式（白 绿 紫 金）

DATA.forgeEqName = (slot, g) => DATA.JIE[g] + "·" + DATA.forgeNames[slot][g];
DATA.forgeEqMats = g => DATA.parseMats(_FG.equip.mats[g]);
DATA.forgeEqTime = g => _FG.equip.time[g] * 60000;
DATA.stoneName = g => DATA.JIE[g] + "空间石";
DATA.stoneMats = g => DATA.parseMats(_FG.stone.mats[g]);
DATA.stoneTime = g => _FG.stone.time[g] * 60000;

// 一条属性的数值
DATA.attrVal = (a, g) => {
  const A = _FG.attr, col = A.colors[a.c] || A.colors[0];
  const grow = a.k === "crit" ? g + 1 : (A.GROW[g] || 1);
  return (A.base[a.k] || 0) * grow * col.mult * (a.r || 1) * (a.m ? 1 : A.AFFIX_MULT);
};
// 随机生成一件装备
DATA.rollForged = (slot, g) => {
  const A = _FG.attr, cw = A.colors.map(c => c.weight), rr = () => A.RAND_MIN + Math.random() * (A.RAND_MAX - A.RAND_MIN);
  const main = (A.main[slot] || []).slice(0, 2), attrs = main.map(k => ({ k, c: U.weighted(cw), r: rr(), m: 1 }));
  const pool = A.pool.filter(k => !main.includes(k)), n = Math.min(pool.length, U.weighted(A.AFFIX_COUNT) + 1);
  for (let i = 0; i < n; i++) { const j = Math.floor(Math.random() * pool.length); attrs.push({ k: pool.splice(j, 1)[0], c: U.weighted(cw), r: rr(), m: 0 }); }
  const best = Math.max(...attrs.map(a => a.c));
  return { slot, g, name: DATA.forgeNames[slot][g], q: DATA.COLOR_Q[best], attrs };
};
