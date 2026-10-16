/* =====================================================================
 * 怪物属性生成（数值在 config/mobs.js）
 * 每个怪物 8 个数 [进入境界, 境界, 层, 功法星级, 功法来源, 学功法%, 功法层, 倍率]：
 *   怪物基础属性 = (修为突破属性 + 肉身突破属性 + 宗门功法属性) × 倍率
 *   遇到时 × 随机(RAND[0] ~ RAND[1])；暴击 = CRIT
 * 生成后写进：
 *   CFG.monster.regions[地图][区域][normal/elite/boss]、CFG.monster.MAP_REALM（凡界 + 仙魔冥神）
 *   CFG.mijing.list[i] / CFG.lingdi.list[i] 的 realm 和 normal/elite/boss
 *   天将 / 星君 / 界主、宗门考官用 DATA.mobTj / mobXj / mobJz / mobExam 现取
 * ===================================================================== */
DATA.MOB_KIND = { normal: "普通", elite: "精英", boss: "首领" };
DATA.MOB_KEYS = ["hp", "atk", "def", "speed", "hit", "dodge", "mana", "res"];
// 遇到时的随机倍率
// v180 RAND 每种属性单独：{ atk: [a, b], hp: [a, b], 其他: [a, b] }
DATA.mobRandOf = k => { const R = CFG.mobs.RAND; return R[k] || R["其他"]; };
DATA.mobRnd = k => { const R = DATA.mobRandOf(k); return R[0] + Math.random() * (R[1] - R[0]); };
// 肉身突破 n 次的合计加成（同 modules/body.js bodyBonus）
DATA.mobBody = n => { const o = {}; for (const k of DATA.MOB_KEYS) o[k] = DATA.bodyStat(n, k); return o; };
// v168 一行怪物数据统一成对象：8 个数 [进入境界, 境界, 层, 功法星级, 功法来源, 学功法%, 功法层, 倍率]
//   层、学功法%、功法层都可以写一个数，或 [最小, 最大]（每次遇到随机；层、功法层取整数，学功法% 可带小数）
DATA.MOB_NONE = [0, 0, 1, 0, 1, 100, 0, 1];   // 没写时：练气一层、不算功法
DATA.mobRange = v => Array.isArray(v) ? [v[0], v[v.length - 1]] : [v || 0, v || 0];
DATA.mobRow = t => {
  t = t || DATA.MOB_NONE;
  return { enter: t[0], realm: Math.max(0, Math.min(DATA.realms.length - 1, t[1])), lay: DATA.mobRange(t[2]), star: t[3] || 0, src: t[4] || 1,
    pct: DATA.mobRange(t[5]), gf: DATA.mobRange(t[6]), k: t[7] === undefined ? 1 : t[7] };
};
// 1 ~ 星级、来源里的全部功法，按种类分组：{ 种类id: [{ id, stat, stat2 }] }（缓存）
DATA._mobBooks = {};
DATA.mobBooks = (realm, star, src) => {
  const ms = star > 0 ? star : DATA.refStar(realm), key = ms + ":" + src;
  if (DATA._mobBooks[key]) return DATA._mobBooks[key];
  const o = {};
  for (const sc of DATA.refSrcList(src)) { if (sc.star > ms) continue;
    for (const t of DATA.gfTypesOf(sc.src)) for (const ti of DATA.tiers) { if (sc.src === "shop" && t.sectOnly) continue;
      (o[t.id] = o[t.id] || []).push({ id: DATA.gongfaId(sc.id, t.id, ti.id), stat: t.stat, stat2: t.stat2 }); } }
  return DATA._mobBooks[key] = o;
};
DATA._mobGfv = {};
DATA.mobGfVal = (id, lv) => { const k = id + ":" + lv; if (!(k in DATA._mobGfv)) { const g = lv > 0 ? DATA.gongfaInfo(id, lv) : null; DATA._mobGfv[k] = g ? [g.value || 0, g.value2 || 0] : [0, 0]; } return DATA._mobGfv[k]; };
const _mobRi = r => r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
// 算属性：rnd = true 每次遇到随机（层、学哪些功法、每本几层）；false = 显示用的平均值
DATA.mobCalc = (t, crit, rnd) => {
  const R = DATA.mobRow(t), lay = Math.max(1, Math.min(DATA.LAYERS, rnd ? _mobRi(R.lay) : Math.round((R.lay[0] + R.lay[1]) / 2)));
  const st = DATA.refStats(R.realm, lay, 0, R.star, R.src), bd = DATA.mobBody(R.realm * DATA.LAYERS + lay), add = {};
  for (const x of DATA.MOB_KEYS) add[x] = 0;
  if (R.gf[1] > 0) {
    const B = DATA.mobBooks(R.realm, R.star, R.src);
    for (const ty in B) {
      const list = B[ty], pct = rnd ? R.pct[0] + Math.random() * (R.pct[1] - R.pct[0]) : (R.pct[0] + R.pct[1]) / 2;
      if (rnd) {   // 每个种类各学 pct% 本（随机挑），每本随机练到 功法层 [最小, 最大]
        const pick = list.slice(), n = Math.min(list.length, Math.round(list.length * pct / 100));
        for (let i = 0; i < n; i++) { const b = pick.splice(Math.floor(Math.random() * pick.length), 1)[0], v = DATA.mobGfVal(b.id, _mobRi(R.gf));
          if (add[b.stat] !== undefined) add[b.stat] += v[0]; if (b.stat2 && add[b.stat2] !== undefined) add[b.stat2] += v[1]; }
      } else {     // 平均：全部功法 × pct%，层数取两头平均
        for (const b of list) { const v0 = DATA.mobGfVal(b.id, R.gf[0]), v1 = DATA.mobGfVal(b.id, R.gf[1]), f = pct / 100 / 2;
          if (add[b.stat] !== undefined) add[b.stat] += (v0[0] + v1[0]) * f; if (b.stat2 && add[b.stat2] !== undefined) add[b.stat2] += (v0[1] + v1[1]) * f; }
      }
    }
  }
  const o = {};
  for (const x of DATA.MOB_KEYS) o[x] = (st[x] + add[x] + bd[x]) * R.k;
  o.manaBr = st.manaBr;   // 修为突破的法力（法术 / 法宝耗法力用，不乘倍率）
  o.crit = crit || 0; o.layer = lay; o.L = R.realm * DATA.LAYERS + lay - 1;   // v171 总层序（保底伤害用）
  return o;
};
// 显示用（平均值）
DATA.mobStats = (t, crit) => DATA.mobCalc(t, crit, false);
// v168 每次遇到：层、学哪些功法、每本几层都随机
DATA.mobRoll = (t, crit) => DATA.mobCalc(t, crit, true);
// 按名字取，名字对不上时按顺序取（地图改了名也不会丢）
DATA.mobPick = (obj, name, i) => { if (!obj) return null; if (obj[name]) return obj[name]; const v = Object.values(obj); return v[i] || null; };
DATA.mobCrit = k => (CFG.mobs.CRIT || {})[k] || 0;
// 一组 {普通, 精英, 首领} → {normal, elite, boss}
DATA.mobGroup = g => { const o = { _t: {} }; for (const k in DATA.MOB_KIND) { const t = (g || {})[DATA.MOB_KIND[k]]; o[k] = DATA.mobStats(t, DATA.mobCrit(DATA.MOB_KIND[k])); o._t[k] = t; } return o; };
// v168 遇到怪物时按这一组的原始数据重新随机（没有原始数据就用算好的）
DATA.mobMeet = (grp, kind) => { const t = grp && grp._t && grp._t[kind]; return t ? DATA.mobRoll(t, DATA.mobCrit(DATA.MOB_KIND[kind])) : grp[kind]; };

// ---------- 凡界 + 仙魔冥神地图 ----------
(() => {
  const M = CFG.mobs;
  for (let a = 0; a < DATA.FAN_MAP_N; a++) {
    const c = DATA.mobPick(M.fan, DATA.maps[a].name, a) || {};
    CFG.monster.regions[a] = DATA.regionDirs.map((n, r) => Object.assign({ name: n, L: a * 10 + (M.FAN_L || [0, 3, 6, 9])[r] }, DATA.mobGroup(c[n])));
    CFG.monster.MAP_REALM[a] = ((c["东"] || {})["普通"] || [0])[0];
  }
  for (const w of ["xian", "ming", "mo", "shen"]) for (const a of DATA.worldMapIdx[w] || []) {
    const m = DATA.maps[a], c = DATA.mobPick(M[w], m.name, m.wi) || {}, R = CFG.monster.regions[a] || [];
    CFG.monster.regions[a] = DATA.regionDirs.map((n, r) => Object.assign({ name: n, L: (R[r] || {}).L || 0 }, DATA.mobGroup(c[n])));
    CFG.monster.MAP_REALM[a] = (c["界主"] || [0])[0];
    m.mob = c;   // 天将 / 星君 / 界主
  }
})();
DATA.mobTj = a => (DATA.maps[a].mob || {})["天将"] || DATA.MOB_NONE;
DATA.mobXj = (a, i) => { const l = (DATA.maps[a].mob || {})["星君"] || []; return l[i] || l[l.length - 1] || DATA.MOB_NONE; };
DATA.mobJz = a => (DATA.maps[a].mob || {})["界主"] || DATA.MOB_NONE;

// ---------- 秘境 / 灵地 ----------
(() => {
  for (const [C, key] of [[CFG.mijing, "mijing"], [CFG.lingdi, "lingdi"]]) {
    if (!C || !C.list) continue;
    C.list.forEach((d, i) => {
      const g = DATA.mobPick(CFG.mobs[key], d.name, i) || {};
      Object.assign(d, DATA.mobGroup(g));
      d.realm = (g["普通"] || [0])[0];
    });
  }
})();

// ---------- 试炼塔守关者（config/mobs.js 的 tower）：三个阶段，每段从「起」到「止」按层数渐变（属性按比例插值） ----------
DATA.towerStage = (star, floor, max) => {
  const T = CFG.mobs.tower; if (!T) return null;
  const st = DATA.mobPick(T, star + "星", star - 1); if (!Array.isArray(st) || !st.length) return null;
  const P = T.STAGE || [30, 30, 40], sum = P.reduce((a, b) => a + b, 0) || 1;
  let end = 0, i = 0, from = 0;
  for (; i < st.length; i++) { from = end; end = i === st.length - 1 ? max : Math.round(max * P.slice(0, i + 1).reduce((a, b) => a + b, 0) / sum); if (floor <= end) break; }
  i = Math.min(i, st.length - 1);
  const [a, b] = st[i], n = Math.max(1, end - from), t = Math.max(0, Math.min(1, i === 0 ? (n <= 1 ? 1 : (floor - 1) / (n - 1)) : (floor - from) / n));   // 后两段从上一段的「止」之后开始
  const crit = T.CRIT !== undefined ? T.CRIT : DATA.mobCrit("考官"), A = DATA.mobStats(a, crit), B = DATA.mobStats(b || a, crit), o = { crit };
  for (const k of [...DATA.REF_KEYS, "manaBr"]) o[k] = A[k] > 0 && B[k] > 0 ? A[k] * Math.pow(B[k] / A[k], t) : A[k] + (B[k] - A[k]) * t;
  return o;
};

// ---------- 宗门考官：star 星级（1~10），i 职务序号（1 = 内门弟子 …… 6 = 宗主） ----------
DATA.mobExam = (star, i) => { const g = DATA.mobPick(CFG.mobs.sect, star + "星", star - 1) || {}; return DATA.mobPick(g, DATA.ranks[i] && DATA.ranks[i].name, i - 1); };
