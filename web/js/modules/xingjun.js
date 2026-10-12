/* =====================================================================
 * 模块：仙界星君殿（单人，数值在 config/xingjun.js）
 * ---------------------------------------------------------------------
 * 每张仙界地图 SEATS 个星君之位，由守殿星君（NPC）镇守；挑战获胜即就任。
 *   挑战时双方满血满法力，不影响自己当前气血法力。
 * 天将：能进入该地图即可就任。官位同时只能担任一个（s.office）。
 * 俸禄：每天领一次（北京时间 0 点重置）：灵石 + 功德（s.gongde）。
 * ===================================================================== */
G.module({
  id: "xingjun",

  defaults: () => ({
    office: null,   // { t: "xj" 星君 / "tj" 天将, map 地图序号, seat 星君位序号 }
    gongde: 0,      // 功德
    xjDay: "",      // 俸禄已领的北京日期
    xjCh: { day: "", n: 0 },   // 今天已挑战次数
  }),

  api: {
    xjSeatName(i) { return CFG.xingjun.SEATS[i] + "星君"; },
    xjChLeft() { const c = this.s.xjCh || {}; return Math.max(0, CFG.xingjun.TIMES - (c.day === this.bjDay() ? c.n : 0)); },
    // 守殿星君：该地图北域首领 × NPC_MULT
    xjNpc(a, i) {
      const R = DATA.region(a, 3).boss, M = DATA.mapMob(a), k = CFG.xingjun.NPC_MULT[i] || 1;
      const v = key => R[key] * (M[key] === undefined ? 1 : M[key]) * k;
      return this.addMagic({ name: this.xjSeatName(i), Lm: DATA.region(a, 3).L, kind: "boss", boss: true,
        hp: v("hp"), atk: v("atk"), def: v("def"), speed: v("speed"), hit: v("hit"), dodge: v("dodge"), crit: R.crit }, "boss", R);
    },
    xjOffice() { const o = this.s.office; return o ? DATA.maps[o.map].name + (o.t === "xj" ? this.xjSeatName(o.seat) : "天将") : "无"; },

    xjChallenge(a, i) {
      const s = this.s, o = s.office;
      if (!this.mapOpen(a) || this.xjChLeft() <= 0) return;
      if (o && o.t === "xj" && o.map === a && o.seat === i) return;
      const m = this.xjNpc(a, i), hp0 = s.hp, mp0 = s.mana, st = this.stats();
      s.hp = st.hp; s.mana = st.mana;   // 满血满法力挑战，结束后恢复原来的气血法力
      const res = this.battle(m);
      s.hp = hp0; s.mana = mp0;
      const c = s.xjCh && s.xjCh.day === this.bjDay() ? s.xjCh : (s.xjCh = { day: this.bjDay(), n: 0 });
      c.n++;
      const title = `挑战${DATA.maps[a].name}${this.xjSeatName(i)}`;
      const t = res.win ? `${res.rounds}回合获胜` : res.lose ? `第 ${res.rounds} 回合落败` : `缠斗 ${res.rounds} 回合，未分胜负`;
      if (!s.explore) s.lastRun = { title: `${title} · ${res.win ? "胜" : "未胜"}`, ev: [{ n: 1, t, c: res.win ? "gold" : "bad", b: res.detail }], bad: !res.win };
      if (res.win) { s.office = { t: "xj", map: a, seat: i }; this.log(`${title}，${t}，就任${DATA.maps[a].name}${this.xjSeatName(i)}！`, "gold"); }
      else this.log(`${title}，${t}。`, "bad");
      this.after();
    },
    xjTianjiang(a) {
      const T = CFG.xingjun.TJ_REALM;
      if (!this.mapOpen(a) || (T >= 0 && !this.realmOK(T))) return;
      this.s.office = { t: "tj", map: a };
      this.log(`就任${DATA.maps[a].name}天将。`, "gold");
      this.after();
    },
    xjResign() { if (!this.s.office) return; this.s.office = null; this.log("已辞去官位。", "sys"); this.after(); },
    xjSalary(o) {
      const C = CFG.xingjun, S = C.SALARY[o.t], a = o.map, wi = DATA.maps[a].wi || 0, k = o.t === "xj" ? (C.PAY || [])[o.seat] || 1 : 1;
      return { stone: Math.floor(DATA.STONE_BASE * Math.pow(DATA.STONE_GROW, DATA.region(a, 3).L) * S.stone * k), gongde: Math.floor(S.gongde * Math.pow(C.GD_GROW, wi) * k) };
    },
    xjClaim() {
      const s = this.s, o = s.office;
      if (!o || s.xjDay === this.bjDay()) return;
      const g = this.xjSalary(o);
      s.stone += g.stone; s.gongde = (s.gongde || 0) + g.gongde; s.xjDay = this.bjDay();
      this.log(`领取${this.xjOffice()}俸禄：灵石 ${U.fmt(g.stone)}、功德 ${U.fmt(g.gongde)}`, "gold");
      this.after();
    },

    // 星君殿页面（world.js 地图殿堂按钮「星君殿」）
    xjView(a) {
      const s = this.s, C = CFG.xingjun, o = s.office, lockMap = !this.mapOpen(a), left = this.xjChLeft();
      const seats = C.SEATS.map((n, i) => {
        const mine = o && o.t === "xj" && o.map === a && o.seat === i;
        return `<div class="line"><div>${this.xjSeatName(i)}<small>${mine ? "在任" : ""}</small></div>
          ${mine ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjChallenge(${a},${i})" ${lockMap || left <= 0 ? "disabled" : ""}>挑战</button>`}</div>`;
      }).join("");
      const tjOn = o && o.t === "tj" && o.map === a, T = C.TJ_REALM;
      const g = o ? this.xjSalary(o) : null, got = s.xjDay === this.bjDay();
      return `<div class="card"><h3>${DATA.maps[a].name} · 星君殿<small>今日挑战 ${left} / ${C.TIMES}</small></h3>
        <div class="row small"><span>官位 ${this.xjOffice()}</span><span>功德 ${U.fmt(s.gongde || 0)}</span></div>
        ${o ? `<div class="line"><div>俸禄<small>灵石 ${U.fmt(g.stone)} · 功德 ${U.fmt(g.gongde)}</small></div><div>
          <button class="sm" onclick="G.xjClaim()" ${got ? "disabled" : ""}>${got ? "已领取" : "领取"}</button>
          <button class="sm" onclick="G.xjResign()">辞官</button></div></div>` : ""}
        ${seats}
        <div class="line"><div>天将<small>${tjOn ? "在任" : ""}</small></div>
          ${tjOn ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjTianjiang(${a})" ${lockMap || (T >= 0 && !this.realmOK(T)) ? "disabled" : ""}>就任</button>`}</div></div>`;
    },
  },
});
