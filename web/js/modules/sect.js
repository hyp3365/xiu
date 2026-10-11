/* =====================================================================
 * 模块：门派
 * ---------------------------------------------------------------------
 * 未入门：按 1~10 星浏览 120 个门派，境界够了即可拜入。
 * 入门后有九个去处：
 *   宗门大殿  晋升职务（外门弟子 → 宗主），每天领取职务俸禄（灵石）
 *   功法殿    用贡献学习本门功法、法术（天地玄黄四阶；学会为第 1 层，之后去“功法”页修炼）
 *   事务堂    每个职务一个任务；点任务后循环自动执行（离线也会进行）
 *   练功房    修炼时消耗贡献，增加修炼速度
 *   宗门宝库  用贡献兑换：杂物（一阶炼丹炉、一阶炼器炉、灵石）/ 凡界全部药材矿石（可输入数量）/ 灵药种子 / 炉子图纸
 *             种子、图纸只能兑换不高于门派星级的（一星 = 一阶）；炉子、图纸兑换后放进背包
 *   炼丹房    学习丹方（贡献 + 时间），学会后在洞府炼丹房炼制（见 craft.js）
 *   炼器室    学习炼器（暂未开放）
 *   试炼塔    100 层，逐层挑战，首次通关得贡献
 *   宗门秘境  消耗贡献进入探索，随机奖励
 * 数值都在 js/config/ 下的数值文件 的 sect。
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
    affair: { task: -1, start: 0, count: 0 },     // 事务堂：正在循环执行的任务（-1 = 无）
    tower: 0,         // 试炼塔已通关层数
  }),

  // 每 10 秒：事务堂任务到时间就结算一次，并自动开始下一次（离线也会补算）
  tick() {
    const s = this.s, a = s.affair;
    if (!s.sect || !a || a.task === undefined || a.task < 0) return;
    const t = DATA.affairs[a.task]; if (!t) { a.task = -1; return; }
    const T = t.time * 60000, now = this.now();
    let guard = 0;
    while (now >= a.start + T && guard++ < 1e5) { a.start += T; a.count++; this.affairReward(a.task); }
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
      Object.assign(this.s, { sect: id, contrib: 0, rank: 0, room: -1, tower: 0, affair: { task: -1, start: 0, count: 0 } });
      this.sectTab = "hall";
      this.log(`你拜入${x.name}（${x.star}星），成为外门弟子。`, "gold"); this.after();
    },
    leaveSect() {
      if (!confirm("叛出门派将清空贡献和职务（已学功法保留），确定？")) return;
      this.log(`你离开了${this.sectInfo().name}。`, "bad");
      this.s.sect = null; this.s.room = -1; this.s.affair = { task: -1, start: 0, count: 0 }; this.s.contrib = 0; this.s.rank = 0; this.after();
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
    setLibEl(e) { this.libEl = e; this.render(); },
    learnGongfa(id) {
      const g = DATA.skillInfo(id);
      if (this.hasGongfa(id) || this.s.contrib < g.cost) return;
      this.s.contrib -= g.cost; this.s.gongfa[id] = 1;
      if (g.kind === "sp") this.autoSlotSpell(id); // 法术栏有空位就自动放入（见 bag.js）
      this.log(`习得《${g.name}》（${g.tier.name}）第 1 层，可在功法栏修炼提升。`, "gold"); this.after();
    },

    /* ---------- 事务堂 ---------- */
    affairContrib(i) { const t = DATA.affairs[i]; return Math.floor(t.contrib * (CFG.sect.affair.CONTRIB_STAR ? this.sectInfo().star : 1)); },
    affairStone(i) { return Math.floor(DATA.affairs[i].stone * Math.pow(DATA.STONE_GROW, this.s.L)); },
    affairReward(i) {
      const c = this.affairContrib(i), st = this.affairStone(i);
      this.s.contrib += c; this.s.stone += st;
      this.log(`完成「${DATA.affairs[i].name}」，贡献 +${U.fmt(c)}，灵石 +${U.fmt(st)}。`, "good");
    },
    // 点任务：开始循环执行；再点一次停止（停止时本次进度作废）
    startAffair(i) {
      const a = this.s.affair;
      if (a.task === i) { a.task = -1; this.log("停止执行事务。", "sys"); return this.after(); }
      if (DATA.affairs[i].rank > this.s.rank) return this.log(`需要职务【${DATA.ranks[DATA.affairs[i].rank].name}】。`, "sys");
      Object.assign(a, { task: i, start: this.now(), count: 0 });
      this.log(`开始执行「${DATA.affairs[i].name}」，完成后自动继续。`, "good"); this.after();
    },

    /* ---------- 练功房 ---------- */
    enterRoom(i) { this.s.room = this.s.room === i ? -1 : i; this.after(); },

    /* ---------- 宗门宝库 ---------- */
    treasuryCost(it) { return it.cost; },
    // 杂物页货单：content/items.js 的 ITEMS.treasury（没写就用 config/sect.js 的 treasury）
    treasuryList() { return ITEMS.treasury || DATA.treasury; },
    treasuryName(it) {
      if (it.item) return it.item;
      if (it.kind === "furnace") return DATA.furnaceName(it.fk, it.g);
      if (it.kind === "pill") return `${DATA.realms[this.r()]}·${DATA.pills[it.type].name}`;
      return it.name || "灵石";
    },
    exchange(i) {
      const it = this.treasuryList()[i], c = this.treasuryCost(it);
      if (!it || this.s.contrib < c || (it.star || 1) > this.sectInfo().star) return;
      if (it.item) { if (!this.addCustom(it.item)) return; }
      else if (it.kind === "furnace") { if (!this.addFurnaceItem(it.fk, it.g)) return; }
      else if (it.kind === "pill") { if (!this.addPill(it.type, this.r())) return; }
      else this.s.stone += Math.floor(it.n * Math.pow(DATA.STONE_GROW, this.s.L));
      this.s.contrib -= c;
      this.log("兑换成功。", "good"); this.after();
    },
    setTreasuryTab(t) { this.treasuryTab = t; this.render(); },
    treasuryMaxG() { return this.sectInfo().star - 1; }, // 可兑换的最高 品/阶 序号
    // 兑换材料（药材、矿石，凡界全部可换）；n 不填就用输入框里的数量
    exchangeMat(kind, g, n) {
      n = Math.floor(n || +($("#tr-n") && $("#tr-n").value) || 1);
      if (n <= 0) return;
      const c = DATA.matContrib(kind, g) * n;
      if (this.s.contrib < c) return this.log(`贡献不足，需要 ${U.fmt(c)}。`, "sys");
      if (!this.addMat(kind, DATA.matName(kind, g), g, n)) return;
      this.s.contrib -= c; this.trN = n;
      this.log(`兑换${DATA.matFull(kind, g)} ×${U.fmt(n)}，贡献 -${U.fmt(c)}。`, "good"); this.after();
    },
    // 兑换种子（每种一次，永久可种）
    exchangeSeed(g) {
      const c = DATA.seedCost(g);
      if (g > this.treasuryMaxG() || this.s.seeds.includes(g) || this.s.contrib < c) return;
      this.s.contrib -= c; this.s.seeds.push(g);
      this.log(`获得${DATA.herbs[g]}种子，可在洞府灵药园种植。`, "gold"); this.after();
    },
    // 兑换图纸：放进背包，点「学习」才能炼制
    exchangeBlueprint(kind, g) {
      const c = DATA.blueprintCost(kind, g), bp = this.s.blueprints[kind];
      if (g > this.treasuryMaxG() || bp.includes(g) || this.s.contrib < c) return;
      if (this.s.bag.some(it => it.t === "bp" && it.kind === kind && it.g === g)) return this.log("背包里已有这张图纸。", "sys");
      if (!this.addBlueprintItem(kind, g)) return;
      this.s.contrib -= c;
      this.log(`获得${DATA.furnaceName(kind, g)}图纸，已放进背包（点击「学习」）。`, "gold"); this.after();
    },

    /* ---------- 试炼塔 ---------- */
    // 试炼塔守关者属性（js/config/ 数值文件 的 sect.tower 单独设置）
    makeTowerGuard(floor) {
      const T = CFG.sect.tower, Lm = this.towerLevel(floor), f = Math.pow(T.GROW, Lm), b = T.base;
      return this.addMagic({ name: `第${floor}层守关者`, Lm, boss: false, crit: b.crit,
        hp: b.hp * f, atk: b.atk * f, def: b.def * f, speed: b.speed * f, hit: b.hit * f, dodge: b.dodge * f }, "tower");
    },
    towerLevel(floor) { return Math.min(DATA.realms.length * DATA.LAYERS - 1, this.sectInfo().reqRealm * DATA.LAYERS + floor * DATA.TOWER_STEP); },
    challengeTower() {
      const f = this.s.tower + 1; if (f > DATA.TOWER_MAX) return;
      const st = this.stats();
      if (this.s.hp < st.hp * CFG.battle.TOWER_HP_MIN) return this.log("气血不足三成，先休养片刻。", "sys");
      const Lm = this.towerLevel(f), m = this.makeTowerGuard(f);
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
      const roll = Math.random(), g = this.r(), SC = CFG.sect.secret;
      if (roll < SC.stone.chance) {
        const n = Math.floor(DATA.STONE_BASE * SC.stone.mult * Math.pow(DATA.STONE_GROW, this.s.L) * (1 + Math.random()));
        this.s.stone += n; this.log(`秘境中寻得一处灵石矿脉，灵石 +${U.fmt(n)}。`, "gold");
      } else if (roll < SC.stone.chance + SC.pill.chance) {
        const t = U.pick(Object.keys(DATA.pills)), n = U.rand(SC.pill.n[0], SC.pill.n[1]);
        this.addPill(t, g, n); this.log(`秘境中发现前人遗留的${DATA.pills[t].name} ×${n}。`, "gold");
      } else if (roll < SC.stone.chance + SC.pill.chance + SC.equip.chance) {
        const e = this.makeEquip(U.pick(Object.keys(DATA.slots)), g, U.rand(SC.equip.q[0], SC.equip.q[1]));
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
      const stars = Array.from({ length: DATA.SECT_STARS }, (_, i) => `<button class="${star === i + 1 ? "active" : ""}" onclick="G.setSectStar(${i + 1})">${i + 1}★</button>`).join("");
      return `<div class="room-grid five">${stars}</div><div class="card"><h3>${star} 星门派<small>需${DATA.realms[DATA.sectReq(star)]}期</small></h3>` +
        DATA.sects.filter(x => x.star === star).map(x => {
          const lock = this.r() < x.reqRealm;
          return `<div class="line"><div>${x.name}<span class="tag">${DATA.elById[x.el].name}</span><small>${DATA.elById[x.el].name}属性功法、法术 · 可学本星级全部门派功法</small></div>
            <button class="sm" onclick="G.joinSect('${x.id}')" ${lock ? "disabled" : ""}>${lock ? "境界不足" : "拜入"}</button></div>`;
        }).join("") + `</div>`;
    }

    // ---------- 已入门 ----------
    const x = this.sectInfo(), tab = this.sectTab || "hall";
    const TABS = [["hall", "宗门大殿"], ["lib", "功法殿"], ["affair", "事务堂"], ["room", "练功房"], ["treasury", "宗门宝库"],
                  ["alchemy", "炼丹房"], ["forge", "炼器室"], ["wudao", "悟道室"], ["tower", "试炼塔"], ["secret", "宗门秘境"]];
    let h = `<div class="card"><h3>${x.name} <span class="tag">${x.star}星</span><span class="tag">${DATA.elById[x.el].name}</span><small>${DATA.ranks[s.rank].name} · 贡献 ${U.fmt(s.contrib)}</small></h3></div>
      <div class="room-grid">${TABS.map(([k, n]) => `<button class="${tab === k ? "active" : ""}" onclick="G.setSectTab('${k}')">${n}</button>`).join("")}</div>`;

    if (tab === "hall") {
      const next = s.rank + 1 < DATA.ranks.length ? s.rank + 1 : -1, got = s.salaryDay === this.today();
      h += `<div class="card"><h3>宗门大殿<small>当前：${DATA.ranks[s.rank].name}</small></h3>
        <div class="line"><div>每日俸禄<small>${U.fmt(this.salary())} 灵石</small></div>
        <button class="sm" onclick="G.claimSalary()" ${got ? "disabled" : ""}>${got ? "今日已领" : "领取"}</button></div>
        ${next < 0 ? `<p class="desc">你已是一宗之主。</p>` : `<div class="line"><div>晋升【${DATA.ranks[next].name}】
          <small>需${DATA.realms[this.rankReqRealm(next)]}期 · ${U.fmt(this.rankCost(next))} 贡献</small></div>
          <button class="sm" onclick="G.promote()" ${this.r() < this.rankReqRealm(next) || s.contrib < this.rankCost(next) ? "disabled" : ""}>晋升</button></div>`}</div>
        <div class="card"><h3>职务一览</h3>${DATA.ranks.map((r, i) => `<div class="line"><div>${r.name}<small>俸禄 ${U.fmt(r.daily)} × 星级 · 晋升 ${U.fmt(r.cost)} × 星级</small></div>${i === s.rank ? "<b>当前</b>" : i < s.rank ? "<small>已历</small>" : ""}</div>`).join("")}</div>
        <div class="btns"><button onclick="G.leaveSect()">叛出门派</button></div>`;
    } else if (tab === "lib") {
      // 功法殿：本星级全部门派的功法、法术；按 阶 和 属性 筛选
      const tier = this.libTier || "huang", el = this.libEl || x.el;
      const btn = g => { const has = this.hasGongfa(g.id);
        return `<button class="sm" onclick="G.learnGongfa('${g.id}')" ${has || s.contrib < g.cost ? "disabled" : ""}>${has ? "已学会" : "学习"}</button>`; };
      const sects = DATA.sects.filter(o => o.star === x.star && (el === "all" || o.el === el));
      h += `<div class="room-grid">${DATA.tiers.map(t => `<button class="${tier === t.id ? "active" : ""}" onclick="G.setLibTier('${t.id}')">${t.name}</button>`).join("")}</div>
        <div class="room-grid">${[["all", "全部"], ...DATA.elements.map(e => [e.id, e.name])].map(([k, n]) =>
          `<button class="${el === k ? "active" : ""}" onclick="G.setLibEl('${k}')">${n}</button>`).join("")}</div>` +
        sects.map(o => `<div class="card"><h3>${o.name}<span class="tag">${DATA.elById[o.el].name}</span><small>${DATA.tierById[tier].name}</small></h3>` +
          DATA.gongfaTypes.map(t => {
            const g = DATA.gongfaInfo(DATA.gongfaId(o.id, t.id, tier));
            return `<div class="line"><div>《${g.name}》<span class="tag">${t.name}</span><small>每层${g.label} +${this.gfValue(g, g.perLv)} · ${U.fmt(g.cost)} 贡献</small></div>${btn(g)}</div>`;
          }).join("") + (() => {
            const g = DATA.spellInfo(DATA.spellId(o.id, o.el, tier));
            return `<div class="line"><div>《${g.name}》<span class="tag">法术</span><small>攻击×${g.pct}% + ${U.fmt(g.perLv)}/层 · 耗法力 ${U.fmt(g.mana)} · ${U.fmt(g.cost)} 贡献</small></div>${btn(g)}</div>`;
          })() + `</div>`).join("");
    } else if (tab === "affair") {
      const a = s.affair, cur = a.task >= 0 ? DATA.affairs[a.task] : null;
      h += `<div class="card"><h3>事务堂<small>点任务开始，完成后自动继续，离线也进行</small></h3>` +
        (cur ? (() => { const T = cur.time * 60000, p = Math.min(100, (Date.now() - a.start) / T * 100);
          return `<div class="row small"><span>执行中：${cur.name}（已完成 ${a.count} 次）</span><span>${U.dur(Math.max(0, a.start + T - Date.now()) / 1000)}</span></div>
            <div class="bar tick"><div style="width:${p}%"></div></div>`; })() : `<p class="desc">当前没有执行任务。</p>`) +
        DATA.affairs.map((t, i) => { const lock = t.rank > s.rank, on = a.task === i;
          return `<div class="line"><div>${t.name}<span class="tag">${DATA.ranks[t.rank].name}</span><small>每次 ${U.dur(t.time * 60)} · 贡献 +${U.fmt(this.affairContrib(i))} · 灵石 +${U.fmt(this.affairStone(i))}</small></div>
            <button class="sm ${on ? "on" : ""}" onclick="G.startAffair(${i})" ${lock ? "disabled" : ""}>${lock ? "职务不足" : on ? "停止" : "执行"}</button></div>`; }).join("") + `</div>`;
    } else if (tab === "room") {
      h += `<div class="card"><h3>练功房<small>修炼时每次消耗贡献</small></h3>` + DATA.rooms.map((r, i) => {
        const on = s.room === i;
        return `<div class="line"><div>${r.name}<span class="tag">+${this.roomPct(i)}%</span><small>每次修炼消耗 ${this.roomCost(i)} 贡献</small></div>
          <button class="sm ${on ? "on" : ""}" onclick="G.enterRoom(${i})">${on ? "使用中" : "进入"}</button></div>`;
      }).join("") + `</div>`;
    } else if (tab === "treasury") {
      const tt = this.treasuryTab || "pill", maxG = this.treasuryMaxG();
      h += `<div class="sub-tabs">${[["pill", "杂物"], ["herb", "药材"], ["ore", "矿石"], ["seed", "种子"], ["bp", "图纸"]].map(([k, n]) =>
        `<button class="${tt === k ? "active" : ""}" onclick="G.setTreasuryTab('${k}')">${n}</button>`).join("")}</div>`;
      if (tt === "pill") {
        h += `<div class="card"><h3>杂物<small>以贡献兑换 · 炉子放进背包后点「使用」</small></h3>` + this.treasuryList().map((it, i) => {
          if (!it || (it.item && !this.cuDef(it.item))) return "";
          const c = this.treasuryCost(it), lock = (it.star || 1) > x.star, cd = it.item ? this.cuDef(it.item) : null;
          const desc = it.kind === "furnace" ? `${it.fk === "dan" ? "炼丹" : "炼器"}时间 -${DATA.furnaceBonus(it.fk, it.g)}% · `
            : cd ? `${DATA.cuTypes[cd.type] || ""}${cd.desc ? " · " + cd.desc : ""}${["perm", "equip", "fabao"].includes(cd.type) ? " · " + this.cuStatText(this.cuStats(cd)) : ""} · ` : "";
          return `<div class="line"><div>${cd ? `<span class="q${cd.q || 0}">${this.treasuryName(it)}</span>` : this.treasuryName(it)}<small>${desc}${U.fmt(c)} 贡献</small></div>
            <button class="sm" onclick="G.exchange(${i})" ${lock || s.contrib < c ? "disabled" : ""}>${lock ? `需${it.star}星` : "兑换"}</button></div>`;
        }).join("") + `</div>`;
      } else if (tt === "seed") {
        h += `<div class="card"><h3>灵药种子<small>${x.star}星门派可换前 ${Math.min(maxG + 1, DATA.herbs.length)} 种 · 每种兑换一次</small></h3>` + DATA.herbs.map((n, g) => { const c = DATA.seedCost(g), has = s.seeds.includes(g), lock = g > maxG;
          return `<div class="line"><div>${n}种子<small>${U.fmt(c)} 贡献 · ${U.dur(DATA.growTime(g) / 1000)}成熟</small></div>
            <button class="sm" onclick="G.exchangeSeed(${g})" ${has || lock || s.contrib < c ? "disabled" : ""}>${has ? "已拥有" : lock ? `需${g + 1}星` : "兑换"}</button></div>`; }).join("") + `</div>`;
      } else if (tt === "bp") {
        h += ["dan", "qi"].map(k => `<div class="card"><h3>${DATA.furnaces[k].name}图纸<small>${x.star}星门派可换 一阶~${DATA.JIE[maxG]} · 放进背包后点「学习」</small></h3>` + DATA.JIE.map((jn, g) => {
          const c = DATA.blueprintCost(k, g), has = s.blueprints[k].includes(g) || s.bag.some(it => it.t === "bp" && it.kind === k && it.g === g), lock = g > maxG;
          return `<div class="line"><div>${DATA.furnaceName(k, g)}图纸<small>${U.fmt(c)} 贡献</small></div>
            <button class="sm" onclick="G.exchangeBlueprint('${k}',${g})" ${has || lock || s.contrib < c ? "disabled" : ""}>${has ? (s.blueprints[k].includes(g) ? "已学会" : "在背包") : lock ? `需${g + 1}星` : "兑换"}</button></div>`; }).join("") + `</div>`).join("");
      } else {
        const names = tt === "herb" ? DATA.herbs : DATA.ores;
        h += `<div class="card"><h3>${DATA.matKinds[tt]}<small>凡界全部可换 · 贡献 ${U.fmt(s.contrib)}</small></h3>
          <div class="line"><div>兑换数量</div><input id="tr-n" type="number" min="1" value="${this.trN || 1}" oninput="G.trN=+this.value" style="width:110px"></div>` +
          names.map((n, g) => { const c = DATA.matContrib(tt, g);
          return `<div class="line"><div>${DATA.matFull(tt, g)}<small>${U.fmt(c)} 贡献/个 · 已有 ${U.fmt(this.countMat(tt, g))}</small></div>
            <button class="sm" onclick="G.exchangeMat('${tt}',${g})" ${s.contrib < c ? "disabled" : ""}>兑换</button></div>`; }).join("") + `</div>`;
      }
    } else if (tab === "alchemy") {
      h += this.sectAlchemyView(); // 见 craft.js
    } else if (tab === "wudao") {
      h += this.sectWudaoView();   // 见 wudao.js
    } else if (tab === "forge") {
      h += `<div class="card"><h3>炼器室 · 器谱</h3><p class="desc">长老闭关中，暂未开放传授。</p></div>`;
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
