/* =====================================================================
 * 模块：世界（六界：凡界 仙界 魔界 冥界 神界 天外天，目前只开放凡界）
 * 凡界内：9 张地图（练气 → 渡劫）、坊市、设置
 * ---------------------------------------------------------------------
 * 历练：选择地图，战斗一场。速度高者先手，闪避/暴击生效。
 *   法术栏里的法术轮流施放（消耗法力），法力不足时普通攻击。
 *   胜利：灵石 + 概率获得灵药、矿物、丹药、装备
 *   失败：遗失 10% 灵石
 * 自动探索：每 10 秒战斗一场（离线也继续）；探索时不能修炼；
 *   气血低于上限 30% 自动停止。
 * 坊市：出售当前境界品质的丹药和灵品装备。
 * ===================================================================== */
G.module({
  id: "world",
  tab: "world",

  defaults: () => ({ explore: null }), // 自动探索中：{ map: 地图序号 }

  // 每 10 秒：自动探索打一场
  tick() {
    const s = this.s;
    if (!s.explore) return;
    if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) {
      s.explore = null;
      this.log("气血不足三成，自动探索已停止。", "bad");
      return;
    }
    this.fightMap(s.explore.map, true);
  },

  api: {
    setWorldTab(t) { this.worldTab = t; this.render(); },

    setWorld(id) { this.worldId = id; this.render(); },

    // 生成怪物：Lm 为怪物层序，k 为强度系数
    makeMonster(Lm, name, k = 0.8 + Math.random() * 0.2) {
      const f = k * Math.pow(DATA.GROW, Lm), B = DATA.playerBase, F = DATA.playerFixed;
      return { name, Lm, hp: B.hp * f, atk: B.atk * f, def: B.def * f, speed: F.speed, dodge: F.dodge, crit: F.crit };
    },

    // 通用战斗：速度高者先手，判闪避、暴击。返回 { win, rounds }，并更新玩家气血
    battle(m) {
      const st = this.stats(), s = this.s;
      const spells = s.spellSlots.slice(0, this.slotCount()).map(id => DATA.spellInfo(id, s.gongfa[id])).filter(Boolean);
      let si = 0;
      // 玩家出手：按顺序施放法术，法力不足则普通攻击
      const myHit = () => {
        for (let k = 0; k < spells.length; k++) {
          const sp = spells[(si + k) % spells.length];
          if (s.mana >= sp.mana) {
            si = (si + k + 1) % spells.length; s.mana -= sp.mana;
            if (Math.random() * 100 < m.dodge) return 0;
            let d = Math.max(st.atk * 0.1, st.atk * sp.pct / 100 + sp.flat - m.def * 0.5) * (0.9 + Math.random() * 0.2);
            if (Math.random() * 100 < st.crit) d *= 2;
            return d;
          }
        }
        return hit(st, m);
      };
      const hit = (A, D) => {
        if (Math.random() * 100 < D.dodge) return 0;                              // 闪避
        let d = Math.max(A.atk * 0.1, A.atk - D.def * 0.5) * (0.9 + Math.random() * 0.2);
        if (Math.random() * 100 < A.crit) d *= 2;                                  // 暴击
        return d;
      };
      let php = this.s.hp, mhp = m.hp, rounds = 0;
      const meFirst = st.speed >= m.speed;
      while (php > 0 && mhp > 0 && rounds < 60) {
        rounds++;
        if (meFirst) { mhp -= myHit(); if (mhp > 0) php -= hit(m, st); }
        else { php -= hit(m, st); if (php > 0) mhp -= myHit(); }
      }
      const win = mhp <= 0 && php > 0;
      this.s.hp = Math.max(1, php);
      return { win, lose: php <= 0, rounds };
    },

    // 历练：a 为地图序号（= 大境界序号）
    // auto 为 true 时是自动探索（不刷新界面）
    fightMap(a, auto) {
      const s = this.s, st = this.stats(), maxL = DATA.realms.length * DATA.LAYERS - 1;
      if (this.r() < a) return;
      if (s.hp < st.hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻（每 10 秒恢复 1%）。", "sys");
      const map = DATA.maps[a], Lm = Math.min(maxL, a * 10 + U.rand(0, 9));
      const m = this.makeMonster(Lm, U.pick(map.monsters));
      const res = this.battle(m), tag = `${m.name}（${this.realmName(Lm)}）`;
      if (res.win) {
        s.kills++;
        const stone = Math.floor(DATA.STONE_BASE * Math.pow(DATA.STONE_GROW, Lm) * (1 + Math.random() * 1.5));
        s.stone += stone;
        const got = [];
        if (Math.random() < DATA.DROP_PILL) {
          const t = ["juqi", "juling", "peiyuan"][U.weighted([60, 30, 10])];
          if (this.addPill(t, a)) got.push(`${DATA.realms[a]}·${DATA.pills[t].name}`);
        }
        if (Math.random() < DATA.HERB_CHANCE) { const n = U.pick(map.herbs); if (this.addMat("herb", n, a)) got.push(n); }
        if (Math.random() < DATA.ORE_CHANCE) { const n = U.pick(map.ores); if (this.addMat("ore", n, a)) got.push(n); }
        if (Math.random() < DATA.DROP_EQUIP) {
          const e = this.makeEquip(U.pick(Object.keys(DATA.slots)), a, U.weighted(DATA.EQUIP_QUAL_WEIGHT));
          if (this.addEquip(e)) got.push(`<span class="q${e.q}">${DATA.quals[e.q]}${e.name}</span>`);
        }
        this.log(`${res.rounds}回合击败${tag}，灵石 +${U.fmt(stone)}${got.length ? "，获得 " + got.join("、") : ""}`, "gold");
      } else if (res.lose) {
        const lost = Math.floor(s.stone * 0.1);
        s.stone -= lost;
        this.log(`不敌${tag}，重伤逃回，遗失灵石 ${U.fmt(lost)}。`, "bad");
      } else this.log(`与${tag}缠斗 ${res.rounds} 回合未分胜负，各自退去。`, "sys");
      if (auto) this.dirty(); else this.after();
    },

    // 开始 / 停止自动探索
    toggleExplore(a) {
      const s = this.s;
      if (s.explore && s.explore.map === a) { s.explore = null; this.log("停止自动探索。", "sys"); return this.after(); }
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，无法探索。", "sys");
      s.explore = { map: a };
      this.log(`开始在${DATA.maps[a].name}自动探索（探索期间无法修炼）。`, "sys");
      this.after();
    },

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
        <div class="row small"><span>法力 ${U.fmt(s.mana)} / ${U.fmt(st.mana)}</span><span>${s.explore ? `<b class="q4">探索中：${DATA.maps[s.explore.map].name}</b>` : "未探索"}</span></div>
        <div class="card"><h3>凡界<small>探索时无法修炼，气血低于三成自动停止</small></h3>` +
        DATA.maps.map((map, a) => {
          const lock = this.r() < a, on = s.explore && s.explore.map === a;
          return `<div class="line"><div>${map.name}<small>${DATA.realms[a]}期妖兽 · ${map.herbs.join("、")}、${map.ores.join("、")}</small></div>
            ${lock ? `<button class="sm" disabled>需${DATA.realms[a]}期</button>` : `<div><button class="sm" onclick="G.fightMap(${a})">历练</button>
            <button class="sm ${on ? "on" : ""}" onclick="G.toggleExplore(${a})">${on ? "停止" : "自动探索"}</button></div>`}</div>`;
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
