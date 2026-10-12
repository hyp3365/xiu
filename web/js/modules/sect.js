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
    room: -1,         // 正在使用的修炼室（原练功房），-1 为未使用
    gfRoom: -1,       // v27：宗门练功房（加快功法修炼）
    shopRoom: -1,     // v27：坊市修炼室
    shopGfRoom: -1,   // v27：坊市练功房
    merit: 0,         // v27：功德
    salaryDay: "",    // 上次领取俸禄的日期
    affair: { task: -1, start: 0, count: 0 },     // 事务堂：正在循环执行的任务（-1 = 无）
    tower: 0,         // 试炼塔已通关层数（当前门派星级，和 towers 同步，旧字段）
    towers: {},       // v25：各星级试炼塔已通关层数 { 星级: 层数 }
    rankPass: -1,     // 已通过考验、可以晋升的职务序号（-1 = 没有）
    freeCult: { day: "", used: 0, left: 0, on: false },   // 免费修炼室：今天用了几次、本次剩余修炼次数
    freeGf: { day: "", used: 0, end: 0 },                 // 免费练功房：今天用了几次、本次结束时间
    cqLv: 0,          // 元婴出窍秘法层数
    cqStudy: null,    // 元婴出窍秘法修炼中 { end, total }
    cqDay: "", cqUsed: 0,   // 元婴出窍：今天已用次数
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
    // 星级倍率、职务倍率（config/sect.js 的 STAR_MULT / RANK_MULT）
    starMul() { const v = (CFG.sect.STAR_MULT || [])[this.sectInfo().star - 1]; return v === undefined ? this.sectInfo().star : v; },
    rankMul(i = this.s.rank) { const v = (CFG.sect.RANK_MULT || [])[i]; return v === undefined ? 1 : v; },
    roomPct(i) { return DATA.rooms[i].pct * this.starMul(); },
    roomCost(i) { return Math.floor(DATA.rooms[i].cost * this.starMul()); },
    roomLocked(i) { return (DATA.rooms[i].rank || 0) > this.s.rank; },
    gfRoomPct(i) { return DATA.gfRooms[i].pct * this.starMul(); },
    gfRoomCost(i) { return Math.floor(DATA.gfRooms[i].cost * this.starMul()); },
    gfRoomLocked(i) { return (DATA.gfRooms[i].rank || 0) > this.s.rank; },
    // 当前练功房（宗门或坊市）：{ name, pct, cost, cur: "contrib"|"stone" } 或 null
    gfRoomNow() {
      const s = this.s;
      if (this.freeGfOn()) return { name: CFG.sect.freeGfRoom.name, pct: this.freeGfPct(), cost: 0, cur: "contrib", free: true };
      if (s.gfRoom >= 0 && s.sect && DATA.gfRooms[s.gfRoom]) return { name: DATA.gfRooms[s.gfRoom].name, pct: this.gfRoomPct(s.gfRoom), cost: this.gfRoomCost(s.gfRoom), cur: "contrib" };
      const r = DATA.shopRooms.gf[s.shopGfRoom];
      return s.shopGfRoom >= 0 && r ? { name: r.name, pct: r.pct, cost: r.cost, cur: "stone" } : null;
    },
    leaveGfRoom(why) { const r = this.gfRoomNow(); this.s.gfRoom = -1; this.s.shopGfRoom = -1; if (r && why) this.log(`${why}，已离开${r.name}。`, "bad"); this.dirty(); },
    setSectStar(n) { this.sectStar = n; this.render(); },
    setSectTab(t) { this.sectTab = t; this.render(); },

    /* ---------- 入门 / 叛出 ---------- */
    joinSect(id) {
      const x = DATA.sectById[id];
      if (!this.realmOK(x.reqRealm)) return;
      this.fixTower();
      Object.assign(this.s, { sect: id, contrib: 0, rank: 0, room: -1, rankPass: -1, tower: this.s.towers[x.star] || 0, affair: { task: -1, start: 0, count: 0 } });
      this.sectTab = "hall";
      this.log(`你拜入${x.name}（${x.star}星），成为外门弟子。`, "gold"); this.after();
    },
    leaveSect() {
      if (!confirm("叛出门派将清空贡献和职务（已学功法保留），确定？")) return;
      this.log(`你离开了${this.sectInfo().name}。`, "bad");
      this.s.sect = null; this.s.room = -1; this.s.affair = { task: -1, start: 0, count: 0 }; this.s.contrib = 0; this.s.rank = 0; this.s.rankPass = -1; this.after();
    },

    /* ---------- 宗门大殿 ---------- */
    rankReqRealm(i) { return Math.min(DATA.realms.length - 1, this.sectInfo().reqRealm + DATA.ranks[i].realm); }, // -1 = 凡人
    rankCost(i) { return Math.floor(DATA.ranks[i].cost * this.starMul()); },
    promote() {
      const i = this.s.rank + 1; if (i >= DATA.ranks.length) return;
      if (!this.realmOK(this.rankReqRealm(i)) || this.s.contrib < this.rankCost(i)) return;
      if (this.s.rankPass !== i) return this.log("需先通过晋升考验。", "sys");
      this.s.contrib -= this.rankCost(i); this.s.rank = i; this.s.rankPass = -1;
      this.log(`晋升为【${DATA.ranks[i].name}】！`, "gold"); this.after();
    },
    /* ---------- 晋升考验（config/sect.js 的 sect.rankTrial） ---------- */
    rankTrialCost(i) { return Math.floor(((CFG.sect.rankTrial.cost || [])[i] || 0) * this.starMul()); },
    makeRankGuard(i) {
      const T = CFG.sect.rankTrial, S = T.STAT || {}, B = DATA.playerBase;
      const L = Math.max(0, this.rankReqRealm(i)) * DATA.LAYERS, d = (T.DIFF || [])[i] === undefined ? 1 : T.DIFF[i], f = Math.pow(DATA.GROW, L) * d;
      const v = k => B[k] * f * (S[k] === undefined ? 1 : S[k]);
      return this.addMagic({ name: `${DATA.ranks[i].name}考官`, boss: false, crit: T.crit || 0,
        hp: v("hp"), atk: v("atk"), def: v("def"), speed: v("speed"), hit: v("hit"), dodge: v("dodge") }, "tower");
    },
    challengeRank() {
      const s = this.s, i = s.rank + 1; if (i >= DATA.ranks.length || s.rankPass === i) return;
      if (!this.realmOK(this.rankReqRealm(i))) return;
      const c = this.rankTrialCost(i);
      if (s.contrib < c) return this.log(`贡献不足，参加考验需要 ${U.fmt(c)}。`, "sys");
      if (s.hp < this.stats().hp * CFG.battle.TOWER_HP_MIN) return this.log("气血不足三成，先休养片刻。", "sys");
      s.contrib -= c;
      const res = this.battle(this.makeRankGuard(i));
      let txt;
      if (res.win) { s.rankPass = i; txt = `${res.rounds}回合击败${DATA.ranks[i].name}考官，通过晋升考验！`; this.log(txt, "gold"); }
      else { txt = `${DATA.ranks[i].name}晋升考验失败${res.lose ? "" : "（回合耗尽，各自退去）"}。`; this.log(txt, "bad"); }
      this.after();
      this.playBattle(res.detail, `晋升考验 · ${DATA.ranks[i].name}`, txt, res.win);   // 见 world.js
    },
    salary() { return Math.floor(DATA.ranks[this.s.rank].daily * this.starMul() * this.rankMul()); },
    today() { return new Date(this.now()).toDateString(); },
    bjDay() { return new Date(this.now() + 8 * 3600000).toISOString().slice(0, 10); },   // 北京时间日期：免费修炼室、免费练功房、出窍次数每天北京时间 0 点重置
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
      if (!g || g.src !== "sect" || this.hasGongfa(id) || this.s.contrib < g.cost) return;
      const need = DATA.tierRank(g.tier);
      if (this.s.rank < need) return this.log(`${g.tier.name}功法需要职务【${DATA.ranks[need].name}】以上。`, "sys");
      this.s.contrib -= g.cost; this.s.gongfa[id] = 1;
      if (g.kind === "sp") this.autoSlotSpell(id); // 法术栏有空位就自动放入（见 bag.js）
      this.log(`习得《${g.name}》（${g.tier.name}）第 1 层，可在功法栏修炼提升。`, "gold"); this.after();
    },

    /* ---------- 事务堂 ---------- */
    affairContrib(i) { return Math.floor(DATA.affairs[i].contrib * this.starMul() * this.rankMul()); },
    affairStone(i) { return Math.floor(DATA.affairs[i].stone * this.starMul() * this.rankMul()); },
    affairReward(i) {
      const c = this.affairContrib(i), st = this.affairStone(i);
      this.s.contrib += c; this.s.stone += st;
      if (this._off) { this._off.afN++; this._off.afStone += st; this._off.afContrib += c; } // 离线账本
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

    /* ---------- 免费修炼室 / 免费练功房（config/sect.js 的 freeRoom / freeGfRoom） ---------- */
    freeCultPct() { const p = CFG.sect.freeRoom.pct; return p ? p * this.starMul() : this.roomPct(0); },
    freeGfPct() { const p = CFG.sect.freeGfRoom.pct; return p ? p * this.starMul() : this.gfRoomPct(0); },
    freeCultOn() { const f = this.s.freeCult; return !!(this.s.sect && f && f.on && f.left > 0); },
    freeGfOn() { const f = this.s.freeGf; return !!(this.s.sect && f && this.now() < f.end); },
    freeUsed(f) { return f && f.day === this.bjDay() ? f.used || 0 : 0; },
    enterFreeRoom() {
      const s = this.s, C = CFG.sect.freeRoom;
      if (!s.freeCult) s.freeCult = { day: "", used: 0, left: 0, on: false };
      const f = s.freeCult;
      if (f.left > 0) { f.on = !f.on; return this.after(); }              // 本次还没用完：进入 / 离开
      if (this.freeUsed(f) >= C.daily) return this.log(`${C.name}今天已用过。`, "sys");
      Object.assign(f, { day: this.bjDay(), used: this.freeUsed(f) + 1, left: C.times, on: true });
      this.log(`进入${C.name}，可修炼 ${C.times} 次。`, "good"); this.after();
    },
    enterFreeGfRoom() {
      const s = this.s, C = CFG.sect.freeGfRoom;
      if (!s.freeGf) s.freeGf = { day: "", used: 0, end: 0 };
      const f = s.freeGf;
      if (this.freeGfOn()) return;
      if (this.freeUsed(f) >= C.daily) return this.log(`${C.name}今天已用过。`, "sys");
      Object.assign(f, { day: this.bjDay(), used: this.freeUsed(f) + 1, end: this.now() + C.minutes * 60000 });
      this.log(`进入${C.name}，持续 ${C.minutes} 分钟。`, "good"); this.after();
    },

    /* ---------- 练功房 ---------- */
    enterRoom(i) {
      if (this.s.room !== i && this.roomLocked(i)) return this.log(`需要职务【${DATA.ranks[DATA.rooms[i].rank].name}】。`, "sys");
      this.s.room = this.s.room === i ? -1 : i; if (this.s.room >= 0) this.s.shopRoom = -1; this.after();
    },
    enterGfRoom(i) {
      if (this.s.gfRoom !== i && this.gfRoomLocked(i)) return this.log(`需要职务【${DATA.ranks[DATA.gfRooms[i].rank].name}】。`, "sys");
      this.s.gfRoom = this.s.gfRoom === i ? -1 : i; if (this.s.gfRoom >= 0) this.s.shopGfRoom = -1; this.after();
    },
    // 坊市修炼室 / 练功房（灵石）
    enterShopRoom(i) { this.s.shopRoom = this.s.shopRoom === i ? -1 : i; if (this.s.shopRoom >= 0) this.s.room = -1; this.after(); },
    enterShopGfRoom(i) { this.s.shopGfRoom = this.s.shopGfRoom === i ? -1 : i; if (this.s.shopGfRoom >= 0) this.s.gfRoom = -1; this.after(); },
    shopRoomView(kind) {
      const s = this.s, cult = kind === "cult", list = DATA.shopRooms[kind] || [], cur = cult ? s.shopRoom : s.shopGfRoom;
      return `<div class="card"><h3>坊市${cult ? "修炼室" : "练功房"}<small>${cult ? "加快修炼 · 每次修炼消耗灵石" : "加快功法修炼 · 修炼功法时每 5 秒消耗灵石"} · 灵石 ${U.fmt(s.stone)}</small></h3>` +
        list.map((r, i) => { const on = cur === i;
          return `<div class="line"><div>${r.name}<span class="tag">+${U.num(r.pct)}%</span><small>${cult ? "每次修炼" : "每 5 秒"}消耗 ${U.fmt(r.cost)} 灵石</small></div>
            <button class="sm ${on ? "on" : ""}" onclick="G.${cult ? "enterShopRoom" : "enterShopGfRoom"}(${i})">${on ? "使用中" : "进入"}</button></div>`; }).join("") +
        `<p class="desc">和宗门的${cult ? "修炼室" : "练功房"}同时只能用一个。</p></div>`;
    },

    /* ---------- 宗门宝库 ---------- */
    treasuryCost(it) { return it.kind === "chuqiao" ? this.cqCost() : it.cost; },
    // 元婴出窍秘法（config/sect.js 的 CFG.chuqiao）
    cqCost() { return CFG.chuqiao.LEARN_CONTRIB; },
    cqMaxRuns() { return (this.s.cqLv || 0) * CFG.chuqiao.PER_LV; },
    // 今天还能出窍几次（开始出窍时就扣，停止不退）
    cqLeftToday() { const s = this.s; return Math.max(0, this.cqMaxRuns() - (s.cqDay === this.bjDay() ? s.cqUsed || 0 : 0)); },
    cqUse(n) { const s = this.s; if (s.cqDay !== this.bjDay()) { s.cqDay = this.bjDay(); s.cqUsed = 0; } s.cqUsed += n; },
    cqRefund(n) { const s = this.s; if (n > 0 && s.cqDay === this.bjDay()) s.cqUsed = Math.max(0, (s.cqUsed || 0) - n); },   // 跨天了就不用退（已经重置）
    // 第 lv 层 → lv+1 层的修炼消耗
    cqStudyCost(lv) {
      const C = CFG.chuqiao;
      return { exp: Math.floor(C.EXP), sec: Math.max(1, C.TIME), lu: Math.floor(C.LU_BASE + C.LU_ADD * Math.floor(lv / C.LU_EVERY)) };
    },
    studyCq() {
      const s = this.s, C = CFG.chuqiao, lv = s.cqLv || 0;
      if (!lv || lv >= C.MAX_LV || s.cqStudy) return;
      if (!this.realmOK(C.REALM)) return this.log(`修炼${C.NAME}需要${DATA.realmLabel(C.REALM)}。`, "sys");
      const c = this.cqStudyCost(lv);
      if (s.exp < c.exp) return this.log(`修为不足，需要 ${U.fmt(c.exp)}。`, "sys");
      if (this.smCount("lu") < c.lu) return this.log(`${DATA.smName("lu")}不足，需要 ${c.lu} 个（元婴期秘境掉落）。`, "sys");
      s.exp -= c.exp; this.takeSm("lu", c.lu);
      s.cqStudy = { end: this.now() + c.sec * 1000, total: c.sec * 1000 };
      this.log(`开始修炼${C.NAME}（第 ${lv} → ${lv + 1} 层）。`, "sys"); this.after();
    },
    // 修炼到时间就升一层（离线也会补算）
    cqTick() {
      const s = this.s, x = s.cqStudy;
      if (!x || this.now() < x.end) return;
      s.cqStudy = null; s.cqLv = Math.min(CFG.chuqiao.MAX_LV, (s.cqLv || 0) + 1); this.dirty();
      this.log(`${CFG.chuqiao.NAME}提升至第 ${s.cqLv} 层，每天可出窍探索 ${this.cqMaxRuns()} 次。`, "gold");
    },
    // 功法页 · 秘法里的出窍秘法一行
    cqLine() {
      const s = this.s, C = CFG.chuqiao, lv = s.cqLv || 0; if (!lv) return "";
      const max = lv >= C.MAX_LV, x = s.cqStudy, c = this.cqStudyCost(lv);
      const st = x ? `<br>修炼中 · 剩余 ${this.countdown(x.end - Date.now())}` : max ? "" : `<br>下一层：${U.dur(c.sec)} · ${U.fmt(c.exp)} 修为 + ${DATA.smName("lu")} ${c.lu} 个（已有 ${U.fmt(this.smCount("lu"))}）`;
      return `<div class="line"><div>${DATA.li(DATA.iconImg("mifa"))}《${C.NAME}》<span class="tag">${lv}/${C.MAX_LV}层</span>
        <small>出窍探索时可继续修炼 · 每天可出窍 ${this.cqMaxRuns()} 次（今天还剩 ${this.cqLeftToday()} 次）${st}</small></div>
        <button class="sm" onclick="G.studyCq()" ${max || x || s.exp < c.exp || this.smCount("lu") < c.lu ? "disabled" : ""}>${max ? "圆满" : x ? "修炼中" : "修炼"}</button></div>`;
    },
    // 杂物页货单：content/items.js 的 ITEMS.treasury（没写就用 config/sect.js 的 treasury）
    treasuryList() { return ITEMS.treasury || DATA.treasury; },
    treasuryName(it) {
      if (it.item) return it.item;
      if (it.kind === "furnace") return DATA.furnaceName(it.fk, it.g);
      if (it.kind === "pill") return `${DATA.realms[this.r()]}·${DATA.pills[it.type].name}`;
      if (it.kind === "chuqiao") return CFG.chuqiao.NAME;
      return it.name || "灵石";
    },
    exchange(i) {
      const it = this.treasuryList()[i], c = this.treasuryCost(it);
      if (!it || this.s.contrib < c || (it.star || 1) > this.sectInfo().star) return;
      if (it.kind === "chuqiao") {
        const C = CFG.chuqiao;
        if (this.s.cqLv || C.STAR > this.sectInfo().star) return;
        if (!this.realmOK(C.REALM)) return this.log(`${C.NAME}需要${DATA.realmLabel(C.REALM)}。`, "sys");
        this.s.contrib -= c; this.s.cqLv = 1;
        this.log(`习得${C.NAME}第 1 层！在「功法 → 秘法」里修炼升层，在世界地图点「出窍」探索。`, "gold");
        return this.after();
      }
      if (it.item) { if (!this.addCustom(it.item)) return; }
      else if (it.kind === "furnace") { if (!this.addFurnaceItem(it.fk, it.g)) return; }
      else if (it.kind === "pill") { if (!this.addPill(it.type, this.r())) return; }
      else this.s.stone += Math.floor(it.n * this.starMul());
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

    /* ---------- 试炼塔（v25：1~10 星，层数见 config/sect.js 的 sect.trial） ---------- */
    // 旧存档：s.tower → s.towers[当前门派星级]
    fixTower() {
      const s = this.s; if (!s.towers) s.towers = {};
      if (s.sect && s.tower > 0) { const st = this.sectInfo().star; s.towers[st] = Math.max(s.towers[st] || 0, s.tower); }
    },
    towerFloor() { this.fixTower(); return this.s.towers[this.sectInfo().star] || 0; },
    towerMax() { return DATA.towerMax(this.sectInfo().star); },
    // 守关者属性 = base × 星级倍率 × GROW^(层数-1)（config/sect.js 的 sect.tower）
    makeTowerGuard(floor) {
      const T = CFG.sect.tower, f = this.starMul() * Math.pow(T.GROW, floor - 1), b = T.base;
      return this.addMagic({ name: `第${floor}层守关者`, boss: false, crit: b.crit,
        hp: b.hp * f, atk: b.atk * f, def: b.def * f, speed: b.speed * f, hit: b.hit * f, dodge: b.dodge * f }, "tower");
    },
    // 第 f 层每 10 层的额外奖励是什么：{ kind: "ring", r } / { kind: "rbp", g } / { kind: "mijue" }
    towerBonus(star, f) {
      const T = CFG.sect.trial, E = T.EVERY || 10;
      if (f % E) return null;
      const k = f / E, r = (T.RING || [])[star - 1];
      if (r !== undefined && r >= 0 && DATA.ringNames[r]) {
        if (k === 1) return { kind: "ring", r };       // 第 10 层：一阶戒指
        if (k <= 10) return { kind: "rbp", r, g: k - 1 }; // 第 20~100 层：二阶 ~ 十阶图纸
      }
      return { kind: "mijue" };
    },
    towerBonusText(b) { return !b ? "" : b.kind === "ring" ? DATA.ringName(b.r, 0) : b.kind === "rbp" ? DATA.ringBpName(b.g, b.r) : "试炼塔秘诀 +1 层"; },
    // 试炼塔秘诀 +1 层：黄 → 玄 → 地 → 天，天阶满层后给灵石
    giveTowerMijue(star) {
      const s = this.s, MAX = DATA.GONGFA_MAX;
      for (const t of DATA.tiers) {
        const id = DATA.towerMijueId(star, t.id), lv = s.gongfa[id] || 0;
        if (lv >= MAX) continue;
        s.gongfa[id] = lv + 1; this.dirty();
        const info = DATA.gongfaInfo(id, lv + 1);
        return `《${info.name}》（${t.name}）${lv ? `提升至第 ${lv + 1} 层` : "习得第 1 层"}`;
      }
      const n = Math.floor((CFG.sect.trial.MIJUE_DONE_STONE || 0) * this.starMul()); s.stone += n;
      return `灵石 ${U.fmt(n)}（试炼塔秘诀已圆满）`;
    },
    // 首通第 f 层的奖励，返回文字
    towerReward(f) {
      const s = this.s, star = this.sectInfo().star, T = CFG.sect.trial, F = T.floor, i = star - 1, out = [];
      const c = DATA.towerReward(f, star); s.contrib += c; out.push(`贡献 +${U.fmt(c)}`);
      const fire = F.fire[i] || 0; if (fire && this.addFire(fire)) out.push(`火髓 ×${fire}`);
      const st = Math.floor((F.stone || 0) * this.starMul() * f); if (st) { s.stone += st; out.push(`灵石 +${U.fmt(st)}`); }
      const mx = Math.min(5, F.MAT_MAX[i] === undefined ? 5 : F.MAT_MAX[i]);
      for (const kind of ["herb", "ore"]) {
        const n = F[kind][i] || 0; if (!n) continue;
        const g = U.rand(0, mx), name = DATA.matName(kind, g);
        if (this.addMat(kind, name, g, n)) out.push(`${name} ×${n}`);
      }
      const b = this.towerBonus(star, f);
      if (b && b.kind === "ring") { const e = DATA.rollForged("ring", 0, b.r); if (this.addEquip(e)) out.push(`<span class="q${e.q}">${DATA.ringName(b.r, 0)}</span>`); }
      else if (b && b.kind === "rbp") {
        if (this.ringKnown(b.r, b.g) || s.bag.some(x => x.t === "rbp" && x.g === b.g && x.r === b.r)) out.push(this.giveTowerMijue(star));   // 已有这张图纸 → 改给秘诀
        else if (this.bagFull()) out.push(this.giveTowerMijue(star));
        else { s.bag.push({ t: "rbp", r: b.r, g: b.g }); out.push(DATA.ringBpName(b.g, b.r)); }
      }
      else if (b) out.push(this.giveTowerMijue(star));
      return out.join("，");
    },
    // 点「挑战」：立即算出结果，打开战斗画面逐回合播放（3 秒后可跳过）
    challengeTower() {
      const star = this.sectInfo().star, f = this.towerFloor() + 1; if (f > this.towerMax()) return;
      const st = this.stats();
      if (this.s.hp < st.hp * CFG.battle.TOWER_HP_MIN) return this.log("气血不足三成，先休养片刻。", "sys");
      const m = this.makeTowerGuard(f);
      const res = this.battle(m);
      let txt;
      if (res.win) {
        this.s.towers[star] = f; this.s.tower = f;
        txt = `${res.rounds}回合击败${star}星试炼塔第 ${f} 层守关者，获得 ${this.towerReward(f)}。`;
        this.log(txt, "gold");
      } else { txt = `挑战试炼塔第 ${f} 层失败${res.lose ? "" : "（回合耗尽，各自退去）"}。`; this.log(txt, "bad"); }
      this.after();
      this.playBattle(res.detail, `试炼塔 · 第 ${f} 层`, txt, res.win);   // 见 world.js
    },

    /* ---------- 宗门秘境 ---------- */
    exploreSecret() {
      const x = this.sectInfo(), c = DATA.secretCost(x.star);
      if (this.s.contrib < c) return;
      this.s.contrib -= c;
      const roll = Math.random(), g = this.r(), SC = CFG.sect.secret;
      if (roll < SC.stone.chance) {
        const n = Math.floor(SC.stone.mult * this.starMul() * (1 + Math.random()));
        this.s.stone += n; this.log(`秘境中寻得一处灵石矿脉，灵石 +${U.fmt(n)}。`, "gold");
      } else if (roll < SC.stone.chance + SC.pill.chance) {
        const t = U.pick(Object.keys(DATA.pills)), n = U.rand(SC.pill.n[0], SC.pill.n[1]);
        this.addPill(t, g, n); this.log(`秘境中发现前人遗留的${DATA.pills[t].name} ×${n}。`, "gold");
      } else if (roll < SC.stone.chance + SC.pill.chance + SC.equip.chance) {
        const sl = U.pick(Object.keys(DATA.slots));   // 头盔~吊坠：本门星级对应阶的炼器装备；戒指、法宝：旧品质装备
        const e = DATA.forgeSlots.includes(sl) ? DATA.rollForged(sl, Math.min(9, this.sectInfo().star - 1)) : this.makeEquip(sl, g, U.rand(SC.equip.q[0], SC.equip.q[1]));
        if (this.addEquip(e)) this.log(`秘境深处得到<span class="q${e.q}">${this.eqQual(e)}${this.itemName({ t: "eq", e })}</span>！`, "gold");
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
      return `<div class="room-grid five">${stars}</div><div class="card"><h3>${star} 星门派<small>需${DATA.realmLabel(DATA.sectReq(star))}</small></h3>` +
        DATA.sects.filter(x => x.star === star).map(x => {
          const lock = !this.realmOK(x.reqRealm);
          return `<div class="line"><div>${x.name}<span class="tag">${DATA.elById[x.el].name}</span><small>${DATA.elById[x.el].name}属性功法、法术 · 可学本星级全部门派功法</small></div>
            <button class="sm" onclick="G.joinSect('${x.id}')" ${lock ? "disabled" : ""}>${lock ? "境界不足" : "拜入"}</button></div>`;
        }).join("") + `</div>`;
    }

    // ---------- 已入门 ----------
    const x = this.sectInfo(), tab = this.sectTab || "hall";
    const TABS = [["hall", "宗门大殿"], ["lib", "功法殿"], ["affair", "事务堂"], ["room", "修炼室"], ["gfroom", "练功房"], ["treasury", "宗门宝库"],
                  ["alchemy", "炼丹房"], ["forge", "炼器室"], ["wudao", "悟道室"], ["tower", "试炼塔"], ["secret", "宗门秘境"]];
    let h = `<div class="card"><h3>${x.name} <span class="tag">${x.star}星</span><span class="tag">${DATA.elById[x.el].name}</span><small>${DATA.ranks[s.rank].name} · 贡献 ${U.fmt(s.contrib)}</small></h3></div>
      <div class="room-grid">${TABS.map(([k, n]) => `<button class="${tab === k ? "active" : ""}" onclick="G.setSectTab('${k}')">${n}</button>`).join("")}</div>`;

    if (tab === "hall") {
      const next = s.rank + 1 < DATA.ranks.length ? s.rank + 1 : -1, got = s.salaryDay === this.today();
      h += `<div class="card"><h3>宗门大殿<small>当前：${DATA.ranks[s.rank].name}</small></h3>
        <div class="line"><div>每日俸禄<small>${U.fmt(this.salary())} 灵石</small></div>
        <button class="sm" onclick="G.claimSalary()" ${got ? "disabled" : ""}>${got ? "今日已领" : "领取"}</button></div>
        ${next < 0 ? `<p class="desc">你已是一宗之主。</p>` : `<div class="line"><div>晋升【${DATA.ranks[next].name}】
          <small>需${DATA.realmLabel(this.rankReqRealm(next))} · ${U.fmt(this.rankCost(next))} 贡献 · ${s.rankPass === next ? "已通过考验" : "需先通过考验"}</small></div>
          <button class="sm" onclick="G.promote()" ${s.rankPass !== next || !this.realmOK(this.rankReqRealm(next)) || s.contrib < this.rankCost(next) ? "disabled" : ""}>晋升</button></div>
          <div class="line"><div>晋升考验 · ${DATA.ranks[next].name}考官<small>每次消耗 ${U.fmt(this.rankTrialCost(next))} 贡献 · 战斗胜利后才能晋升</small></div>
          <button class="sm ${s.rankPass === next ? "on" : ""}" onclick="G.challengeRank()" ${s.rankPass === next || !this.realmOK(this.rankReqRealm(next)) || s.contrib < this.rankTrialCost(next) ? "disabled" : ""}>${s.rankPass === next ? "已通过" : "考验"}</button></div>`}</div>
        <div class="card"><h3>职务一览</h3>${DATA.ranks.map((r, i) => `<div class="line"><div>${r.name}<small>俸禄 ${U.fmt(Math.floor(r.daily * this.starMul() * this.rankMul(i)))} 灵石 · 晋升 ${U.fmt(this.rankCost(i))} 贡献</small></div>${i === s.rank ? "<b>当前</b>" : i < s.rank ? "<small>已历</small>" : ""}</div>`).join("")}</div>
        <div class="btns"><button onclick="G.leaveSect()">叛出门派</button></div>`;
    } else if (tab === "lib") {
      // 功法殿：本星级全部门派的功法、法术；按 阶 和 属性 筛选
      const tier = this.libTier || "huang", el = this.libEl || x.el;
      const need = DATA.tierRank(DATA.tierById[tier]), rankLock = s.rank < need;
      const btn = g => { const has = this.hasGongfa(g.id);
        return `<button class="sm" onclick="G.learnGongfa('${g.id}')" ${has || rankLock || s.contrib < g.cost ? "disabled" : ""}>${has ? "已学会" : rankLock ? "职务不足" : "学习"}</button>`; };
      const sects = DATA.sects.filter(o => o.star === x.star && (el === "all" || o.el === el));
      h += `<div class="room-grid">${DATA.tiers.map(t => `<button class="${tier === t.id ? "active" : ""}" onclick="G.setLibTier('${t.id}')">${t.name}</button>`).join("")}</div>
        <div class="room-grid">${[["all", "全部"], ...DATA.elements.map(e => [e.id, e.name])].map(([k, n]) =>
          `<button class="${el === k ? "active" : ""}" onclick="G.setLibEl('${k}')">${n}</button>`).join("")}</div>` +
        (need ? `<p class="desc">${DATA.tierById[tier].name}功法、法术需要职务【${DATA.ranks[need].name}】以上才能学习${rankLock ? "（你的职务不足）" : ""}。</p>` : "") +
        sects.map(o => `<div class="card"><h3>${o.name}<span class="tag">${DATA.elById[o.el].name}</span><small>${DATA.tierById[tier].name}</small></h3>` +
          DATA.gongfaTypes.map(t => {
            const g = DATA.gongfaInfo(DATA.gongfaId(o.id, t.id, tier));
            return `<div class="line"><div>${DATA.skillIco(g)}《${g.name}》<span class="tag">${g.star}星</span><span class="tag">${t.name}</span><small>每层${g.label} +${this.gfValue(g, g.perLv)} · ${U.fmt(g.cost)} 贡献</small></div>${btn(g)}</div>`;
          }).join("") + (() => {
            const g = DATA.spellInfo(DATA.spellId(o.id, o.el, tier));
            return `<div class="line"><div>${DATA.skillIco(g)}《${g.name}》<span class="tag">${g.star}星</span><span class="tag">法术</span><small>攻击×${g.pct}% + ${U.fmt(g.perLv)}/层 · 耗法力 ${U.fmt(g.mana)} · ${U.fmt(g.cost)} 贡献</small></div>${btn(g)}</div>`;
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
      const FC = CFG.sect.freeRoom, fc = s.freeCult || {}, fcOn = this.freeCultOn(), fcLeft = fc.left > 0, fcDone = !fcLeft && this.freeUsed(fc) >= FC.daily;
      h += `<div class="card"><h3>修炼室<small>加快修炼 · 每次修炼消耗贡献</small></h3>
        <div class="line"><div>${FC.name}<span class="tag">+${U.num(this.freeCultPct())}%</span><small>${fcLeft ? `本次剩余 ${fc.left} 次修炼` : `每天 ${FC.daily} 次 · 每次 ${FC.times} 次修炼 · 不消耗贡献`}</small></div>
          <button class="sm ${fcOn ? "on" : ""}" onclick="G.enterFreeRoom()" ${fcDone ? "disabled" : ""}>${fcOn ? "使用中" : fcDone ? "今日已用" : "进入"}</button></div>` + DATA.rooms.map((r, i) => {
        const on = s.room === i, lock = !on && this.roomLocked(i);
        return `<div class="line"><div>${r.name}<span class="tag">+${U.num(this.roomPct(i))}%</span>${r.rank ? `<span class="tag">${DATA.ranks[r.rank].name}专用</span>` : ""}<small>每次修炼消耗 ${U.fmt(this.roomCost(i))} 贡献</small></div>
          <button class="sm ${on ? "on" : ""}" onclick="G.enterRoom(${i})" ${lock ? "disabled" : ""}>${on ? "使用中" : lock ? "职务不足" : "进入"}</button></div>`;
      }).join("") + `</div>`;
    } else if (tab === "gfroom") {
      const FG = CFG.sect.freeGfRoom, fg = s.freeGf || {}, fgOn = this.freeGfOn(), fgDone = !fgOn && this.freeUsed(fg) >= FG.daily;
      h += `<div class="card"><h3>练功房<small>加快功法修炼 · 修炼功法时每 5 秒消耗贡献</small></h3>
        <div class="line"><div>${FG.name}<span class="tag">功法修炼 +${U.num(this.freeGfPct())}%</span><small>${fgOn ? `剩余 ${U.dur(Math.ceil((fg.end - this.now()) / 1000))}` : `每天 ${FG.daily} 次 · 每次 ${FG.minutes} 分钟 · 不消耗贡献`}</small></div>
          <button class="sm ${fgOn ? "on" : ""}" onclick="G.enterFreeGfRoom()" ${fgOn || fgDone ? "disabled" : ""}>${fgOn ? "使用中" : fgDone ? "今日已用" : "进入"}</button></div>` + DATA.gfRooms.map((r, i) => {
        const on = s.gfRoom === i, lock = !on && this.gfRoomLocked(i);
        return `<div class="line"><div>${r.name}<span class="tag">功法修炼 +${U.num(this.gfRoomPct(i))}%</span>${r.rank ? `<span class="tag">${DATA.ranks[r.rank].name}专用</span>` : ""}<small>每 5 秒消耗 ${U.fmt(this.gfRoomCost(i))} 贡献</small></div>
          <button class="sm ${on ? "on" : ""}" onclick="G.enterGfRoom(${i})" ${lock ? "disabled" : ""}>${on ? "使用中" : lock ? "职务不足" : "进入"}</button></div>`;
      }).join("") + `<p class="desc">只在功法修炼队列有功法在修炼时才消耗；功法修炼时间缩短，消耗的修为不变。</p></div>`;
    } else if (tab === "treasury") {
      const tt = this.treasuryTab || "pill", maxG = this.treasuryMaxG();
      h += `<div class="sub-tabs">${[["pill", "杂物"], ["herb", "药材"], ["ore", "矿石"], ["seed", "种子"], ["bp", "图纸"]].map(([k, n]) =>
        `<button class="${tt === k ? "active" : ""}" onclick="G.setTreasuryTab('${k}')">${n}</button>`).join("")}</div>`;
      if (tt === "pill") {
        h += `<div class="card"><h3>杂物<small>以贡献兑换 · 炉子放进背包后点「使用」</small></h3>` + this.treasuryList().map((it, i) => {
          if (!it || (it.item && !this.cuDef(it.item))) return "";
          if (it.kind === "chuqiao") {
            const C = CFG.chuqiao, has = !!s.cqLv, c = this.cqCost(), rl = !this.realmOK(C.REALM), sl = C.STAR > x.star;
            return `<div class="line"><div>${DATA.li(DATA.iconImg("mifa"))}<span class="q4">${C.NAME}</span>
              <small>出窍探索时可继续修炼 · 学会后在「功法 → 秘法」修炼升层 · 需${DATA.realmLabel(C.REALM)} · ${U.fmt(c)} 贡献</small></div>
              <button class="sm" onclick="G.exchange(${i})" ${has || rl || sl || s.contrib < c ? "disabled" : ""}>${has ? "已学会" : sl ? `需${C.STAR}星` : rl ? "境界不足" : "兑换"}</button></div>`;
          }
          const c = this.treasuryCost(it), lock = (it.star || 1) > x.star, cd = it.item ? this.cuDef(it.item) : null;
          const desc = it.kind === "furnace" ? `${it.fk === "dan" ? "炼丹" : "炼器"}时间 -${DATA.furnaceBonus(it.fk, it.g)}% · `
            : cd ? `${DATA.cuTypes[cd.type] || ""}${cd.desc ? " · " + cd.desc : ""}${["perm", "equip", "fabao"].includes(cd.type) ? " · " + this.cuStatText(this.cuStats(cd)) : ""} · ` : "";
          const img = cd ? DATA.cuIcon(cd) : it.kind === "furnace" ? DATA.furnaceIcon(it.fk) : it.kind === "pill" ? DATA.pillIcon(it.type) : DATA.iconImg("stone");
          return `<div class="line"><div>${DATA.li(img)}${cd ? `<span class="q${cd.q || 0}">${this.treasuryName(it)}</span>` : this.treasuryName(it)}<small>${desc}${U.fmt(c)} 贡献</small></div>
            <button class="sm" onclick="G.exchange(${i})" ${lock || s.contrib < c ? "disabled" : ""}>${lock ? `需${it.star}星` : "兑换"}</button></div>`;
        }).join("") + `</div>`;
      } else if (tt === "seed") {
        h += `<div class="card"><h3>灵药种子<small>${x.star}星门派可换前 ${Math.min(maxG + 1, DATA.herbs.length)} 种 · 每种兑换一次</small></h3>` + DATA.herbs.map((n, g) => { const c = DATA.seedCost(g), has = s.seeds.includes(g), lock = g > maxG;
          return `<div class="line"><div>${DATA.li(DATA.matImg("herb", g))}${n}种子<small>${U.fmt(c)} 贡献 · ${U.dur(DATA.growTime(g) / 1000)}成熟</small></div>
            <button class="sm" onclick="G.exchangeSeed(${g})" ${has || lock || s.contrib < c ? "disabled" : ""}>${has ? "已拥有" : lock ? `需${g + 1}星` : "兑换"}</button></div>`; }).join("") + `</div>`;
      } else if (tt === "bp") {
        h += ["dan", "qi"].map(k => `<div class="card"><h3>${DATA.furnaces[k].name}图纸<small>${x.star}星门派可换 一阶~${DATA.JIE[maxG]} · 放进背包后点「学习」</small></h3>` + DATA.JIE.map((jn, g) => {
          const c = DATA.blueprintCost(k, g), has = s.blueprints[k].includes(g) || s.bag.some(it => it.t === "bp" && it.kind === k && it.g === g), lock = g > maxG;
          return `<div class="line"><div>${DATA.li(DATA.iconImg("bp"))}${DATA.furnaceName(k, g)}图纸<small>${U.fmt(c)} 贡献</small></div>
            <button class="sm" onclick="G.exchangeBlueprint('${k}',${g})" ${has || lock || s.contrib < c ? "disabled" : ""}>${has ? (s.blueprints[k].includes(g) ? "已学会" : "在背包") : lock ? `需${g + 1}星` : "兑换"}</button></div>`; }).join("") + `</div>`).join("");
      } else {
        const names = tt === "herb" ? DATA.herbs : DATA.ores;
        h += `<div class="card"><h3>${DATA.matKinds[tt]}<small>凡界全部可换 · 贡献 ${U.fmt(s.contrib)}</small></h3>
          <div class="line"><div>兑换数量</div><input id="tr-n" type="number" min="1" value="${this.trN || 1}" oninput="G.trN=+this.value" style="width:110px"></div>` +
          names.map((n, g) => { const c = DATA.matContrib(tt, g);
          return `<div class="line"><div>${DATA.li(DATA.matImg(tt, g))}${DATA.matFull(tt, g)}<small>${U.fmt(c)} 贡献/个 · 已有 ${U.fmt(this.countMat(tt, g))}</small></div>
            <button class="sm" onclick="G.exchangeMat('${tt}',${g})" ${s.contrib < c ? "disabled" : ""}>兑换</button></div>`; }).join("") + `</div>`;
      }
    } else if (tab === "alchemy") {
      h += this.sectAlchemyView(); // 见 craft.js
    } else if (tab === "wudao") {
      h += this.sectWudaoView();   // 见 wudao.js
    } else if (tab === "forge") {
      h += this.sectForgeView();   // 见 craft.js
    } else if (tab === "tower") {
      const star = x.star, cur = this.towerFloor(), max = this.towerMax(), f = cur + 1, done = cur >= max, T = CFG.sect.trial, F = T.floor;
      // 下一个每 10 层的奖励
      const E = T.EVERY || 10, nb = Math.ceil(f / E) * E, bonus = nb <= max ? this.towerBonus(star, nb) : null;
      h += `<div class="card"><h3>${star}星试炼塔<small>已通关 ${cur} / ${max} 层</small></h3>
        ${done ? `<p class="desc">你已登顶试炼塔！</p>` : `<div class="line"><div>第 ${f} 层守关者<small>首通：贡献 +${U.fmt(DATA.towerReward(f, star))}、火髓 ×${F.fire[star - 1] || 0}、灵石 +${U.fmt(Math.floor((F.stone || 0) * this.starMul() * f))}、药材 ×${F.herb[star - 1] || 0}、矿石 ×${F.ore[star - 1] || 0}</small></div>
        <button class="sm" onclick="G.challengeTower()">挑战</button></div>`}
        ${bonus ? `<p class="desc">第 ${nb} 层额外奖励：${this.towerBonusText(bonus)}</p>` : ""}
        <p class="desc">进度按门派星级记录，换门派不会重置。${(T.RING || [])[star - 1] >= 0 && DATA.ringNames[T.RING[star - 1]] ? `本塔第 10 层奖励${DATA.ringName(T.RING[star - 1], 0)}，第 20~100 层依次奖励它的二阶~十阶升级图纸，之后每 10 层奖励试炼塔秘诀。` : "本塔每 10 层奖励试炼塔秘诀（每次 +1 层）。"}</p></div>`;
    } else if (tab === "secret") {
      const c = DATA.secretCost(x.star);
      h += `<div class="card"><h3>宗门秘境<small>每次消耗 ${U.fmt(c)} 贡献</small></h3>
        <p class="desc">秘境中或有灵石矿脉、前人遗丹、上品法器，也可能一无所获。</p>
        <div class="btns"><button class="primary" onclick="G.exploreSecret()" ${s.contrib < c ? "disabled" : ""}>进入探索</button></div></div>`;
    }
    return h;
  },
});
