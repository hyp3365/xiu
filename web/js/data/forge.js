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

// 每阶每部位一种装备（一阶 ~ 十二阶）
DATA.forgeNames = {
  helmet:  ["青铜盔", "玄铁盔", "赤炎冠", "寒玉冠", "紫金冠", "星辰冠", "太虚冠", "混元冠", "鸿蒙冠", "道源冠", "太初冠", "无极冠"],
  armor:   ["青铜甲", "玄铁甲", "赤炎袍", "寒玉衣", "紫金甲", "星辰战衣", "太虚道袍", "混元宝甲", "鸿蒙仙衣", "道源圣衣", "太初神甲", "无极圣袍"],
  weapon:  ["青铜剑", "玄铁剑", "赤炎刀", "寒玉剑", "紫金锏", "星辰剑", "太虚剑", "混元戟", "鸿蒙剑", "道源剑", "太初剑", "无极剑"],
  legs:    ["青铜护腿", "玄铁护腿", "赤炎护膝", "寒玉腿甲", "紫金腿甲", "星辰护腿", "太虚护腿", "混元腿甲", "鸿蒙护腿", "道源护腿", "太初腿甲", "无极护腿"],
  boots:   ["青铜靴", "玄铁靴", "赤炎靴", "寒玉靴", "紫金靴", "星辰靴", "太虚靴", "混元靴", "鸿蒙靴", "道源靴", "太初靴", "无极靴"],
  pendant: ["青铜坠", "玄铁坠", "赤炎佩", "寒玉佩", "紫金坠", "星辰佩", "太虚佩", "混元坠", "鸿蒙佩", "道源佩", "太初佩", "无极佩"],
};
// 名字在 config/names.js 的 forge（上面是原名，读档对照用）
DATA.NM_DEF.forge = JSON.parse(JSON.stringify(DATA.forgeNames));
for (const k in DATA.forgeNames) DATA.forgeNames[k] = DATA.nmArr((CFG.names.forge || {})[k], DATA.forgeNames[k]);
DATA.forgeSlots = Object.keys(DATA.forgeNames);            // 能炼的部位
DATA.attrNames = { hp: "生命", atk: "攻击", def: "防御", mana: "法力", speed: "速度", hit: "命中", dodge: "闪避", crit: "暴击%" };
for (const k in DATA.attrNames) DATA.attrNames[k] = DATA.nmPick(CFG.names.attr, k, DATA.attrNames[k]);
DATA.COLOR_Q = [0, 1, 3, 4];                                // 颜色 → 品质样式（白 绿 紫 金）

DATA.forgeEqName = (slot, g) => DATA.JIE[g] + "·" + DATA.forgeNames[slot][g];
DATA.forgeEqMats = g => DATA.parseMats(_FG.equip.mats[g]);
DATA.forgeEqTime = g => _FG.equip.time[g] * 60000;
DATA.stoneName = g => DATA.JIE[g] + DATA.SS;
DATA.stoneMats = g => DATA.parseMats(_FG.stone.mats[g]);
DATA.stoneTime = g => _FG.stone.time[g] * 60000;

// 法宝：7 种形状（config/forge.js 的 fabao.types：剑 刀 锤 环 盾 鼎 印），属性炼制时自己选，显示如 一阶·火·剑
//   法宝在存档里：ft = 形状序号、el = 属性、fv = 2（v57 新法宝；没有 fv 的是旧的 36 种，读档时转换）
DATA.fabaoTypes = _FG.fabao.types;
DATA.forgeNames.fabao = DATA.JIE.map(() => DATA.slots.fabao);        // 门派炼器室图谱名：一阶·法宝
DATA.elIdx = el => Math.max(0, DATA.elements.findIndex(x => x.id === el));   // 属性序号（金木水火土雷 = 0~5）
// 法宝名字（config/names.js 的 fabaoName[形状][阶]），没写就用形状名
DATA.fabaoName = (ft, g, def) => { const L = (CFG.names.fabaoName || {})[ft]; return (L && L[g]) || def || (DATA.fabaoTypes[ft] || {}).name || "法宝"; };
// 秘境专用材料（config/mijing.js 的 items）：背包里 { t: "sm", k, ft, n }，k = kj 空间晶核 / lu 养神灵露 / ys 耀石（ft = 属性序号 0~5）
//   ft = -1 表示「任意一种耀石」（装备、戒指炼制和强化用；扣的时候先扣最多的那种）
DATA.SM_GRADED = ["ys"];
DATA.smName = (k, ft) => {
  const I = CFG.mijing.items;
  if (k === "ys") return ft >= 0 ? ((I.ys.names || [])[ft] || DATA.elements[ft].name + I.ys.name) : I.ys.name;
  return (I[k] || {}).name || k;
};
// 按名字找专用材料：「耀石」（每个随机一种属性）「火耀石」……
DATA.smByName = name => {
  const I = CFG.mijing.items;
  if (I.ys) { if (name === I.ys.name) return { k: "ys" }; const f = (I.ys.names || []).indexOf(name); if (f >= 0) return { k: "ys", ft: f }; }
  for (const k in I) if (k !== "ys" && I[k].name === name) return { k };
  return null;
};
DATA.smIcon = (k, ft) => k === "ys" ? DATA.iconImg("sm_ys" + Math.max(0, ft || 0)) : DATA.iconImg("sm_" + k);
// 掉落记账的键：k / k:ft
DATA.smKey = (k, ft) => k + (ft === undefined ? "" : ":" + ft);
DATA.smParse = key => { const [k, f] = key.split(":"); return { k, ft: f === undefined ? undefined : +f }; };
DATA.forgeSlots = Object.keys(DATA.forgeNames);            // 能炼的部位（含法宝）
DATA.eqSlots6 = DATA.forgeSlots.filter(x => x !== "fabao"); // 头盔 ~ 吊坠
// v25：戒指 9 种（主属性见 config/forge.js 的 forge.ring.main）
DATA.ringNames = ["破军戒", "磐石戒", "长生戒", "灵犀戒", "疾风戒", "鹰眼戒", "幻影戒", "烈阳戒", "玄武戒"];
DATA.NM_DEF.ring = DATA.ringNames.slice();                  // 原名（读档对照用）；名字在 config/names.js 的 ring
DATA.ringNames = DATA.nmArr(CFG.names.ring, DATA.ringNames);
DATA.ringName = (r, g) => DATA.JIE[g] + "·" + DATA.ringNames[r];
DATA.ringMats = g => DATA.parseMats(_FG.ring.mats[g]);
DATA.ringTime = g => _FG.ring.time[g] * 60000;
DATA.ringBpName = (g, r) => DATA.JIE[g] + (DATA.ringNames[r] || "戒指") + "图纸";   // v26：图纸分戒指种类（r）
// 法宝属性名（额外伤害 elDmg 带一个属性 el）
DATA.fbAttrNames = { pct: "伤害", elDmg: "额外伤害", ignRes: "无视抗性", manaCut: "法力消耗减少%",
  sAtk: "攻击", dSAtk: "攻击", sHit: "命中", sCrit: "暴击%", sCritDmg: "暴击伤害%", sMana: "本法宝法力消耗减少%", sDing: "降低属性", sYin: "眩晕几率%",
  shHpMain: "护盾值", shDef: "防御", shHp: "增加护盾值", dmgRed: "受到伤害减少%" };
for (const k in DATA.fbAttrNames) DATA.fbAttrNames[k] = DATA.nmPick(CFG.names.fbAttr, k, DATA.fbAttrNames[k]);
// v108 法宝一条属性的比例 %：按颜色在 [最小, 最大] 里，位置 p（0~1），保留一位小数
DATA.fbRange = k => { const F = _FG.fabao; return (F.MAIN || {})[k] || (F.AFFIX || {})[k] || (F.SPECIAL || {})[k]; };
DATA.fbPct = a => { const R = DATA.fbRange(a.k), r = R && (R[a.c] || R[R.length - 1]); return r ? Math.round((r[0] + (r[1] - r[0]) * (a.p || 0)) * 10) / 10 : 0; };
// 比例 × 哪个参考属性（不写 = 本身就是 %）
DATA.FB_REF_OF = { shHpMain: "hp", shHp: "hp", ignRes: "res", sAtk: "atk", dSAtk: "atk", sHit: "hit" };

// 颜色 c 在第 g 阶的数值范围 [最小, 最大]（没设置 RANGE 时用旧算法 colors.mult × RAND）
DATA.colorRange = (c, g) => {
  const A = _FG.attr, R = A.RANGE && A.RANGE[c] && A.RANGE[c][g];
  if (R) return R;
  const m = (A.colors[c] || A.colors[0]).mult; return [m * A.RAND_MIN, m * A.RAND_MAX];
};
// 属性在范围里的位置 0~1
DATA.attrPos = a => a.p || 0;
DATA.rangeMult = (a, g) => { const [lo, hi] = DATA.colorRange(a.c, g); return lo + (hi - lo) * DATA.attrPos(a); };
// v43 强化：每条属性 a.enh = 强化次数（config/forge.js 的 forge.enhance.equip / fabao）
DATA.enhCfg = e => CFG.forge.enhance[e && e.slot === "fabao" ? "fabao" : "equip"];
DATA.attrEnhOK = (a, e) => ((DATA.enhCfg(e).ADD || {})[a.k] || 0) > 0;
DATA.enhMult = (a, e, n) => 1 + (n === undefined ? a.enh || 0 : n) * ((DATA.enhCfg(e).ADD || {})[a.k] || 0) / 100;
// 一条属性的数值（e = 整件装备，用来区分法宝 / 戒指），含强化
DATA.attrVal = (a, g, e) => { return DATA.attrBase(a, g, e) * (a.enh ? DATA.enhMult(a, e) : 1); };
// 一条属性没强化时的数值
DATA.attrBase = (a, g, e) => {
  const A = _FG.attr, fb = e && e.slot === "fabao" && e.attrs;
  // v26：附加属性单独设置了「每阶金色最高值」（AFFIX_TOP，装备 / 戒指）
  const TOP = !a.m && !fb && A.AFFIX_TOP;
  if (TOP && TOP[a.k] && TOP[a.k][g] !== undefined) {
    const last = DATA.colorRange(A.colors.length - 1, g)[1] || 1;
    return TOP[a.k][g] * DATA.rangeMult(a, g) / last;
  }
  if (fb) {   // v108 法宝：比例 %（按颜色随机）；FB_REF_OF 里的 = 参考属性 × %，盾防御 = 参考防御 × ATK_MULT × %；鼎 = 回合数
    if (a.k === "sDing") return (_FG.fabao.DING_ROUNDS || [])[a.c] || 1;
    const v = DATA.fbPct(a), ref = DATA.fbRef(g);
    if (a.k === "shDef") return ref.def * (_FG.fabao.ATK_MULT || 1) * v / 100;
    return DATA.FB_REF_OF[a.k] ? ref[DATA.FB_REF_OF[a.k]] * v / 100 : v;
  }
  const grow = a.k === "crit" ? g + 1 : (A.GROW[g] || 1);
  return (A.base[a.k] || 0) * grow * DATA.rangeMult(a, g) * (a.m ? 1 : A.AFFIX_MULT) * (e && e.slot === "ring" ? (_FG.ring.MULT || 1) : 1);
};
DATA.bestQ = attrs => DATA.COLOR_Q[Math.max(...attrs.map(a => a.c))];
// 随机一条属性（颜色 + 位置）；w = 颜色权重（不填 = attr.colors 的 weight）
DATA.rollAttr = (k, m, el, w) => { const a = { k, c: U.weighted(w || _FG.attr.colors.map(c => c.weight)), p: Math.random(), m }; if (el) a.el = el; return a; };
// 法宝颜色权重：新得到的最高 NEW_COLOR_MAX（默认绿），洗练用 reset.WASH_WEIGHT
DATA.fabaoNewW = () => { const mx = _FG.fabao.NEW_COLOR_MAX === undefined ? 1 : _FG.fabao.NEW_COLOR_MAX; return _FG.attr.colors.map((c, i) => i <= mx ? c.weight : 0); };
DATA.fabaoWashW = () => _FG.reset.WASH_WEIGHT || _FG.attr.colors.map(c => c.weight);
// v53：新得到的装备 / 戒指颜色权重，最高 attr.NEW_COLOR_MAX（默认绿）；紫、金只能洗练
DATA.equipNewW = () => { const mx = _FG.attr.NEW_COLOR_MAX === undefined ? 1 : _FG.attr.NEW_COLOR_MAX; return _FG.attr.colors.map((c, i) => i <= mx ? c.weight : 0); };
// 法宝附加属性：只有额外伤害带属性（金木水火土雷随机）
DATA.fbAffix = (k, W) => DATA.rollAttr(k, 0, k === "elDmg" ? U.pick(DATA.elements).id : undefined, W);
// 随机生成一件装备 / 戒指（r = 戒指种类）/ 法宝
DATA.fbPool = T => T && T.shield ? _FG.fabao.SHIELD_POOL : _FG.fabao.pool;   // 法宝附加属性池（盾单独一组）
DATA.rollForged = (slot, g, r, el) => {
  const A = _FG.attr;
  if (slot === "fabao") {   // r = 形状序号、el = 属性（不填就随机）
    const F = _FG.fabao, ft = r === undefined ? Math.floor(Math.random() * DATA.fabaoTypes.length) : r, T = DATA.fabaoTypes[ft];
    const elv = el && DATA.elById[el] ? el : U.pick(DATA.elements).id;
    const W = DATA.fabaoNewW(), attrs = (T.shield ? ["shHpMain", "shDef"] : ["pct"]).map(k => DATA.rollAttr(k, 1, undefined, W));
    for (const k of T.special || []) attrs.push(DATA.rollAttr(k, 2, undefined, W));
    const n = U.weighted(F.AFFIX_COUNT) + 1, pool = DATA.fbPool(T);
    for (let i = 0; i < n; i++) attrs.push(DATA.fbAffix(U.pick(pool), W));
    return { slot, g, ft, el: elv, name: DATA.fabaoName(ft, g), enh: 0, q: DATA.bestQ(attrs), attrs, fv: 2 };
  }
  if (slot === "ring" && r === undefined) r = Math.floor(Math.random() * DATA.ringNames.length);
  const main = (slot === "ring" ? _FG.ring.main[r] : A.main[slot] || []).slice(0, 2), W = DATA.equipNewW(), attrs = main.map(k => DATA.rollAttr(k, 1, undefined, W));
  const pool = A.pool.filter(k => !main.includes(k)), n = Math.min(pool.length, U.weighted(A.AFFIX_COUNT) + 1);
  for (let i = 0; i < n; i++) { const j = Math.floor(Math.random() * pool.length); attrs.push(DATA.rollAttr(pool.splice(j, 1)[0], 0, undefined, W)); }
  const e = { slot, g, name: slot === "ring" ? DATA.ringNames[r] : DATA.forgeNames[slot][g], q: DATA.bestQ(attrs), attrs };
  if (slot === "ring") e.r = r;
  return e;
};
// 升阶：颜色、位置都不变，只改阶和名字（数值按新阶自动变大）
DATA.upgradeForged = (prev, g) => {
  const e = JSON.parse(JSON.stringify(prev));
  e.g = g;
  e.name = e.slot === "ring" ? DATA.ringNames[e.r] : e.slot === "fabao" ? DATA.fabaoName(e.ft, g) : DATA.forgeNames[e.slot][g];
  return e;
};
// 火髓洗练：locks = 锁定的属性序号；没锁的重新随机
DATA.resetCost = (e, nLock) => Math.ceil((_FG.reset.FIRE[e.g] || 1) * Math.pow(_FG.reset.LOCK_MULT || 2, nLock));
// v44：没锁的附加属性重新随机条数 —— 锁定的附加属性 + 新随机的 ≤ reset.AFFIX_MAX（5），新随机的至少 1 条（锁满了就 0 条）
//   新条数在 [1, AFFIX_MAX − 锁定的附加属性] 里按 reset.COUNT_WEIGHT 随机；去掉的那几格强化次数按从高到低转给新属性
DATA.washRange = (e, locks) => {
  const R = _FG.reset, MX = R.AFFIX_MAX || 5, lockedAff = e.attrs.filter((a, i) => !a.m && locks.includes(i)).length;
  const hi = Math.max(0, MX - lockedAff); return [Math.min(1, hi), hi];
};
DATA.rerollForged = (e, locks) => {
  const A = _FG.attr, fb = e.slot === "fabao", W = fb ? DATA.fabaoWashW() : A.colors.map(c => c.weight);   // 法宝洗练颜色权重单独设置
  const used = e.attrs.filter((a, i) => locks.includes(i) || a.m).map(a => a.k);
  const [lo, hi] = DATA.washRange(e, locks), CW = _FG.reset.COUNT_WEIGHT || [1, 1, 1, 1, 1];
  let w = []; for (let c = lo; c <= hi; c++) w.push(CW[c - 1] || 0);
  if (!w.some(x => x > 0)) w = w.map(() => 1);
  const n = hi <= 0 ? 0 : lo + U.weighted(w);
  const enh = e.attrs.filter((a, i) => !a.m && !locks.includes(i)).map(a => a.enh || 0).sort((x, y) => y - x);
  const roll = () => {
    let k;
    if (fb) k = U.pick(DATA.fbPool(DATA.fabaoTypes[e.ft]));
    else { const pool = A.pool.filter(x => !used.includes(x)); if (!pool.length) return null; k = U.pick(pool); used.push(k); }
    const a = fb ? DATA.fbAffix(k, W) : DATA.rollAttr(k, 0, undefined, W); if (enh.length && enh[0]) a.enh = enh.shift(); else enh.shift(); return a;
  };
  let made = 0;
  const out = [];
  e.attrs.forEach((a, i) => {
    if (locks.includes(i)) return out.push(a);
    if (a.m) { a.c = U.weighted(W); a.p = Math.random(); return out.push(a); }
    if (made < n) { const x = roll(); if (x) { out.push(x); made++; } }   // 原来的位置换成新属性，多出来的格子去掉
  });
  while (made < n) { const x = roll(); if (!x) break; out.push(x); made++; }
  e.attrs = out;
  e.q = DATA.bestQ(e.attrs);
};
// 一条属性的文字
DATA.attrText = (a, e) => {
  const v = U.num(DATA.attrVal(a, e.g, e)), col = (_FG.attr.colors[a.c] || {}).name || "";
  if (e.slot === "fabao") {
    const el = DATA.elById[a.el] ? DATA.elById[a.el].name : "", p = Math.round(DATA.attrVal(a, e.g, e) * 10) / 10, F = _FG.fabao;   // % 类保留一位小数
    const t = { pct: `伤害 攻击×${p}%`, elDmg: `${el}属性伤害 ${p}%`, ignRes: `无视抗性 ${v}`, manaCut: `法力消耗 -${p}%`,
      sAtk: `法宝攻击时额外增加攻击 +${v}`, dSAtk: `法宝攻击时额外增加攻击 +${v}`, sHit: `法宝攻击时额外增加命中 +${v}`, sCrit: `法宝攻击时额外增加暴击 +${p}%`, sCritDmg: `暴击伤害 ${p}%`, sMana: `本法宝法力消耗 -${p}%`,
      sDing: `击中后降低对方属性 ${v} 回合`, sYin: `眩晕几率 ${p}%（${(F.YIN_ROUNDS || [])[a.c] || 1} 回合）`,
      shHpMain: `护盾值 ${v}`, shDef: `防御 ${v}`, shHp: `护盾值 +${v}`, dmgRed: `受到伤害 -${p}%` }[a.k] || DATA.fbAttrNames[a.k] || a.k;
    return `${a.m === 2 ? "专属 " : a.m ? "" : a.k === "elDmg" ? "附加伤害 " : "附加 "}${t}（${col}${a.enh ? `·强化${a.enh}` : ""}）`;
  }
  return `${a.m ? "" : "附加 "}${DATA.attrNames[a.k]} +${v}（${col}${a.enh ? `·强化${a.enh}` : ""}）`;
};
// v107 法宝第 g 阶的参考属性：config/forge.js 的 fabao.REF[阶] 那个境界的人物属性（修为突破 + 肉身突破，不算功法），含 manaBr
DATA._fbRef = {};
DATA.fbRef = g => DATA._fbRef[g] || (DATA._fbRef[g] = (() => { const r = (_FG.fabao.REF || [])[g] || [2 * g + 1, 10]; return DATA.mobStats([0, r[0], r[1], 0, 1, 0, 1]); })());
// 法宝攻击 = 自己修为 + 肉身攻击（不超过参考攻击）+ 功法攻击（own 不写 = 玩家自己的，见 data/gongfa.js 的 DATA.capAtk）
// 法宝战斗数值（atk 已含剑 / 刀的专属攻击；hit、critAdd = 刀 / 锤攻击时额外命中、暴击%）：{ el, atk, pct, mana, ign, cutPct, extra: [{ el, pct }], crit（锤暴击伤害%）, shield, ding, yin }
DATA.fabaoInfo = (e, own) => {
  const F = _FG.fabao, T = DATA.fabaoTypes[e.ft] || {}, ref = DATA.fbRef(e.g);
  const o = { name: DATA.fabaoName(e.ft, e.g, e.name), el: e.el, ft: e.ft, atk: DATA.capAtk(ref.atk, own), pct: 0, ign: 0, cutPct: 0, extra: [] };
  let shHp = 0, shDef = 0, red = 0, ding = 0, yin = 0, yinC = 0;
  for (const a of e.attrs) {
    const v = DATA.attrVal(a, e.g, e);
    if (a.k === "pct") o.pct += v; else if (a.k === "ignRes") o.ign += v;
    else if (a.k === "elDmg") o.extra.push({ el: a.el, pct: v });
    else if (a.k === "manaCut" || a.k === "sMana") o.cutPct += v;
    else if (a.k === "sAtk" || a.k === "dSAtk") o.atk += v;   // 专属：只在这件法宝攻击时生效
    else if (a.k === "sHit") o.hit = (o.hit || 0) + v;
    else if (a.k === "sCrit") o.critAdd = (o.critAdd || 0) + v;
    else if (a.k === "sCritDmg") o.crit = (o.crit || 0) + v;
    else if (a.k === "shHpMain" || a.k === "shHp") shHp += v; else if (a.k === "shDef") shDef += v; else if (a.k === "dmgRed") red += v;
    else if (a.k === "sDing") ding = Math.max(ding, v);
    else if (a.k === "sYin") { yin += v; yinC = Math.max(yinC, a.c); }
  }
  const CAP = F.CAP || {}, at = (arr, d) => { const x = (arr || [])[e.g]; return x === undefined ? d : x; };
  o.pct *= (T.mul === undefined ? 1 : T.mul) * (F.DMG_MUL === undefined ? 1 : F.DMG_MUL);   // 形状倍率、DMG_MUL（不显示）
  if (T.shield) o.shield = { def: shDef, hp: shHp, red: Math.min(CAP.dmgRed === undefined ? 100 : CAP.dmgRed, red) };   // 盾
  if (T.ding) { const D = F.DING || {}; o.ding = { speed: at(D.SPEED, 0), hit: at(D.HIT, 0), dodge: at(D.DODGE, 0), rounds: ding || 1 }; }   // 鼎
  if (T.yin) o.yin = { chance: yin, rounds: (F.YIN_ROUNDS || [])[yinC] || 1 };   // 印
  o.cutPct = Math.min(CAP.manaCut === undefined ? 80 : CAP.manaCut, o.cutPct);
  // 人物大境界倍率（同法术）
  const R = typeof G !== "undefined" && G.s && !G.s.mortal ? Math.min(Math.floor(G.s.L / DATA.LAYERS), 23) : 0;
  const rv = a => { if (!a) return 1; const x = Array.isArray(a) ? a[R] : a[DATA.realms[R]]; return x === undefined ? 1 : x; };   // 按境界名取倍率
  o.pct *= rv(F.DMG_REALM);
  // 法力 = 该阶对应境界的修为突破法力 × MANA_PCT[主属性颜色]%；颜色只看第一条主属性
  const main = e.attrs.find(a => a.m === 1) || {};
  o.mana = Math.max(0, ref.manaBr * ((F.MANA_PCT || [])[main.c || 0] || 0) / 100 * (1 - o.cutPct / 100));
  return o;
};

/* ---------- 图片 ----------
 * 浏览器缓存 30 天（nginx 设置）；换了图片把 IMG_V 加 1，玩家就会重新下载
 *   img/mats/herb0.png ……  药材、矿石（按 config/items.js 里的顺序）
 *   img/icons/eq_部位.png  装备、戒指；fb_属性.png 法宝；gf_属性.png 功法；sp_属性.png 法术
 *   img/icons/pill_丹药id.png 修炼丹、dan_类型.png 属性丹、fu_dan / fu_qi.png 炉子、ss.png 空间石
 *   fbs形状_属性.png 法宝（7 种形状 × 6 种属性）、sm_ys属性.png 耀石、mifa.png 秘法、seed.png 种子、stone.png 灵石、cu_*.png 自定义物品
 *   hx.png 火髓、bp.png 图纸 */
DATA.IMG_V = 1;
DATA.matImg = (kind, g) => `img/mats/${kind}${g}.png?v=${DATA.IMG_V}`;
DATA.iconImg = n => `img/icons/${n}.png?v=${DATA.IMG_V}`;
DATA.ICON_EQ = ["helmet", "armor", "weapon", "legs", "boots", "pendant", "ring"];
// 自定义物品的图片：content/items.js 里写了 img（图片路径）就用它，没写按类型给一张
DATA.cuIcon = d => {
  if (!d) return DATA.iconImg("cu_misc");
  if (d.img) return d.img;
  if (d.type === "equip") return DATA.iconImg("eq_" + (DATA.ICON_EQ.includes(d.slot) ? d.slot : "weapon"));
  if (d.type === "fabao") return DATA.iconImg("fb_" + (Object.keys(d.res || {})[0] || "jin"));
  return DATA.iconImg({ use: "cu_use", perm: "dan_crit", box: "cu_box" }[d.type] || "cu_misc");
};
// 装备 / 法宝的图片
DATA.eqIcon = e => {
  if (!e) return "";
  if (e.cid) return DATA.cuIcon((window.ITEMS && ITEMS.list || {})[e.cid]);
  if (e.slot === "fabao") {   // 炼制法宝按种类；自定义 / 旧法宝按名字挑一个属性图
    if (e.ft !== undefined && e.fv === 2) return DATA.iconImg("fbs" + e.ft + "_" + DATA.elIdx(e.el));
    const el = e.el || DATA.elements[[...(e.name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 6].id;
    return DATA.iconImg("fb_" + el);
  }
  return DATA.ICON_EQ.includes(e.slot) ? DATA.iconImg("eq_" + e.slot) : "";
};
DATA.PILL_ICONS = ["juqi", "juling", "peiyuan", "taixu", "jiuxuan", "hongmeng"];
DATA.pillIcon = type => DATA.iconImg("pill_" + (DATA.PILL_ICONS.includes(type) ? type : DATA.PILL_ICONS[Math.max(0, Object.keys(DATA.pills).indexOf(type)) % 3]));
// 属性丹（修炼速度丹用修炼丹的图）、炉子
DATA.danIcon = type => DATA.isSpeedRecipe(type) ? DATA.pillIcon(type) : DATA.iconImg("dan_" + type);
DATA.furnaceIcon = kind => DATA.iconImg("fu_" + kind);
// 列表里的小图：DATA.li(图片地址)
DATA.li = src => src ? `<img class="li" src="${src}" alt="" loading="lazy">` : "";
// 功法 / 法术：按属性选图，按阶（黄玄地天）换边框；秘法统一一张卷轴
DATA.skillIcon = g => g.kind === "mf" || g.noEl ? DATA.iconImg("mifa") : DATA.iconImg((g.kind === "sp" ? "sp_" : "gf_") + g.el.id);
DATA.skillIco = g => `<span class="ico t-${g.tier.id}"><img src="${DATA.skillIcon(g)}" alt="" loading="lazy">${g.kind === "mf" ? `<b>${g.tier.name[0]}</b>` : ""}</span>`;   // v93：功法、法术不再显示阶
// 炼制物品（装备 / 戒指 / 法宝）的小图标：按阶换边框
// 炼制装备 / 法宝按阶（一阶~十阶）加外观：越高阶越亮、光晕越强，高阶有流光（css/style.css 的 .eqt0 ~ .eqt9）
DATA.eqCls = e => e && e.attrs ? ` eqt eqt${Math.max(0, Math.min(11, e.g || 0))}${e.slot === "fabao" && e.el ? ` fbel fb-${e.el}` : ""}` : "";   // 法宝按金木水火土雷显示颜色
DATA.fbElCls = e => e && e.slot === "fabao" && e.el ? ` fb-${e.el}` : "";
// 炼器室列表（宗门、洞府）用：按第 g 阶显示同样的外观
DATA.eqTierIco = (src, g) => `<span class="ico j${g} eqt eqt${Math.max(0, Math.min(11, g))}"><img src="${src}" alt="" loading="lazy"><b>${g + 1}</b></span>`;
