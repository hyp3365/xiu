/* =====================================================================
 * 模块：丹方、炼丹房、炼器室
 * ---------------------------------------------------------------------
 * 丹方：在 门派 → 炼丹房 学习（消耗贡献 + 时间，一次学一个），学会后才在洞府炼丹房显示。
 * 炉子：在 门派 → 宗门宝库 兑换「N阶炼丹炉/炼器炉图纸」即学会，之后在洞府炼制炉子
 *   （三种材料 + 时间，不耗灵石）。已拥有的炉子可以随时更换使用哪一个。
 *   炼丹炉缩短炼丹时间，炼器炉缩短炼器时间；丹阶不能高于正在使用的炼丹炉阶。
 * 炼丹：只消耗药材（不耗灵石），一炉可连续炼多枚，一枚一枚出炉放进背包。
 *   服用后永久增加属性，每种丹每阶有服用上限。
 * 全部数值在 numbers.js 的 alchemy / furnace。按 G.now() 计时，离线也会继续。
 * 存档：
 *   recipes    ["atk|0", ...]                   已学会的丹方（类型|阶）
 *   danStudy   { key, end } | null              正在学习的丹方
 *   blueprints { dan: [阶...], qi: [阶...] }      已学会的图纸
 *   furnaces   { dan: [阶...], qi: [阶...] }      已拥有的炉子
 *   furnaceUse { dan: 阶|-1, qi: 阶|-1 }          正在使用的炉子
 *   furnaceJob { dan: {g, end} | null, qi: ... } 正在炼制的炉子
 *   alchJob    { type, g, n, done, next, per } | null  正在炼的丹
 *   danEaten   { "atk|0": 已服用枚数 }
 * ===================================================================== */
G.module({
  id: "craft",

  defaults: () => ({
    recipes: [], danStudy: null,
    blueprints: { dan: [], qi: [] },
    furnaces: { dan: [], qi: [] },
    furnaceUse: { dan: -1, qi: -1 },
    furnaceJob: { dan: null, qi: null },
    alchJob: null,
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

    /* ---------- 定时结算（每 10 秒，离线也会补算） ---------- */
    craftTick() {
      const s = this.s, now = this.now();
      // 旧存档：furnace { dan: 最高阶 } → furnaces 列表
      if (s.furnace) { for (const k of ["dan", "qi"]) if (s.furnace[k] >= 0) { s.furnaces[k] = [s.furnace[k]]; s.furnaceUse[k] = s.furnace[k]; } delete s.furnace; }
      // 丹方学习
      if (s.danStudy && now >= s.danStudy.end) {
        const [t, g] = s.danStudy.key.split("|");
        if (!s.recipes.includes(s.danStudy.key)) s.recipes.push(s.danStudy.key);
        s.danStudy = null; this.log(`学会丹方《${DATA.danName(t, +g)}》，可在洞府炼丹房炼制。`, "gold");
      }
      // 炉子
      for (const k of ["dan", "qi"]) {
        const j = s.furnaceJob[k];
        if (j && now >= j.end) {
          s.furnaceJob[k] = null;
          if (!s.furnaces[k].includes(j.g)) s.furnaces[k].push(j.g);
          if (j.g > s.furnaceUse[k]) s.furnaceUse[k] = j.g; // 新炉更好就自动换上
          this.log(`${DATA.furnaceName(k, j.g)}炼制成功！`, "gold"); this.dirty();
        }
      }
      // 炼丹
      const a = s.alchJob;
      while (a && a.done < a.n && now >= a.next) {
        if (!this.addDan(a.type, a.g, 1)) break;
        a.done++; a.next += a.per;
      }
      if (a && a.done >= a.n) { s.alchJob = null; this.log(`${DATA.danName(a.type, a.g)} ×${a.n} 全部出炉。`, "gold"); }
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

    /* ---------- 炉子 ---------- */
    craftFurnace(kind, g) {
      const s = this.s, mats = DATA.furnaceMats(kind, g);
      if (s.furnaceJob[kind]) return this.log("炉子正在炼制中。", "sys");
      if (!s.blueprints[kind].includes(g)) return this.log("尚未学会该图纸。", "sys");
      if (!this.hasMats(mats)) return this.log("材料不足。", "sys");
      mats.forEach(m => this.takeMat(m.kind, m.g, m.n));
      s.furnaceJob[kind] = { g, end: this.now() + DATA.furnaceTime(kind, g) };
      this.log(`开始炼制${DATA.furnaceName(kind, g)}。`, "good"); this.after();
    },
    useFurnace(kind, g) {
      if (!this.s.furnaces[kind].includes(g)) return;
      this.s.furnaceUse[kind] = g; this.log(`换用${DATA.furnaceName(kind, g)}。`, "sys"); this.after();
    },

    /* ---------- 炼丹 ---------- */
    danPer(type, g) { return Math.ceil(DATA.danTime(type, g) * (1 - DATA.furnaceBonus("dan", this.s.furnaceUse.dan) / 100)); },
    setDanTier(g) { this.danTier = g; this.render(); },
    startAlch(type, g, n) {
      const s = this.s, rec = DATA.danRecipe(type, g);
      if (s.alchJob) return this.log("炼丹炉正在使用中。", "sys");
      if (!s.recipes.includes(type + "|" + g)) return this.log("尚未学会该丹方。", "sys");
      if (s.furnaceUse.dan < g) return this.log(`需要使用${DATA.JIE[g]}及以上炼丹炉。`, "sys");
      // n = 0 表示用现有药材能炼多少炼多少
      let max = CFG.alchemy.MAX_BATCH;
      for (const m of rec) max = Math.min(max, Math.floor(this.countMat(m.kind, m.g) / m.n));
      n = n ? Math.min(n, max) : max;
      if (n <= 0) return this.log("药材不足。", "sys");
      rec.forEach(m => this.takeMat(m.kind, m.g, m.n * n));
      const per = this.danPer(type, g);
      s.alchJob = { type, g, n, done: 0, per, next: this.now() + per };
      this.log(`开炉炼制${DATA.danName(type, g)} ×${n}。`, "good"); this.after();
    },
    // 停炉：退还没炼的药材
    stopAlch() {
      const s = this.s, a = s.alchJob; if (!a) return;
      const left = a.n - a.done;
      DATA.danRecipe(a.type, a.g).forEach(m => this.addMat(m.kind, DATA.matName(m.kind, m.g), m.g, m.n * left));
      s.alchJob = null;
      this.log(`停炉，退回 ${left} 枚的药材。`, "sys"); this.after();
    },

    /* ---------- 属性丹：背包、服用 ---------- */
    addDan(type, g, n = 1) {
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

    /* ---------- 页面：炉子卡片（炼丹房、炼器室共用） ---------- */
    furnaceCard(kind) {
      const s = this.s, F = DATA.furnaces[kind], j = s.furnaceJob[kind], cur = s.furnaceUse[kind], own = s.furnaces[kind];
      let h = `<div class="card"><h3>${F.name}<small>${cur >= 0 ? `使用中：${DATA.furnaceName(kind, cur)} · ${kind === "dan" ? "炼丹" : "炼器"}时间 -${DATA.furnaceBonus(kind, cur)}%` : "尚无"}</small></h3>`;
      if (j) h += `<div class="line"><div>正在炼制 ${DATA.furnaceName(kind, j.g)}<small>剩余 ${U.dur(Math.max(0, j.end - Date.now()) / 1000 + 59)}</small></div></div>`;
      const bps = s.blueprints[kind].slice().sort((a, b) => a - b);
      if (!bps.length) h += `<p class="desc">尚未学会${F.name}图纸，可在门派 → 宗门宝库兑换。</p>`;
      h += bps.map(g => { const mats = DATA.furnaceMats(kind, g), has = own.includes(g);
        const btn = has ? (cur === g ? `<button class="sm on" disabled>使用中</button>` : `<button class="sm" onclick="G.useFurnace('${kind}',${g})">更换</button>`)
          : `<button class="sm" onclick="G.craftFurnace('${kind}',${g})" ${j || !this.hasMats(mats) ? "disabled" : ""}>炼制</button>`;
        return `<div class="line"><div>${DATA.furnaceName(kind, g)}<span class="tag">-${DATA.furnaceBonus(kind, g)}%</span>
          <small>${has ? "已拥有" : `${this.matsText(mats)} · ${U.dur(DATA.furnaceTime(kind, g) / 1000)}`}</small></div>${btn}</div>`; }).join("");
      return h + `</div>`;
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
      <button class="sm" onclick="G.stopAlch()">停炉</button></div></div>`;
  }
  const list = Object.keys(DATA.dans).filter(t => s.recipes.includes(t + "|" + tier));
  h += `<div class="card"><h3>炼丹<small>${fu >= 0 ? `可炼一阶~${DATA.JIE[fu]}` : "需要炼丹炉"} · 已学丹方 ${s.recipes.length}</small></h3>
    <div class="sub-tabs scroll">${DATA.JIE.map((n, g) => `<button class="${tier === g ? "active" : ""}" onclick="G.setDanTier(${g})">${n}</button>`).join("")}</div>` +
    (list.length ? list.map(t => {
      const rec = DATA.danRecipe(t, tier), ok = fu >= tier && !a && this.hasMats(rec);
      return `<div class="line"><div>${DATA.danName(t, tier)}<span class="tag">${DATA.dans[t].label}+${U.num(DATA.danVal(t, tier))}</span>
        <small>${this.matsText(rec)} · 每枚 ${U.dur(this.danPer(t, tier) / 1000)} · 已服 ${DATA.danLimit(t, tier) - this.danLeft(t, tier)}/${DATA.danLimit(t, tier)}</small></div>
        <div><button class="sm" onclick="G.startAlch('${t}',${tier},1)" ${ok ? "" : "disabled"}>炼1</button>
        <button class="sm" onclick="G.startAlch('${t}',${tier},0)" ${ok ? "" : "disabled"}>全部</button></div></div>`;
    }).join("") : `<p class="desc">尚未学会${DATA.JIE[tier]}丹方，可在门派 → 炼丹房学习。</p>`) +
    `<p class="desc">丹阶不能高于使用中的炼丹炉；「全部」= 用现有药材最多炼 ${CFG.alchemy.MAX_BATCH} 枚。</p></div>`;
  return h;
};

/* 洞府 · 炼器室 */
G.caveViews.forge = function () {
  return this.furnaceCard("qi") + `<div class="card"><h3>炼器</h3><p class="desc">炼器器谱尚未开放。炼器炉会缩短日后的炼器时间。</p></div>`;
};

/* 门派 · 炼丹房：学习丹方（sect.js 调用） */
G.sectAlchemyView = function () {
  const s = this.s, star = this.sectInfo().star, tier = this.danLibTier || 0, st = s.danStudy;
  let h = "";
  if (st) { const [t, g] = st.key.split("|");
    h += `<div class="card"><h3>参悟中<small>《${DATA.danName(t, +g)}》</small></h3><p class="desc">剩余 ${U.dur(Math.max(0, st.end - Date.now()) / 1000 + 59)}</p></div>`; }
  h += `<div class="sub-tabs scroll">${DATA.JIE.map((n, g) => `<button class="${tier === g ? "active" : ""}" onclick="G.setDanLibTier(${g})">${n}</button>`).join("")}</div>
    <div class="card"><h3>炼丹房 · 丹方<small>${star}星门派可学 一阶~${DATA.JIE[star - 1]} · 一次学一个</small></h3>` +
    Object.keys(DATA.dans).map(t => {
      const d = DATA.dans[t], key = t + "|" + tier, has = s.recipes.includes(key), c = DATA.danLearnCost(t, tier), lock = tier >= star;
      return `<div class="line"><div>《${DATA.danName(t, tier)}》<span class="tag">${d.label}+${U.num(d.val[tier])}</span>
        <small>${this.matsText(DATA.danRecipe(t, tier))}<br>${U.fmt(c)} 贡献 · 学习 ${U.dur(DATA.danLearnTime(t, tier) / 1000)}</small></div>
        <button class="sm" onclick="G.learnRecipe('${t}',${tier})" ${has || lock || st || s.contrib < c ? "disabled" : ""}>${has ? "已学会" : lock ? `需${tier + 1}星` : "学习"}</button></div>`;
    }).join("") + `</div>`;
  return h;
};
