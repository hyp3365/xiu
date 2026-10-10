/* =====================================================================
 * 模块：门派
 * ---------------------------------------------------------------------
 * 未入门：按 1~9 星浏览 90 个门派，境界够了即可拜入。
 * 入门后有九个去处：
 *   宗门大殿  晋升职务（外门弟子 → 宗主），每天领取职务俸禄（灵石）
 *   功法殿    用贡献学习本门功法、法术（天地玄黄四阶；学会为第 1 层，之后去“功法”页修炼）
 *   事务堂    每 30 分钟一轮任务，可手动完成或开启自动完成（离线也会进行）
 *   练功房    修炼时消耗贡献，增加修炼速度
 *   宗门宝库  用贡献兑换物品
 *   炼丹房    学习丹方（暂未开放）
 *   炼器室    学习炼器（暂未开放）
 *   试炼塔    100 层，逐层挑战，首次通关得贡献
 *   宗门秘境  消耗贡献进入探索，随机奖励
 * 数值都在 data/sects.js。
 * ===================================================================== */
G.module({
  id: "sect",
  tab: "sect",

  defaults: () => ({
    sect: null,       // 门派 id
    contrib: 0,       // 门派贡献
    rank: 0,          // 职务（DATA.ranks 下标）
    room: -1,         // 正在使用的练功房，-1 为未使用
    salaryDay: "",    // 上次领取俸禄的日期
    affair: { start: 0, tasks: [], auto: false }, // 事务堂当前一轮
    tower: 0,         // 试炼塔已通关层数
  }),

  // 每 10 秒：事务堂到点刷新一轮，开了自动就直接完成
  tick() {
    const s = this.s;
    if (!s.sect) return;
    const now = this.now(), R = DATA.AFFAIR_ROUND * 1000;
    if (now >= s.affair.start + R) {
      s.affair.start = now - (now % R);  // 对齐到整 30 分钟
      const names = DATA.ranks[s.rank].tasks;
      s.affair.tasks = Array.from({ length: DATA.AFFAIR_COUNT }, () => ({ name: U.pick(names), done: false }));
    }
    if (s.affair.auto) s.affair.tasks.forEach((t, i) => { if (!t.done) this.doAffair(i, true); });
  },

  api: {
    sectInfo() { return DATA.sectById[this.s.sect]; },
    roomPct(i) { return DATA.rooms[i].pct * this.sectInfo().star; },
    roomCost(i) { return DATA.rooms[i].cost * this.sectInfo().star; },
    setSectStar(n) { this.sectStar = n; this.render(); },
    setSectTab(t) { this.sectTab = t; this.render(); },

    /* ---------- 入门 / 叛出 ---------- */
    joinSect(id) {
      const x = DATA.sectById[id];
      if (this.r() < x.reqRealm) return;
      Object.assign(this.s, { sect: id, contrib: 0, rank: 0, room: -1, tower: 0, affair: { start: 0, tasks: [], auto: false } });
      this.sectTab = "hall";
      this.log(`你拜入${x.name}（${x.star}星），成为外门弟子。`, "gold"); this.after();
    },
    leaveSect() {
      if (!confirm("叛出门派将清空贡献和职务（已学功法保留），确定？")) return;
      this.log(`你离开了${this.sectInfo().name}。`, "bad");
      this.s.sect = null; this.s.room = -1; this.s.contrib = 0; this.s.rank = 0; this.after();
    },

    /* ---------- 宗门大殿 ---------- */
    rankReqRealm(i) { return Math.min(DATA.realms.length - 1, this.sectInfo().reqRealm + DATA.ranks[i].realm); },
    rankCost(i) { return DATA.ranks[i].cost * this.sectInfo().star; },
    promote() {
      const i = this.s.rank + 1; if (i >= DATA.ranks.length) return;
      if (this.r() < this.rankReqRealm(i) || this.s.contrib < this.rankCost(i)) return;
      this.s.contrib -= this.rankCost(i); this.s.rank = i;
      this.log(`晋升为【${DATA.ranks[i].name}】！`, "gold"); this.after();
    },
    salary() { return Math.floor(DATA.ranks[this.s.rank].daily * this.sectInfo().star * Math.pow(DATA.STONE_GROW, this.s.L)); },
    today() { return new Date(this.now()).toDateString(); },
    claimSalary() {
      if (this.s.salaryDay === this.today()) return;
      const n = this.salary();
      this.s.salaryDay = this.today(); this.s.stone += n;
      this.log(`领取${DATA.ranks[this.s.rank].name}俸禄，灵石 +${U.fmt(n)}。`, "good"); this.after();
    },

    /* ---------- 功法殿 ---------- */
    setLibTier(t) { this.libTier = t; this.render(); },
    learnGongfa(id) {
      const g = DATA.skillInfo(id);
      if (this.hasGongfa(id) || this.s.contrib < g.cost) return;
      this.s.contrib -= g.cost; this.s.gongfa[id] = 1;
      if (g.kind === "sp") this.autoSlotSpell(id); // 法术栏有空位就自动放入（见 bag.js）
      this.log(`习得《${g.name}》（${g.tier.name}）第 1 层，可在功法栏修炼提升。`, "gold"); this.after();
    },

    /* ---------- 事务堂 ---------- */
    doAffair(i, silent) {
      const t = this.s.affair.tasks[i]; if (!t || t.done) return;
      const x = this.sectInfo(), c = DATA.affairContrib(this.s.rank, x.star);
      const st = Math.floor(DATA.STONE_BASE * 2 * Math.pow(DATA.STONE_GROW, this.s.L) * x.star * (1 + Math.random()));
      t.done = true; this.s.contrib += c; this.s.stone += st;
      this.log(`完成「${t.name}」，贡献 +${c}，灵石 +${U.fmt(st)}。`, "good");
      if (!silent) this.after();
    },
    toggleAutoAffair() {
      this.s.affair.auto = !this.s.affair.auto;
      if (this.s.affair.auto) this.s.affair.tasks.forEach((t, i) => { if (!t.done) this.doAffair(i, true); }); // 开启时把本轮剩下的做完
      this.after();
    },

    /* ---------- 练功房 ---------- */
    enterRoom(i) { this.s.room = this.s.room === i ? -1 : i; this.after(); },

    /* ---------- 宗门宝库 ---------- */
    treasuryCost(it) { return it.cost * this.sectInfo().star; },
    exchange(i) {
      const it = DATA.treasury[i], c = this.treasuryCost(it);
      if (this.s.contrib < c) return;
      if (it.kind === "pill") { if (!this.addPill(it.type, this.r())) return; }
      else this.s.stone += Math.floor(it.n * Math.pow(DATA.STONE_GROW, this.s.L));
      this.s.contrib -= c;
      this.log("兑换成功。", "good"); this.after();
    },

    /* ---------- 试炼塔 ---------- */
    towerLevel(floor) { return Math.min(DATA.realms.length * DATA.LAYERS - 1, this.sectInfo().reqRealm * DATA.LAYERS + floor * DATA.TOWER_STEP); },
    challengeTower() {
      const f = this.s.tower + 1; if (f > DATA.TOWER_MAX) return;
      const st = this.stats();
      if (this.s.hp < st.hp * 0.3) return this.log("气血不足三成，先休养片刻。", "sys");
      const Lm = this.towerLevel(f), m = this.makeMonster(Lm, `第${f}层守关者`, 1.0);
      const res = this.battle(m);
      if (res.win) {
        this.s.tower = f; const c = DATA.towerReward(f); this.s.contrib += c;
        this.log(`${res.rounds}回合击败试炼塔第 ${f} 层守关者，贡献 +${c}。`, "gold");
      } else this.log(`挑战试炼塔第 ${f} 层失败。`, "bad");
      this.after();
    },

    /* ---------- 宗门秘境 ---------- */
    exploreSecret() {
      const x = this.sectInfo(), c = DATA.secretCost(x.star);
      if (this.s.contrib < c) return;
      this.s.contrib -= c;
      const roll = Math.random(), g = this.r();
      if (roll < 0.4) {
        const n = Math.floor(DATA.STONE_BASE * 30 * Math.pow(DATA.STONE_GROW, this.s.L) * (1 + Math.random()));
        this.s.stone += n; this.log(`秘境中寻得一处灵石矿脉，灵石 +${U.fmt(n)}。`, "gold");
      } else if (roll < 0.75) {
        const t = U.pick(Object.keys(DATA.pills)), n = U.rand(2, 5);
        this.addPill(t, g, n); this.log(`秘境中发现前人遗留的${DATA.pills[t].name} ×${n}。`, "gold");
      } else if (roll < 0.9) {
        const e = this.makeEquip(U.pick(Object.keys(DATA.slots)), g, U.rand(2, 4));
        if (this.addEquip(e)) this.log(`秘境深处得到<span class="q${e.q}">${DATA.quals[e.q]}${e.name}</span>！`, "gold");
      } else this.log("秘境中迷雾重重，一无所获。", "sys");
      this.after();
    },
  },

  view() {
    const s = this.s;
    // ---------- 未加入门派：按星级浏览 ----------
    if (!s.sect) {
      const star = this.sectStar || 1;
      const stars = Array.from({ length: 9 }, (_, i) => `<button class="${star === i + 1 ? "active" : ""}" onclick="G.setSectStar(${i + 1})">${i + 1}★</button>`).join("");
      return `<div class="room-grid five">${stars}</div><div class="card"><h3>${star} 星门派<small>需${DATA.realms[(star - 1) * 2]}期</small></h3>` +
        DATA.sects.filter(x => x.star === star).map(x => {
          const lock = this.r() < x.reqRealm;
          return `<div class="line"><div>${x.name}<small>六类功法、六系法术 · 天地玄黄四阶</small></div>
            <button class="sm" onclick="G.joinSect('${x.id}')" ${lock ? "disabled" : ""}>${lock ? "境界不足" : "拜入"}</button></div>`;
        }).join("") + `</div>`;
    }

    // ---------- 已入门 ----------
    const x = this.sectInfo(), tab = this.sectTab || "hall";
    const TABS = [["hall", "宗门大殿"], ["lib", "功法殿"], ["affair", "事务堂"], ["room", "练功房"], ["treasury", "宗门宝库"],
                  ["alchemy", "炼丹房"], ["forge", "炼器室"], ["tower", "试炼塔"], ["secret", "宗门秘境"]];
    let h = `<div class="card"><h3>${x.name} <span class="tag">${x.star}星</span><small>${DATA.ranks[s.rank].name} · 贡献 ${U.fmt(s.contrib)}</small></h3></div>
      <div class="room-grid">${TABS.map(([k, n]) => `<button class="${tab === k ? "active" : ""}" onclick="G.setSectTab('${k}')">${n}</button>`).join("")}</div>`;

    if (tab === "hall") {
      const next = s.rank + 1 < DATA.ranks.length ? s.rank + 1 : -1, got = s.salaryDay === this.today();
      h += `<div class="card"><h3>宗门大殿<small>当前：${DATA.ranks[s.rank].name}</small></h3>
        <div class="line"><div>每日俸禄<small>${U.fmt(this.salary())} 灵石</small></div>
        <button class="sm" onclick="G.claimSalary()" ${got ? "disabled" : ""}>${got ? "今日已领" : "领取"}</button></div>
        ${next < 0 ? `<p class="desc">你已是一宗之主。</p>` : `<div class="line"><div>晋升【${DATA.ranks[next].name}】
          <small>需${DATA.realms[this.rankReqRealm(next)]}期 · ${U.fmt(this.rankCost(next))} 贡献</small></div>
          <button class="sm" onclick="G.promote()" ${this.r() < this.rankReqRealm(next) || s.contrib < this.rankCost(next) ? "disabled" : ""}>晋升</button></div>`}</div>
        <div class="card"><h3>职务一览</h3>${DATA.ranks.map((r, i) => `<div class="line"><div>${r.name}<small>俸禄 ×${r.daily} · 任务贡献 ×${r.reward}</small></div>${i === s.rank ? "<b>当前</b>" : i < s.rank ? "<small>已历</small>" : ""}</div>`).join("")}</div>
        <div class="btns"><button onclick="G.leaveSect()">叛出门派</button></div>`;
    } else if (tab === "lib") {
      const tier = this.libTier || "huang";
      const btn = g => { const has = this.hasGongfa(g.id);
        return `<button class="sm" onclick="G.learnGongfa('${g.id}')" ${has || s.contrib < g.cost ? "disabled" : ""}>${has ? "已学会" : "学习"}</button>`; };
      h += `<div class="room-grid">${DATA.tiers.map(t => `<button class="${tier === t.id ? "active" : ""}" onclick="G.setLibTier('${t.id}')">${t.name}</button>`).join("")}</div>
        <div class="card"><h3>功法<small>学会后到“功法”页修炼升层</small></h3>` + DATA.gongfaTypes.map(t => {
          const g = DATA.gongfaInfo(DATA.gongfaId(x.id, t.id, tier));
          return `<div class="line"><div>《${g.name}》<span class="tag">${t.name}</span><small>每层${t.label} +${this.gfValue(g, g.perLv)} · ${U.fmt(g.cost)} 贡献</small></div>${btn(g)}</div>`;
        }).join("") + `</div><div class="card"><h3>法术<small>施放消耗法力</small></h3>` + DATA.elements.map(e => {
          const g = DATA.spellInfo(DATA.spellId(x.id, e.id, tier));
          return `<div class="line"><div>《${g.name}》<span class="tag">${e.name}</span><small>攻击×${g.pct}% + ${U.fmt(g.perLv)}/层 · 耗法力 ${U.fmt(g.mana)} · ${U.fmt(g.cost)} 贡献</small></div>${btn(g)}</div>`;
        }).join("") + `</div>`;
    } else if (tab === "affair") {
      const left = Math.max(0, s.affair.start + DATA.AFFAIR_ROUND * 1000 - Date.now());
      h += `<div class="card"><h3>事务堂<small>${U.dur(left / 1000)}后刷新</small></h3>` + s.affair.tasks.map((t, i) =>
        `<div class="line"><div>${t.name}<small>贡献 +${DATA.affairContrib(s.rank, x.star)}，另得灵石</small></div>
        <button class="sm" onclick="G.doAffair(${i})" ${t.done ? "disabled" : ""}>${t.done ? "已完成" : "完成"}</button></div>`).join("") +
        `<div class="btns"><button class="${s.affair.auto ? "on" : ""}" onclick="G.toggleAutoAffair()">自动完成任务：${s.affair.auto ? "开" : "关"}</button></div>
        <p class="desc">每 30 分钟一轮，开启自动后离线也会完成。</p></div>`;
    } else if (tab === "room") {
      h += `<div class="card"><h3>练功房<small>修炼时每次消耗贡献</small></h3>` + DATA.rooms.map((r, i) => {
        const on = s.room === i;
        return `<div class="line"><div>${r.name}<span class="tag">+${this.roomPct(i)}%</span><small>每次修炼消耗 ${this.roomCost(i)} 贡献</small></div>
          <button class="sm ${on ? "on" : ""}" onclick="G.enterRoom(${i})">${on ? "使用中" : "进入"}</button></div>`;
      }).join("") + `</div>`;
    } else if (tab === "treasury") {
      h += `<div class="card"><h3>宗门宝库<small>以贡献兑换</small></h3>` + DATA.treasury.map((it, i) => {
        const name = it.kind === "pill" ? `${DATA.realms[this.r()]}·${DATA.pills[it.type].name}` : it.name;
        const c = this.treasuryCost(it);
        return `<div class="line"><div>${name}<small>${U.fmt(c)} 贡献</small></div>
          <button class="sm" onclick="G.exchange(${i})" ${s.contrib < c ? "disabled" : ""}>兑换</button></div>`;
      }).join("") + `</div>`;
    } else if (tab === "alchemy" || tab === "forge") {
      h += `<div class="card"><h3>${tab === "alchemy" ? "炼丹房 · 丹方" : "炼器室 · 器谱"}</h3><p class="desc">长老闭关中，暂未开放传授。</p></div>`;
    } else if (tab === "tower") {
      const f = s.tower + 1, done = s.tower >= DATA.TOWER_MAX;
      h += `<div class="card"><h3>试炼塔<small>已通关 ${s.tower} / ${DATA.TOWER_MAX} 层</small></h3>
        ${done ? `<p class="desc">你已登顶试炼塔！</p>` : `<div class="line"><div>第 ${f} 层守关者<small>${this.realmName(this.towerLevel(f))} · 首通贡献 +${DATA.towerReward(f)}</small></div>
        <button class="sm" onclick="G.challengeTower()">挑战</button></div>`}</div>`;
    } else if (tab === "secret") {
      const c = DATA.secretCost(x.star);
      h += `<div class="card"><h3>宗门秘境<small>每次消耗 ${U.fmt(c)} 贡献</small></h3>
        <p class="desc">秘境中或有灵石矿脉、前人遗丹、上品法器，也可能一无所获。</p>
        <div class="btns"><button class="primary" onclick="G.exploreSecret()" ${s.contrib < c ? "disabled" : ""}>进入探索</button></div></div>`;
    }
    return h;
  },
});
