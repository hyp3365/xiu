/* =====================================================================
 * 模块：世界（地图历练、坊市、设置）
 * ---------------------------------------------------------------------
 * 历练：选择地图，自动战斗一场。速度高者先手，闪避/暴击生效。
 *   胜利：灵石 + 概率掉落该境界的丹药/装备
 *   失败：气血归 1，遗失 10% 灵石
 * 坊市：出售当前境界品质的丹药和灵品装备。
 * ===================================================================== */
G.module({
  id: "world",
  tab: "world",

  api: {
    setWorldTab(t) { this.worldTab = t; this.render(); },

    // 历练：a 为地图序号（= 大境界序号）
    fightMap(a) {
      const s = this.s, st = this.stats(), maxL = DATA.realms.length * DATA.LAYERS - 1;
      if (this.r() < a) return;
      if (s.hp < st.hp * 0.3) return this.log("气血不足三成，先休养片刻（每 10 秒恢复 1%）。", "sys");
      const map = DATA.maps[a];
      const Lm = Math.min(maxL, a * 10 + U.rand(0, 9)), f = (0.8 + Math.random() * 0.2) * Math.pow(DATA.GROW, Lm), B = DATA.playerBase, F = DATA.playerFixed;
      const m = { name: U.pick(map.monsters), hp: B.hp * f, atk: B.atk * f, def: B.def * f, speed: F.speed, dodge: F.dodge, crit: F.crit };

      // 一次攻击：先判闪避，再算伤害，再判暴击
      const hit = (A, D) => {
        if (Math.random() * 100 < D.dodge) return 0;
        let d = Math.max(A.atk * 0.1, A.atk - D.def * 0.5) * (0.9 + Math.random() * 0.2);
        if (Math.random() * 100 < A.crit) d *= 2;
        return d;
      };
      let php = s.hp, mhp = m.hp, rounds = 0;
      const meFirst = st.speed >= m.speed;
      while (php > 0 && mhp > 0 && rounds < 60) {
        rounds++;
        if (meFirst) { mhp -= hit(st, m); if (mhp > 0) php -= hit(m, st); }
        else { php -= hit(m, st); if (php > 0) mhp -= hit(st, m); }
      }

      const tag = `${m.name}（${this.realmName(Lm)}）`;
      if (mhp <= 0 && php > 0) {
        s.hp = php; s.kills++;
        const stone = Math.floor(DATA.STONE_BASE * Math.pow(DATA.STONE_GROW, Lm) * (1 + Math.random() * 1.5));
        s.stone += stone;
        const got = [];
        if (Math.random() < DATA.DROP_PILL) {
          const t = ["juqi", "juling", "peiyuan"][U.weighted([60, 30, 10])];
          if (this.addPill(t, a)) got.push(`${DATA.realms[a]}·${DATA.pills[t].name}`);
        }
        if (Math.random() < DATA.DROP_EQUIP) {
          const e = this.makeEquip(U.pick(Object.keys(DATA.slots)), a, U.weighted(DATA.EQUIP_QUAL_WEIGHT));
          if (this.addEquip(e)) got.push(`<span class="q${e.q}">${DATA.quals[e.q]}${e.name}</span>`);
        }
        this.log(`${rounds}回合击败${tag}，灵石 +${U.fmt(stone)}${got.length ? "，获得 " + got.join("、") : ""}`, "gold");
      } else if (php <= 0) {
        const lost = Math.floor(s.stone * 0.1);
        s.stone -= lost; s.hp = 1;
        this.log(`不敌${tag}，重伤逃回，遗失灵石 ${U.fmt(lost)}。`, "bad");
      } else {
        s.hp = php;
        this.log(`与${tag}缠斗 ${rounds} 回合未分胜负，各自退去。`, "sys");
      }
      this.after();
    },

    // 坊市货单（当前境界品质）
    shopList() {
      const g = this.r(), list = [];
      for (const t in DATA.pills) list.push({ kind: "pill", type: t, g, price: DATA.pillPrice(t, g) });
      for (const sl in DATA.slots) list.push({ kind: "eq", slot: sl, g, q: 1, price: Math.floor(500 * Math.pow(DATA.STONE_GROW, g * 10)) });
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
    const s = this.s, wt = this.worldTab || "explore";
    const tabs = `<div class="sub-tabs">
      <button class="${wt === "explore" ? "active" : ""}" onclick="G.setWorldTab('explore')">历练</button>
      <button class="${wt === "shop" ? "active" : ""}" onclick="G.setWorldTab('shop')">坊市</button>
      <button class="${wt === "set" ? "active" : ""}" onclick="G.setWorldTab('set')">设置</button></div>`;

    if (wt === "explore") {
      const st = this.stats();
      return tabs + `<div class="row small"><span>气血 ${U.fmt(s.hp)} / ${U.fmt(st.hp)}</span><span>斩妖 ${s.kills}</span></div>
        <div class="bar hp"><div style="width:${s.hp / st.hp * 100}%"></div></div><div class="card">` +
        DATA.maps.map((map, a) => {
          if (a > this.r() + 1) return "";
          const lock = this.r() < a;
          return `<div class="line"><div>${map.name}<small>${DATA.realms[a]}期妖兽 · 掉落${DATA.realms[a]}期丹药与装备</small></div>
            <button class="sm" onclick="G.fightMap(${a})" ${lock ? "disabled" : ""}>${lock ? "需" + DATA.realms[a] + "期" : "历练"}</button></div>`;
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
