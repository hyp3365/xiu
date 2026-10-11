/* =====================================================================
 * 模块：丹方、炼丹房、炼器室
 * ---------------------------------------------------------------------
 * 丹方：在 门派 → 炼丹房 学习（消耗贡献 + 时间，一次学一个），学会后才在洞府炼丹房显示。
 *   一星门派可学一阶，二星可学一~二阶……；含 7 种属性丹 + 3 种修炼速度丹（聚气/聚灵/培元）。
 * 图纸：门派 → 宗门宝库 兑换后放进背包，在背包点「学习」才能炼制该炉子。
 * 炉子：炼丹炉、炼器炉都在 洞府 · 炼器室 炼制（必须装有炼器炉，炼器炉缩短炼制时间），
 *   炼好的炉子放进背包，在背包点「使用」后装进洞府；洞府炼丹房 / 炼器室可随时更换使用哪一个。
 *   宗门宝库「杂物」可直接兑换一阶炼丹炉、一阶炼器炉。
 * 炼丹：必须装有炼丹炉，丹阶不能高于炼丹炉阶；只消耗药材，一炉可连续炼多枚，出炉放进背包。
 * 全部数值在 js/config/ 数值文件 的 alchemy / furnace。按 G.now() 计时，离线也会继续。
 * 存档：
 *   recipes    ["atk|0", "juqi|0", ...]          已学会的丹方（类型|阶）
 *   danStudy   { key, end } | null              正在学习的丹方
 *   blueprints { dan: [阶...], qi: [阶...] }      已学会的图纸
 *   furnaces   { dan: [阶...], qi: [阶...] }      已装进洞府的炉子
 *   furnaceUse { dan: 阶|-1, qi: 阶|-1 }          正在使用的炉子
 *   forgeJob   { kind, g, end } | null           炼器室正在炼制的炉子
 *   forgeQueue [{ kind, g }]                     炼器室队列（排队时已扣材料）
 *   alchJob    { type, g, n, done, next, per } | null  正在炼的丹
 *   alchQueue  [{ type, g, n }]                   炼丹队列（排队时已扣药材）
 *   danEaten   { "atk|0": 已服用枚数 }
 * ===================================================================== */
G.module({
  id: "craft",

  defaults: () => ({
    recipes: [], danStudy: null,
    blueprints: { dan: [], qi: [] },
    furnaces: { dan: [], qi: [] },
    furnaceUse: { dan: -1, qi: -1 },
    forgeJob: null,
    forgeQueue: [],
    alchJob: null,
    alchQueue: [],
    danEaten: {},
  }),

  tick() { this.craftTick(); },

  api: {
    /* ---------- 材料 ---------- */
    countMat(kind, g) {
      const name = DATA.matName(kind, g);
      return this.s.bag.reduce((a, it) => a + (it.t === "mat" && it.kind === kind && it.name === name ? it.n : 0), 0);
    },
    takeMat(kind, g, n) {
      const name = DATA.matName(kind, g);
      for (let i = this.s.bag.length - 1; i >= 0 && n > 0; i--) {
        const it = this.s.bag[i];
        if (it.t !== "mat" || it.kind !== kind || it.name !== name) continue;
        const k = Math.min(n, it.n); this.removeAt(i, k); n -= k;
      }
    },
    hasMats(list, times = 1) { return list.every(m => this.countMat(m.kind, m.g) >= m.n * times); },
    matsText(list, times = 1) {
      return list.map(m => { const have = this.countMat(m.kind, m.g), need = m.n * times;
        return `<span class="${have >= need ? "" : "q5"}">${DATA.matFull(m.kind, m.g)} ${U.fmt(have)}/${U.fmt(need)}</span>`; }).join("、");
    },
    giveBack(list, times = 1) { list.forEach(m => this.addMat(m.kind, DATA.matName(m.kind, m.g), m.g, m.n * times)); },

    /* ---------- 定时结算（每 10 秒，离线也会补算） ---------- */
    craftTick() {
      const s = this.s, now = this.now();
      this.fixCraft();
      // 丹方学习
      if (s.danStudy && now >= s.danStudy.end) {
        const [t, g] = s.danStudy.key.split("|");
        if (!s.recipes.includes(s.danStudy.key)) s.recipes.push(s.danStudy.key);
        s.danStudy = null; this.log(`学会丹方《${DATA.danName(t, +g)}》，可在洞府炼丹房炼制。`, "gold");
      }
      // 炼器室：炉子炼好放进背包（背包满就等着），队列自动衔接
      let j, guard = 0;
      while ((j = s.forgeJob) && now >= j.end && guard++ < 1000) {
        if (!this.addFurnaceItem(j.kind, j.g)) break;
        s.forgeJob = null;
        this.log(`${DATA.furnaceName(j.kind, j.g)}炼制成功，已放进背包（点击「使用」装进洞府）。`, "gold");
        const nx = s.forgeQueue.shift();
        if (nx) s.forgeJob = { kind: nx.kind, g: nx.g, end: j.end + this.forgePer(nx.kind, nx.g) };
      }
      // 炼丹（一炉炼完自动开始队列里的下一炉）
      guard = 0;
      while (s.alchJob && guard++ < 1000) {
        const a = s.alchJob;
        while (a.done < a.n && now >= a.next) {
          if (!this.addDan(a.type, a.g, 1)) break;
          a.done++; a.next += a.per;
        }
        if (a.done < a.n) break;
        s.alchJob = null; this.log(`${DATA.danName(a.type, a.g)} ×${a.n} 全部出炉。`, "gold");
        const nx = s.alchQueue.shift();
        if (nx) { const per = this.danPer(nx.type, nx.g); s.alchJob = { type: nx.type, g: nx.g, n: nx.n, done: 0, per, next: a.next - a.per + per }; }
      }
    },
    // 旧存档转换
    fixCraft() {
      const s = this.s;
      if (s.furnace) { for (const k of ["dan", "qi"]) if (s.furnace[k] >= 0) { s.furnaces[k] = [s.furnace[k]]; s.furnaceUse[k] = s.furnace[k]; } delete s.furnace; }
      if (s.furnaceJob) { // v11：两个炉子各自炼制 → v12：炼器室一条队列
        for (const k of ["dan", "qi"]) {
          const fj = s.furnaceJob[k];
          if (fj) { if (!s.forgeJob) s.forgeJob = { kind: k, g: fj.g, end: fj.end }; else s.forgeQueue.push({ kind: k, g: fj.g }); }
          ((s.furnaceQueue || {})[k] || []).forEach(g => s.forgeQueue.push({ kind: k, g }));
        }
        delete s.furnaceJob; delete s.furnaceQueue;
      }
      for (const k of ["dan", "qi"]) {
        s.blueprints[k] = s.blueprints[k].filter(g => g >= 0 && g < 9);
        s.furnaces[k] = s.furnaces[k].filter(g => g >= 0 && g < 9);
      }
      if (s.alchJob && !DATA.recipes[s.alchJob.type]) s.alchJob = null;
      s.alchQueue = s.alchQueue.filter(q => DATA.recipes[q.type]);
    },

    /* ---------- 门派炼丹房：学习丹方 ---------- */
    setDanLibTier(g) { this.danLibTier = g; this.render(); },
    learnRecipe(type, g) {
      const s = this.s, key = type + "|" + g, c = DATA.danLearnCost(type, g);
      if (s.recipes.includes(key)) return;
      if (s.danStudy) return this.log("正在参悟其他丹方，一次只能学一个。", "sys");
      if (g >= this.sectInfo().star) return this.log(`需要 ${g + 1} 星及以上门派才能学习。`, "sys");
      if (s.contrib < c) return this.log("贡献不足。", "sys");
      s.contrib -= c; s.danStudy = { key, end: this.now() + DATA.danLearnTime(type, g) };
      this.log(`开始参悟丹方《${DATA.danName(type, g)}》，需 ${U.dur(DATA.danLearnTime(type, g) / 1000)}。`, "good"); this.after();
    },

    /* ---------- 图纸、炉子（背包物品） ---------- */
    addBlueprintItem(kind, g) {
      if (this.bagFull()) { this.log("背包已满。", "bad"); return false; }
      this.s.bag.push({ t: "bp", kind, g }); return true;
    },
    addFurnaceItem(kind, g) {
      const it = this.s.bag.find(x => x.t === "fu" && x.kind === kind && x.g === g);
      if (it) { it.n = (it.n || 1) + 1; return true; }
      if (this.bagFull()) { if (!this.silent) this.log("背包已满，炉子无处存放，暂停出炉。", "bad"); return false; }
      this.s.bag.push({ t: "fu", kind, g, n: 1 }); return true;
    },
    // 背包里点图纸「学习」
    learnBlueprint(i) {
      const it = this.s.bag[i]; if (!it || it.t !== "bp") return;
      const bp = this.s.blueprints[it.kind];
      if (bp.includes(it.g)) return this.log("已学会该图纸。", "sys");
      bp.push(it.g); this.removeAt(i, 1);
      this.log(`学会${DATA.furnaceName(it.kind, it.g)}图纸，可在洞府炼器室炼制。`, "gold"); this.closeModal(); this.after();
    },
    // 背包里点炉子「使用」：装进洞府
    installFurnace(i) {
      const s = this.s, it = s.bag[i]; if (!it || it.t !== "fu") return;
      if (s.furnaces[it.kind].includes(it.g)) return this.log(`洞府里已有${DATA.furnaceName(it.kind, it.g)}。`, "sys");
      s.furnaces[it.kind].push(it.g); this.removeAt(i, 1);
      if (it.g > s.furnaceUse[it.kind]) s.furnaceUse[it.kind] = it.g;
      this.log(`${DATA.furnaceName(it.kind, it.g)}已装进洞府${it.kind === "dan" ? "炼丹房" : "炼器室"}。`, "gold"); this.closeModal(); this.after();
    },

    /* ---------- 炼器室：炼制炉子 ---------- */
    forgePer(kind, g) { return Math.ceil(DATA.furnaceTime(kind, g) * (1 - DATA.furnaceBonus("qi", this.s.furnaceUse.qi) / 100)); },
    // 炼制炉子：空闲就开始，否则加入队列（都会先扣材料）
    craftFurnace(kind, g) {
      const s = this.s, mats = DATA.furnaceMats(kind, g), q = s.forgeQueue;
      if (s.furnaceUse.qi < 0) return this.log("炼器必须装有炼器炉（宗门宝库 · 杂物可兑换一阶炼器炉）。", "sys");
      if (!s.blueprints[kind].includes(g)) return this.log("尚未学会该图纸。", "sys");
      if (s.forgeJob && q.length >= CFG.furnace.QUEUE) return this.log(`队列已满（最多 ${CFG.furnace.QUEUE} 个）。`, "sys");
      if (!this.hasMats(mats)) return this.log("材料不足。", "sys");
      mats.forEach(m => this.takeMat(m.kind, m.g, m.n));
      if (s.forgeJob) { q.push({ kind, g }); this.log(`${DATA.furnaceName(kind, g)}加入队列。`, "sys"); }
      else { s.forgeJob = { kind, g, end: this.now() + this.forgePer(kind, g) }; this.log(`开始炼制${DATA.furnaceName(kind, g)}。`, "good"); }
      this.after();
    },
    // 取消队列中的一项，退回材料
    cancelForgeQ(i) {
      const q = this.s.forgeQueue[i]; if (!q) return;
      this.s.forgeQueue.splice(i, 1); this.giveBack(DATA.furnaceMats(q.kind, q.g));
      this.log(`取消${DATA.furnaceName(q.kind, q.g)}，材料已退回。`, "sys"); this.after();
    },
    // 停止正在炼制的炉子，退回材料，队列下一个马上开始
    stopForge() {
      const s = this.s, j = s.forgeJob; if (!j) return;
      this.giveBack(DATA.furnaceMats(j.kind, j.g)); s.forgeJob = null;
      const nx = s.forgeQueue.shift();
      if (nx) s.forgeJob = { kind: nx.kind, g: nx.g, end: this.now() + this.forgePer(nx.kind, nx.g) };
      this.log(`停止炼制${DATA.furnaceName(j.kind, j.g)}，材料已退回。`, "sys"); this.after();
    },
    useFurnace(kind, g) {
      if (!this.s.furnaces[kind].includes(g)) return;
      this.s.furnaceUse[kind] = g; this.log(`换用${DATA.furnaceName(kind, g)}。`, "sys"); this.closeModal(); this.after();
    },
    // 更换炉子弹窗
    openFurnacePick(kind) {
      const s = this.s, own = s.furnaces[kind].slice().sort((a, b) => a - b);
      if (!own.length) return this.log(`洞府里还没有${DATA.furnaceKinds[kind]}。`, "sys");
      this.modal(`<h2>更换${DATA.furnaceKinds[kind]}</h2>` + own.map(g => `<div class="line"><div>${DATA.furnaceName(kind, g)}<small>${kind === "dan" ? "炼丹" : "炼器"}时间 -${DATA.furnaceBonus(kind, g)}%${kind === "dan" ? ` · 可炼一阶~${DATA.JIE[g]}丹` : ""}</small></div>
        ${s.furnaceUse[kind] === g ? `<button class="sm on" disabled>使用中</button>` : `<button class="sm" onclick="G.useFurnace('${kind}',${g})">使用</button>`}</div>`).join("") +
        `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },

    /* ---------- 炼丹 ---------- */
    danPer(type, g) { return Math.ceil(DATA.danTime(type, g) * (1 - DATA.furnaceBonus("dan", this.s.furnaceUse.dan) / 100)); },
    setDanTier(g) { this.danTier = g; this.render(); },
    // 炼丹：丹炉空闲就开炉，否则加入队列（都会先扣药材）
    startAlch(type, g, n) {
      const s = this.s, rec = DATA.danRecipe(type, g);
      if (s.alchJob && s.alchQueue.length >= CFG.alchemy.QUEUE) return this.log(`炼丹队列已满（最多 ${CFG.alchemy.QUEUE} 个）。`, "sys");
      if (!s.recipes.includes(type + "|" + g)) return this.log("尚未学会该丹方。", "sys");
      if (s.furnaceUse.dan < 0) return this.log("炼丹必须装有炼丹炉。", "sys");
      if (s.furnaceUse.dan < g) return this.log(`需要使用${DATA.JIE[g]}及以上炼丹炉。`, "sys");
      // n = 0 表示用现有药材能炼多少炼多少
      let max = CFG.alchemy.MAX_BATCH;
      for (const m of rec) max = Math.min(max, Math.floor(this.countMat(m.kind, m.g) / m.n));
      n = n ? Math.min(n, max) : max;
      if (n <= 0) return this.log("药材不足。", "sys");
      rec.forEach(m => this.takeMat(m.kind, m.g, m.n * n));
      if (s.alchJob) { s.alchQueue.push({ type, g, n }); this.log(`${DATA.danName(type, g)} ×${n} 加入炼丹队列。`, "sys"); return this.after(); }
      const per = this.danPer(type, g);
      s.alchJob = { type, g, n, done: 0, per, next: this.now() + per };
      this.log(`开炉炼制${DATA.danName(type, g)} ×${n}。`, "good"); this.after();
    },
    // 停炉：退还没炼的药材，队列里的下一炉马上开始
    stopAlch() {
      const s = this.s, a = s.alchJob; if (!a) return;
      const left = a.n - a.done;
      DATA.danRecipe(a.type, a.g).forEach(m => this.addMat(m.kind, DATA.matName(m.kind, m.g), m.g, m.n * left));
      s.alchJob = null;
      const nx = s.alchQueue.shift();
      if (nx) { const per = this.danPer(nx.type, nx.g); s.alchJob = { type: nx.type, g: nx.g, n: nx.n, done: 0, per, next: this.now() + per }; }
      this.log(`停炉，退回 ${left} 枚的药材。`, "sys"); this.after();
    },
    // 取消队列中的一项，退回药材
    cancelAlchQ(i) {
      const q = this.s.alchQueue[i]; if (!q) return;
      this.s.alchQueue.splice(i, 1);
      DATA.danRecipe(q.type, q.g).forEach(m => this.addMat(m.kind, DATA.matName(m.kind, m.g), m.g, m.n * q.n));
      this.log(`取消${DATA.danName(q.type, q.g)} ×${q.n}，药材已退回。`, "sys"); this.after();
    },

    /* ---------- 属性丹：背包、服用 ---------- */
    addDan(type, g, n = 1) {
      if (DATA.isSpeedRecipe(type)) return this.addPill(type, g, n); // 修炼速度丹 → 背包修炼丹（品质 = 阶）
      const it = this.s.bag.find(x => x.t === "dan" && x.type === type && x.g === g);
      if (it) { it.n += n; return true; }
      if (this.bagFull()) { this.log("背包已满，丹药无处存放，暂停出炉。", "bad"); return false; }
      this.s.bag.push({ t: "dan", type, g, n }); return true;
    },
    danLeft(type, g) { return DATA.danLimit(type, g) - (this.s.danEaten[type + "|" + g] || 0); },
    eatDan(i, n) {
      const it = this.s.bag[i]; if (!it || it.t !== "dan") return;
      n = Math.min(n, it.n, this.danLeft(it.type, it.g));
      if (n <= 0) return this.log(`${DATA.danName(it.type, it.g)}已达服用上限。`, "sys");
      const key = it.type + "|" + it.g, d = DATA.dans[it.type];
      this.s.danEaten[key] = (this.s.danEaten[key] || 0) + n;
      this.log(`服下${DATA.danName(it.type, it.g)} ×${n}，${d.label} +${U.num(DATA.danVal(it.type, it.g) * n)}。`, "good");
      this.removeAt(i, n); this.closeModal(); this.after();
    },
    // 所有已服用丹药的属性总和（computeStats 里用）
    danBonus() {
      const b = { atk: 0, def: 0, hp: 0, mana: 0, hit: 0, dodge: 0, crit: 0 };
      for (const key in this.s.danEaten) { const [t, g] = key.split("|"); if (t in b && DATA.dans[t]) b[t] += (DATA.danVal(t, +g) || 0) * this.s.danEaten[key]; }
      return b;
    },

    /* ---------- 页面：炉子卡片（炼丹房、炼器室共用，可更换） ---------- */
    furnaceCard(kind) {
      const s = this.s, cur = s.furnaceUse[kind], n = s.furnaces[kind].length;
      return `<div class="card"><h3>${DATA.furnaceKinds[kind]}<small>洞府已有 ${n} 个</small></h3>
        <div class="line"><div>${cur >= 0 ? `使用中：${DATA.furnaceName(kind, cur)}` : `尚未装${DATA.furnaceKinds[kind]}`}
          <small>${cur >= 0 ? `${kind === "dan" ? "炼丹" : "炼器"}时间 -${DATA.furnaceBonus(kind, cur)}%${kind === "dan" ? ` · 可炼一阶~${DATA.JIE[cur]}丹` : ""}` : `${kind === "dan" ? "炼丹" : "炼器"}必须装有${DATA.furnaceKinds[kind]}：宗门宝库 · 杂物兑换，或在炼器室炼制，放进背包后点「使用」`}</small></div>
          <button class="sm" onclick="G.openFurnacePick('${kind}')" ${n ? "" : "disabled"}>更换</button></div></div>`;
    },
  },
});

/* 洞府 · 炼丹房：按 一阶~九阶 分页，只显示已学会的丹方 */
G.caveViews.alchemy = function () {
  const s = this.s, a = s.alchJob, fu = s.furnaceUse.dan, tier = this.danTier || 0;
  let h = this.furnaceCard("dan");
  if (a) {
    h += `<div class="card"><h3>丹炉中<small>${DATA.danName(a.type, a.g)} ${a.done} / ${a.n}</small></h3>
      <div class="line"><div>下一枚出炉<small>${U.dur(Math.max(0, a.next - Date.now()) / 1000 + 59)} · 每枚 ${U.dur(a.per / 1000)}</small></div>
      <button class="sm" onclick="G.stopAlch()">停炉</button></div>` +
      s.alchQueue.map((q, i) => `<div class="line"><div>队列 ${i + 1}：${DATA.danName(q.type, q.g)} ×${q.n}</div><button class="sm" onclick="G.cancelAlchQ(${i})">取消</button></div>`).join("") +
      `<p class="desc">队列 ${s.alchQueue.length} / ${CFG.alchemy.QUEUE}，炼完自动开下一炉。</p></div>`;
  }
  const list = Object.keys(DATA.recipes).filter(t => s.recipes.includes(t + "|" + tier));
  h += `<div class="card"><h3>炼丹<small>${fu >= 0 ? `可炼一阶~${DATA.JIE[fu]}` : "需要炼丹炉"} · 已学丹方 ${s.recipes.length}</small></h3>
    <div class="room-grid five">${DATA.JIE.map((n, g) => `<button class="${tier === g ? "active" : ""}" onclick="G.setDanTier(${g})">${n}</button>`).join("")}</div>` +
    (list.length ? list.map(t => {
      const rec = DATA.danRecipe(t, tier), ok = fu >= tier && this.hasMats(rec) && !(a && s.alchQueue.length >= CFG.alchemy.QUEUE);
      const eaten = DATA.isSpeedRecipe(t) ? "" : ` · 已服 ${DATA.danLimit(t, tier) - this.danLeft(t, tier)}/${DATA.danLimit(t, tier)}`;
      return `<div class="line"><div>${DATA.danName(t, tier)}<span class="tag">${DATA.recipeEffect(t, tier)}</span>
        <small>${this.matsText(rec)} · 每枚 ${U.dur(this.danPer(t, tier) / 1000)}${eaten}</small></div>
        <div><button class="sm" onclick="G.startAlch('${t}',${tier},1)" ${ok ? "" : "disabled"}>${a ? "排1" : "炼1"}</button>
        <button class="sm" onclick="G.startAlch('${t}',${tier},0)" ${ok ? "" : "disabled"}>全部</button></div></div>`;
    }).join("") : `<p class="desc">尚未学会${DATA.JIE[tier]}丹方，可在门派 → 炼丹房学习。</p>`) +
    `<p class="desc">必须装有炼丹炉，丹阶不能高于使用中的炼丹炉；「全部」= 用现有药材最多炼 ${CFG.alchemy.MAX_BATCH} 枚。</p></div>`;
  return h;
};

/* 洞府 · 炼器室：炼制炼丹炉、炼器炉（必须装有炼器炉） */
G.caveViews.forge = function () {
  const s = this.s, j = s.forgeJob, has = s.furnaceUse.qi >= 0, full = j && s.forgeQueue.length >= CFG.furnace.QUEUE;
  let h = this.furnaceCard("qi");
  if (j) h += `<div class="card"><h3>炼制中<small>${DATA.furnaceName(j.kind, j.g)}</small></h3>
    <div class="line"><div>剩余 ${U.dur(Math.max(0, j.end - Date.now()) / 1000 + 59)}</div><button class="sm" onclick="G.stopForge()">停止</button></div>` +
    s.forgeQueue.map((q, i) => `<div class="line"><div>队列 ${i + 1}：${DATA.furnaceName(q.kind, q.g)}<small>${U.dur(this.forgePer(q.kind, q.g) / 1000)}</small></div>
      <button class="sm" onclick="G.cancelForgeQ(${i})">取消</button></div>`).join("") +
    `<p class="desc">队列 ${s.forgeQueue.length} / ${CFG.furnace.QUEUE}，炼好放进背包，自动开始下一个。</p></div>`;
  h += ["dan", "qi"].map(k => {
    const bps = s.blueprints[k].slice().sort((a, b) => a - b);
    return `<div class="card"><h3>炼制${DATA.furnaceKinds[k]}<small>已学图纸 ${bps.length}</small></h3>` +
      (bps.length ? bps.map(g => { const mats = DATA.furnaceMats(k, g);
        return `<div class="line"><div>${DATA.furnaceName(k, g)}<span class="tag">-${DATA.furnaceBonus(k, g)}%</span>
          <small>${this.matsText(mats)} · ${U.dur(this.forgePer(k, g) / 1000)}</small></div>
          <button class="sm" onclick="G.craftFurnace('${k}',${g})" ${!has || full || !this.hasMats(mats) ? "disabled" : ""}>${j ? "排队" : "炼制"}</button></div>`; }).join("")
        : `<p class="desc">尚未学会${DATA.furnaceKinds[k]}图纸：门派 → 宗门宝库兑换图纸，在背包点「学习」。</p>`) + `</div>`;
  }).join("");
  return h + `<div class="card"><h3>炼器</h3><p class="desc">法器器谱尚未开放。</p></div>`;
};

/* 门派 · 炼丹房：学习丹方（sect.js 调用） */
G.sectAlchemyView = function () {
  const s = this.s, star = this.sectInfo().star, tier = this.danLibTier || 0, st = s.danStudy;
  let h = "";
  if (st) { const [t, g] = st.key.split("|");
    h += `<div class="card"><h3>参悟中<small>《${DATA.danName(t, +g)}》</small></h3><p class="desc">剩余 ${U.dur(Math.max(0, st.end - Date.now()) / 1000 + 59)}</p></div>`; }
  h += `<div class="room-grid five">${DATA.JIE.map((n, g) => `<button class="${tier === g ? "active" : ""}" onclick="G.setDanLibTier(${g})">${n}</button>`).join("")}</div>
    <div class="card"><h3>炼丹房 · 丹方<small>${star}星门派可学 一阶~${DATA.JIE[star - 1]} · 一次学一个</small></h3>` +
    Object.keys(DATA.recipes).map(t => {
      const key = t + "|" + tier, has = s.recipes.includes(key), c = DATA.danLearnCost(t, tier), lock = tier >= star;
      return `<div class="line"><div>《${DATA.danName(t, tier)}》<span class="tag">${DATA.recipeEffect(t, tier)}</span>
        <small>${this.matsText(DATA.danRecipe(t, tier))}<br>${U.fmt(c)} 贡献 · 学习 ${U.dur(DATA.danLearnTime(t, tier) / 1000)}</small></div>
        <button class="sm" onclick="G.learnRecipe('${t}',${tier})" ${has || lock || st || s.contrib < c ? "disabled" : ""}>${has ? "已学会" : lock ? `需${tier + 1}星` : "学习"}</button></div>`;
    }).join("") + `</div>`;
  return h;
};
