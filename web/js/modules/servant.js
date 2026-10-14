/* =====================================================================
 * 模块：洞府 · 道童居（数值在 config/servant.js）
 * 存档：
 *   servants   [{ uid, star 资质, el 五行, lv 等级, job 是否在做差事 }]
 *   svPick     选拔中 { end } | 选拔完成待处理 { star, el } | null
 * ===================================================================== */
G.module({
  id: "servant",
  defaults: () => ({ servants: [], svPick: null }),
  tick() {
    const p = this.s.svPick;
    if (p && p.end && this.now() >= p.end) {
      const C = CFG.servant, els = Object.keys(C.EL);
      this.s.svPick = { star: U.weighted(C.STAR_W) + 1, el: U.pick(els) };
      this.log(`道童选拔结束：选出${this.svName(this.s.svPick)}。`, "good"); this.dirty();
    }
  },
  api: {
    svName(d) { return `${d.star}星·${CFG.servant.EL[d.el] || d.el}灵根道童`; },
    svUpCost(d) { const C = CFG.servant; return Math.floor(C.UP_BASE * Math.pow(C.UP_RATE, d.lv - 1) * (C.STAR_COST[d.star - 1] || 1)); },
    // 某五行差事的效果 %（只算正在做差事的道童）
    servantPct(el) { const J = CFG.servant.JOB[el]; if (!J) return 0; const d = (this.s.servants || []).find(x => x.job && x.el === el); return d ? d.lv * J.PER : 0; },
    svStartPick() {
      const s = this.s, C = CFG.servant;
      if (s.svPick) return;
      if (s.stone < C.PICK_COST) return this.log("灵石不足。", "sys");
      s.stone -= C.PICK_COST; s.svPick = { end: this.now() + C.PICK_SEC * 1000 };
      this.log("开始选拔道童。", "good"); this.after();
    },
    svAccept(keep) {
      const s = this.s, p = s.svPick; if (!p || p.end) return;
      if (keep) {
        if (s.servants.length >= CFG.servant.MAX) return this.log("道童已满。", "sys");
        s.servants.push({ uid: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), star: p.star, el: p.el, lv: 1, job: false });
        this.log(`收下${this.svName(p)}。`, "good");
      }
      s.svPick = null; this.after();
    },
    svUp(i) {
      const s = this.s, d = s.servants[i]; if (!d || d.lv >= CFG.servant.MAX_LV) return;
      const c = this.svUpCost(d); if (s.stone < c) return this.log("灵石不足。", "sys");
      s.stone -= c; d.lv++; this.after(); this.openSv(i);
    },
    svJob(i) {
      const s = this.s, d = s.servants[i]; if (!d || !CFG.servant.JOB[d.el]) return;
      if (!d.job) s.servants.forEach(x => { if (x.el === d.el) x.job = false; });
      d.job = !d.job; this.after(); this.openSv(i);
    },
    svFire(i) {
      if (!confirm("遣散这个道童？")) return;
      this.s.servants.splice(i, 1); this.closeModal(); this.after();
    },
    openSv(i) {
      const d = this.s.servants[i]; if (!d) return this.closeModal();
      const C = CFG.servant, J = C.JOB[d.el], max = d.lv >= C.MAX_LV, c = this.svUpCost(d);
      const eff = !J ? "暂无差事" : `${J.name}：${d.el === "shui" ? "修炼速度 +" : d.el === "mu" ? "灵药生长时间 −" : d.el === "huo" ? "炼丹时间 −" : "炼器时间 −"}${U.num(d.lv * J.PER)}%`;
      this.modal(`<h2>${this.svName(d)}</h2>
        <p>等级 ${d.lv} / ${C.MAX_LV}<br>${eff}${J ? `<br>${d.job ? "差事中" : "空闲"}` : ""}</p>
        <div class="btns">${J ? `<button class="${d.job ? "on" : ""}" onclick="G.svJob(${i})">${d.job ? "停止差事" : "派去" + J.name}</button>` : ""}
        <button class="primary" onclick="G.svUp(${i})" ${max || this.s.stone < c ? "disabled" : ""}>${max ? "已满级" : `升级（${U.fmt(c)} 灵石）`}</button>
        <button onclick="G.svFire(${i})">遣散</button><button onclick="G.closeModal()">关闭</button></div>`);
    },
  },
});

/* 洞府 · 道童居 */
G.caveViews.servant = function () {
  const s = this.s, C = CFG.servant, p = s.svPick, n = s.servants.length;
  const cells = s.servants.map((d, i) => `<div class="slot-eq sv-cell q${Math.min(5, Math.floor((d.star - 1) / 2))}" onclick="G.openSv(${i})"><b class="sv-el sv-${d.el}">${C.EL[d.el]}</b>${d.star}星道童<br><span class="g">${d.lv}级${d.job ? " · 差事中" : ""}</span></div>`).join("");
  const pick = !p ? `<button class="primary" onclick="G.svStartPick()" ${s.stone < C.PICK_COST || n >= C.MAX ? "disabled" : ""}>${n >= C.MAX ? "道童已满" : `选拔道童（${U.fmt(C.PICK_COST)} 灵石）`}</button>`
    : p.end ? `<button disabled>选拔中 ${U.dur(Math.max(0, (p.end - this.now()) / 1000))}</button>`
    : `<button class="primary" onclick="G.svAccept(true)" ${n >= C.MAX ? "disabled" : ""}>收下${this.svName(p)}</button><button onclick="G.svAccept(false)">遣散</button>`;
  return `<div class="card"><h3>${DATA.caveName("servant")}<small>道童 ${n} / ${C.MAX}</small></h3>
    ${n ? `<div class="equip four">${cells}</div>` : ""}
    <div class="btns">${pick}</div></div>`;
};
