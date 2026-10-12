/* =====================================================================
 * 模块：仙界官位 —— 天宫界主 / 星君殿星君 / 天将（单人，数值在 config/xingjun.js）
 * ---------------------------------------------------------------------
 * 界主、星君之位由 NPC 镇守；挑战获胜即就任（双方满血满法力，不影响自己当前气血法力）。
 * 天将直接就任。官位同时只能担任一个（s.office）。
 * 官位只奖励功德（s.gongde），每 HOUR 秒结算一次，离线也会补算。
 * ===================================================================== */
G.module({
  id: "xingjun",

  defaults: () => ({
    office: null,   // { t: "jz" 界主 / "xj" 星君 / "tj" 天将, map 地图序号, seat 星君位序号 }
    officeT: 0,     // 上次结算功德的时间
    gongde: 0,      // 功德
    xjCh: { day: "", n: 0 },   // 今天已挑战次数
  }),

  tick() { this.xjSettle(); },

  api: {
    // 结算功德（每 HOUR 秒一次）
    xjSettle() {
    const s = this.s, o = s.office, H = (CFG.xingjun.HOUR || 3600) * 1000;
    if (!o) return;
    if (!DATA.maps[o.map] || (o.t === "xj" && !this.xjSeats(o.map)[o.seat])) { s.office = null; return; }
    if (!s.officeT) s.officeT = this.now();
    const n = Math.floor((this.now() - s.officeT) / H);
    if (n <= 0) return;
    const g = this.xjRate(o) * n;
    s.gongde = (s.gongde || 0) + g; s.officeT += n * H;
    this.log(`${this.xjOffice()}俸禄：功德 +${U.fmt(g)}`, "gold");
    this.dirty();
    },
    xjSeats(a) { return (CFG.xingjun.SEATS || [])[DATA.maps[a].wi || 0] || []; },
    xjSeatName(a, i) { return this.xjSeats(a)[i] + "星君"; },
    xjDadi(a) { return DATA.maps[a].name.replace(/天$/, "") + "大帝"; },
    xjTgName(a) { return ((CFG.worldMaps.xian || {}).halls || {}).tg ? CFG.worldMaps.xian.halls.tg.replace("{map}", DATA.maps[a].name) : DATA.maps[a].name + "宫"; },
    xjChLeft() { const c = this.s.xjCh || {}; return Math.max(0, CFG.xingjun.TIMES - (c.day === this.bjDay() ? c.n : 0)); },
    // NPC：该地图北域首领 × 倍率
    xjNpc(a, name, k) {
      const R = DATA.region(a, 3).boss, M = DATA.mapMob(a);
      const v = key => R[key] * (M[key] === undefined ? 1 : M[key]) * k;
      return this.addMagic({ name, Lm: DATA.region(a, 3).L, kind: "boss", boss: true,
        hp: v("hp"), atk: v("atk"), def: v("def"), speed: v("speed"), hit: v("hit"), dodge: v("dodge"), crit: R.crit }, "boss", R);
    },
    xjOffice(o) {
      o = o || this.s.office; if (!o) return "无";
      const m = DATA.maps[o.map].name;
      return o.t === "jz" ? m + "界主" : o.t === "xj" ? m + this.xjSeatName(o.map, o.seat) : m + "天将";
    },
    // 每次结算的功德
    xjRate(o) {
      const C = CFG.xingjun, wi = DATA.maps[o.map].wi || 0, P = C.PAY || [];
      const k = o.t === "xj" ? (P[o.seat] !== undefined ? P[o.seat] : P[P.length - 1] || 1) : 1;
      return Math.floor((C.GD[o.t] || 0) * Math.pow(C.GD_GROW, wi) * k);
    },
    // 换官位：先把旧官位到现在的整小时结算掉，再从现在重新计时
    xjSetOffice(o) { this.xjSettle(); this.s.office = o; this.s.officeT = this.now(); },
    xjFight(a, m, title, onWin) {
      const s = this.s;
      if (!this.mapOpen(a) || this.xjChLeft() <= 0) return;
      const hp0 = s.hp, mp0 = s.mana, st = this.stats();
      s.hp = st.hp; s.mana = st.mana;   // 满血满法力挑战，结束后恢复原来的气血法力
      const res = this.battle(m);
      s.hp = hp0; s.mana = mp0;
      const c = s.xjCh && s.xjCh.day === this.bjDay() ? s.xjCh : (s.xjCh = { day: this.bjDay(), n: 0 });
      c.n++;
      const t = res.win ? `${res.rounds}回合获胜` : res.lose ? `第 ${res.rounds} 回合落败` : `缠斗 ${res.rounds} 回合，未分胜负`;
      this.xjLast = { title: `${title} · ${res.win ? "胜" : "未胜"}`, ev: [{ n: 1, t, c: res.win ? "gold" : "bad", b: res.detail }] };
      if (res.win) onWin(); else this.log(`${title}，${t}。`, "bad");
      this.after();
    },
    xjChallenge(a, i) {
      const o = this.s.office; if (o && o.t === "xj" && o.map === a && o.seat === i) return;
      const C = CFG.xingjun, K = C.NPC_MULT[i] !== undefined ? C.NPC_MULT[i] : C.NPC_MULT[C.NPC_MULT.length - 1];
      const name = this.xjSeatName(a, i), title = `挑战${DATA.maps[a].name}${name}`;
      this.xjFight(a, this.xjNpc(a, name, K), title, () => { this.xjSetOffice({ t: "xj", map: a, seat: i }); this.log(`${title}获胜，就任${this.xjOffice()}！`, "gold"); });
    },
    xjChallengeJz(a) {
      const o = this.s.office; if (o && o.t === "jz" && o.map === a) return;
      const name = this.xjDadi(a), title = `挑战${this.xjTgName(a)}${name}`;
      this.xjFight(a, this.xjNpc(a, name, CFG.xingjun.JZ_MULT), title, () => { this.xjSetOffice({ t: "jz", map: a }); this.log(`${title}获胜，就任${this.xjOffice()}！`, "gold"); });
    },
    xjTianjiang(a) {
      const T = CFG.xingjun.TJ_REALM, o = this.s.office;
      if (!this.mapOpen(a) || (T >= 0 && !this.realmOK(T)) || (o && o.t === "tj" && o.map === a)) return;
      this.xjSetOffice({ t: "tj", map: a });
      this.log(`就任${this.xjOffice()}。`, "gold");
      this.after();
    },
    xjResign() { if (!this.s.office) return; this.xjSetOffice(null); this.log("已辞去官位。", "sys"); this.after(); },
    xjShowLast() {
      const L = this.xjLast; if (!L || !L.ev[0].b) return;
      const keep = this.s.lastRun; this.s.lastRun = L; this.showBattle("last", 0); this.s.lastRun = keep;
    },

    // 官位信息 + 上次挑战结果（天宫、星君殿共用）
    xjHead(a) {
      const s = this.s, o = s.office, H = CFG.xingjun.HOUR || 3600, L = this.xjLast;
      const next = o ? Math.max(0, Math.ceil((s.officeT + H * 1000 - this.now()) / 1000)) : 0;
      return `<div class="row small"><span>官位 ${this.xjOffice()}</span><span>功德 ${U.fmt(s.gongde || 0)}</span></div>
        ${o ? `<div class="line"><div>俸禄<small>功德 ${U.fmt(this.xjRate(o))} / ${U.dur(H)} · ${U.dur(next)}后结算</small></div><button class="sm" onclick="G.xjResign()">辞官</button></div>` : ""}
        ${L ? `<p class="desc ${L.ev[0].c === "bad" ? "q5" : ""}">${L.title}：${L.ev[0].t}${L.ev[0].b ? ` <button class="sm" onclick="G.xjShowLast()">详情</button>` : ""}</p>` : ""}`;
    },
    // 天宫（界主）
    tgView(a) {
      const o = this.s.office, C = CFG.xingjun, mine = o && o.t === "jz" && o.map === a, left = this.xjChLeft();
      return `<div class="card"><h3>${this.xjTgName(a)}<small>今日挑战 ${left} / ${C.TIMES}</small></h3>${this.xjHead(a)}
        <div class="line"><div>界主<small>${mine ? "在任" : this.xjDadi(a)}</small></div>
          ${mine ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjChallengeJz(${a})" ${!this.mapOpen(a) || left <= 0 ? "disabled" : ""}>挑战</button>`}</div></div>`;
    },
    // 星君殿（星君 + 天将）
    xjView(a) {
      const s = this.s, C = CFG.xingjun, o = s.office, lockMap = !this.mapOpen(a), left = this.xjChLeft();
      const seats = this.xjSeats(a).map((n, i) => {
        const mine = o && o.t === "xj" && o.map === a && o.seat === i;
        return `<div class="line"><div>${this.xjSeatName(a, i)}<small>${mine ? "在任" : ""}</small></div>
          ${mine ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjChallenge(${a},${i})" ${lockMap || left <= 0 ? "disabled" : ""}>挑战</button>`}</div>`;
      }).join("");
      const tjOn = o && o.t === "tj" && o.map === a, T = C.TJ_REALM;
      return `<div class="card"><h3>星君殿<small>今日挑战 ${left} / ${C.TIMES}</small></h3>${this.xjHead(a)}
        ${seats}
        <div class="line"><div>天将<small>${tjOn ? "在任" : ""}</small></div>
          ${tjOn ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjTianjiang(${a})" ${lockMap || (T >= 0 && !this.realmOK(T)) ? "disabled" : ""}>就任</button>`}</div></div>`;
    },
  },
});
