/* =====================================================================
 * 模块：门派 · 悟道室 · 宗门秘法
 * ---------------------------------------------------------------------
 * 秘法 1 ~ 10 星，同星级门派共用一套（每星 9 部，见 config/wudao.js、data/gongfa.js 的 mifaKinds）。
 * 在本门悟道室首次学习（灵石 + 贡献），学会即第 1 层，之后在「功法」页修炼升层（修为 + 灵石）。
 * 学会的秘法离开门派也一直有效。
 * 存档：和功法放在一起 gongfa { "w3:mf:expSpeed": 层数 }
 * ===================================================================== */
G.module({
  id: "wudao",

  api: {
    // 旧版悟道室（每个门派 7 种百分比秘法）已取消
    fixMifaV2() { if (this.s.mifa) delete this.s.mifa; },
    // 全部已学秘法的效果合计 { mpBattle, mpIdle, hpBattle, hpIdle, spStudy, gfStudy, expSpeed, bodySpeed, explore }
    mifaBonus() {
      const out = Object.fromEntries(DATA.mifaKinds.map(k => [k.id, 0]));
      for (const id in this.s.gongfa) {
        if (!DATA.isMifa(id)) continue;
        const g = DATA.mifaInfo(id, this.s.gongfa[id]); if (g) out[g.mk.id] += g.value;
      }
      const LX = CFG.wudao.LIANXING || {};
      for (const K of DATA.mifaKinds) { const C = K.cfg && CFG.wudao[K.cfg]; if (C) out[K.id] = Math.round(Math.min(C.MAX === undefined ? Infinity : C.MAX, out[K.id] || 0) * 1e6) / 1e6; }   // 战斗秘法几率上限
      // 破军无视防御 %、金蝉伤害降低 %：按修满的星级相加
      const PJ = CFG.wudao.POJUN || {}, JC = CFG.wudao.JINCHAN || {}, full = k => { const r = []; for (let st = 1; st <= 10; st++) if ((this.s.gongfa[DATA.mifaId(st, k)] || 0) >= DATA.GONGFA_MAX) r.push(st); return r; };
      out.pojunIgn = Math.min(PJ.IGNORE_MAX === undefined ? 100 : PJ.IGNORE_MAX, full("pojun").reduce((t, st) => t + ((PJ.IGNORE || [])[st - 1] || 0), 0));
      const pctOf = (k, arr) => full(k).reduce((t, st) => t + ((arr || [])[st - 1] || 0), 0);
      out.expSpeedPct = pctOf("expSpeed", CFG.wudao.JUYUAN_PCT); out.bodySpeedPct = pctOf("bodySpeed", CFG.wudao.LIANTI_PCT);   // 聚元 / 炼体 圆满后额外 %
      const ZH = CFG.wudao.ZHENHUN || {}, zf = full("zhenhun"); out.zhenhunR = zf.length ? ((ZH.ROUNDS || [])[zf[zf.length - 1] - 1] || 3) : 0;
      out.jinchanCut = Math.max(JC.CUT_MIN || 0, (JC.CUT_START || 0) - full("jinchan").reduce((t, st) => t + ((JC.CUT_STEP || [])[st - 1] || 0), 0));
      return out;
    },
    learnMifa(kind) {
      const s = this.s, sect = this.sectInfo(); if (!sect) return;
      const id = DATA.mifaId(sect.star, kind), c = DATA.mifaLearnCost(sect.star);
      if (s.gongfa[id]) return;
      if (s.stone < c.stone) return this.log("灵石不足。", "sys");
      if (s.contrib < c.contrib) return this.log("门派贡献不足。", "sys");
      s.stone -= c.stone; s.contrib -= c.contrib; s.gongfa[id] = 1;
      this.log(`习得《${DATA.mifaInfo(id).name}》！之后在「功法 → 秘法」里修炼升层。`, "good");
      this.dirty(); this.after();
    },
  },
});

/* 门派 · 悟道室页面（sect.js 调用） */
G.sectWudaoView = function () {
  const s = this.s, x = this.sectInfo(), c = DATA.mifaLearnCost(x.star), tot = this.mifaBonus();
  const fmt = (K, v) => `${K.sign}${U.num(v)}${K.unit}`;
  return `<div class="card"><h3>${DATA.nmPick(CFG.names.sectHall, "wudao", "悟道室")} · ${x.star}星宗门秘法<small>灵石 ${U.fmt(s.stone)} · 贡献 ${U.fmt(s.contrib)}</small></h3>` +
    DATA.mifaKinds.map(K => {
      const id = DATA.mifaId(x.star, K.id), lv = s.gongfa[id] || 0, g = DATA.mifaInfo(id, Math.max(1, lv));
      const eff = K.id === "explore" ? `圆满后每步 -${U.num(g.perLv)} 秒` : K.id === "pojun" ? `圆满后 ${fmt(K, g.perLv)}，无视防御 ${U.num(((CFG.wudao.POJUN || {}).IGNORE || [])[x.star - 1] || 0)}%` : K.full ? `圆满后 ${fmt(K, g.perLv)}` : `每层 ${fmt(K, g.perLv)}`;
      const xp = ((CFG.wudao[K.id === "expSpeed" ? "JUYUAN_PCT" : K.id === "bodySpeed" ? "LIANTI_PCT" : ""] || [])[x.star - 1] || 0);   // 聚元 / 炼体 圆满额外 %
      const effTxt = xp ? `${eff}，圆满再 +${U.num(xp)}%` : eff;
      return `<div class="line"><div>${DATA.skillIco(g)}《${g.name}》<span class="tag">${x.star}星</span>${lv ? `<span class="tag">${lv}/${DATA.GONGFA_MAX}层</span>` : ""}
        <small>${K.label} · ${effTxt}${lv ? "" : ` · ${U.fmt(c.stone)} 灵石 + ${U.fmt(c.contrib)} 贡献`}</small></div>
        <button class="sm" onclick="G.learnMifa('${K.id}')" ${lv || s.stone < c.stone || s.contrib < c.contrib ? "disabled" : ""}>${lv ? "已学会" : "学习"}</button></div>`;
    }).join("") +
    `<p class="desc">同星级门派共用这套秘法。学会后在「功法 → 秘法」里修炼升层（每 5 秒消耗修为和灵石），离开门派也一直有效。</p></div>
    <div class="card"><h3>秘法总加成</h3><div class="stats">${DATA.mifaKinds.map(K => `<div><span>${K.label}</span>${fmt(K, tot[K.id])}</div>`).join("")}<div><span>破军无视防御</span>${U.num(tot.pojunIgn)}%</div><div><span>金蝉伤害降低</span>${tot.jinchan ? U.num(tot.jinchanCut) + "%" : "-"}</div></div></div>`;
};
