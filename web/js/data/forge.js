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

// v25：法宝名字（每阶一种，炼成时随机属性，显示如 一阶·火·铜镜）
DATA.forgeNames.fabao = ["铜镜", "铁印", "赤炎葫", "寒玉瓶", "紫金铃", "星辰盘", "太虚鼎", "混元珠", "鸿蒙钟", "道源塔"];
DATA.forgeSlots = Object.keys(DATA.forgeNames);            // 能炼的部位（含法宝）
DATA.eqSlots6 = DATA.forgeSlots.filter(x => x !== "fabao"); // 头盔 ~ 吊坠
// v25：戒指 9 种（主属性见 config/forge.js 的 forge.ring.main）
DATA.ringNames = ["破军戒", "磐石戒", "长生戒", "灵犀戒", "疾风戒", "鹰眼戒", "幻影戒", "烈阳戒", "玄武戒"];
DATA.ringName = (r, g) => DATA.JIE[g] + "·" + DATA.ringNames[r];
DATA.ringMats = g => DATA.parseMats(_FG.ring.mats[g]);
DATA.ringTime = g => _FG.ring.time[g] * 60000;
DATA.ringBpName = (g, r) => DATA.JIE[g] + (DATA.ringNames[r] || "戒指") + "图纸";   // v26：图纸分戒指种类（r）
// 法宝属性名（附加属性带一个属性 el）
DATA.fbAttrNames = { pct: "伤害", flat: "属性伤害", ignRes: "无视抗性", ignResPct: "无视抗性%", elDmg: "追加伤害", elDmgPct: "追加伤害%", manaCut: "法力消耗减少", manaCutPct: "法力消耗减少%" };
DATA.FB_PCT = ["pct", "ignResPct", "elDmgPct", "manaCutPct"];   // 百分比类

// 颜色 c 在第 g 阶的数值范围 [最小, 最大]（没设置 RANGE 时用旧算法 colors.mult × RAND）
DATA.colorRange = (c, g) => {
  const A = _FG.attr, R = A.RANGE && A.RANGE[c] && A.RANGE[c][g];
  if (R) return R;
  const m = (A.colors[c] || A.colors[0]).mult; return [m * A.RAND_MIN, m * A.RAND_MAX];
};
// 属性在范围里的位置 0~1（旧存档只有 r：随机系数 RAND_MIN~RAND_MAX）
DATA.attrPos = a => {
  if (a.p !== undefined) return a.p;
  const A = _FG.attr, r = a.r === undefined ? 1 : a.r;
  return Math.max(0, Math.min(1, (r - A.RAND_MIN) / ((A.RAND_MAX - A.RAND_MIN) || 1)));
};
DATA.rangeMult = (a, g) => { const [lo, hi] = DATA.colorRange(a.c, g); return lo + (hi - lo) * DATA.attrPos(a); };
// 一条属性的数值（e = 整件装备，用来区分法宝 / 戒指）
DATA.attrVal = (a, g, e) => {
  const A = _FG.attr, fb = e && e.slot === "fabao" && e.attrs;
  // v26：附加属性单独设置了「每阶金色最高值」（AFFIX_TOP）
  const TOP = !a.m && (fb ? _FG.fabao.AFFIX_TOP : A.AFFIX_TOP);
  if (TOP && TOP[a.k] && TOP[a.k][g] !== undefined) {
    const last = DATA.colorRange(A.colors.length - 1, g)[1] || 1;
    return TOP[a.k][g] * DATA.rangeMult(a, g) / last;
  }
  if (e && e.slot === "fabao" && e.attrs) {   // 法宝
    const F = _FG.fabao, grow = DATA.FB_PCT.includes(a.k) ? (F.PCT_GROW[g] || 1) : (F.GROW[g] || 1);
    return (F.base[a.k] || 0) * grow * DATA.rangeMult(a, g);
  }
  const grow = a.k === "crit" ? g + 1 : (A.GROW[g] || 1);
  return (A.base[a.k] || 0) * grow * DATA.rangeMult(a, g) * (a.m ? 1 : A.AFFIX_MULT) * (e && e.slot === "ring" ? (_FG.ring.MULT || 1) : 1);
};
DATA.bestQ = attrs => DATA.COLOR_Q[Math.max(...attrs.map(a => a.c))];
// 随机一条属性（颜色 + 位置）
DATA.rollAttr = (k, m, el) => { const a = { k, c: U.weighted(_FG.attr.colors.map(c => c.weight)), p: Math.random(), m }; if (el) a.el = el; return a; };
// 随机生成一件装备 / 戒指（r = 戒指种类）/ 法宝
DATA.rollForged = (slot, g, r) => {
  const A = _FG.attr;
  if (slot === "fabao") {
    const F = _FG.fabao, el = U.pick(DATA.elements).id;
    const attrs = [DATA.rollAttr("pct", 1), DATA.rollAttr("flat", 1)];
    const n = U.weighted(F.AFFIX_COUNT) + 1;
    for (let i = 0; i < n; i++) attrs.push(DATA.rollAttr(U.pick(F.pool), 0, U.pick(DATA.elements).id));
    return { slot, g, el, name: DATA.forgeNames.fabao[g], q: DATA.bestQ(attrs), attrs };
  }
  if (slot === "ring" && r === undefined) r = Math.floor(Math.random() * DATA.ringNames.length);
  const main = (slot === "ring" ? _FG.ring.main[r] : A.main[slot] || []).slice(0, 2), attrs = main.map(k => DATA.rollAttr(k, 1));
  const pool = A.pool.filter(k => !main.includes(k)), n = Math.min(pool.length, U.weighted(A.AFFIX_COUNT) + 1);
  for (let i = 0; i < n; i++) { const j = Math.floor(Math.random() * pool.length); attrs.push(DATA.rollAttr(pool.splice(j, 1)[0], 0)); }
  const e = { slot, g, name: slot === "ring" ? DATA.ringNames[r] : DATA.forgeNames[slot][g], q: DATA.bestQ(attrs), attrs };
  if (slot === "ring") e.r = r;
  return e;
};
// 升阶：颜色、位置都不变，只改阶和名字（数值按新阶自动变大）
DATA.upgradeForged = (prev, g) => {
  const e = JSON.parse(JSON.stringify(prev));
  e.attrs.forEach(a => { if (a.p === undefined) a.p = DATA.attrPos(a); delete a.r; });
  e.g = g;
  e.name = e.slot === "ring" ? DATA.ringNames[e.r] : DATA.forgeNames[e.slot][g];
  return e;
};
// 火髓重置：locks = 锁定的属性序号；没锁的重新随机
DATA.resetCost = (e, nLock) => Math.ceil((_FG.reset.FIRE[e.g] || 1) * Math.pow(_FG.reset.LOCK_MULT || 2, nLock));
DATA.rerollForged = (e, locks) => {
  const A = _FG.attr, fb = e.slot === "fabao";
  const used = e.attrs.filter((a, i) => locks.includes(i) || a.m).map(a => a.k);
  e.attrs.forEach((a, i) => {
    if (locks.includes(i)) return;
    if (a.m) { a.c = U.weighted(A.colors.map(c => c.weight)); a.p = Math.random(); delete a.r; return; }
    let k;
    if (fb) k = U.pick(_FG.fabao.pool);
    else { const pool = A.pool.filter(x => !used.includes(x)); k = pool.length ? U.pick(pool) : a.k; used.push(k); }
    Object.assign(a, DATA.rollAttr(k, 0, fb ? U.pick(DATA.elements).id : undefined)); delete a.r;
  });
  e.q = DATA.bestQ(e.attrs);
};
// 一条属性的文字
DATA.attrText = (a, e) => {
  const v = U.num(DATA.attrVal(a, e.g, e)), col = (_FG.attr.colors[a.c] || {}).name || "";
  if (e.slot === "fabao") {
    const el = DATA.elById[a.el || e.el] ? DATA.elById[a.el || e.el].name : "";
    const t = { pct: `伤害 攻击×${v}%`, flat: `${el}属性伤害 +${v}`, ignRes: `无视${el}抗性 ${v} 点`, ignResPct: `无视${el}抗性 ${v}%`,
      elDmg: `追加${el}属性伤害 +${v}`, elDmgPct: `追加${el}属性伤害 攻击×${v}%`, manaCut: `法力消耗 -${v}`, manaCutPct: `法力消耗 -${v}%` }[a.k] || a.k;
    const off = (a.k === "ignRes" || a.k === "ignResPct") && a.el !== e.el ? "（与法宝属性不同，不生效）" : "";
    return `${a.m ? "" : "附加 "}${t}（${col}）${off}`;
  }
  return `${a.m ? "" : "附加 "}${DATA.attrNames[a.k]} +${v}（${col}）`;
};
// 法宝战斗数值：{ el, pct, flat, mana, ign, ignPct, extra: [{ el, flat, pct }] }
DATA.fabaoInfo = e => {
  const F = _FG.fabao, o = { name: e.name, el: e.el, pct: 0, flat: 0, ign: 0, ignPct: 0, cut: 0, cutPct: 0, extra: [] };
  for (const a of e.attrs) {
    const v = DATA.attrVal(a, e.g, e);
    if (a.k === "pct") o.pct += v; else if (a.k === "flat") o.flat += v;
    else if (a.k === "ignRes" && a.el === e.el) o.ign += v;
    else if (a.k === "ignResPct" && a.el === e.el) o.ignPct += v;
    else if (a.k === "elDmg") o.extra.push({ el: a.el, flat: v, pct: 0 });
    else if (a.k === "elDmgPct") o.extra.push({ el: a.el, flat: 0, pct: v });
    else if (a.k === "manaCut") o.cut += v; else if (a.k === "manaCutPct") o.cutPct += v;
  }
  o.ignPct = Math.min(F.CAP.ignResPct || 100, o.ignPct); o.cutPct = Math.min(F.CAP.manaCutPct || 80, o.cutPct);
  o.mana = Math.max(0, (F.base.mana || 0) * (F.GROW[e.g] || 1) * (1 - o.cutPct / 100) - o.cut);
  return o;
};

// v26：药材、矿石图片（img/mats/herb0.png …… 按 config/items.js 里的顺序）
DATA.matImg = (kind, g) => `img/mats/${kind}${g}.png`;
