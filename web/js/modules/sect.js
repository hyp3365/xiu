/* =====================================================================
 * 模块：门派（1~9 星，每星 10 个）
 * ---------------------------------------------------------------------
 * - 加入门派需达到对应境界；可以叛出后加入别的门派（贡献清零，功法保留）
 * - 宗门任务：每 60 秒一次，获得贡献和灵石
 * - 练功房：修炼时每次扣贡献，增加修炼速度（随星级提高）
 * - 藏经阁：本门 6 类功法 × 5 重，用贡献学习
 * ===================================================================== */
G.module({
  id: "sect",
  tab: "sect",

  defaults: () => ({ sect: null, contrib: 0, room: -1, taskAt: 0 }),

  api: {
    sectInfo() { return DATA.sectById[this.s.sect]; },
    roomPct(i) { return DATA.rooms[i].pct * this.sectInfo().star; },
    roomCost(i) { return DATA.rooms[i].cost * this.sectInfo().star; },

    joinSect(id) {
      const x = DATA.sectById[id];
      if (this.r() < x.reqRealm) return;
      this.s.sect = id; this.s.contrib = 0; this.s.room = -1;
      this.log(`你拜入${x.name}（${x.star}星）。`, "gold"); this.after();
    },
    leaveSect() {
      if (!confirm("叛出门派将清空贡献（已学功法保留），确定？")) return;
      this.log(`你离开了${this.sectInfo().name}。`, "bad");
      this.s.sect = null; this.s.room = -1; this.s.contrib = 0; this.after();
    },
    doTask() {
      const now = Date.now(); if (now < this.s.taskAt) return;
      const x = this.sectInfo();
      const c = x.taskContrib, st = Math.floor(DATA.STONE_BASE * 2 * Math.pow(DATA.STONE_GROW, this.s.L) * x.star * (1 + Math.random()));
      this.s.contrib += c; this.s.stone += st; this.s.taskAt = now + DATA.TASK_CD * 1000;
      this.log(`完成宗门任务，贡献 +${c}，灵石 +${U.fmt(st)}。`, "good"); this.after();
    },
    enterRoom(i) { this.s.room = this.s.room === i ? -1 : i; this.after(); },

    learnGongfa(id) {
      const g = DATA.gongfaInfo(id);
      if (this.hasGongfa(id) || this.r() < g.reqRealm || this.s.contrib < g.cost) return;
      this.s.contrib -= g.cost; this.s.gongfa.push(id);
      // 这一类还没有主修，或新学的更强，就自动设为主修
      const cur = this.s.gfActive[g.type.id];
      if (!cur || DATA.gongfaInfo(cur).value < g.value) this.s.gfActive[g.type.id] = id;
      this.log(`习得《${g.name}》。`, "gold"); this.after();
    },
    setSectStar(n) { this.sectStar = n; this.render(); },
    setSectTab(t) { this.sectTab = t; this.render(); },
  },

  view() {
    const s = this.s;
    // 未加入门派：按星级浏览
    if (!s.sect) {
      const star = this.sectStar || 1;
      const stars = Array.from({ length: 9 }, (_, i) => `<button class="${star === i + 1 ? "active" : ""}" onclick="G.setSectStar(${i + 1})">${i + 1}★</button>`).join("");
      return `<div class="sub-tabs scroll">${stars}</div><div class="card"><h3>${star} 星门派<small>需${DATA.realms[(star - 1) * 2]}期</small></h3>` +
        DATA.sects.filter(x => x.star === star).map(x => {
          const lock = this.r() < x.reqRealm;
          return `<div class="line"><div>${x.name}<small>功法：${x.prefix}心法、${x.prefix}诀、${x.prefix}真经…</small></div>
            <button class="sm" onclick="G.joinSect('${x.id}')" ${lock ? "disabled" : ""}>${lock ? "境界不足" : "拜入"}</button></div>`;
        }).join("") + `</div>`;
    }
    const x = this.sectInfo(), cd = Math.max(0, Math.ceil((s.taskAt - Date.now()) / 1000)), tab = this.sectTab || "hall";
    let h = `<div class="card"><h3>${x.name} <span class="tag">${x.star}星</span><small>贡献 ${U.fmt(s.contrib)}</small></h3>
      <div class="btns"><button class="primary" onclick="G.doTask()" ${cd ? "disabled" : ""}>${cd ? `宗门任务（${cd}秒后）` : "领取宗门任务"}</button></div></div>
      <div class="sub-tabs"><button class="${tab === "hall" ? "active" : ""}" onclick="G.setSectTab('hall')">练功房</button>
      <button class="${tab === "lib" ? "active" : ""}" onclick="G.setSectTab('lib')">藏经阁</button></div>`;
    if (tab === "hall") {
      h += `<div class="card"><h3>练功房<small>修炼时每次消耗贡献</small></h3>` + DATA.rooms.map((r, i) => {
        const on = s.room === i;
        return `<div class="line"><div>${r.name}<span class="tag">+${this.roomPct(i)}%</span><small>每次修炼消耗 ${this.roomCost(i)} 贡献</small></div>
          <button class="sm ${on ? "on" : ""}" onclick="G.enterRoom(${i})">${on ? "使用中" : "进入"}</button></div>`;
      }).join("") + `</div><div class="btns"><button onclick="G.leaveSect()">叛出门派</button></div>`;
    } else {
      h += DATA.gongfaTypes.map(type => `<div class="card"><h3>${x.prefix}${type.suffix}<small>加成${type.label}</small></h3>` +
        Array.from({ length: DATA.GONGFA_TIERS }, (_, k) => {
          const g = DATA.gongfaInfo(DATA.gongfaId(x.id, type.id, k + 1)), has = this.hasGongfa(g.id), lock = this.r() < g.reqRealm;
          return `<div class="line"><div>${g.name}<small>${type.label} +${g.value}% · ${U.fmt(g.cost)} 贡献${lock ? " · 需" + DATA.realms[g.reqRealm] + "期" : ""}</small></div>
            <button class="sm" onclick="G.learnGongfa('${g.id}')" ${has || lock || s.contrib < g.cost ? "disabled" : ""}>${has ? "已学" : "学习"}</button></div>`;
        }).join("") + `</div>`).join("");
    }
    return h;
  },
});
