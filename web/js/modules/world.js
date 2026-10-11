/* =====================================================================
 * 模块：世界（六界：凡界 仙界 魔界 冥界 神界 天外天，目前只开放凡界）
 * 凡界内：9 张地图（练气 → 渡劫），每张分 东 西 南 北 四个区域；坊市、设置
 * ---------------------------------------------------------------------
 * 每个区域的 普通怪 / 精英怪 / 首领 属性在 js/config/ 数值文件 的 monster.regions 单独设置。
 * 历练：和自动探索一样走 100 步，但只走一次；走完且没战败 = 通过，解锁该区域的自动探索。
 * 自动探索：每次 100 秒，每秒走一步；固定遇到 10 个普通怪、3 个精英怪、灵药 5~10 次、矿石 5~10 次，
 *   最后一步遇到首领，其余无事发生（顺序随机）。怪物掉 灵石、药材、矿石（不掉丹药、装备）。
 *   历练、自动探索期间都不能修炼。
 * 战斗：速度高者先手，判闪避、暴击；法术栏法术轮流施放（耗法力），不足时普通攻击；战败遗失部分灵石。
 *   法术伤害 = 威力 - (对方防御 + 对方该属性抗性) × DEF_RATE；普通攻击、法宝只算防御。
 *   怪物也有法力、六系抗性、法术和法宝（见 config/monster.js 的 monster.magic）。
 *   一次探索中获得的东西先记下，100 秒结束后一起放进背包；
 *   气血够（≥ 三成）就继续下一次，不够就停止；探索时不能修炼；离线也继续。
 *   探索信息栏显示每一步发生的事，每秒刷新。
 * 数值全部在 js/config/ 下的数值文件 的 monster / explore 部分。
 * ===================================================================== */
G.module({
  id: "world",
  tab: "world",

  /* explore：历练 / 自动探索中
   *   { map 地图序号, reg 区域序号(0东 1西 2南 3北), once 是否历练, start 本次开始时间, step 已走步数, count 已完成次数,
   *     loot 本次收获 { stone, mats: { "herb|名字": {kind,name,g,n} }, pills: [], equips: [] },
   *     ev 本次事件列表（最新在前）, last 上一次结算文字 } */
  // trainedR：已历练通过的区域（地图序号 × 4 + 区域序号）；trained 为旧版（按地图）
  defaults: () => ({ explore: null, trained: [], trainedR: [], lastRun: null }),

  // 每 10 秒（以及在线时每秒）推进探索
  tick() { this.fixRegions(); this.advanceExplore(); },

  api: {
    setWorldTab(t) { this.worldTab = t; this.render(); },

    setWorld(id) { this.worldId = id; this.render(); },

    // 旧存档：按地图记录的历练 → 该地图东域已通过
    fixRegions() {
      const s = this.s;
      if (s.regionFix === 1) return;
      (s.trained || []).forEach(a => { if (!s.trainedR.includes(a * 4)) s.trainedR.push(a * 4); });
      if (s.explore && s.explore.reg === undefined) s.explore.reg = 0;
      s.regionFix = 1;
    },
    regionKey(a, r) { return a * DATA.regionCount + r; },
    isTrained(a, r) { return this.s.trainedR.includes(this.regionKey(a, r)); },

    // 生成怪物：a 地图、r 区域、kind = normal 普通 / elite 精英 / boss 首领（属性见 js/config/ 数值文件 monster.regions）
    makeMob(a, r, kind) {
      const R = DATA.region(a, r), b = R[kind], map = DATA.maps[a], k = CFG.monster.RAND;
      const v = x => x * (1 - k + Math.random() * 2 * k);
      const name = kind === "boss" ? DATA.regionBoss(a, r) : (kind === "elite" ? "精英·" : "") + U.pick(map.monsters);
      return this.addMagic({ name, Lm: R.L, kind, boss: kind === "boss", elite: kind === "elite",
        hp: v(b.hp), atk: v(b.atk), def: v(b.def), speed: v(b.speed), hit: v(b.hit), dodge: v(b.dodge), crit: b.crit }, kind, b);
    },

    // 给怪物加 法力 / 属性 / 六系抗性 / 法术 / 法宝（js/config/monster.js 的 monster.magic；b = regions 里单独写的数值）
    addMagic(m, kind, b = {}) {
      const M = (CFG.monster.magic || {})[kind] || {}, O = (CFG.monster.magic || {}).OWN_RES || 1;
      m.el = b.el || U.pick(DATA.elements).id;
      m.mana = m.maxMana = b.mana !== undefined ? b.mana : m.atk * (M.MANA || 0);
      m.res = {};
      for (const e of DATA.elements) m.res[e.id] = b.res && b.res[e.id] !== undefined ? b.res[e.id] : m.def * (M.RES || 0) * (e.id === m.el ? O : 1);
      m.spell = M.spell; m.fabao = M.fabao;
      return m;
    },

    // 通用战斗：速度高者先手，判闪避、暴击。返回 { win, lose, rounds, why, log }，并更新玩家气血、法力
    //   log：完整战斗过程（点「详情」查看），格式见 battleDetail
    battle(m) {
      const st = this.stats(), s = this.s;
      const spells = s.spellSlots.slice(0, this.slotCount()).map(id => DATA.spellInfo(id, s.gongfa[id])).filter(Boolean);
      let si = 0, act = null;   // act：这一下出手的方式 { k: 0 普通攻击 / 1 法术 / 2 法宝, sp 法术名序号, f: 0 命中 / 1 被闪避 / 2 暴击 }
      const BT = CFG.battle, rnd = () => BT.RAND_MIN + Math.random() * (BT.RAND_MAX - BT.RAND_MIN);
      const roll = (A, D, raw, k, sp) => {
        act = { k, sp, f: 0 };
        if (Math.random() * 100 < DATA.dodgeChance(A.hit, D.dodge)) { act.f = 1; return 0; } // 闪避（看命中与闪避之比）
        let d = raw * rnd();
        if (Math.random() * 100 < Math.min(DATA.CRIT_CAP, A.crit)) { d *= BT.CRIT_MULT; act.f = 2; } // 暴击
        return d;
      };
      const hit = (A, D) => roll(A, D, Math.max(A.atk * BT.MIN_DMG, A.atk - D.def * BT.DEF_RATE), 0);
      // 玩家出手：按顺序施放法术，法力不足则普通攻击
      const spNames = spells.map(sp => sp.name);
      const myHit = () => {
        for (let k = 0; k < spells.length; k++) {
          const j = (si + k) % spells.length, sp = spells[j];
          if (s.mana >= sp.mana) {
            si = (j + 1) % spells.length; s.mana -= sp.mana;
            return roll(st, m, Math.max(st.atk * BT.MIN_DMG, (st.atk * sp.pct / 100 + sp.flat) * this.lingenSpell(sp.el.id) - (m.def + ((m.res || {})[sp.el.id] || 0)) * BT.DEF_RATE), 1, j);
          }
        }
        return hit(st, m);
      };
      let php = s.hp, mhp = m.hp, rounds = 0, dealt = 0, taken = 0;
      const hp0 = s.hp, mana0 = s.mana, meFirst = st.speed >= m.speed;
      // 怪物出手：先判法术（带属性，算 防御 + 抗性），再判法宝（只算防御），都没有就普通攻击
      let mSp = 0, mFb = 0;
      const mCast = (k, el) => {
        const c = m[k], cost = c ? m.maxMana * c.cost : 0;
        if (!c || m.mana < cost || Math.random() * 100 >= c.chance) return -1;
        m.mana -= cost; k === "spell" ? mSp++ : mFb++;
        return roll(m, st, Math.max(m.atk * BT.MIN_DMG, m.atk * c.pct / 100 - (st.def + (el ? st.res[el] || 0 : 0)) * BT.DEF_RATE), k === "spell" ? 1 : 2);
      };
      const mobHit = () => { let d = mCast("spell", m.el); if (d < 0) d = mCast("fabao"); return d < 0 ? hit(m, st) : d; };
      // 每一下记一条：[回合, 谁(0 你 / 1 对方), 方式, 法术名序号, 结果, 伤害, 你的气血, 你的法力, 对方气血, 对方法力]
      const log = [], R = Math.round;
      const rec = (w, d) => log.push([rounds, w, act.k, act.sp === undefined ? -1 : act.sp, act.f, R(d), R(Math.max(0, php)), R(s.mana), R(Math.max(0, mhp)), R(m.mana || 0)]);
      const me = () => { const d = myHit(); mhp -= d; dealt += d; rec(0, d); }, him = () => { const d = mobHit(); php -= d; taken += d; rec(1, d); };
      while (php > 0 && mhp > 0 && rounds < BT.MAX_ROUNDS) {
        rounds++;
        if (meFirst) { me(); if (mhp > 0) him(); }
        else { him(); if (php > 0) me(); }
      }
      s.hp = Math.max(1, php);
      // 战斗说明（显示在探索信息里）
      const why = `你出战时气血 ${U.fmt(hp0)}，共造成 ${U.fmt(dealt)} 伤害（对方剩余气血 ${U.fmt(Math.max(0, mhp))}/${U.fmt(m.hp)}），承受 ${U.fmt(taken)} 伤害；对方攻击 ${U.fmt(m.atk)} 防御 ${U.fmt(m.def)}${m.el ? `，${DATA.elById[m.el].name}属性，施法术 ${mSp} 次、法宝 ${mFb} 次` : ""}`;
      const detail = { name: m.name, el: m.el || "", sp: spNames, first: meFirst ? 0 : 1, log,
        me: [R(hp0), R(st.hp), R(mana0), R(st.mana)], mob: [R(m.hp), R(m.hp), R(m.maxMana || 0), R(m.maxMana || 0)] };
      return { win: mhp <= 0 && php > 0, lose: php <= 0, rounds, why, detail };
    },

    // 完整战斗过程弹窗：src = "cur" 本次探索 / "last" 上一次结果，i = 事件序号
    showBattle(src, i) {
      const s = this.s, list = src === "cur" ? (s.explore && s.explore.ev) : (s.lastRun && s.lastRun.ev), e = list && list[i];
      if (!e || !e.b) return;
      const b = e.b, K = ["普通攻击", "法术", "法宝"], el = b.el ? DATA.elById[b.el].name : "";
      const rows = b.log.map(([r, w, k, sp, f, d, ph, pm, mh, mm]) => {
        const who = w ? b.name : "你", how = k === 1 ? (w ? `${el}系法术` : `《${b.sp[sp] || "法术"}》`) : K[k];
        const res = f === 1 ? "被闪避" : `造成 <b>${U.fmt(d)}</b> 伤害${f === 2 ? "（暴击）" : ""}`;
        return `<p class="${w ? "bad" : "good"}"><b>第${r}回合</b> ${who}${k ? "施放" : ""}${how}，${res}<br><small>你 气血 ${U.fmt(ph)}/${U.fmt(b.me[1])} 法力 ${U.fmt(pm)}/${U.fmt(b.me[3])} · 对方 气血 ${U.fmt(mh)}/${U.fmt(b.mob[1])} 法力 ${U.fmt(mm)}/${U.fmt(b.mob[3])}</small></p>`;
      }).join("");
      // 各方式伤害合计
      const sum = (w, k) => b.log.filter(x => x[1] === w && x[2] === k).reduce((t, x) => t + x[5], 0);
      const cnt = (w, k) => b.log.filter(x => x[1] === w && x[2] === k).length;
      const line = w => K.map((n, k) => cnt(w, k) ? `${n} ${cnt(w, k)} 次 ${U.fmt(sum(w, k))}` : "").filter(Boolean).join("，") || "无";
      this.modal(`<h2>战斗详情 · ${b.name}${el ? `（${el}属性）` : ""}</h2>
        <p class="desc">${b.first ? "对方先手" : "你先手"}<br>开战：你 气血 ${U.fmt(b.me[0])}/${U.fmt(b.me[1])} 法力 ${U.fmt(b.me[2])}/${U.fmt(b.me[3])} · 对方 气血 ${U.fmt(b.mob[0])} 法力 ${U.fmt(b.mob[2])}<br>
        你造成：${line(0)}<br>对方造成：${line(1)}</p>
        <div class="explore-log">${rows || "<p>无</p>"}</div>
        <div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },

    /* ---------- 掉落 ---------- */
    newLoot() { return { stone: 0, mats: {}, pills: [], equips: [] }; },
    // 掉落：先看 config/drops.js 里该地图单独设置的掉落组，没有就用 explore.js 的通用设置
    //   之后再加 content/items.js 里 ITEMS.drops 的自定义物品掉落
    rollEvent(loot, ev, a) {
      const base = this.rollEventMats(loot, ev, a), extra = this.rollCustom(loot, ev, a);
      return [base, extra].filter(Boolean).join("、");
    },
    // 自定义物品掉落（ITEMS.drops）：按地图、区域、事件、几率
    rollCustom(loot, ev, a) {
      const r = this.s.explore ? this.s.explore.reg || 0 : 0, got = [];
      for (const d of ITEMS.drops || []) {
        if (!d || d.event !== ev || !this.cuDef(d.item)) continue;
        if (d.map !== "all" && d.map !== undefined && +d.map !== a) continue;
        if (d.region !== "all" && d.region !== undefined && +d.region !== r) continue;
        if (Math.random() * 100 >= (d.chance || 0)) continue;
        const nn = d.n || [1, 1], n = U.rand(nn[0], nn[1]); if (n <= 0) continue;
        loot.cu = loot.cu || {}; loot.cu[d.item] = (loot.cu[d.item] || 0) + n;
        got.push(`${d.item}×${U.fmt(n)}`);
      }
      return got.join("、");
    },
    rollEventMats(loot, ev, a) {
      const groups = DATA.mapDrop(a, ev);
      if (!groups) return this.rollDrop(loot, CFG.explore.drop[ev], a);
      const got = [];
      for (const gr of groups) {
        const names = Object.keys(gr.items || {}).filter(n => DATA.matByName[n]), w = names.map(n => gr.items[n]);
        const kinds = U.rand(gr.kinds[0], gr.kinds[1]);
        for (let i = 0; i < kinds && w.some(x => x > 0); i++) {
          const j = U.weighted(w); w[j] = 0;   // 同一组不重复
          const name = names[j], m = DATA.matByName[name], n = U.rand(gr.n[0], gr.n[1]);
          if (n <= 0) continue;
          const key = m.kind + "|" + name;
          (loot.mats[key] = loot.mats[key] || { kind: m.kind, name, g: m.g, n: 0 }).n += n;
          got.push(`${name}×${U.fmt(n)}`);
        }
      }
      return got.join("、");
    },
    // 通用掉落：spec = { herb: {kinds, n}, ore: {kinds, n} }，返回描述
    rollDrop(loot, spec, a) {
      if (!spec) return "";
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
      const E = CFG.explore, mult = m.boss ? E.BOSS_DROP : m.elite ? E.ELITE_DROP : 1;
      const stone = Math.floor(E.STONE_BASE * Math.pow(E.STONE_GROW, m.Lm) * (1 + Math.random() * 1.5) * E.STONE_RATE * mult * DATA.mapStone(a));
      loot.stone += stone;
      const mats = this.rollEvent(loot, m.boss ? "boss" : m.elite ? "elite" : "monster", a);
      return `灵石${U.fmt(stone)}${mats ? "、" + mats : ""}`; // 怪物不掉丹药、装备
    },
    // 把收获放进背包，返回简短描述
    giveLoot(loot) {
      const s = this.s, parts = [], o = this._off;
      if (o) {   // 离线账本（core/game.js offlineReport）
        o.exRuns++; o.exStone += loot.stone;
        const add = (k, n) => { o.exItems[k] = (o.exItems[k] || 0) + n; };
        for (const k in loot.mats) { const x = loot.mats[k]; add(DATA.matFull(x.kind, x.g), x.n); }
        loot.pills.forEach(p => add(`${DATA.realms[p.g]}·${DATA.pills[p.t].name}`, 1));
        loot.equips.forEach(e => add(this.itemName({ t: "eq", e }), 1));
        for (const name in loot.cu || {}) add(name, loot.cu[name]);
      }
      s.stone += loot.stone; if (loot.stone) parts.push(`灵石${U.fmt(loot.stone)}`);
      let lost = 0;
      for (const k in loot.mats) { const x = loot.mats[k]; if (this.addMat(x.kind, x.name, x.g, x.n)) parts.push(`${DATA.matFull(x.kind, x.g)}×${U.fmt(x.n)}`); else lost++; }
      loot.pills.forEach(p => { if (this.addPill(p.t, p.g)) parts.push(`${DATA.realms[p.g]}·${DATA.pills[p.t].name}`); else lost++; });
      loot.equips.forEach(e => { if (this.addEquip(e)) parts.push(`<span class="q${e.q}">${DATA.quals[e.q]}${e.name}</span>`); else lost++; });
      for (const name in loot.cu || {}) { if (this.addCustom(name, loot.cu[name])) parts.push(`${name}×${U.fmt(loot.cu[name])}`); else lost++; } // 自定义物品
      if (o) o.exLost += lost;
      return parts.join("、") + (lost ? `（背包已满，遗失 ${lost} 件）` : "");
    },
    // 战败损失
    loseStone() { const lost = Math.floor(this.s.stone * CFG.explore.LOSE_STONE); this.s.stone -= lost; return lost; },

    /* ---------- 自动探索 ---------- */
    // once = true：历练（只走一次）；否则自动探索（需先历练通过该区域）
    toggleExplore(a, r, once) {
      const s = this.s;
      if (s.explore && s.explore.map === a && s.explore.reg === r && !!s.explore.once === !!once) { this.stopExplore(once ? "放弃历练" : "停止自动探索"); return this.after(); }
      if (this.r() < a) return;
      if (!once && !this.isTrained(a, r)) return this.log("需先在此区域历练通过，才能自动探索。", "sys");
      if (s.explore) this.stopExplore("更换");
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻（每 10 秒恢复 1%）。", "sys");
      s.explore = { map: a, reg: r, once: !!once, start: this.now(), step: 0, count: 0, loot: this.newLoot(), ev: [], last: "", plan: this.makePlan() };
      s.lastRun = null;
      this.exploreOpen = true;
      this.log(`开始在${DATA.regionName(a, r)}${once ? "历练" : "自动探索"}（期间无法修炼）。`, "sys");
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
      const x = this.s.explore, a = x.map, r = x.reg || 0;
      if (!x.plan) x.plan = this.makePlan();
      const type = { n: "nothing", m: "monster", e: "elite", b: "boss", h: "herb", o: "ore" }[x.plan[x.step]] || "nothing";
      x.step++;
      // 每走一步恢复少量气血、法力
      const st = this.stats(), H = CFG.explore.HEAL_STEP;
      this.s.hp = Math.min(st.hp, this.s.hp + st.hp * H); this.s.mana = Math.min(st.mana, this.s.mana + st.mana * H);
      let t = "", c = "", bd = null;
      if (type === "herb") { t = `发现灵药，采得 ${this.rollEvent(x.loot, "herbEvent", a) || "无"}`; c = "good"; }
      else if (type === "ore") { t = `发现矿脉，挖得 ${this.rollEvent(x.loot, "oreEvent", a) || "无"}`; c = "good"; }
      else if (type === "monster" || type === "elite" || type === "boss") {
        const kind = type === "monster" ? "normal" : type, m = this.makeMob(a, r, kind);
        const res = this.battle(m), tag = `${m.boss ? "【首领】" : m.elite ? "【精英】" : ""}${m.name}（${this.realmName(m.Lm)}）`;
        if (res.win) { this.s.kills++; t = `遭遇${tag}，${res.rounds}回合击败，获得 ${this.rollMonsterLoot(x.loot, m, a)}`; c = m.boss ? "gold" : ""; }
        else if (res.lose) { t = `遭遇${tag}，第 ${res.rounds} 回合不敌重伤，遗失灵石 ${U.fmt(this.loseStone())}。${res.why}`; c = "bad"; }
        else { t = `遭遇${tag}，缠斗 ${res.rounds} 回合，各自退去`; }
        bd = res.detail;
      } else t = U.pick(DATA.exploreIdle);
      x.ev.unshift(bd ? { n: x.step, t, c, b: bd } : { n: x.step, t, c });   // b：完整战斗过程（点「详情」看）
      if (x.ev.length > CFG.explore.TIME) x.ev.length = CFG.explore.TIME;
      return c === "bad"; // 战败：本次提前结束
    },
    // 生成一次探索的事件顺序（字符串，每个字符一步）：首领固定在最后一步
    makePlan() {
      const E = CFG.explore, T = E.TIME;
      const list = [...Array(E.MONSTERS).fill("m"), ...Array(E.ELITES || 0).fill("e"), ...Array(U.rand(E.HERB_MIN, E.HERB_MAX)).fill("h"), ...Array(U.rand(E.ORE_MIN, E.ORE_MAX)).fill("o")];
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
          s.lastRun = { title: `${DATA.regionName(x.map, x.reg || 0)} · ${x.last}`, ev: x.ev.slice(), bad: lost };
          if (x.once) { // 历练只走一次；走完且未战败 = 通过，解锁该区域自动探索
            const key = this.regionKey(x.map, x.reg || 0);
            if (!lost && !s.trainedR.includes(key)) { s.trainedR.push(key); this.log(`${DATA.regionName(x.map, x.reg || 0)}历练通过！已可自动探索。`, "gold"); }
            else if (lost) this.log("历练失败，提升实力后再来。", "bad");
            s.explore = null; break;
          }
          if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) {
            this.log(`气血不足三成，自动探索停止（共探索 ${x.count} 次）。`, "bad");
            s.lastRun.title += "；气血不足三成，自动探索停止";
            s.explore = null; break;
          }
          x.start = x.start + x.step * 1000; x.step = 0; x.loot = this.newLoot(); x.ev = []; x.plan = this.makePlan();
          s.lastRun = null; // 开始新一次：不保留上一次的记录
        }
      }
      if (changed) this.dirty();
    },
    setExploreOpen(v) { this.exploreOpen = v; this.render(); },
    // 探索信息一行：战斗事件后面带「详情」按钮
    evLine(e, src, i) { return `<p class="${e.c}"><b>第${e.n}步</b> ${e.t}${e.b ? ` <button class="sm" onclick="G.showBattle('${src}',${i})">详情</button>` : ""}</p>`; },
    setLastOpen(v) { this.lastOpen = v; this.render(); },
    setMapSel(a) { this.mapSel = a; this.render(); },

    // 坊市货单：content/items.js 的 ITEMS.shop（修炼丹、装备为当前境界品质；自定义物品按 item 名）
    shopList() {
      const g = this.r(), list = [];
      const src = ITEMS.shop || [...Object.keys(DATA.pills).map(t => ({ kind: "pill", type: t })), ...Object.keys(DATA.slots).filter(sl => sl !== "fabao").map(sl => ({ kind: "eq", slot: sl, q: 1 }))];
      for (const x of src) {
        if (!x || (x.realm !== undefined && g < x.realm)) continue;
        if (x.item) { if (this.cuDef(x.item)) list.push({ kind: "cu", name: x.item, price: x.price || 0 }); }
        else if (x.kind === "pill" && DATA.pills[x.type]) list.push({ kind: "pill", type: x.type, g, price: x.price || DATA.pillPrice(x.type, g) });
        else if (x.kind === "eq" && DATA.equipNames[x.slot]) list.push({ kind: "eq", slot: x.slot, g, q: x.q || 1, price: x.price || Math.floor(CFG.price.SHOP_EQUIP * Math.pow(DATA.STONE_GROW, g * 10)) });
      }
      return list;
    },
    buy(i, n = 1) {
      const it = this.shopList()[i];
      let k = 0;
      for (; k < n; k++) {
        if (this.s.stone < it.price) { this.log("灵石不足。", "sys"); break; }
        const ok = it.kind === "pill" ? this.addPill(it.type, it.g) : it.kind === "cu" ? this.addCustom(it.name) : this.addEquip(this.makeEquip(it.slot, it.g, it.q));
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
          return `<div class="card"><h3>${x.once ? "历练中" : "自动探索中"} · ${DATA.regionName(x.map, x.reg || 0)}<small>${x.once ? "走完且不战败即通过" : `已完成 ${x.count} 次`}</small></h3>
          <div class="bar tick"><div style="width:${x.step / T * 100}%"></div></div>
          <div class="row small"><span>第 ${x.step} / ${T} 步 · 剩余 ${T - x.step} 秒</span><span>
            <button class="sm" onclick="G.setExploreOpen(${!this.exploreOpen})">${this.exploreOpen ? "收起信息" : "探索信息"}</button>
            <button class="sm" onclick="G.toggleExplore(${x.map},${x.reg || 0},${!!x.once})">停止</button></span></div>
          <p class="desc">本次收获（结束后放入背包）：灵石 ${U.fmt(L.stone)}${mats.length ? "、" + mats.join("、") : ""}</p>
          ${this.exploreOpen ? `<div class="explore-log">${x.ev.map((e, i) => this.evLine(e, "cur", i)).join("") || "<p>出发……</p>"}</div>` : ""}</div>`; })()
        : s.lastRun ? `<div class="card"><h3>本次结果<small><button class="sm" onclick="G.setLastOpen(${!this.lastOpen})">${this.lastOpen ? "收起" : "详细"}</button></small></h3>
          <p class="desc ${s.lastRun.bad ? "q5" : ""}">${s.lastRun.title}</p>
          ${this.lastOpen ? `<div class="explore-log">${s.lastRun.ev.map((e, i) => this.evLine(e, "last", i)).join("")}</div>` : ""}</div>` : ""}
        ${(() => {
          // 地图选择（9 张）+ 选中地图的 东西南北 四个区域
          const sel = this.mapSel !== undefined ? this.mapSel : s.explore ? s.explore.map : Math.min(this.r(), DATA.maps.length - 1);
          const map = DATA.maps[sel], lock = this.r() < sel;
          return `<div class="room-grid five">${DATA.maps.map((m, a) => `<button class="${sel === a ? "active" : ""}" onclick="G.setMapSel(${a})">${m.name}${this.r() < a ? `<small>需${DATA.realms[a]}期</small>` : ""}</button>`).join("")}</div>
          <div class="card"><h3>${map.name}<small>${DATA.realms[sel]}期 · 掉落 ×${U.num(DATA.mapMult(sel))} · 历练一次 100 秒，通过后才能自动探索</small></h3>` +
          DATA.regionDirs.map((d, r) => {
            const R = DATA.region(sel, r), ok = this.isTrained(sel, r), x = s.explore && s.explore.map === sel && (s.explore.reg || 0) === r ? s.explore : null;
            return `<div class="line"><div>${d}域<span class="tag">${this.realmName(R.L)}</span><small>首领 ${DATA.regionBoss(sel, r)} · ${ok ? "已通过历练" : "未历练"}</small></div>
              ${lock ? `<button class="sm" disabled>需${DATA.realms[sel]}期</button>` : `<div><button class="sm ${x && x.once ? "on" : ""}" onclick="G.toggleExplore(${sel},${r},true)">${x && x.once ? "停止" : "历练"}</button>
              <button class="sm ${x && !x.once ? "on" : ""}" onclick="G.toggleExplore(${sel},${r})" ${ok ? "" : "disabled"}>${x && !x.once ? "停止" : "探索"}</button></div>`}</div>`;
          }).join("") + `<p class="desc">期间无法修炼；气血低于三成停止。</p></div>`;
        })()}`;
    }

    if (wt === "shop") {
      return tabs + `<div class="card"><h3>坊市<small>${DATA.realms[this.r()]}期货品</small></h3>` + this.shopList().map((it, i) => {
        const cd = it.kind === "cu" ? this.cuDef(it.name) : null, multi = it.kind === "pill" || (cd && cd.type !== "equip" && cd.type !== "fabao");
        const name = cd ? `<span class="q${cd.q || 0}">${it.name}</span>` : it.kind === "pill" ? `${DATA.realms[it.g]}·${DATA.pills[it.type].name}` : `${DATA.quals[it.q]} ${DATA.realms[it.g]}·${DATA.equipNames[it.slot][Math.min(5, it.q)]}`;
        const desc = cd ? `${DATA.cuTypes[cd.type] || ""}${cd.desc ? " · " + cd.desc : ""}${["perm", "equip", "fabao"].includes(cd.type) ? " · " + this.cuStatText(this.cuStats(cd)) : ""}`
          : it.kind === "pill" ? `修炼速度 +${Math.round(DATA.pillPct(it.type, it.g))}%，${DATA.pills[it.type].dur}次修炼` : `${DATA.slots[it.slot]} · ${this.equipDesc(this.makeEquip(it.slot, it.g, it.q))}`;
        return `<div class="line"><div>${name}<small>${desc}</small></div><div>
          <button class="sm" onclick="G.buy(${i})" ${s.stone < it.price ? "disabled" : ""}>${U.fmt(it.price)}</button>
          ${multi ? `<button class="sm" onclick="G.buy(${i},10)" ${s.stone < it.price * 10 ? "disabled" : ""}>×10</button>` : ""}</div></div>`;
      }).join("") + `</div>`;
    }

    return tabs + `<div class="card"><h3>账号<small>${API.user}</small></h3>
      <p class="desc">存档保存在服务器，换手机、关浏览器都不会丢。离线期间修炼、聚灵阵持续进行，不封顶。</p>
      <div class="btns"><button onclick="G.save(true)">立即同步</button><button onclick="G.logout()">退出登录</button>
      <button onclick="G.restart()">删档重来</button></div></div>`;
  },
});
