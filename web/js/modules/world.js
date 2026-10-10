/* =====================================================================
 * 模块：世界（六界：凡界 仙界 魔界 冥界 神界 天外天，目前只开放凡界）
 * 凡界内：9 张地图（练气 → 渡劫）、坊市、设置
 * ---------------------------------------------------------------------
 * 历练：和自动探索一样走 100 步，但只走一次；走完且没战败 = 通过，解锁该地图的自动探索。
 * 自动探索：每次 100 秒，每秒走一步；固定遇到 10 个小怪、灵药 5~10 次、矿石 5~10 次，
 *   最后一步遇到首领，其余无事发生（顺序随机）。怪物掉 灵石、药材、矿石（不掉丹药、装备）。
 * 战斗：速度高者先手，判闪避、暴击；法术栏法术轮流施放（耗法力），不足时普通攻击；战败遗失部分灵石。
 *   一次探索中获得的东西先记下，100 秒结束后一起放进背包；
 *   气血够（≥ 三成）就继续下一次，不够就停止；探索时不能修炼；离线也继续。
 *   探索信息栏显示每一步发生的事，每秒刷新。
 * 数值全部在 js/config/numbers.js 的 monster / explore 部分。
 * ===================================================================== */
G.module({
  id: "world",
  tab: "world",

  /* explore：自动探索中
   *   { map 地图序号, start 本次开始时间, step 已走步数, count 已完成次数,
   *     loot 本次收获 { stone, mats: { "herb|名字": {kind,name,g,n} }, pills: [], equips: [] },
   *     ev 本次事件列表（最新在前）, last 上一次结算文字 } */
  defaults: () => ({ explore: null, trained: [], lastRun: null }), // lastRun：上一次历练/探索的事件记录 // trained：已历练通过的地图序号

  // 每 10 秒（以及在线时每秒）推进探索
  tick() { this.advanceExplore(); },

  api: {
    setWorldTab(t) { this.worldTab = t; this.render(); },

    setWorld(id) { this.worldId = id; this.render(); },

    // 生成怪物：Lm 怪物层序，boss 是否首领
    makeMonster(Lm, name, boss, mult = 1) {
      const M = CFG.monster, k = (M.STRENGTH_MIN + Math.random() * (M.STRENGTH_MAX - M.STRENGTH_MIN)) * mult;
      const f = k * Math.pow(DATA.GROW, Lm), B = DATA.playerBase, F = DATA.playerFixed;
      const m = { name, Lm, boss, hp: B.hp * f, atk: B.atk * f, def: B.def * f, speed: F.speed, crit: F.crit,
        hit: F.hit + Lm * DATA.MONSTER_HIT, dodge: F.dodge + Lm * DATA.MONSTER_DODGE };
      if (boss) for (const key in M.boss) m[key] *= M.boss[key];
      return m;
    },

    // 通用战斗：速度高者先手，判闪避、暴击。返回 { win, lose, rounds }，并更新玩家气血
    battle(m) {
      const st = this.stats(), s = this.s;
      const spells = s.spellSlots.slice(0, this.slotCount()).map(id => DATA.spellInfo(id, s.gongfa[id])).filter(Boolean);
      let si = 0;
      const hit = (A, D) => {
        if (Math.random() * 100 < DATA.dodgeChance(A.hit, D.dodge)) return 0;     // 闪避（看命中与闪避之差）
        let d = Math.max(A.atk * 0.1, A.atk - D.def * 0.5) * (0.9 + Math.random() * 0.2);
        if (Math.random() * 100 < Math.min(DATA.CRIT_CAP, A.crit)) d *= 2;        // 暴击
        return d;
      };
      // 玩家出手：按顺序施放法术，法力不足则普通攻击
      const myHit = () => {
        for (let k = 0; k < spells.length; k++) {
          const sp = spells[(si + k) % spells.length];
          if (s.mana >= sp.mana) {
            si = (si + k + 1) % spells.length; s.mana -= sp.mana;
            if (Math.random() * 100 < DATA.dodgeChance(st.hit, m.dodge)) return 0;
            let d = Math.max(st.atk * 0.1, (st.atk * sp.pct / 100 + sp.flat) * this.lingenSpell(sp.el.id) - m.def * 0.5) * (0.9 + Math.random() * 0.2);
            if (Math.random() * 100 < st.crit) d *= 2;
            return d;
          }
        }
        return hit(st, m);
      };
      let php = s.hp, mhp = m.hp, rounds = 0, dealt = 0, taken = 0;
      const hp0 = s.hp, meFirst = st.speed >= m.speed;
      const me = () => { const d = myHit(); mhp -= d; dealt += d; }, him = () => { const d = hit(m, st); php -= d; taken += d; };
      while (php > 0 && mhp > 0 && rounds < 60) {
        rounds++;
        if (meFirst) { me(); if (mhp > 0) him(); }
        else { him(); if (php > 0) me(); }
      }
      s.hp = Math.max(1, php);
      // 失败原因说明（显示在探索信息里）
      const why = `你出战时气血 ${U.fmt(hp0)}，共造成 ${U.fmt(dealt)} 伤害（对方剩余气血 ${U.fmt(Math.max(0, mhp))}/${U.fmt(m.hp)}），承受 ${U.fmt(taken)} 伤害；对方攻击 ${U.fmt(m.atk)} 防御 ${U.fmt(m.def)}`;
      return { win: mhp <= 0 && php > 0, lose: php <= 0, rounds, why };
    },

    /* ---------- 掉落 ---------- */
    newLoot() { return { stone: 0, mats: {}, pills: [], equips: [] }; },
    // 按配置掉落材料：spec = { herb: {kinds, n}, ore: {kinds, n} }，返回描述
    rollDrop(loot, spec, a) {
      const E = CFG.explore, got = [];
      for (const kind of ["herb", "ore"]) {
        const d = spec[kind]; if (!d) continue;
        const kinds = U.rand(d.kinds[0], d.kinds[1]), w = E.MAT_WEIGHT.slice(), names = kind === "herb" ? DATA.herbs : DATA.ores;
        for (let i = 0; i < kinds && w.some(x => x > 0); i++) {
          const g = U.weighted(w); w[g] = 0; // 同一次不重复
          const n = Math.max(1, Math.round(U.rand(d.n[0], d.n[1]) * DATA.mapMult(a)));
          const key = kind + "|" + names[g];
          (loot.mats[key] = loot.mats[key] || { kind, name: names[g], g, n: 0 }).n += n;
          got.push(`${names[g]}×${U.fmt(n)}`);
        }
      }
      return got.join("、");
    },
    // 击败怪物的掉落，写进 loot，返回描述文字
    rollMonsterLoot(loot, m, a) {
      const E = CFG.explore, mult = m.boss ? E.BOSS_DROP : 1;
      const stone = Math.floor(E.STONE_BASE * Math.pow(E.STONE_GROW, m.Lm) * (1 + Math.random() * 1.5) * E.STONE_RATE * mult);
      loot.stone += stone;
      const mats = this.rollDrop(loot, E.drop[m.boss ? "boss" : "monster"], a);
      return `灵石${U.fmt(stone)}${mats ? "、" + mats : ""}`; // 怪物不掉丹药、装备
    },
    // 把收获放进背包，返回简短描述
    giveLoot(loot) {
      const s = this.s, parts = [];
      s.stone += loot.stone; if (loot.stone) parts.push(`灵石${U.fmt(loot.stone)}`);
      let lost = 0;
      for (const k in loot.mats) { const x = loot.mats[k]; if (this.addMat(x.kind, x.name, x.g, x.n)) parts.push(`${DATA.matFull(x.kind, x.g)}×${U.fmt(x.n)}`); else lost++; }
      loot.pills.forEach(p => { if (this.addPill(p.t, p.g)) parts.push(`${DATA.realms[p.g]}·${DATA.pills[p.t].name}`); else lost++; });
      loot.equips.forEach(e => { if (this.addEquip(e)) parts.push(`<span class="q${e.q}">${DATA.quals[e.q]}${e.name}</span>`); else lost++; });
      return parts.join("、") + (lost ? `（背包已满，遗失 ${lost} 件）` : "");
    },
    // 战败损失
    loseStone() { const lost = Math.floor(this.s.stone * CFG.explore.LOSE_STONE); this.s.stone -= lost; return lost; },

    /* ---------- 自动探索 ---------- */
    // once = true：历练（只走一次）；否则自动探索（需先历练通过该地图）
    toggleExplore(a, once) {
      const s = this.s;
      if (s.explore && s.explore.map === a && !!s.explore.once === !!once) { this.stopExplore(once ? "放弃历练" : "停止自动探索"); return this.after(); }
      if (this.r() < a) return;
      if (!once && !s.trained.includes(a)) return this.log("需先在此地历练通过，才能自动探索。", "sys");
      if (s.explore) this.stopExplore("更换");
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻（每 10 秒恢复 1%）。", "sys");
      s.explore = { map: a, once: !!once, start: this.now(), step: 0, count: 0, loot: this.newLoot(), ev: [], last: "", plan: this.makePlan() };
      this.exploreOpen = true;
      this.log(`开始在${DATA.maps[a].name}${once ? "历练" : "自动探索"}（期间无法修炼）。`, "sys");
      this.after();
    },
    // 停止：本次已获得的东西也结算
    stopExplore(why) {
      const x = this.s.explore; if (!x) return;
      const got = this.giveLoot(x.loot);
      this.log(`${why}，共完成 ${x.count} 次探索${got ? "，本次收获 " + got : ""}。`, "sys");
      this.s.explore = null;
    },
    // 走一步：随机事件
    exploreStep() {
      const x = this.s.explore, a = x.map, map = DATA.maps[a], maxL = DATA.realms.length * DATA.LAYERS - 1;
      if (!x.plan) x.plan = this.makePlan();
      const type = { n: "nothing", m: "monster", b: "boss", h: "herb", o: "ore" }[x.plan[x.step]] || "nothing";
      x.step++;
      // 每走一步恢复少量气血、法力
      const st = this.stats(), H = CFG.explore.HEAL_STEP;
      this.s.hp = Math.min(st.hp, this.s.hp + st.hp * H); this.s.mana = Math.min(st.mana, this.s.mana + st.mana * H);
      let t = "", c = "";
      if (type === "herb") { t = `发现灵药，采得 ${this.rollDrop(x.loot, CFG.explore.drop.herbEvent, a) || "无"}`; c = "good"; }
      else if (type === "ore") { t = `发现矿脉，挖得 ${this.rollDrop(x.loot, CFG.explore.drop.oreEvent, a) || "无"}`; c = "good"; }
      else if (type === "monster" || type === "boss") {
        const boss = type === "boss", Lm = Math.min(maxL, a * 10 + (boss ? 9 : U.rand(0, 9)));
        const m = this.makeMonster(Lm, boss ? map.boss : U.pick(map.monsters), boss);
        const res = this.battle(m), tag = `${boss ? "【首领】" : ""}${m.name}（${this.realmName(Lm)}）`;
        if (res.win) { this.s.kills++; t = `遭遇${tag}，${res.rounds}回合击败，获得 ${this.rollMonsterLoot(x.loot, m, a)}`; c = boss ? "gold" : ""; }
        else if (res.lose) { t = `遭遇${tag}，第 ${res.rounds} 回合不敌重伤，遗失灵石 ${U.fmt(this.loseStone())}。${res.why}`; c = "bad"; }
        else { t = `遭遇${tag}，缠斗 ${res.rounds} 回合，各自退去`; }
      } else t = U.pick(DATA.exploreIdle);
      x.ev.unshift({ n: x.step, t, c });
      if (x.ev.length > CFG.explore.TIME) x.ev.length = CFG.explore.TIME;
      return c === "bad"; // 战败：本次提前结束
    },
    // 生成一次探索的事件顺序（字符串，每个字符一步）：首领固定在最后一步
    makePlan() {
      const E = CFG.explore, T = E.TIME;
      const list = [...Array(E.MONSTERS).fill("m"), ...Array(U.rand(E.HERB_MIN, E.HERB_MAX)).fill("h"), ...Array(U.rand(E.ORE_MIN, E.ORE_MAX)).fill("o")];
      while (list.length < T - E.BOSS) list.push("n");
      list.length = T - E.BOSS;
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      return list.join("") + "b".repeat(E.BOSS);
    },
    // 推进到当前时间（每秒走一步；满 100 步结算一次）
    advanceExplore() {
      const s = this.s, T = CFG.explore.TIME;
      if (!s.explore) return;
      const x = s.explore;
      if (x.step === undefined) Object.assign(x, { start: this.now(), step: 0, count: x.count || 0, loot: this.newLoot(), ev: [], last: "" }); // 旧存档
      let changed = false;
      while (s.explore && this.now() >= x.start + (x.step + 1) * 1000) {
        changed = true;
        const lost = this.exploreStep();
        if (x.step >= T || lost) {
          // 结算本次
          x.count++;
          const got = this.giveLoot(x.loot);
          x.last = `${x.once ? "历练" : `第 ${x.count} 次探索`}${lost ? `（第 ${x.step} 步战败，提前结束）` : ""}：${got || "一无所获"}`;
          this.log(x.last, lost ? "bad" : "gold");
          // 保存这一次的全部事件，结束后也能查看（含失败那一步）
          s.lastRun = { title: `${DATA.maps[x.map].name} · ${x.last}`, ev: x.ev.slice(), bad: lost };
          if (x.once) { // 历练只走一次；走完且未战败 = 通过，解锁该地图自动探索
            if (!lost && !s.trained.includes(x.map)) { s.trained.push(x.map); this.log(`${DATA.maps[x.map].name}历练通过！已可自动探索。`, "gold"); }
            else if (lost) this.log("历练失败，提升实力后再来。", "bad");
            s.explore = null; break;
          }
          if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) {
            this.log(`气血不足三成，自动探索停止（共探索 ${x.count} 次）。`, "bad");
            s.lastRun.title += "；气血不足三成，自动探索停止";
            s.explore = null; break;
          }
          x.start = x.start + x.step * 1000; x.step = 0; x.loot = this.newLoot(); x.ev = []; x.plan = this.makePlan();
        }
      }
      if (changed) this.dirty();
    },
    setExploreOpen(v) { this.exploreOpen = v; this.render(); },
    setLastOpen(v) { this.lastOpen = v; this.render(); },

    // 坊市货单（当前境界品质）
    shopList() {
      const g = this.r(), list = [];
      for (const t in DATA.pills) list.push({ kind: "pill", type: t, g, price: DATA.pillPrice(t, g) });
      for (const sl in DATA.slots) if (sl !== "fabao") list.push({ kind: "eq", slot: sl, g, q: 1, price: Math.floor(CFG.price.SHOP_EQUIP * Math.pow(DATA.STONE_GROW, g * 10)) });
      return list;
    },
    buy(i, n = 1) {
      const it = this.shopList()[i];
      let k = 0;
      for (; k < n; k++) {
        if (this.s.stone < it.price) { this.log("灵石不足。", "sys"); break; }
        const ok = it.kind === "pill" ? this.addPill(it.type, it.g) : this.addEquip(this.makeEquip(it.slot, it.g, it.q));
        if (!ok) break;
        this.s.stone -= it.price;
      }
      if (k) this.log(`购买成功 ×${k}。`, "good");
      this.after();
    },
  },

  view() {
    const s = this.s, wt = this.worldTab || "explore", wid = this.worldId || "fan";
    // 六界选择
    const worlds = `<div class="room-grid">${DATA.worlds.map(w =>
      `<button class="${wid === w.id ? "active" : ""}" onclick="G.setWorld('${w.id}')">${w.name}${w.open ? "" : "<small>未开放</small>"}</button>`).join("")}</div>`;
    const W = DATA.worlds.find(w => w.id === wid);
    if (!W.open) return worlds + `<div class="card"><h3>${W.name}</h3><p class="desc">${W.desc}</p><p class="desc">界壁未开，以你如今的修为尚无法踏足。</p></div>`;
    const tabs = worlds + `<div class="sub-tabs">
      <button class="${wt === "explore" ? "active" : ""}" onclick="G.setWorldTab('explore')">历练</button>
      <button class="${wt === "shop" ? "active" : ""}" onclick="G.setWorldTab('shop')">坊市</button>
      <button class="${wt === "set" ? "active" : ""}" onclick="G.setWorldTab('set')">设置</button></div>`;

    if (wt === "explore") {
      const st = this.stats();
      return tabs + `<div class="row small"><span>气血 ${U.fmt(s.hp)} / ${U.fmt(st.hp)}</span><span>斩妖 ${s.kills}</span></div>
        <div class="bar hp"><div style="width:${s.hp / st.hp * 100}%"></div></div>
        <div class="row small"><span>法力 ${U.fmt(s.mana)} / ${U.fmt(st.mana)}</span><span>灵石 ${U.fmt(s.stone)}</span></div>
        ${s.explore ? (() => { const x = s.explore, T = CFG.explore.TIME, L = x.loot;
          const mats = Object.values(L.mats).map(m => `${m.name}×${U.fmt(m.n)}`);
          return `<div class="card"><h3>${x.once ? "历练中" : "自动探索中"} · ${DATA.maps[x.map].name}<small>${x.once ? "走完且不战败即通过" : `已完成 ${x.count} 次`}</small></h3>
          <div class="bar tick"><div style="width:${x.step / T * 100}%"></div></div>
          <div class="row small"><span>第 ${x.step} / ${T} 步 · 剩余 ${T - x.step} 秒</span><span>
            <button class="sm" onclick="G.setExploreOpen(${!this.exploreOpen})">${this.exploreOpen ? "收起信息" : "探索信息"}</button>
            <button class="sm" onclick="G.toggleExplore(${x.map},${!!x.once})">停止</button></span></div>
          <p class="desc">本次收获（结束后放入背包）：灵石 ${U.fmt(L.stone)}${mats.length ? "、" + mats.join("、") : ""}${L.pills.length ? `、丹药${L.pills.length}枚` : ""}${L.equips.length ? `、装备${L.equips.length}件` : ""}</p>
          ${x.last ? `<p class="desc">上次：${x.last}</p>` : ""}
          ${this.exploreOpen ? `<div class="explore-log">${x.ev.map(e => `<p class="${e.c}"><b>第${e.n}步</b> ${e.t}</p>`).join("") || "<p>出发……</p>"}</div>` : ""}</div>`; })() : ""}
        ${s.lastRun ? `<div class="card"><h3>上次记录<small><button class="sm" onclick="G.setLastOpen(${!this.lastOpen})">${this.lastOpen ? "收起" : "展开"}</button></small></h3>
          <p class="desc ${s.lastRun.bad ? "q5" : ""}">${s.lastRun.title}</p>
          ${this.lastOpen ? `<div class="explore-log">${s.lastRun.ev.map(e => `<p class="${e.c}"><b>第${e.n}步</b> ${e.t}</p>`).join("")}</div>` : ""}</div>` : ""}
        <div class="card"><h3>凡界<small>历练一次 100 秒，通过后才能自动探索；期间无法修炼，气血低于三成停止</small></h3>` +
        DATA.maps.map((map, a) => {
          const lock = this.r() < a, ok = s.trained.includes(a), x = s.explore && s.explore.map === a ? s.explore : null;
          return `<div class="line"><div>${map.name}<small>${DATA.realms[a]}期 · 掉落 ×${U.num(DATA.mapMult(a))} · ${ok ? "已通过历练" : "未历练"}</small></div>
            ${lock ? `<button class="sm" disabled>需${DATA.realms[a]}期</button>` : `<div><button class="sm ${x && x.once ? "on" : ""}" onclick="G.toggleExplore(${a},true)">${x && x.once ? "停止" : "历练"}</button>
            <button class="sm ${x && !x.once ? "on" : ""}" onclick="G.toggleExplore(${a})" ${ok ? "" : "disabled"}>${x && !x.once ? "停止" : "探索"}</button></div>`}</div>`;
        }).join("") + `</div>`;
    }

    if (wt === "shop") {
      return tabs + `<div class="card"><h3>坊市<small>${DATA.realms[this.r()]}期货品</small></h3>` + this.shopList().map((it, i) => {
        const name = it.kind === "pill" ? `${DATA.realms[it.g]}·${DATA.pills[it.type].name}` : `灵品 ${DATA.realms[it.g]}·${DATA.equipNames[it.slot][1]}`;
        const desc = it.kind === "pill" ? `修炼速度 +${Math.round(DATA.pillPct(it.type, it.g))}%，${DATA.pills[it.type].dur}次修炼` : `${DATA.slots[it.slot]} · ${this.equipDesc(this.makeEquip(it.slot, it.g, 1))}`;
        return `<div class="line"><div>${name}<small>${desc}</small></div><div>
          <button class="sm" onclick="G.buy(${i})" ${s.stone < it.price ? "disabled" : ""}>${U.fmt(it.price)}</button>
          ${it.kind === "pill" ? `<button class="sm" onclick="G.buy(${i},10)" ${s.stone < it.price * 10 ? "disabled" : ""}>×10</button>` : ""}</div></div>`;
      }).join("") + `</div>`;
    }

    return tabs + `<div class="card"><h3>账号<small>${API.user}</small></h3>
      <p class="desc">存档保存在服务器，换手机、关浏览器都不会丢。离线期间修炼、聚灵阵持续进行，不封顶。</p>
      <div class="btns"><button onclick="G.save(true)">立即同步</button><button onclick="G.logout()">退出登录</button>
      <button onclick="G.restart()">删档重来</button></div></div>`;
  },
});
