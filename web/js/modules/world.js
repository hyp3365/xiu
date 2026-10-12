/* =====================================================================
 * 模块：世界（六界：凡界 仙界 魔界 冥界 神界 天外天，目前只开放凡界）
 * 凡界内：9 张地图（练气 → 渡劫），每张分 东 西 南 北 四个区域；坊市、设置
 * ---------------------------------------------------------------------
 * 每个区域的 普通怪 / 精英怪 / 首领 属性在 js/config/ 数值文件 的 monster.regions 单独设置。
 * 历练：和自动探索一样走 100 步，但只走一次；走完且没战败 = 通过，解锁该区域的自动探索。
 * 自动探索：每次 TIME 步，每步 STEP_SEC 秒（config/explore.js）；固定遇到 10 个普通怪、3 个精英怪、灵药 5~10 次、矿石 5~10 次，
 *   最后一步遇到首领，其余无事发生（顺序随机）。怪物掉 灵石、药材、矿石（不掉丹药、装备）。
 *   历练、自动探索期间都不能修炼。
 * 战斗：速度高者先手，判闪避、暴击；法术栏法术轮流施放（耗法力），不足时普通攻击；战败遗失部分灵石。
 *   法术伤害 = 威力 - (对方防御 + 对方该属性抗性) × DEF_RATE；普通攻击、法宝只算防御。
 *   怪物也有法力、六系抗性、法术和法宝（见 config/monster.js 的 monster.magic）。
 *   一次探索中获得的东西先记下，走完后一起放进背包；
 *   气血够（≥ 三成）就继续下一次，不够就停止；探索时不能修炼；离线也继续。
 *   探索信息栏显示每一步发生的事，每秒刷新。
 * 秘境（config/mijing.js）：历练探索时有几率发现；每处每天进一次，先历练通过才能自动探索；探索中 x.mj = 秘境序号、x.queue = 一键探索还没走的秘境。
 * 数值全部在 js/config/ 下的数值文件 的 monster / explore / mijing 部分。
 * ===================================================================== */
G.module({
  id: "world",
  tab: "world",

  /* explore：历练 / 自动探索中
   *   { map 地图序号, reg 区域序号(0东 1西 2南 3北), once 是否历练, start 本次开始时间, step 已走步数, count 已完成次数,
   *     loot 本次收获 { stone, mats: { "herb|名字": {kind,name,g,n} }, pills: [], equips: [] },
   *     ev 本次事件列表（最新在前）, last 上一次结算文字 } */
  // trainedR：已历练通过的区域（地图序号 × 4 + 区域序号）；trained 为旧版（按地图）
  // mj：秘境 { found 已发现, trained 已历练通过, day 日期, used { 秘境序号: 今天已进次数 } }
  defaults: () => ({ explore: null, trained: [], trainedR: [], lastRun: null, mj: { found: [], trained: [], day: "", used: {} } }),

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
      const R = DATA.region(a, r), b = R[kind], map = DATA.maps[a], k = CFG.monster.RAND, M = DATA.mapMob(a);
      const v = (x, key) => x * (M[key] === undefined ? 1 : M[key]) * (1 - k + Math.random() * 2 * k);   // × 地图倍率 × 随机浮动
      const name = kind === "boss" ? DATA.regionBoss(a, r) : (kind === "elite" ? "精英·" : "") + U.pick(map.monsters);
      return this.addMagic({ name, Lm: R.L, kind, boss: kind === "boss", elite: kind === "elite",
        hp: v(b.hp, "hp"), atk: v(b.atk, "atk"), def: v(b.def, "def"), speed: v(b.speed, "speed"), hit: v(b.hit, "hit"), dodge: v(b.dodge, "dodge"), crit: b.crit }, kind, b);
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
      // 某系抗性 = 防御 × RES_RATE + 该系抗性（config/battle.js）
      const RR = BT.RES_RATE === undefined ? 1 : BT.RES_RATE, resOf = (D, el) => D.def * RR + ((D.res || {})[el] || 0);
      const roll = (A, D, raw, k, sp) => {
        act = { k, sp, f: 0 };
        if (Math.random() * 100 < DATA.dodgeChance(A.hit, D.dodge)) { act.f = 1; return 0; } // 闪避（看命中与闪避之比）
        let d = raw * rnd();
        if (Math.random() * 100 < Math.min(DATA.CRIT_CAP, A.crit)) { d *= BT.CRIT_MULT; act.f = 2; } // 暴击
        return d;
      };
      const hit = (A, D) => roll(A, D, Math.max(A.atk * BT.MIN_DMG, A.atk - D.def * BT.DEF_RATE), 0);
      // v25：炼制法宝也能祭出（金木水火土雷属性伤害，消耗法力）
      const fabaos = s.fabao.slice(0, this.slotCount()).filter(e => e && e.attrs).map(e => DATA.fabaoInfo(e));
      // 玩家出手：法术、法宝按顺序轮流（法术在前），法力不足的跳过，都放不出就普通攻击
      const acts = [...spells.map(sp => ({ k: 1, sp })), ...fabaos.map(fb => ({ k: 2, fb }))];
      const spNames = [...spells.map(sp => sp.name), ...fabaos.map(fb => fb.name)];
      // 法宝伤害：主伤害（攻击×% + 属性伤害）按「防御×RES_RATE + 该系抗性 − 无视」减免；追加伤害只按对方该系抗性减免
      const fabaoDmg = fb => {
        const resMain = Math.max(0, resOf(m, fb.el) - fb.ign) * (1 - fb.ignPct / 100);
        let d = Math.max(st.atk * BT.MIN_DMG, st.atk * fb.pct / 100 + fb.flat - resMain * BT.DEF_RATE);
        for (const x of fb.extra) {
          let r = (m.res || {})[x.el] || 0;
          if (x.el === fb.el) r = Math.max(0, r - fb.ign) * (1 - fb.ignPct / 100);
          d += Math.max(0, x.flat + st.atk * x.pct / 100 - r * BT.DEF_RATE);
        }
        return d;
      };
      const myHit = () => {
        for (let k = 0; k < acts.length; k++) {
          const j = (si + k) % acts.length, a = acts[j], cost = a.k === 1 ? a.sp.mana : a.fb.mana;
          if (s.mana >= cost) {
            si = (j + 1) % acts.length; s.mana -= cost;
            if (a.k === 1) { const sp = a.sp; return roll(st, m, Math.max(st.atk * BT.MIN_DMG, (st.atk * sp.pct / 100 + sp.flat) * this.lingenSpell(sp.el.id) - resOf(m, sp.el.id) * BT.DEF_RATE), 1, j); }
            return roll(st, m, fabaoDmg(a.fb), 2, j);
          }
        }
        return hit(st, m);
      };
      let php = s.hp, mhp = m.hp, rounds = 0, dealt = 0, taken = 0;
      const hp0 = s.hp, mana0 = s.mana, meFirst = st.speed >= m.speed;
      // 怪物出手：先判法术，再判法宝（都按 防御×RES_RATE + 该系抗性 减免），都没有就普通攻击
      let mSp = 0, mFb = 0;
      const mCast = (k, el) => {
        const c = m[k], cost = c ? m.maxMana * c.cost : 0;
        if (!c || m.mana < cost || Math.random() * 100 >= c.chance) return -1;
        m.mana -= cost; k === "spell" ? mSp++ : mFb++;
        return roll(m, st, Math.max(m.atk * BT.MIN_DMG, m.atk * c.pct / 100 - (el ? resOf(st, el) : st.def) * BT.DEF_RATE), k === "spell" ? 1 : 2);
      };
      const mobHit = () => { let d = mCast("spell", m.el); if (d < 0) d = mCast("fabao", m.el); return d < 0 ? hit(m, st) : d; };   // v25：怪物法宝也是属性伤害
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

    // 战斗过程每一下的文字（b = battle() 返回的 detail）
    battleRow(b, x) {
      const [r, w, k, sp, f, d, ph, pm, mh, mm] = x, el = b.el ? DATA.elById[b.el].name : "";
      const who = w ? b.name : "你", tgt = w ? "你" : b.name;
      const how = k === 1 ? `施放${w ? `${el}系法术` : `《${b.sp[sp] || "法术"}》`}` : k === 2 ? (w || !b.sp[sp] ? "祭出法宝" : `祭出法宝「${b.sp[sp]}」`) : "发动普通攻击";
      const res = f === 1 ? `，被${tgt}闪避` : `，${f === 2 ? "暴击！" : ""}对${tgt}造成 <b>${U.fmt(d)}</b> 伤害`;
      return `<p class="${w ? "bad" : "good"}"><b>第${r}回合</b> ${who}${how}${res}<br><small>你 气血 ${U.fmt(ph)}/${U.fmt(b.me[1])} 法力 ${U.fmt(pm)}/${U.fmt(b.me[3])} · ${b.name} 气血 ${U.fmt(mh)}/${U.fmt(b.mob[1])} 法力 ${U.fmt(mm)}/${U.fmt(b.mob[3])}</small></p>`;
    },
    // 战斗总览：先手、开战数值、双方各方式伤害合计
    battleHead(b) {
      const K = ["普通攻击", "法术", "法宝"], el = b.el ? DATA.elById[b.el].name : "";
      const sum = (w, k) => b.log.filter(x => x[1] === w && x[2] === k).reduce((t, x) => t + x[5], 0);
      const cnt = (w, k) => b.log.filter(x => x[1] === w && x[2] === k).length;
      const line = w => K.map((n, k) => cnt(w, k) ? `${n} ${cnt(w, k)} 次 ${U.fmt(sum(w, k))}` : "").filter(Boolean).join("，") || "无";
      return `<p class="desc">${el ? `${b.name}为${el}属性 · ` : ""}${b.first ? `${b.name}先手` : "你先手"}<br>开战：你 气血 ${U.fmt(b.me[0])}/${U.fmt(b.me[1])} 法力 ${U.fmt(b.me[2])}/${U.fmt(b.me[3])} · ${b.name} 气血 ${U.fmt(b.mob[0])} 法力 ${U.fmt(b.mob[2])}<br>
        你造成：${line(0)}<br>${b.name}造成：${line(1)}</p>`;
    },
    // 完整战斗过程弹窗：src = "cur" 本次探索 / "last" 上一次结果，i = 事件序号
    showBattle(src, i) {
      const s = this.s, list = src === "cur" ? (s.explore && s.explore.ev) : (s.lastRun && s.lastRun.ev), e = list && list[i];
      if (!e || !e.b) return;
      const b = e.b, el = b.el ? DATA.elById[b.el].name : "";
      this.modal(`<h2>战斗详情 · ${b.name}${el ? `（${el}属性）` : ""}</h2>${this.battleHead(b)}
        <div class="explore-log">${b.log.map(x => this.battleRow(b, x)).join("") || "<p>无</p>"}</div>
        <div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    // 战斗画面（试炼塔）：每 ROUND_SEC 秒播放一回合，3 秒后可跳过；结果已经结算好，这里只是播放
    playBattle(b, title, txt, win) {
      if (this._bp && this._bp.timer) clearInterval(this._bp.timer);
      const rounds = [];
      b.log.forEach(x => { (rounds[x[0] - 1] = rounds[x[0] - 1] || []).push(x); });
      const bp = this._bp = { b, title, txt, win, rounds: rounds.filter(Boolean), shown: 0, t0: Date.now(), done: false };
      this._lockModal = true;
      const step = () => {
        if (this._bp !== bp) return clearInterval(bp.timer);
        if (bp.shown < bp.rounds.length) bp.shown++;
        if (bp.shown >= bp.rounds.length) { bp.done = true; clearInterval(bp.timer); }
        this.drawBattle();
      };
      bp.shown = Math.min(1, bp.rounds.length); if (bp.shown >= bp.rounds.length) bp.done = true;
      this.drawBattle();
      if (!bp.done || Date.now() - bp.t0 < 3000) bp.timer = setInterval(step, (CFG.battle.ROUND_SEC || 1) * 1000);
    },
    drawBattle() {
      const bp = this._bp; if (!bp) return;
      const b = bp.b, canSkip = Date.now() - bp.t0 >= 3000;
      const rows = bp.rounds.slice(0, bp.shown).map(r => r.map(x => this.battleRow(b, x)).join("")).join("");
      const el = b.el ? DATA.elById[b.el].name : "";
      this.modal(`<h2>${bp.title} · ${b.name}${el ? `（${el}属性）` : ""}</h2>
        <p class="desc">第 ${bp.rounds.length ? (bp.rounds[Math.max(0, bp.shown - 1)][0][0]) : 0} 回合${bp.done ? "" : " · 战斗中……"}</p>
        <div class="explore-log" id="bt-log">${rows || "<p>交手……</p>"}</div>
        ${bp.done ? `<p class="${bp.win ? "good" : "bad"}"><b>${bp.txt}</b></p>${this.battleHead(b)}` : ""}
        <div class="btns">${bp.done ? `<button onclick="G.closeBattle()">关闭</button>`
          : `<button onclick="G.skipBattle()" ${canSkip ? "" : "disabled"}>${canSkip ? "跳过战斗" : "3 秒后可跳过"}</button>`}</div>`);
      const box = $("#bt-log"); if (box) box.scrollTop = 1e9;
    },
    skipBattle() {
      const bp = this._bp; if (!bp || Date.now() - bp.t0 < 3000) return;
      clearInterval(bp.timer); bp.shown = bp.rounds.length; bp.done = true; this.drawBattle();
    },
    closeBattle() { if (this._bp) clearInterval(this._bp.timer); this._bp = null; this._lockModal = false; this.closeModal(); this.render(); },

    /* ---------- 掉落 ---------- */
    newLoot() { return { stone: 0, mats: {}, pills: [], equips: [] }; },
    // 掉落：config/drops.js 里该地图的掉落组（数量 × 该地图 mat 倍率）
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
    rollEventMats(loot, ev, a, mulSet) {
      const groups = DATA.mapDrop(a, ev), mul = mulSet !== undefined ? mulSet : DATA.mapMat(a);
      if (!groups) return "";
      const got = [];
      for (const gr of groups) {
        const names = Object.keys(gr.items || {}).filter(n => DATA.matByName[n]), w = names.map(n => gr.items[n]);
        const kinds = U.rand(gr.kinds[0], gr.kinds[1]);
        for (let i = 0; i < kinds && w.some(x => x > 0); i++) {
          const j = U.weighted(w); w[j] = 0;   // 同一组不重复
          const name = names[j], m = DATA.matByName[name], n0 = U.rand(gr.n[0], gr.n[1]), n = n0 > 0 ? Math.max(1, Math.round(n0 * mul)) : 0;
          if (n <= 0) continue;
          const key = m.kind + "|" + name;
          (loot.mats[key] = loot.mats[key] || { kind: m.kind, name, g: m.g, n: 0 }).n += n;
          got.push(`${name}×${U.fmt(n)}`);
        }
      }
      return got.join("、");
    },
    // 击败怪物的掉落，写进 loot，返回描述文字
    //   mj = 秘境序号（秘境：灵石倍率、掉落按 config/mijing.js）
    rollMonsterLoot(loot, m, a, mj) {
      const E = CFG.drop, mult = m.boss ? E.BOSS_STONE : m.elite ? E.ELITE_STONE : 1, ev = m.boss ? "boss" : m.elite ? "elite" : "monster";
      const sm = mj !== undefined ? (this.mjDef(mj).stone || 1) : DATA.mapStone(a);
      const stone = Math.floor(E.STONE_BASE * Math.pow(E.STONE_GROW, m.Lm) * (1 + Math.random() * 1.5) * E.STONE_RATE * mult * sm);
      loot.stone += stone;
      const mats = mj !== undefined ? this.rollMj(loot, ev, mj) : this.rollEvent(loot, ev, a);
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
        if (loot.hx) add("火髓", loot.hx);
        for (const k in loot.sm || {}) { const [kk, ft] = k.split(":"); add(DATA.smName(kk, ft === undefined ? undefined : +ft), loot.sm[k]); }
      }
      s.stone += loot.stone; if (loot.stone) parts.push(`灵石${U.fmt(loot.stone)}`);
      let lost = 0;
      for (const k in loot.mats) { const x = loot.mats[k]; if (this.addMat(x.kind, x.name, x.g, x.n)) parts.push(`${DATA.matFull(x.kind, x.g)}×${U.fmt(x.n)}`); else lost++; }
      loot.pills.forEach(p => { if (this.addPill(p.t, p.g)) parts.push(`${DATA.realms[p.g]}·${DATA.pills[p.t].name}`); else lost++; });
      loot.equips.forEach(e => { if (this.addEquip(e)) parts.push(`<span class="q${e.q}">${DATA.quals[e.q]}${e.name}</span>`); else lost++; });
      for (const name in loot.cu || {}) { if (this.addCustom(name, loot.cu[name])) parts.push(`${name}×${U.fmt(loot.cu[name])}`); else lost++; } // 自定义物品
      if (loot.hx) { if (this.addFire(loot.hx)) parts.push(`火髓×${U.fmt(loot.hx)}`); else lost++; }   // 秘境：火髓、专用材料、模具
      for (const k in loot.sm || {}) { const [kk, f] = k.split(":"), ft = f === undefined ? undefined : +f;
        if (this.addSm(kk, loot.sm[k], ft)) parts.push(`${DATA.smName(kk, ft)}×${U.fmt(loot.sm[k])}`); else lost++; }
      if (o) o.exLost += lost;
      return parts.join("、") + (lost ? `（背包已满，遗失 ${lost} 件）` : "");
    },
    // 战败损失
    loseStone() { const lost = Math.floor(this.s.stone * CFG.explore.LOSE_STONE); this.s.stone -= lost; return lost; },

    /* ---------- 自动探索 ---------- */
    // once = true：历练（只走一次）；否则自动探索（需先历练通过该区域）
    toggleExplore(a, r, once) {
      const s = this.s;
      if (s.explore && !s.explore.cq && s.explore.map === a && s.explore.reg === r && !!s.explore.once === !!once) { this.stopExplore(once ? "放弃历练" : "停止自动探索"); return this.after(); }
      if (!this.realmOK(DATA.mapReq(a))) return;
      if (!once && !this.isTrained(a, r)) return this.log("需先在此区域历练通过，才能自动探索。", "sys");
      if (s.explore) this.stopExplore("更换");
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻（每 10 秒恢复 1%）。", "sys");
      s.explore = { map: a, reg: r, once: !!once, start: this.now(), step: 0, count: 0, loot: this.newLoot(), ev: [], last: "", plan: this.makePlan(), ms: this.exploreMs() };
      s.lastRun = null;
      this.exploreOpen = true;
      this.log(`开始在${DATA.regionName(a, r)}${once ? "历练" : "自动探索"}（期间无法修炼）。`, "sys");
      this.after();
    },
    /* ---------- 元婴出窍（config/sect.js 的 CFG.chuqiao）：自动探索指定次数，期间可以继续修炼 ---------- */
    openChuqiao(a, r) {
      const s = this.s, C = CFG.chuqiao, x = s.explore;
      if (x && x.cq && x.map === a && (x.reg || 0) === r) { this.stopExplore("结束出窍"); return this.after(); }
      if (!s.cqLv) return this.log(`需先在宗门宝库兑换${C.NAME}。`, "sys");
      if (this.cqLeftToday() <= 0) return this.log("今天的出窍次数已用完。", "sys");
      if (!this.realmOK(C.REALM)) return this.log(`出窍需要${DATA.realmLabel(C.REALM)}。`, "sys");
      if (!this.isTrained(a, r)) return this.log("需先在此区域历练通过，才能出窍探索。", "sys");
      const max = this.cqLeftToday();
      this.modal(`<h2>元婴出窍 · ${DATA.regionName(a, r)}</h2>
        <p>${C.NAME}第 ${s.cqLv} 层，今天还能出窍探索 ${max} 次；出窍期间可以继续修炼。开始后就扣次数，中途停止不退还。</p>
        <div class="line"><div>出窍次数<small>1 ~ ${max}</small></div><input id="cq-n" type="number" min="1" max="${max}" value="${max}" style="width:110px"></div>
        <div class="btns"><button class="primary" onclick="G.startChuqiao(${a},${r})">出窍</button><button onclick="G.closeModal()">取消</button></div>`);
    },
    startChuqiao(a, r) {
      const s = this.s, max = this.cqLeftToday(), n = Math.min(max, Math.floor(+($("#cq-n") && $("#cq-n").value) || 0));
      if (n < 1) return;
      this.closeModal();
      if (s.explore) this.stopExplore("更换");
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻（每 10 秒恢复 1%）。", "sys");
      this.cqUse(n);   // 开始就扣次数，停止不退
      s.explore = { map: a, reg: r, once: false, cq: n, start: this.now(), step: 0, count: 0, loot: this.newLoot(), ev: [], last: "", plan: this.makePlan(), ms: this.exploreMs() };
      s.lastRun = null;
      this.exploreOpen = true;
      this.log(`元婴出窍，前往${DATA.regionName(a, r)}探索 ${n} 次（期间可以继续修炼）。`, "sys");
      this.after();
    },
    // 停止：本次已获得的东西也结算
    stopExplore(why) {
      const x = this.s.explore; if (!x) return;
      const got = this.giveLoot(x.loot);
      this.log(`${why}，${x.mj !== undefined ? `离开${this.exName(x)}` : `共完成 ${x.count} 次探索`}${got ? "，本次收获 " + got : ""}。`, "sys");
      this.s.explore = null;
    },
    // 走一步：随机事件
    exploreStep() {
      const x = this.s.explore, a = x.map, r = x.reg || 0, mj = x.mj;
      if (!x.plan) x.plan = this.makePlan(this.exCfg(x));
      const type = { n: "nothing", m: "monster", e: "elite", b: "boss", h: "herb", o: "ore" }[x.plan[x.step]] || "nothing";
      x.step++;
      // 每走一步恢复气血、法力（HEAL_STEP + 宗门秘法「斗血 / 斗灵」）；战斗回合中不恢复
      const st = this.stats(), H = this.regenStep();
      this.s.hp = Math.min(st.hp, this.s.hp + st.hp * H.hp / 100); this.s.mana = Math.min(st.mana, this.s.mana + st.mana * H.mana / 100);
      let t = "", c = "", bd = null;
      const roll = ev => mj !== undefined ? this.rollMj(x.loot, ev, mj) : this.rollEvent(x.loot, ev, a);
      if (type === "herb") { t = `发现灵药，采得 ${roll("herbEvent") || "无"}`; c = "good"; }
      else if (type === "ore") { t = `发现矿脉，挖得 ${roll("oreEvent") || "无"}`; c = "good"; }
      else if (type === "monster" || type === "elite" || type === "boss") {
        const kind = type === "monster" ? "normal" : type, m = mj !== undefined ? this.makeMjMob(mj, kind) : this.makeMob(a, r, kind);
        const res = this.battle(m), tag = `${m.boss ? "【首领】" : m.elite ? "【精英】" : ""}${m.name}`;
        if (res.win) { this.s.kills++; t = `遭遇${tag}，${res.rounds}回合击败，获得 ${this.rollMonsterLoot(x.loot, m, a, mj)}`; c = m.boss ? "gold" : ""; }
        else if (res.lose) { t = `遭遇${tag}，第 ${res.rounds} 回合不敌重伤，遗失灵石 ${U.fmt(this.loseStone())}。${res.why}`; c = "bad"; }
        else { t = `遭遇${tag}，缠斗 ${res.rounds} 回合，各自退去`; }
        bd = res.detail;
      } else t = U.pick(DATA.exploreIdle);
      x.ev.unshift(bd ? { n: x.step, t, c, b: bd } : { n: x.step, t, c });   // b：完整战斗过程（点「详情」看）
      if (x.ev.length > this.exCfg(x).TIME) x.ev.length = this.exCfg(x).TIME;
      return c === "bad"; // 战败：本次提前结束
    },
    // 生成一次探索的事件顺序（字符串，每个字符一步）：首领固定在最后一步
    makePlan(E = CFG.explore) {
      const T = E.TIME;
      const list = [...Array(E.MONSTERS).fill("m"), ...Array(E.ELITES || 0).fill("e"), ...Array(U.rand(E.HERB_MIN, E.HERB_MAX)).fill("h"), ...Array(U.rand(E.ORE_MIN, E.ORE_MAX)).fill("o")];
      while (list.length < T - E.BOSS) list.push("n");
      list.length = T - E.BOSS;
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      return list.join("") + "b".repeat(E.BOSS);
    },
    // 每走一步的毫秒数 = STEP_SEC − 宗门秘法「神行」（只影响历练 / 探索走路，最少 STEP_MIN 秒）
    exploreMs() { const E = CFG.explore; return Math.round(Math.max(E.STEP_MIN || 0.5, (E.STEP_SEC || 1) - this.mifaBonus().explore) * 1000); },
    // 推进到当前时间（每 exploreMs 走一步；满 TIME 步结算一次）
    advanceExplore() {
      const s = this.s;
      if (!s.explore) return;
      let x = s.explore; const T = this.exCfg(x).TIME;
      if (x.step === undefined) Object.assign(x, { start: this.now(), step: 0, count: x.count || 0, loot: this.newLoot(), ev: [], last: "" }); // 旧存档
      let changed = false;
      if (!x.ms) x.ms = this.exploreMs();
      while (s.explore && this.now() >= x.start + (x.step + 1) * x.ms) {
        changed = true;
        const lost = this.exploreStep();
        if (x.step >= T || lost) {
          // 结算本次
          x.count++;
          const got = this.giveLoot(x.loot);
          x.last = `${x.once ? "历练" : x.mj !== undefined ? "探索" : `第 ${x.count} 次探索`}${lost ? `（第 ${x.step} 步战败，提前结束）` : ""}：${got || "一无所获"}`;
          this.log(x.mj !== undefined ? this.exName(x) + x.last : x.last, lost ? "bad" : "gold");
          // 保存这一次的全部事件，结束后也能查看（含失败那一步）
          s.lastRun = { title: `${this.exName(x)} · ${x.last}`, ev: x.ev.slice(), bad: lost };
          if (x.mj !== undefined) { if (!this.mjFinish(x, lost)) break; x = s.explore; continue; }   // 秘境：每处只走一次，一键探索接着走下一处
          if (!lost) this.mjDiscover(x.map);   // 凡界地图走完一次：有几率发现秘境
          if (x.once) { // 历练只走一次；走完且未战败 = 通过，解锁该区域自动探索
            const key = this.regionKey(x.map, x.reg || 0);
            if (!lost && !s.trainedR.includes(key)) { s.trainedR.push(key); this.log(`${DATA.regionName(x.map, x.reg || 0)}历练通过！已可自动探索。`, "gold"); }
            else if (lost) this.log("历练失败，提升实力后再来。", "bad");
            s.explore = null; break;
          }
          if (x.cq && x.count >= x.cq) {   // 元婴出窍：探索够次数就回来
            this.log(`出窍探索 ${x.count} 次已完成，元婴归窍。`, "gold");
            s.explore = null; break;
          }
          if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) {
            this.log(`气血不足三成，自动探索停止（共探索 ${x.count} 次）。`, "bad");
            s.lastRun.title += "；气血不足三成，自动探索停止";
            s.explore = null; break;
          }
          x.start = x.start + x.step * x.ms; x.ms = this.exploreMs(); x.step = 0; x.loot = this.newLoot(); x.ev = []; x.plan = this.makePlan(this.exCfg(x));
          s.lastRun = null; // 开始新一次：不保留上一次的记录
        }
      }
      if (changed) this.dirty();
    },
    /* ---------- 秘境（config/mijing.js） ---------- */
    exCfg(x) { return x && x.mj !== undefined ? CFG.mijing : CFG.explore; },
    exName(x) { return x.mj !== undefined ? "秘境·" + this.mjDef(x.mj).name : DATA.regionName(x.map, x.reg || 0); },
    mjDef(i) { return CFG.mijing.list[i]; },
    mjToday() { const d = new Date(this.now()); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; },
    // 秘境存档（换日自动清空今天的次数）
    mjState() {
      const s = this.s, m = s.mj || (s.mj = { found: [], trained: [], day: "", used: {} }), t = this.mjToday();
      if (m.day !== t) { m.day = t; m.used = {}; }
      return m;
    },
    mjLeft(i) { return Math.max(0, (CFG.mijing.DAILY || 1) - (this.mjState().used[i] || 0)); },
    // 凡界地图走完一次：每处在这张地图能发现、还没发现的秘境按 find.chance% 判定，一次最多发现一处
    mjDiscover(a) {
      const m = this.mjState();
      for (let i = 0; i < CFG.mijing.list.length; i++) {
        const d = this.mjDef(i);
        if (m.found.includes(i) || !d.find || d.find.map !== a || Math.random() * 100 >= (d.find.chance || 0)) continue;
        m.found.push(i);
        this.log(`探得秘境消息：发现「${d.name}」（需${DATA.realmLabel(d.realm)}）！可在 历练 → 秘境 进入。`, "gold");
        return;
      }
    },
    makeMjMob(i, kind) {
      const d = this.mjDef(i), b = d[kind], k = CFG.monster.RAND, v = x => x * (1 - k + Math.random() * 2 * k);
      const name = kind === "boss" ? d.bossName : (kind === "elite" ? "精英·" : "") + U.pick(d.monsters);
      return this.addMagic({ name, Lm: d.L, kind, boss: kind === "boss", elite: kind === "elite",
        hp: v(b.hp), atk: v(b.atk), def: v(b.def), speed: v(b.speed), hit: v(b.hit), dodge: v(b.dodge), crit: b.crit }, kind, b);
    },
    // 秘境掉落 = 指定地图的普通掉落（× mat）+ extra 额外掉落
    rollMj(loot, ev, i) {
      const d = this.mjDef(i), got = [this.rollEventMats(loot, ev, d.drops, d.mat === undefined ? 1 : d.mat)];
      for (const x of (d.extra || {})[ev] || []) {
        if (Math.random() * 100 >= (x.chance || 0)) continue;
        const nn = x.n || [1, 1], n = U.rand(nn[0], nn[1]); if (n <= 0) continue;
        const t = this.lootAdd(loot, x.item, n); if (t) got.push(t);
      }
      return got.filter(Boolean).join("、");
    },
    // 按名字把东西记进 loot：火髓 / 专用材料 / 模具 / 药材矿石 / 自定义物品
    lootAdd(loot, name, n) {
      if (name === "火髓") { loot.hx = (loot.hx || 0) + n; return `火髓×${n}`; }
      const sm = DATA.smByName(name);
      if (sm) { const ft = sm.k === "mold" && sm.ft === undefined ? Math.floor(Math.random() * DATA.fabaoTypes.length) : sm.ft;
        const key = sm.k + (ft === undefined ? "" : ":" + ft); loot.sm = loot.sm || {}; loot.sm[key] = (loot.sm[key] || 0) + n; return `${DATA.smName(sm.k, ft)}×${n}`; }
      const m = DATA.matByName[name];
      if (m) { const key = m.kind + "|" + name; (loot.mats[key] = loot.mats[key] || { kind: m.kind, name, g: m.g, n: 0 }).n += n; return `${name}×${n}`; }
      if (this.cuDef(name)) { loot.cu = loot.cu || {}; loot.cu[name] = (loot.cu[name] || 0) + n; return `${name}×${n}`; }
      return "";
    },
    mjCanEnter(i) { const d = this.mjDef(i); return d && this.mjState().found.includes(i) && this.r() >= d.realm && this.mjLeft(i) > 0; },
    // 开始走一处秘境（扣今天的次数）；x = 正在走的探索（一键探索接着走）
    mjStart(i, once, queue, x) {
      const s = this.s; this.mjState().used[i] = (this.mjState().used[i] || 0) + 1;
      const n = { map: -1, reg: 0, mj: i, once: !!once, queue: queue || [], start: x ? x.start + x.step * x.ms : this.now(), step: 0, count: 0, loot: this.newLoot(), ev: [], last: "", plan: this.makePlan(CFG.mijing), ms: this.exploreMs() };
      if (this.mjDef(i).realm === CFG.chuqiao.LU_MJ_REALM && CFG.chuqiao.LU_DROP > 0) this.lootAdd(n.loot, DATA.smName("lu"), CFG.chuqiao.LU_DROP);   // 元婴期秘境必定掉落养神灵露
      s.explore = n; s.lastRun = x ? s.lastRun : null;
      this.log(`进入秘境「${this.mjDef(i).name}」${once ? "历练" : "探索"}（期间无法修炼）。`, "sys");
    },
    // 历练 / 探索一处秘境
    toggleMj(i, once) {
      const s = this.s, x = s.explore;
      if (x && x.mj === i) { this.stopExplore(once ? "放弃历练" : "停止探索"); return this.after(); }
      const d = this.mjDef(i), m = this.mjState();
      if (!m.found.includes(i)) return;
      if (!this.realmOK(d.realm)) return;
      if (!once && !m.trained.includes(i)) return this.log("需先历练通过这处秘境，才能自动探索。", "sys");
      if (this.mjLeft(i) <= 0) return this.log("这处秘境今天已经进过了，明天再来。", "sys");
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻。", "sys");
      if (x) this.stopExplore("更换");
      this.mjStart(i, once); this.exploreOpen = true; this.after();
    },
    // 一键探索：今天还没进过、已历练通过的秘境依次自动探索
    mjAll() {
      const s = this.s, m = this.mjState(), list = m.found.filter(i => m.trained.includes(i) && this.mjCanEnter(i)).sort((a, b) => a - b);
      if (!list.length) return this.log("没有可以探索的秘境（要已发现、已历练通过、今天还没进过）。", "sys");
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) return this.log("气血不足三成，先休养片刻。", "sys");
      if (s.explore) this.stopExplore("更换");
      this.mjStart(list[0], false, list.slice(1)); this.exploreOpen = true; this.after();
    },
    // 秘境走完一处：历练通过记下；一键探索接着下一处。返回 true = 还在继续
    mjFinish(x, lost) {
      const s = this.s, m = this.mjState(), name = this.mjDef(x.mj).name;
      if (x.once) {
        if (!lost && !m.trained.includes(x.mj)) { m.trained.push(x.mj); this.log(`秘境「${name}」历练通过！以后可以自动探索。`, "gold"); }
        else if (lost) this.log("秘境历练失败，明天提升实力再来。", "bad");
      }
      const q = (x.queue || []).filter(i => this.mjCanEnter(i));
      if (lost || !q.length) { s.explore = null; if (x.queue && x.queue.length && lost) s.lastRun.title += "；战败，一键探索停止"; return false; }
      if (s.hp < this.stats().hp * DATA.EXPLORE_STOP) { this.log("气血不足三成，一键探索停止。", "bad"); s.lastRun.title += "；气血不足三成，一键探索停止"; s.explore = null; return false; }
      this.mjStart(q[0], false, q.slice(1), x);
      return true;
    },
    stopNow() { const x = this.s.explore; if (x) this.stopExplore(x.once ? "放弃历练" : "停止探索"); this.after(); },
    mijingView() {
      const s = this.s, m = this.mjState(), L = CFG.mijing.list, x = s.explore;
      const ready = m.found.filter(i => m.trained.includes(i) && this.mjCanEnter(i)).length;
      const rows = m.found.slice().sort((a, b) => a - b).map(i => {
        const d = L[i], lock = !this.realmOK(d.realm), ok = m.trained.includes(i), left = this.mjLeft(i), on = x && x.mj === i;
        return `<div class="line"><div>${d.name}<span class="tag">需${DATA.realmLabel(d.realm)}</span><small>首领 ${d.bossName} · ${ok ? "已通过历练" : "未历练"} · 今天${left > 0 ? `还能进 ${left} 次` : "已进过"}</small></div>
          ${lock ? `<button class="sm" disabled>境界不足</button>` : `<div><button class="sm ${on && x.once ? "on" : ""}" onclick="G.toggleMj(${i},true)" ${on ? "" : left > 0 ? "" : "disabled"}>${on && x.once ? "停止" : "历练"}</button>
          <button class="sm ${on && !x.once ? "on" : ""}" onclick="G.toggleMj(${i})" ${on ? "" : ok && left > 0 ? "" : "disabled"}>${on && !x.once ? "停止" : "探索"}</button></div>`}</div>`;
      }).join("");
      return `<div class="card"><h3>秘境<small>已发现 ${m.found.length} / ${L.length}</small></h3>
        ${rows || `<p class="desc">还没有发现秘境。在凡界地图历练、自动探索时，有几率探得秘境消息。</p>`}
        ${m.found.length ? `<div class="btns"><button class="primary" onclick="G.mjAll()" ${ready ? "" : "disabled"}>一键探索（${ready} 处）</button></div>` : ""}</div>`;
    },
    setExploreOpen(v) { this.exploreOpen = v; this.render(); },
    // 探索信息一行：战斗事件后面带「详情」按钮
    evLine(e, src, i) { return `<p class="${e.c}"><b>第${e.n}步</b> ${e.t}${e.b ? ` <button class="sm" onclick="G.showBattle('${src}',${i})">详情</button>` : ""}</p>`; },
    setLastOpen(v) { this.lastOpen = v; this.render(); },
    setMapSel(a) { this.mapSel = a; this.render(); },   // a = 地图序号，"mj" = 秘境

    /* ---------- 坊市：丹药 装备 功法 药材 矿石 ----------
     * 丹药、装备：content/items.js 的 ITEMS.shop，只卖练气品质（自定义物品按 item 名）
     * 功法：凡界坊市功法（config/gongfa.js 的 shop），灵石购买，买下即学会第 1 层
     * 药材、矿石：凡界地图会掉的（config/drops.js），售价 = 出售价 × CFG.price.SHOP_MAT */
    setShopTab(t) { this.shopTab = t; this.render(); },
    setShopStar(n) { this.shopStar = n; this.render(); },
    setShopTier(t) { this.shopTier = t; this.render(); },
    shopList() {
      const g = 0, list = [];   // 只卖练气品质
      const src = ITEMS.shop || [...Object.keys(DATA.pills).map(t => ({ kind: "pill", type: t })), ...Object.keys(DATA.slots).filter(sl => sl !== "fabao").map(sl => ({ kind: "eq", slot: sl, q: 1 }))];
      for (const x of src) {
        if (!x || (x.realm !== undefined && this.r() < x.realm)) continue;
        if (x.item) { const d = this.cuDef(x.item); if (d) list.push({ kind: "cu", name: x.item, price: x.price || 0, tab: ["equip", "fabao"].includes(d.type) ? "eq" : "pill" }); }
        else if (x.kind === "pill" && DATA.pills[x.type]) list.push({ kind: "pill", type: x.type, g, price: x.price || DATA.pillPrice(x.type, g), tab: "pill" });
        else if (x.kind === "eq" && DATA.equipNames[x.slot]) list.push({ kind: "eq", slot: x.slot, g, q: x.q || 1, price: x.price || Math.floor(CFG.price.SHOP_EQUIP), tab: "eq" });
      }
      return list;
    },
    buy(i, n = 1) {
      const it = this.shopList()[i]; if (!it) return;
      let k = 0;
      for (; k < n; k++) {
        if (this.s.stone < it.price) { this.log("灵石不足。", "sys"); break; }
        const ok = it.kind === "pill" ? this.addPill(it.type, it.g) : it.kind === "cu" ? this.addCustom(it.name)
          : this.addEquip(DATA.forgeSlots.includes(it.slot) ? DATA.rollForged(it.slot, 0) : this.makeEquip(it.slot, it.g, it.q)); // 头盔~吊坠：一阶炼器装备（随机属性）
        if (!ok) break;
        this.s.stone -= it.price;
      }
      if (k) this.log(`购买成功 ×${k}。`, "good");
      this.after();
    },
    // 坊市药材、矿石
    shopMatPrice(kind, g) { return Math.max(1, Math.ceil(DATA.matPrice(kind, g) * (CFG.price.SHOP_MAT || 3))); },
    buyMat(kind, g, n) {
      n = Math.floor(n || +($("#shop-n") && $("#shop-n").value) || 1);
      const names = kind === "herb" ? DATA.herbs : DATA.ores;
      if (n <= 0 || !DATA.fanMats().has(names[g])) return;
      const c = this.shopMatPrice(kind, g) * n;
      if (this.s.stone < c) return this.log(`灵石不足，需要 ${U.fmt(c)}。`, "sys");
      if (!this.addMat(kind, names[g], g, n)) return;
      this.s.stone -= c; this.shopN = n;
      this.log(`购买${DATA.matFull(kind, g)} ×${U.fmt(n)}，灵石 -${U.fmt(c)}。`, "good"); this.after();
    },
    // 坊市功法：买下即学会第 1 层
    buyGongfa(id) {
      const g = DATA.skillInfo(id);
      if (!g || g.src !== "shop" || this.hasGongfa(id)) return;
      if (!this.realmOK(g.sect.reqRealm)) return this.log(`需要${DATA.realmLabel(g.sect.reqRealm)}。`, "sys");
      if (this.s.stone < g.cost) return this.log("灵石不足。", "sys");
      this.s.stone -= g.cost; this.s.gongfa[id] = 1;
      if (g.kind === "sp") this.autoSlotSpell(id);
      this.log(`购得《${g.name}》（${g.star}星 ${g.tier.name}），习得第 1 层。`, "gold"); this.after();
    },
    // 管理员：网页里更新游戏（服务器拉取 GitHub 最新代码，完成后刷新页面）
    async webUpdate() {
      if (this.updating || !confirm("从 GitHub 拉取最新代码并重启存档服务？（会先同步一次存档）")) return;
      this.updating = true; this.render();
      try { await this.save(true); } catch (e) {}
      try { await API.adminUpdate(); } catch (e) { this.updating = false; this.log("更新失败：" + e.message, "bad"); return this.render(); }
      const t0 = Date.now(), poll = async () => {
        try { const j = await API.adminInfo(); this.adminInfo = j;
          if (/更新完成|失败|error/i.test(j.log || "") && Date.now() - t0 > 3000) { this.updating = false; this.log(/更新完成/.test(j.log) ? "游戏已更新，点「刷新页面」载入新版本。" : "更新出错，看下面的输出。", /更新完成/.test(j.log) ? "gold" : "bad"); return this.render(); }
        } catch (e) {}   // 存档服务重启的几秒连不上，继续等
        if (Date.now() - t0 > 120000) { this.updating = false; this.log("等待超时，稍后刷新页面看看。", "bad"); return this.render(); }
        this.render(); setTimeout(poll, 3000);
      };
      setTimeout(poll, 3000);
    },
    shopView() {
      const s = this.s, t = this.shopTab || "pill";
      const tabs = `<div class="sub-tabs">${[["pill", "丹药"], ["eq", "装备"], ["gf", "功法"], ["herb", "药材"], ["ore", "矿石"]].map(([k, n]) =>
        `<button class="${t === k ? "active" : ""}" onclick="G.setShopTab('${k}')">${n}</button>`).join("")}</div>
        <div class="sub-tabs">${[["room", "修炼室"], ["gfroom", "练功房"]].map(([k, n]) =>
        `<button class="${t === k ? "active" : ""}" onclick="G.setShopTab('${k}')">${n}</button>`).join("")}</div>`;
      if (t === "room" || t === "gfroom") return tabs + this.shopRoomView(t === "room" ? "cult" : "gf");
      if (t === "pill" || t === "eq") {
        const rows = this.shopList().map((it, i) => {
          if (it.tab !== t) return "";
          const cd = it.kind === "cu" ? this.cuDef(it.name) : null, multi = it.kind === "pill" || (cd && cd.type !== "equip" && cd.type !== "fabao");
          const name = cd ? `<span class="q${cd.q || 0}">${it.name}</span>` : it.kind === "pill" ? `${DATA.realms[it.g]}·${DATA.pills[it.type].name}` : DATA.forgeSlots.includes(it.slot) ? DATA.forgeEqName(it.slot, 0) : `${DATA.quals[it.q]} ${DATA.realms[it.g]}·${DATA.equipNames[it.slot][Math.min(5, it.q)]}`;
          const desc = cd ? `${DATA.cuTypes[cd.type] || ""}${cd.desc ? " · " + cd.desc : ""}${["perm", "equip", "fabao"].includes(cd.type) ? " · " + this.cuStatText(this.cuStats(cd)) : ""}`
            : it.kind === "pill" ? `修炼速度 +${Math.round(DATA.pillPct(it.type, it.g))}%，${DATA.pills[it.type].dur}次修炼` : DATA.forgeSlots.includes(it.slot) ? `${DATA.slots[it.slot]} · 2 条主属性 + 1~5 条附加属性（颜色随机）` : `${DATA.slots[it.slot]} · ${this.equipDesc(this.makeEquip(it.slot, it.g, it.q))}`;
          const img = cd ? DATA.cuIcon(cd) : it.kind === "pill" ? DATA.pillIcon(it.type) : DATA.iconImg("eq_" + it.slot);
          return `<div class="line"><div>${DATA.li(img)}${name}<small>${desc}</small></div><div>
            <button class="sm" onclick="G.buy(${i})" ${s.stone < it.price ? "disabled" : ""}>${U.fmt(it.price)}</button>
            ${multi ? `<button class="sm" onclick="G.buy(${i},10)" ${s.stone < it.price * 10 ? "disabled" : ""}>×10</button>` : ""}</div></div>`;
        }).join("");
        return tabs + `<div class="card"><h3>${t === "pill" ? "丹药" : "装备"}<small>练气期货品 · 灵石 ${U.fmt(s.stone)}</small></h3>${rows || `<p class="desc">暂无货品。</p>`}</div>`;
      }
      if (t === "gf") {
        const star = this.shopStar || 1, tier = this.shopTier || "huang", T = DATA.tierById[tier], N = DATA.SHOP_GF_PREFIX.length;
        const srcs = DATA.shopSources.filter(o => o.star === star), lock = !this.realmOK(srcs[0] ? srcs[0].reqRealm : 0);
        const line = g => { const has = this.hasGongfa(g.id);
          const desc = g.kind === "sp" ? `${g.el.name}系 · 攻击×${g.pct}% + ${U.fmt(g.perLv)}/层 · 耗法力 ${U.fmt(g.mana)}` : `每层${g.label} +${U.num(g.perLv)}`;
          return `<div class="line"><div>${DATA.skillIco(g)}《${g.name}》<span class="tag">${g.star}星</span><span class="tag">${g.kind === "sp" ? "法术" : g.type.name}</span><small>${desc} · ${U.fmt(g.cost)} 灵石</small></div>
            <button class="sm" onclick="G.buyGongfa('${g.id}')" ${has || lock || s.stone < g.cost ? "disabled" : ""}>${has ? "已学会" : lock ? "境界不足" : "购买"}</button></div>`; };
        return tabs + `<div class="room-grid">${Array.from({ length: N }, (_, i) => `<button class="${star === i + 1 ? "active" : ""}" onclick="G.setShopStar(${i + 1})">${i + 1}星</button>`).join("")}</div>
          <div class="room-grid">${DATA.tiers.map(x => `<button class="${tier === x.id ? "active" : ""}" onclick="G.setShopTier('${x.id}')">${x.name}</button>`).join("")}</div>
          <p class="desc">凡界坊市功法 ${star}星 · 需${DATA.realmLabel(srcs[0] ? srcs[0].reqRealm : 0)} · 灵石 ${U.fmt(s.stone)} · 买下即学会第 1 层</p>` +
          srcs.map(o => `<div class="card"><h3>${o.name}<span class="tag">${DATA.elById[o.el].name}</span><small>${T.name}</small></h3>` +
            DATA.gongfaTypes.map(ty => line(DATA.gongfaInfo(DATA.gongfaId(o.id, ty.id, tier)))).join("") +
            line(DATA.spellInfo(DATA.spellId(o.id, o.el, tier))) + `</div>`).join("");
      }
      const names = t === "herb" ? DATA.herbs : DATA.ores, fan = DATA.fanMats();
      return tabs + `<div class="card"><h3>${DATA.matKinds[t]}<small>凡界地图产出 · 灵石 ${U.fmt(s.stone)}</small></h3>
        <div class="line"><div>购买数量</div><input id="shop-n" type="number" min="1" value="${this.shopN || 1}" oninput="G.shopN=+this.value" style="width:110px"></div>` +
        names.map((n, g) => { if (!fan.has(n)) return ""; const c = this.shopMatPrice(t, g);
          return `<div class="line"><div>${DATA.li(DATA.matImg(t, g))}${DATA.matFull(t, g)}<small>${U.fmt(c)} 灵石/个 · 已有 ${U.fmt(this.countMat(t, g))}</small></div>
            <button class="sm" onclick="G.buyMat('${t}',${g})" ${s.stone < c ? "disabled" : ""}>购买</button></div>`; }).join("") + `</div>`;
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
        ${s.explore ? (() => { const x = s.explore, T = this.exCfg(x).TIME, L = x.loot;
          const mats = Object.values(L.mats).map(m => `${m.name}×${U.fmt(m.n)}`);
          if (L.hx) mats.push(`火髓×${U.fmt(L.hx)}`);
          for (const k in L.sm || {}) { const [kk, f] = k.split(":"); mats.push(`${DATA.smName(kk, f === undefined ? undefined : +f)}×${U.fmt(L.sm[k])}`); }
          for (const n in L.cu || {}) mats.push(`${n}×${U.fmt(L.cu[n])}`);
          const sub = x.mj !== undefined ? (x.once ? "" : x.queue && x.queue.length ? `一键探索 · 后面还有 ${x.queue.length} 处` : "秘境探索") : x.once ? "" : x.cq ? `已完成 ${x.count} / ${x.cq} 次` : `已完成 ${x.count} 次`;
          return `<div class="card"><h3>${x.once ? "历练中" : x.cq ? "出窍探索中" : "自动探索中"} · ${this.exName(x)}<small>${sub}</small></h3>
          <div class="bar tick"><div style="width:${x.step / T * 100}%"></div></div>
          <div class="row small"><span>第 ${x.step} / ${T} 步 · 剩余 ${U.dur(Math.ceil((T - x.step) * (x.ms || 1000) / 1000))}</span><span>
            <button class="sm" onclick="G.setExploreOpen(${!this.exploreOpen})">${this.exploreOpen ? "收起信息" : "探索信息"}</button>
            <button class="sm" onclick="G.stopNow()">停止</button></span></div>
          <p class="desc">本次收获（结束后放入背包）：灵石 ${U.fmt(L.stone)}${mats.length ? "、" + mats.join("、") : ""}</p>
          ${this.exploreOpen ? `<div class="explore-log">${x.ev.map((e, i) => this.evLine(e, "cur", i)).join("") || "<p>出发……</p>"}</div>` : ""}</div>`; })()
        : s.lastRun ? `<div class="card"><h3>本次结果<small><button class="sm" onclick="G.setLastOpen(${!this.lastOpen})">${this.lastOpen ? "收起" : "详细"}</button></small></h3>
          <p class="desc ${s.lastRun.bad ? "q5" : ""}">${s.lastRun.title}</p>
          ${this.lastOpen ? `<div class="explore-log">${s.lastRun.ev.map((e, i) => this.evLine(e, "last", i)).join("")}</div>` : ""}</div>` : ""}
        ${(() => {
          // 地图选择（9 张）+ 选中地图的 东西南北 四个区域
          const sel = this.mapSel !== undefined ? this.mapSel : s.explore ? (s.explore.mj !== undefined ? "mj" : s.explore.map) : Math.min(this.r(), DATA.maps.length - 1);
          const grid = `<div class="room-grid five">${DATA.maps.map((m, a) => `<button class="${sel === a ? "active" : ""}" onclick="G.setMapSel(${a})">${m.name}${!this.realmOK(DATA.mapReq(a)) ? `<small>需${DATA.realmLabel(DATA.mapReq(a))}</small>` : ""}</button>`).join("")}
            <button class="${sel === "mj" ? "active" : ""}" onclick="G.setMapSel('mj')">秘境<small>${this.mjState().found.length ? `已发现 ${this.mjState().found.length} 处` : "未发现"}</small></button></div>`;
          if (sel === "mj") return grid + this.mijingView();
          const map = DATA.maps[sel], lock = !this.realmOK(DATA.mapReq(sel));
          return grid + `<div class="card"><h3>${map.name}<small>需${DATA.realmLabel(DATA.mapReq(sel))} · 历练一次 ${CFG.explore.TIME} 步，每步 ${U.num(this.exploreMs() / 1000)} 秒，通过后才能自动探索</small></h3>` +
          DATA.regionDirs.map((d, r) => {
            const R = DATA.region(sel, r), ok = this.isTrained(sel, r), x = s.explore && s.explore.map === sel && (s.explore.reg || 0) === r ? s.explore : null;
            return `<div class="line"><div>${d}域<small>首领 ${DATA.regionBoss(sel, r)} · ${ok ? "已通过历练" : "未历练"}</small></div>
              ${lock ? `<button class="sm" disabled>需${DATA.realmLabel(DATA.mapReq(sel))}</button>` : `<div><button class="sm ${x && x.once ? "on" : ""}" onclick="G.toggleExplore(${sel},${r},true)">${x && x.once ? "停止" : "历练"}</button>
              <button class="sm ${x && !x.once && !x.cq ? "on" : ""}" onclick="G.toggleExplore(${sel},${r})" ${ok ? "" : "disabled"}>${x && !x.once && !x.cq ? "停止" : "探索"}</button>
              <button class="sm ${x && x.cq ? "on" : ""}" onclick="G.openChuqiao(${sel},${r})" ${ok && s.cqLv ? "" : "disabled"}>${x && x.cq ? "停止" : "出窍"}</button></div>`}</div>`;
          }).join("") + `<p class="desc">期间无法修炼；气血低于三成停止。</p></div>`;
        })()}`;
    }

    if (wt === "shop") return tabs + this.shopView();

    if (this.adminInfo === undefined) { this.adminInfo = null; API.adminInfo().then(j => { this.adminInfo = j; this.render(); }).catch(() => {}); }
    const A = this.adminInfo, upd = A && A.admin ? `<div class="card"><h3>游戏更新<small>管理员</small></h3>
      <p class="desc">当前版本：${A.version || "未知"}</p>
      <div class="btns"><button class="primary" onclick="G.webUpdate()" ${this.updating ? "disabled" : ""}>${this.updating ? "更新中…" : "从 GitHub 更新"}</button>
      <button onclick="location.reload()">刷新页面</button></div>
      ${A.log ? `<div class="explore-log" style="white-space:pre-wrap;font-size:11px">${A.log.replace(/</g, "&lt;")}</div>` : ""}</div>` : "";
    return tabs + upd + `<div class="card"><h3>账号<small>${API.user}</small></h3>
      <p class="desc">存档保存在服务器，换手机、关浏览器都不会丢。离线期间修炼、聚灵阵持续进行，不封顶。</p>
      <div class="btns"><button onclick="G.save(true)">立即同步</button><button onclick="G.logout()">退出登录</button>
      <button onclick="G.restart()">删档重来</button></div></div>`;
  },
});
