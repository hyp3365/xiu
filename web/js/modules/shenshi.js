/* =====================================================================
 * 模块：神识 · 灵识点（数值在 config/shenshi.js）
 * ---------------------------------------------------------------------
 * 修炼页「神识」按钮进入。灵识点 = lsMax（初始 + 用灵石买的）− lsUsed（学习功法 / 法术用掉的）。
 * 存档：lsMax 灵识点总数，lsUsed 已用
 * ===================================================================== */
G.module({
  id: "shenshi",
  defaults: () => ({ lsMax: CFG.shenshi.INIT, lsUsed: 0 }),

  api: {
    lsCap() { const C = CFG.shenshi, B = C.BUY || []; return B.length ? Math.max(C.INIT, B[B.length - 1][1]) : C.INIT; },   // 灵识点上限
    lsLeft() { return Math.max(0, (this.s.lsMax || 0) - (this.s.lsUsed || 0)); },
    // 第 k 点灵识要多少灵石（表里没有 = null，买不了）
    lsPrice(k) { for (const [a, b, p] of CFG.shenshi.BUY || []) if (k >= a && k <= b) return p; return null; },
    // 再买 n 点一共多少灵石（中间有买不了的 = null）
    lsBuyCost(n) {
      let c = 0;
      for (let i = 1; i <= n; i++) { const p = this.lsPrice(this.s.lsMax + i); if (p === null) return null; c += p; }
      return c;
    },
    buyLingshi(n) {
      const s = this.s; n = Math.min(n, this.lsCap() - s.lsMax);
      if (n <= 0) return this.log("灵识点已达上限。", "sys");
      const c = this.lsBuyCost(n);
      if (c === null) return this.log("灵识点已达上限。", "sys");
      if (s.stone < c) return this.log(`灵石不足，需要 ${U.fmt(c)} 灵石。`, "sys");
      s.stone -= c; s.lsMax += n;
      this.log(`消耗灵石 ${U.fmt(c)}，灵识点 +${n}（共 ${s.lsMax} 点）。`, "good"); this.dirty(); this.after();
    },
    // 学习功法 / 法术前检查：灵识点不够就提示，返回 false
    lsCheck() {
      const need = CFG.shenshi.LEARN_COST || 0, left = this.lsLeft();
      if (left < need) { this.log(`灵识点不足（学习需要 ${need} 点，剩余 ${left} 点），可在「修炼 → 神识」用灵石增加。`, "bad"); return false; }
      return true;
    },
    lsSpend() { this.s.lsUsed = (this.s.lsUsed || 0) + (CFG.shenshi.LEARN_COST || 0); },
    openShenshi(on) { this.cultView = on ? "shenshi" : ""; this.render(); },
  },
});

/* 修炼 · 神识页面（cultivate.js 调用） */
G.shenshiView = function () {
  const s = this.s, cap = this.lsCap(), left = this.lsLeft(), room = cap - s.lsMax, need = CFG.shenshi.LEARN_COST || 0;
  const btn = n => { n = Math.min(n, room); const c = n > 0 ? this.lsBuyCost(n) : null;
    return `<button ${c === null || s.stone < c ? "disabled" : ""} onclick="G.buyLingshi(${n})">增加 ${n > 0 ? n : ""} 点${c !== null ? `<small>${U.fmt(c)} 灵石</small>` : ""}</button>`; };
  const next = room > 0 ? this.lsPrice(s.lsMax + 1) : null;
  const table = (CFG.shenshi.BUY || []).map(([a, b, p]) => `<div class="row small"><span>第 ${a} ~ ${b} 点</span><span>每点 ${U.fmt(p)} 灵石</span></div>`).join("");
  return `<div class="card"><h3>神识<small>灵石 ${U.fmt(s.stone)}</small></h3>
    <div class="stats"><div><span>灵识点</span>${left}</div><div><span>总灵识</span>${s.lsMax} / ${cap}</div></div>
    <p class="desc" style="margin-top:6px">学习功法、法术每本消耗 ${need} 点灵识，灵识点不够不能学习。已用 ${s.lsUsed || 0} 点。</p>
    <div class="row small" style="margin-top:6px"><span>下一点灵识</span><span>${next === null ? "已达上限" : `${U.fmt(next)} 灵石`}</span></div>
    <div class="btns">${room > 0 ? btn(1) + (room > 1 ? btn(10) : "") : `<button disabled>灵识点已达上限</button>`}
      <button onclick="G.openShenshi(false)">返回修炼</button></div></div>
    ${table ? `<div class="card"><h3>增加灵识消耗</h3>${table}</div>` : ""}`;
};
