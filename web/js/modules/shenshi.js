/* =====================================================================
 * 模块：神识（数值在 config/shenshi.js）
 * ---------------------------------------------------------------------
 * 修炼页「神识」按钮进入。剩余神识 = lsMax（初始 + 用灵石买的）− 已学功法 / 秘法占用的（实时算，遗忘后归还）。
 * 功法页「遗忘」：删除攻击、防御、修炼速度、肉身修炼速度类功法。
 * 存档：lsMax 神识总数
 * ===================================================================== */
G.module({
  id: "shenshi",
  defaults: () => ({ lsMax: CFG.shenshi.INIT }),

  api: {
    lsCap() { const C = CFG.shenshi, B = C.BUY || []; return B.length ? Math.max(C.INIT, B[B.length - 1][1]) : C.INIT; },   // 神识上限
    // 这本功法 / 秘法占用多少神识（不占用 = 0）
    ssCost(id) {
      const C = CFG.shenshi, g = DATA.skillInfo(id, 1); if (!g || !g.star) return 0;
      const ok = g.kind === "mf" ? C.MIFA : g.kind === "gf" && (C.TYPES || []).includes(DATA.gfTypeKey(g.type.id));
      return ok ? ((C.STAR || [])[g.star - 1] || 0) : 0;
    },
    ssForgettable(id) { const g = DATA.skillInfo(id, 1); return !!g && g.kind === "gf" && (CFG.shenshi.TYPES || []).includes(DATA.gfTypeKey(g.type.id)); },
    lsUsed() {
      const s = this.s; let n = 0;
      for (const id in s.gongfa) n += this.ssCost(id);
      if (s.gfLearn && !s.gongfa[s.gfLearn.id]) n += this.ssCost(s.gfLearn.id);   // 正在学习的也算
      for (const x of (s.lq && s.lq.gf) || []) if (!s.gongfa[x.id]) n += this.ssCost(x.id);   // v173 排队的也算
      return n;
    },
    lsLeft() { return (this.s.lsMax || 0) - this.lsUsed(); },
    // 第 k 点神识要多少灵石（表里没有 = null，买不了）
    lsPrice(k) { for (const [a, b, p] of CFG.shenshi.BUY || []) if (k >= a && k <= b) return p; return null; },
    lsBuyCost(n) {
      let c = 0;
      for (let i = 1; i <= n; i++) { const p = this.lsPrice(this.s.lsMax + i); if (p === null) return null; c += p; }
      return c;
    },
    buyLingshi(n) {
      const s = this.s; n = Math.min(n, this.lsCap() - s.lsMax);
      if (n <= 0) return this.log("神识已达上限。", "sys");
      const c = this.lsBuyCost(n);
      if (c === null) return this.log("神识已达上限。", "sys");
      if (s.stone < c) return this.log(`灵石不足，需要 ${U.fmt(c)} 灵石。`, "sys");
      s.stone -= c; s.lsMax += n;
      this.log(`消耗灵石 ${U.fmt(c)}，神识 +${n}（共 ${s.lsMax}）。`, "good"); this.dirty(); this.after();
    },
    // 学习前检查：神识不够就提示，返回 false
    lsCheck(id) {
      const need = this.ssCost(id), left = this.lsLeft();
      if (need > 0 && left < need) { this.log(`神识不足（需要 ${need}，剩余 ${Math.max(0, left)}），可在「修炼 → 神识」用灵石增加，或在功法页遗忘功法。`, "bad"); return false; }
      return true;
    },
    // 遗忘：删除功法（层数、属性一起删），从修炼队列里去掉，神识归还
    forgetGongfa(id) {
      const s = this.s, g = DATA.skillInfo(id, s.gongfa[id]);
      if (!g || !s.gongfa[id] || !this.ssForgettable(id)) return;
      if (!confirm(`遗忘《${g.name}》？\n第 ${g.lv} 层和加的${g.label}全部删除，归还神识 ${this.ssCost(id)}。`)) return;
      delete s.gongfa[id];
      s.gfQueue = s.gfQueue.filter(x => x !== id);
      if (s.gfStudy && s.gfStudy.id === id) { s.gfStudy = null; this.nextStudy(); }
      this.log(`遗忘了《${g.name}》，归还神识 ${this.ssCost(id)}。`, "sys");
      this.dirty(); this.after();
    },
    openShenshi(on) { this.cultView = on ? "shenshi" : ""; this.render(); },
  },
});

/* 修炼 · 神识页面（cultivate.js 调用） */
G.shenshiView = function () {
  const s = this.s, cap = this.lsCap(), used = this.lsUsed(), left = s.lsMax - used, room = cap - s.lsMax;
  const btn = n => { n = Math.min(n, room); const c = n > 0 ? this.lsBuyCost(n) : null;
    return `<button ${c === null || s.stone < c ? "disabled" : ""} onclick="G.buyLingshi(${n})">增加 ${n > 0 ? n : ""} 点${c !== null ? `<small>${U.fmt(c)} 灵石</small>` : ""}</button>`; };
  const next = room > 0 ? this.lsPrice(s.lsMax + 1) : null;
  return `<div class="card"><h3>神识<small>灵石 ${U.fmt(s.stone)}</small></h3>
    <div class="stats"><div><span>剩余神识</span>${left < 0 ? `<b class="q5">${left}</b>` : left}</div><div><span>总神识</span>${s.lsMax} / ${cap}</div></div>
    <p class="desc" style="margin-top:6px">学会攻击、防御、修炼速度、肉身修炼速度类功法和宗门秘法会占用神识（1 星 1 点 … 10 星 10 点），神识不够不能学习；功法页「遗忘」可归还。已占用 ${used}。</p>
    <div class="row small" style="margin-top:6px"><span>下一点神识</span><span>${next === null ? "已达上限" : `${U.fmt(next)} 灵石`}</span></div>
    <div class="btns">${room > 0 ? btn(1) + (room > 1 ? btn(10) : "") : `<button disabled>神识已达上限</button>`}
      <button onclick="G.openShenshi(false)">返回修炼</button></div></div>`;
};

/* 功法页 · 遗忘（gongfa.js 调用） */
G.forgetView = function () {
  const s = this.s, list = Object.keys(s.gongfa).filter(id => this.ssForgettable(id)).map(id => DATA.skillInfo(id, s.gongfa[id])).filter(Boolean);
  const line = g => `<div class="line"><div>${DATA.skillIco(g)}《${g.name}》${g.star ? `<span class="tag">${g.star}星</span>` : ""}<span class="tag">${g.lv}/${g.max || DATA.GONGFA_MAX}层</span>
      <small>${g.label} +${this.gfValue(g, g.value)} · 占用神识 ${this.ssCost(g.id)}</small></div><button class="sm" onclick="G.forgetGongfa('${g.id}')">遗忘</button></div>`;
  // 和功法页一样按类别分卡片显示
  const cards = DATA.gongfaTypes.filter(t => !t.base).map(t => {
    const items = list.filter(g => (g.type.base || g.type.id) === t.id).sort((a, b) => b.star - a.star || b.lv - a.lv);
    return items.length ? `<div class="card"><h3>${t.name}<small>${t.label}</small></h3>${items.map(line).join("")}</div>` : "";
  }).join("");
  return `<div class="card"><h3>遗忘<small>剩余神识 ${this.lsLeft()} / ${s.lsMax}</small></h3>
    <p class="desc">攻击、防御、修炼速度、肉身修炼速度类功法可以遗忘。遗忘后功法删除，层数和加的属性一起删除，占用的神识归还。</p>
    ${list.length ? "" : `<p class="desc">没有可以遗忘的功法。</p>`}</div>${cards}`;
};
