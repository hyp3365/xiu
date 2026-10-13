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
      const eff = K.id === "explore" ? `圆满后每步 -${U.num(g.perLv)} 秒` : `每层 ${fmt(K, g.perLv)}`;
      return `<div class="line"><div>${DATA.skillIco(g)}《${g.name}》<span class="tag">${x.star}星</span>${lv ? `<span class="tag">${lv}/${DATA.GONGFA_MAX}层</span>` : ""}
        <small>${K.label} · ${eff}${lv ? "" : ` · ${U.fmt(c.stone)} 灵石 + ${U.fmt(c.contrib)} 贡献`}</small></div>
        <button class="sm" onclick="G.learnMifa('${K.id}')" ${lv || s.stone < c.stone || s.contrib < c.contrib ? "disabled" : ""}>${lv ? "已学会" : "学习"}</button></div>`;
    }).join("") +
    `<p class="desc">同星级门派共用这套秘法。学会后在「功法 → 秘法」里修炼升层（每 5 秒消耗修为和灵石），离开门派也一直有效。</p></div>
    <div class="card"><h3>秘法总加成</h3><div class="stats">${DATA.mifaKinds.map(K => `<div><span>${K.label}</span>${fmt(K, tot[K.id])}</div>`).join("")}</div></div>`;
};
