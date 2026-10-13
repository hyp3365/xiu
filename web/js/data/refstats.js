/* =====================================================================
 * v51：怪物属性按「人物属性」生成
 * ---------------------------------------------------------------------
 * DATA.refStats(境界, 层, 功法层数) = 人物在该境界第几层（1~10）的属性（含升级成长）
 *   + 能学的全部宗门功法（1 星 …… 该境界能进的最高星，所有门派 × 所有类别 × 天地玄黄四阶）都练到「功法层数」
 *   不算丹药、肉身、灵根、装备；功法层数 0 = 不算功法
 * 用到的地方（倍率都在 config 里改）：
 *   凡界地图 config/monster.js 的 monster.FAN       秘境 config/mijing.js 的 mijing.REF
 *   试炼塔   config/sect.js 的 sect.tower           宗门考核 config/sect.js 的 sect.rankTrial
 *   雷劫     config/trib.js 的 trib
 * ===================================================================== */
DATA.REF_KEYS = ["hp", "atk", "def", "speed", "hit", "dodge"];
DATA._ref = {};
DATA.refStar = realm => (CFG.sect.REQ_REALM || []).filter(x => x <= realm).length;   // 该境界能进的最高星级
DATA.refStats = (realm, layer, gf) => {
  realm = Math.max(0, Math.min(DATA.realms.length - 1, realm)); layer = Math.max(1, Math.min(DATA.LAYERS, layer));
  const key = realm + ":" + layer + ":" + gf;
  if (DATA._ref[key]) return DATA._ref[key];
  const B = DATA.playerBase, f = Math.pow(DATA.GROW, realm * DATA.LAYERS + layer - 1), o = {};
  for (const k of DATA.REF_KEYS) o[k] = B[k] * f;
  if (gf > 0) {
    const ms = DATA.refStar(realm);
    for (const sc of DATA.sects) {
      if (sc.star > ms) continue;
      for (const t of DATA.gongfaTypes) for (const ti of DATA.tiers) {
        const g = DATA.gongfaInfo(DATA.gongfaId(sc.id, t.id, ti.id), gf);
        if (g && o[t.stat] !== undefined) o[t.stat] += g.value;
      }
    }
  }
  return DATA._ref[key] = o;
};
// 人物属性 × 倍率表 M（{ hp: 1.2, … }，不写 = 1）× 统一倍率 k；crit 用 M.crit
DATA.refMob = (st, M = {}, k = 1) => {
  const o = {};
  for (const x of DATA.REF_KEYS) o[x] = st[x] * (M[x] === undefined ? 1 : M[x]) * k;
  o.crit = M.crit === undefined ? 5 : M.crit;
  return o;
};

// ---------- 凡界 9 张地图 × 东西南北 ----------
(() => {
  const F = CFG.monster.FAN; if (!F) return;
  for (let a = 0; a < DATA.FAN_MAP_N; a++) {
    const R = DATA.mapReq(a);
    CFG.monster.regions[a] = DATA.regionDirs.map((n, r) => {
      const st = DATA.refStats(R, F.LAYER[r], F.GF[r]), o = { name: n, L: a * 10 + (F.L_STEP || [0, 3, 6, 9])[r] };
      for (const kind of ["normal", "elite", "boss"]) o[kind] = DATA.refMob(st, F.KIND[kind]);
      return o;
    });
  }
})();

// ---------- 秘境 ----------
(() => {
  const M = CFG.mijing, F = M && M.REF; if (!F) return;
  for (const d of M.list) {
    const st = DATA.refStats(d.realm, F.LAYER, F.GF);
    for (const kind of ["normal", "elite", "boss"]) d[kind] = DATA.refMob(st, (F.KIND || {})[kind], F.MULT);
  }
})();
