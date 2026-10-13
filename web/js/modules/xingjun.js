/* =====================================================================
 * 模块：四界官位 —— 界主 / 星君（各界殿君）/ 天将（单人，数值在 config/xingjun.js）
 * ---------------------------------------------------------------------
 * 界主、星君之位由 NPC 镇守；挑战时满血满法力，结束后恢复自己原来的气血法力。
 *   星君：单挑胜即就任；界主：一场连战，依次打完该图所有星君再打界主，全胜就任；天将直接就任。
 * 每界各能担任一个官位（s.offices[界]）。俸禄每 HOUR 秒结算：功德 s.merit（顶部显示的功德）、灵石、火髓。
 * ===================================================================== */
G.module({
  id: "xingjun",

  defaults: () => ({
    offices: {},                 // { xian: { t: "jz" 界主 / "xj" 星君 / "tj" 天将, map 地图序号, seat 星君位, T 上次结算时间 }, ming: …, mo: …, shen: … }
    xjCh: { day: "", n: {} },    // 今天各界已挑战次数
  }),

  tick() { this.xjSettle(); },

  api: {
    xjW(a) { return DATA.maps[a].w; },
    xjC(w) { return CFG.xingjun.worlds[w] || CFG.xingjun.worlds.xian; },
    xjTpl(t, a, seat) { const n = DATA.maps[a].name; return t.replace("{map}", n).replace("{short}", n.replace(/天$/, "") || n).replace("{seat}", seat || ""); },
    xjSeats(a) { const S = this.xjC(this.xjW(a)).SEATS || []; return (S.length === 1 ? S[0] : S[DATA.maps[a].wi || 0]) || []; },
    xjSeatName(a, i) { return this.xjTpl(this.xjC(this.xjW(a)).SEAT, a, this.xjSeats(a)[i]); },
    xjDadi(a) { return this.xjTpl(this.xjC(this.xjW(a)).JZ, a); },
    xjTjName(a) { return this.xjC(this.xjW(a)).TJ || "天将"; },
    xjHallName(a, id) { const H = ((CFG.worldMaps || {})[this.xjW(a)] || {}).halls || {}; return this.xjTpl(H[id] || "", a); },
    xjSeatMult(a, i) { const M = this.xjC(this.xjW(a)).NPC_MULT; return M[i] !== undefined ? M[i] : M[M.length - 1]; },
    xjChLeft(w) {
      const c = this.s.xjCh || {}, n = c.day === this.bjDay() && typeof c.n === "object" ? c.n[w] || 0 : 0;
      return Math.max(0, CFG.xingjun.TIMES - n);
    },
    xjChUse(w) {
      let c = this.s.xjCh;
      if (!c || c.day !== this.bjDay() || typeof c.n !== "object") c = this.s.xjCh = { day: this.bjDay(), n: {} };
      c.n[w] = (c.n[w] || 0) + 1;
    },
    xjOfficeOf(w) { return (this.s.offices || {})[w] || null; },
    xjOffice(o) {
      if (!o) return "无";
      const m = DATA.maps[o.map].name;
      return o.t === "jz" ? m + "界主" : o.t === "xj" ? m + this.xjSeatName(o.map, o.seat) : m + this.xjTjName(o.map);
    },
    // 每次结算的俸禄 { merit, stone, hx }
    xjRate(o) {
      const a = o.map, C = this.xjC(this.xjW(a)), P = (C.PAY || {})[o.t] || {}, G = C.GROW || {}, wi = DATA.maps[a].wi || 0, SP = C.SEAT_PAY || [];
      const k = o.t === "xj" ? (SP[o.seat] !== undefined ? SP[o.seat] : SP[SP.length - 1] || 1) : 1;
      const MP = ((C.MAP_PAY || [])[wi] || {})[o.t];   // v52：每张地图单独设置的俸禄
      if (MP) return { merit: Math.floor((MP.merit || 0) * k), stone: Math.floor((MP.stone || 0) * k), hx: Math.floor((MP.hx || 0) * k) };
      const gr = key => Math.pow(G[key] || 1, wi);
      const stoneBase = DATA.STONE_BASE * Math.pow(DATA.STONE_GROW, DATA.region(a, 3).L) * ((CFG.mapDrops[a] || {}).stone || 1);
      return { merit: Math.floor((P.merit || 0) * gr("merit") * k), stone: Math.floor((P.stone || 0) * stoneBase * k), hx: Math.floor((P.hx || 0) * gr("hx") * k) };
    },
    xjRateText(r) { return [r.merit ? `功德 ${U.fmt(r.merit)}` : "", r.stone ? `灵石 ${U.fmt(r.stone)}` : "", r.hx ? `${DATA.HX} ${U.fmt(r.hx)}` : ""].filter(x => x).join("、") || "无"; },
    xjValid(o) { return o && DATA.maps[o.map] && (o.t !== "xj" || this.xjSeats(o.map)[o.seat] !== undefined); },
    // 结算俸禄（每 HOUR 秒一次）；顺带把旧存档的 office / gongde 转过来
    xjSettle() {
      const s = this.s, H = (CFG.xingjun.HOUR || 3600) * 1000;
      if (!s.offices) s.offices = {};
      if (s.gongde) { s.merit = (s.merit || 0) + s.gongde; s.gongde = 0; }
      if (s.office) { const o = s.office; if (this.xjValid(o)) s.offices[this.xjW(o.map)] = { t: o.t, map: o.map, seat: o.seat, T: s.officeT || this.now() }; s.office = null; }
      for (const w in s.offices) {
        const o = s.offices[w]; if (!o) continue;
        if (!this.xjValid(o)) { delete s.offices[w]; continue; }
        if (!o.T) o.T = this.now();
        const n = Math.floor((this.now() - o.T) / H); if (n <= 0) continue;
        const r = this.xjRate(o);
        r.merit *= n; r.stone *= n; r.hx *= n; o.T += n * H;
        s.merit = (s.merit || 0) + r.merit; s.stone += r.stone;
        if (r.hx) this.addFire(r.hx);
        this.log(`${this.xjOffice(o)}俸禄：${this.xjRateText(r)}`, "gold");
        this.dirty();
      }
    },
    // 换官位（同一界）：先结算旧官位，再从现在重新计时
    xjSetOffice(w, o) { this.xjSettle(); if (o) { o.T = this.now(); this.s.offices[w] = o; } else delete this.s.offices[w]; },
    // NPC：该地图北域首领 × 倍率
    xjNpc(a, name, k) {
      const R = DATA.region(a, 3).boss, M = DATA.mapMob(a);
      const v = key => R[key] * (M[key] === undefined ? 1 : M[key]) * k;
      return this.addMagic({ name, Lm: DATA.region(a, 3).L, kind: "boss", boss: true,
        hp: v("hp"), atk: v("atk"), def: v("def"), speed: v("speed"), hit: v("hit"), dodge: v("dodge"), crit: R.crit }, "boss", R);
    },
    // 依次挑战 list（[{name, k}]），满血满法力开打，中间不回复；结束恢复原来的气血法力
    xjFight(a, list, title, onWin) {
      const s = this.s, w = this.xjW(a);
      if (!this.mapOpen(a) || this.xjChLeft(w) <= 0) return;
      const hp0 = s.hp, mp0 = s.mana, st = this.stats();
      s.hp = st.hp; s.mana = st.mana;
      const ev = []; let win = true;
      for (const x of list) {
        const res = this.battle(this.xjNpc(a, x.name, x.k));
        const t = res.win ? `${res.rounds}回合获胜` : res.lose ? `第 ${res.rounds} 回合落败` : `缠斗 ${res.rounds} 回合，未分胜负`;
        ev.push({ n: ev.length + 1, t: `${x.name}：${t}`, c: res.win ? "gold" : "bad", b: res.detail });
        if (!res.win) { win = false; break; }
      }
      s.hp = hp0; s.mana = mp0;
      this.xjChUse(w);
      this.xjLast = { title: `${title} · ${win ? "胜" : "未胜"}`, bad: !win, ev, map: a };
      if (win) onWin(); else this.log(`${title}，${ev[ev.length - 1].t}。`, "bad");
      this.after();
    },
    xjChallenge(a, i) {
      const w = this.xjW(a), o = this.xjOfficeOf(w); if (o && o.t === "xj" && o.map === a && o.seat === i) return;
      const name = this.xjSeatName(a, i), title = `挑战${DATA.maps[a].name}${name}`;
      this.xjFight(a, [{ name, k: this.xjSeatMult(a, i) }], title, () => { this.xjSetOffice(w, { t: "xj", map: a, seat: i }); this.log(`${title}获胜，就任${this.xjOffice(this.xjOfficeOf(w))}！`, "gold"); });
    },
    // 界主：连战全部星君（倍率从小到大），最后打界主
    xjChallengeJz(a) {
      const w = this.xjW(a), o = this.xjOfficeOf(w); if (o && o.t === "jz" && o.map === a) return;
      const list = this.xjSeats(a).map((n, i) => ({ name: this.xjSeatName(a, i), k: this.xjSeatMult(a, i) })).sort((x, y) => x.k - y.k);
      list.push({ name: this.xjDadi(a), k: this.xjC(w).JZ_MULT });
      const title = `挑战${this.xjHallName(a, "tg")}`;
      this.xjFight(a, list, title, () => { this.xjSetOffice(w, { t: "jz", map: a }); this.log(`${title}全胜，就任${this.xjOffice(this.xjOfficeOf(w))}！`, "gold"); });
    },
    xjTianjiang(a) {
      const w = this.xjW(a), T = this.xjC(w).TJ_REALM, o = this.xjOfficeOf(w);
      if (!this.mapOpen(a) || (T >= 0 && !this.realmOK(T)) || (o && o.t === "tj" && o.map === a)) return;
      this.xjSetOffice(w, { t: "tj", map: a });
      this.log(`就任${this.xjOffice(this.xjOfficeOf(w))}。`, "gold");
      this.after();
    },
    xjResign(w) { if (!this.xjOfficeOf(w)) return; const n = this.xjOffice(this.xjOfficeOf(w)); this.xjSetOffice(w, null); this.log(`已辞去${n}。`, "sys"); this.after(); },
    xjShowLast(i) {
      const L = this.xjLast; if (!L || !L.ev[i] || !L.ev[i].b) return;
      const keep = this.s.lastRun; this.s.lastRun = L; this.showBattle("last", i); this.s.lastRun = keep;
    },

    // 本界官位 + 俸禄 + 上次挑战结果（天宫、星君殿共用）
    xjHead(a) {
      const s = this.s, w = this.xjW(a), o = this.xjOfficeOf(w), H = CFG.xingjun.HOUR || 3600, L = this.xjLast && this.xjW(this.xjLast.map) === w ? this.xjLast : null;
      const next = o ? Math.max(0, Math.ceil((o.T + H * 1000 - this.now()) / 1000)) : 0;
      return `<div class="row small"><span>官位 ${this.xjOffice(o)}</span><span>功德 ${U.fmt(s.merit || 0)}</span></div>
        ${o ? `<div class="line"><div>俸禄<small>${this.xjRateText(this.xjRate(o))} / ${U.dur(H)} · ${U.dur(next)}后结算</small></div><button class="sm" onclick="G.xjResign('${w}')">辞官</button></div>` : ""}
        ${L ? `<p class="desc ${L.bad ? "q5" : ""}">${L.title}</p>${L.ev.map((e, i) => `<div class="row small"><span class="${e.c === "bad" ? "q5" : ""}">${e.t}</span>${e.b ? `<button class="sm" onclick="G.xjShowLast(${i})">详情</button>` : ""}</div>`).join("")}` : ""}`;
    },
    // 天宫（界主）
    tgView(a) {
      const w = this.xjW(a), o = this.xjOfficeOf(w), mine = o && o.t === "jz" && o.map === a, left = this.xjChLeft(w);
      return `<div class="card"><h3>${this.xjHallName(a, "tg")}<small>今日挑战 ${left} / ${CFG.xingjun.TIMES}</small></h3>${this.xjHead(a)}
        <div class="line"><div>界主<small>${mine ? "在任" : this.xjDadi(a)}</small></div>
          ${mine ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjChallengeJz(${a})" ${!this.mapOpen(a) || left <= 0 ? "disabled" : ""}>挑战</button>`}</div></div>`;
    },
    // 星君殿（星君 + 天将）
    xjView(a) {
      const w = this.xjW(a), C = this.xjC(w), o = this.xjOfficeOf(w), lockMap = !this.mapOpen(a), left = this.xjChLeft(w);
      const seats = this.xjSeats(a).map((n, i) => {
        const mine = o && o.t === "xj" && o.map === a && o.seat === i;
        return `<div class="line"><div>${this.xjSeatName(a, i)}<small>${mine ? "在任" : ""}</small></div>
          ${mine ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjChallenge(${a},${i})" ${lockMap || left <= 0 ? "disabled" : ""}>挑战</button>`}</div>`;
      }).join("");
      const tjOn = o && o.t === "tj" && o.map === a, T = C.TJ_REALM;
      return `<div class="card"><h3>${this.xjHallName(a, "xj")}<small>今日挑战 ${left} / ${CFG.xingjun.TIMES}</small></h3>${this.xjHead(a)}
        ${seats}
        <div class="line"><div>${this.xjTjName(a)}<small>${tjOn ? "在任" : ""}</small></div>
          ${tjOn ? `<button class="sm on" disabled>在任</button>` : `<button class="sm" onclick="G.xjTianjiang(${a})" ${lockMap || (T >= 0 && !this.realmOK(T)) ? "disabled" : ""}>就任</button>`}</div></div>`;
    },
  },
});
