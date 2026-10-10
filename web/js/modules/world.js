/* =====================================================================
 * 模块：世界（六界：凡界 仙界 魔界 冥界 神界 天外天，目前只开放凡界）
 * 凡界内：9 张地图（练气 → 渡劫）、坊市、设置
 * ---------------------------------------------------------------------
 * 历练：选择地图，战斗一场（普通怪或首领）。速度高者先手，判闪避、暴击。
 *   法术栏里的法术轮流施放（消耗法力），法力不足时普通攻击。
 *   胜利：灵石、药材、矿石（首领掉得更多）；怪物不掉丹药、装备
 *   失败：遗失部分灵石
 * 自动探索：每次 100 秒，每秒走一步，随机遇到：无事 / 怪物 / 灵药 / 矿石 / 首领
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
  defaults: () => ({ explore: null }),

  // 每 10 秒（以及在线时每秒）推进探索
  tick() { this.advanceExplore(); },

  api: {
    setWorldTab(t) { this.worldTab = t; this.render(); },

    setWorld(id) { this.worldId = id; this.render(); },

    // 生成怪物：Lm 怪物层序，boss 是否首领
    makeMonster(Lm, name, boss) {
      const M = CFG.monster, k = M.STRENGTH_MIN + Math.random() * (M.STRENGTH_MAX - M.STRENGTH_MIN);
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
      let php = s.hp, mhp = m.hp, rounds = 0;
      const meFirst = st.speed >= m.speed;
      while (php > 0 && mhp > 0 && rounds < 60) {
        rounds++;
        if (meFirst) { mhp -= myHit(); if (mhp > 0) php -= hit(m, st); }
        else { php -= hit(m, st); if (php > 0) mhp -= myHit(); }
      }
      s.hp = Math.max(1, php);
      return { win: mhp <= 0 && php > 0, lose: php <= 0, rounds };
    },

    /* ---------- 掉落 ---------- */
    newLoot() { return { stone: 0, mats: {}, pills: [], equips: [] }; },
    // 随机一种药材/矿石，数量随地图提高
    rollMat(loot, kind, a, mult = 1) {
      const E = CFG.explore, g = U.weighted(E.MAT_WEIGHT);
      const name = (kind === "herb" ? DATA.herbs : DATA.ores)[g];
      const rate = kind === "herb" ? E.HERB_RATE : E.ORE_RATE;
      const n = Math.max(1, Math.round(E.MAT_BASE * DATA.mapMult(a) * rate * mult * (1 + Math.random())));
      const key = kind + "|" + name;
      (loot.mats[key] = loot.mats[key] || { kind, name, g, n: 0 }).n += n;
      return `${name}×${U.fmt(n)}`;
    },
    // 击败怪物的掉落，写进 loot，返回描述文字
    rollMonsterLoot(loot, m, a) {
      const E = CFG.explore, mult = m.boss ? E.BOSS_DROP : 1, got = [];
      const stone = Math.floor(E.STONE_BASE * Math.pow(E.STONE_GROW, m.Lm) * (1 + Math.random() * 1.5) * E.STONE_RATE * mult);
      loot.stone += stone; got.push(`灵石${U.fmt(stone)}`);
      if (m.boss || Math.random() < E.MONSTER_MAT) got.push(this.rollMat(loot, Math.random() < 0.5 ? "herb" : "ore", a, mult));
      if (m.boss) got.push(this.rollMat(loot, "herb", a, mult), this.rollMat(loot, "ore", a, mult));
      return got.join("、"); // 怪物不掉丹药、装备
    },
    // 把收获放进背包，返回简短描述
    giveLoot(loot) {
      const s = this.s, parts = [];
      s.stone += loot.stone; if (loot.stone) parts.push(`灵石${U.fmt(loot.stone)}`);
      let lost = 0;
      for (const k in loot.mats) { const x = loot.mats[k]; if (this.addMat(x.kind, x.name, x.g, x.n)) parts.push(`${x.name}×${U.fmt(x.n)}`); else lost++; }
      loot.pills.forEach(p => { if (this.addPill(p.t, p.g)) parts.push(`${DATA.realms[p.g]}·${DATA.pills[p.t].name}`); else lost++; });
      loot.equips.forEach(e => { if (this.addEquip(e)) parts.push(`<span class="q${e.q}">${DATA.quals[e.q]}${e.name}</span>`); else lost++; });
      return parts.join("、") + (lost ? `（背包已满，遗失 ${lost} 件）` : "");
    },
    // 战败损失
    loseStone() { const lost = Math.floor(this.s.stone * CFG.explore.LOSE_STONE); this.s.stone -= lost; return lost; },

    // 历练：a 地图序号；boss 是否挑战首领
    fightMap(a, boss) {
      const s = this.s, st = this.stats(), maxL = DATA.realms.length * DATA.LAYERS - 1;
      if (this.r() < a) return;
      if (s.hp < st.hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻（每 10 秒恢复 1%）。", "sys");
      const map = DATA.maps[a], Lm = Math.min(maxL, a * 10 + (boss ? 9 : U.rand(0, 9)));
      const m = this.makeMonster(Lm, boss ? map.boss : U.pick(map.monsters), boss);
      const res = this.battle(m), tag = `${boss ? "首领 " : ""}${m.name}（${this.realmName(Lm)}）`;
      if (res.win) {
        s.kills++;
        const loot = this.newLoot(); this.rollMonsterLoot(loot, m, a);
        this.log(`${res.rounds}回合击败${tag}，获得 ${this.giveLoot(loot)}`, "gold");
      } else if (res.lose) this.log(`不敌${tag}，重伤逃回，遗失灵石 ${U.fmt(this.loseStone())}。`, "bad");
      else this.log(`与${tag}缠斗 ${res.rounds} 回合未分胜负，各自退去。`, "sys");
      this.after();
    },

    /* ---------- 自动探索 ---------- */
    toggleExplore(a) {
      const s = this.s;
      if (s.explore && s.explore.map === a) { this.stopExplore("停止自动探索"); return this.after(); }
      if (s.explore) this.stopExplore("更换地图");
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，无法探索。", "sys");
      s.explore = { map: a, start: this.now(), step: 0, count: 0, loot: this.newLoot(), ev: [], last: "" };
      this.exploreOpen = true;
      this.log(`开始在${DATA.maps[a].name}自动探索（探索期间无法修炼）。`, "sys");
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
      const x = this.s.explore, a = x.map, map = DATA.maps[a], ev = CFG.explore.events, maxL = DATA.realms.length * DATA.LAYERS - 1;
      const keys = Object.keys(ev), type = keys[U.weighted(keys.map(k => ev[k]))];
      x.step++;
      let t = "", c = "";
      if (type === "herb") { t = `发现灵药，采得 ${this.rollMat(x.loot, "herb", a)}`; c = "good"; }
      else if (type === "ore") { t = `发现矿脉，挖得 ${this.rollMat(x.loot, "ore", a)}`; c = "good"; }
      else if (type === "monster" || type === "boss") {
        const boss = type === "boss", Lm = Math.min(maxL, a * 10 + (boss ? 9 : U.rand(0, 9)));
        const m = this.makeMonster(Lm, boss ? map.boss : U.pick(map.monsters), boss);
        const res = this.battle(m), tag = `${boss ? "【首领】" : ""}${m.name}（${this.realmName(Lm)}）`;
        if (res.win) { this.s.kills++; t = `遭遇${tag}，${res.rounds}回合击败，获得 ${this.rollMonsterLoot(x.loot, m, a)}`; c = boss ? "gold" : ""; }
        else if (res.lose) { t = `遭遇${tag}，不敌重伤，遗失灵石 ${U.fmt(this.loseStone())}`; c = "bad"; }
        else { t = `遭遇${tag}，缠斗 ${res.rounds} 回合，各自退去`; }
      } else t = U.pick(DATA.exploreIdle);
      x.ev.unshift({ n: x.step, t, c });
      if (x.ev.length > CFG.explore.TIME) x.ev.length = CFG.explore.TIME;
      return c === "bad"; // 战败：本次提前结束
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
          x.last = `第 ${x.count} 次探索${lost ? "（战败提前结束）" : ""}：${got || "一无所获"}`;
          this.log(x.last, lost ? "bad" : "gold");
          if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) {
            this.log(`气血不足三成，自动探索停止（共探索 ${x.count} 次）。`, "bad");
            s.explore = null; break;
          }
          x.start = x.start + x.step * 1000; x.step = 0; x.loot = this.newLoot(); x.ev = [];
        }
      }
      if (changed) this.dirty();
    },
    setExploreOpen(v) { this.exploreOpen = v; this.render(); },

    // 坊市货单（当前境界品质）
    shopList() {
      const g = this.r(), list = [];
      for (const t in DATA.pills) list.push({ kind: "pill", type: t, g, price: DATA.pillPrice(t, g) });
      for (const sl in DATA.slots) if (sl !== "fabao") list.push({ kind: "eq", slot: sl, g, q: 1, price: Math.floor(500 * Math.pow(DATA.STONE_GROW, g * 10)) });
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
          return `<div class="card"><h3>自动探索中 · ${DATA.maps[x.map].name}<small>已完成 ${x.count} 次</small></h3>
          <div class="bar tick"><div style="width:${x.step / T * 100}%"></div></div>
          <div class="row small"><span>第 ${x.step} / ${T} 步 · 剩余 ${T - x.step} 秒</span><span>
            <button class="sm" onclick="G.setExploreOpen(${!this.exploreOpen})">${this.exploreOpen ? "收起信息" : "探索信息"}</button>
            <button class="sm" onclick="G.toggleExplore(${x.map})">停止</button></span></div>
          <p class="desc">本次收获（结束后放入背包）：灵石 ${U.fmt(L.stone)}${mats.length ? "、" + mats.join("、") : ""}${L.pills.length ? `、丹药${L.pills.length}枚` : ""}${L.equips.length ? `、装备${L.equips.length}件` : ""}</p>
          ${x.last ? `<p class="desc">上次：${x.last}</p>` : ""}
          ${this.exploreOpen ? `<div class="explore-log">${x.ev.map(e => `<p class="${e.c}"><b>第${e.n}步</b> ${e.t}</p>`).join("") || "<p>出发……</p>"}</div>` : ""}</div>`; })() : ""}
        <div class="card"><h3>凡界<small>探索每次 100 秒，探索时无法修炼，气血低于三成停止</small></h3>` +
        DATA.maps.map((map, a) => {
          const lock = this.r() < a, on = s.explore && s.explore.map === a;
          return `<div class="line"><div>${map.name}<small>${DATA.realms[a]}期 · 首领 ${map.boss} · 掉落 ×${U.num(DATA.mapMult(a))}</small></div>
            ${lock ? `<button class="sm" disabled>需${DATA.realms[a]}期</button>` : `<div><button class="sm" onclick="G.fightMap(${a})">历练</button>
            <button class="sm" onclick="G.fightMap(${a},true)">首领</button>
            <button class="sm ${on ? "on" : ""}" onclick="G.toggleExplore(${a})">${on ? "停止" : "探索"}</button></div>`}</div>`;
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
