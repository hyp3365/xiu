/* =====================================================================
 * 模块：炼丹房、炼器室（洞府）
 * ---------------------------------------------------------------------
 * 炉子：
 *   在宗门宝库兑换「N阶炼丹炉图纸 / 炼器炉图纸」即学会，之后在洞府炼制炉子
 *   （三种材料 + 灵石 + 时间）。自动使用已拥有的最高阶炉子。
 *   炼丹炉缩短炼丹时间，炼器炉缩短炼器时间（%见 numbers.js furnace.BONUS）。
 * 炼丹：
 *   七种属性丹（攻击 防御 气血 法力 命中 闪避 暴击）× 九阶，丹阶不能高于炼丹炉阶。
 *   每枚需要三种药材 + 灵石，一炉可连续炼多枚，一枚一枚出炉放进背包。
 *   服用后永久增加属性，每种丹每阶有服用上限。
 * 全部按 G.now() 计时，写在 tick 里，离线也会继续。
 * 存档：
 *   blueprints { dan: [阶...], qi: [阶...] }   已学会的图纸
 *   furnace    { dan: 最高阶 | -1, qi: -1 }      已拥有的炉子
 *   furnaceJob { dan: {g, end} | null, qi: ... }  正在炼制的炉子
 *   alchJob    { type, g, n, done, next, per } | null  正在炼的丹
 *   danEaten   { "atk|0": 已服用枚数 }
 * ===================================================================== */
G.module({
  id: "craft",

  defaults: () => ({
    blueprints: { dan: [], qi: [] },
    furnace: { dan: -1, qi: -1 },
    furnaceJob: { dan: null, qi: null },
    alchJob: null,
    danEaten: {},
  }),

  tick() { this.craftTick(); },

  api: {
    /* ---------- 材料 ---------- */
    countMat(kind, g) {
      const name = DATA.matName(kind, g);
      return this.s.bag.reduce((a, it) => a + (it.t === "mat" && it.name === name && it.g === g ? it.n : 0), 0);
    },
    takeMat(kind, g, n) {
      const name = DATA.matName(kind, g);
      for (let i = this.s.bag.length - 1; i >= 0 && n > 0; i--) {
        const it = this.s.bag[i];
        if (it.t !== "mat" || it.name !== name || it.g !== g) continue;
        const k = Math.min(n, it.n); this.removeAt(i, k); n -= k;
      }
    },
    // 能否付得起一组材料 × 份数
    hasMats(list, times = 1) { return list.every(m => this.countMat(m.kind, m.g) >= m.n * times); },
    matsText(list, times = 1) {
      return list.map(m => { const have = this.countMat(m.kind, m.g), need = m.n * times;
        return `<span class="${have >= need ? "" : "q5"}">${DATA.matFull(m.kind, m.g)} ${U.fmt(have)}/${U.fmt(need)}</span>`; }).join("、");
    },

    /* ---------- 定时结算（每 10 秒，离线也会补算） ---------- */
    craftTick() {
      const s = this.s, now = this.now();
      for (const k of ["dan", "qi"]) {
        const j = s.furnaceJob[k];
        if (j && now >= j.end) {
          s.furnaceJob[k] = null;
          if (j.g > s.furnace[k]) s.furnace[k] = j.g;
          this.log(`${DATA.furnaceName(k, j.g)}炼制成功！`, "gold"); this.dirty();
        }
      }
      const a = s.alchJob;
      while (a && a.done < a.n && now >= a.next) {
        if (!this.addDan(a.type, a.g, 1)) break;
        a.done++; a.next += a.per;
      }
      if (a && a.done >= a.n) { s.alchJob = null; this.log(`${DATA.danName(a.type, a.g)} ×${a.n} 全部出炉。`, "gold"); }
    },

    /* ---------- 炉子 ---------- */
    craftFurnace(kind, g) {
      const s = this.s, mats = DATA.furnaceMats(kind, g), st = DATA.furnaceStone(g);
      if (s.furnaceJob[kind]) return this.log("炉子正在炼制中。", "sys");
      if (!s.blueprints[kind].includes(g)) return this.log("尚未学会该图纸。", "sys");
      if (!this.hasMats(mats) || s.stone < st) return this.log("材料或灵石不足。", "sys");
      mats.forEach(m => this.takeMat(m.kind, m.g, m.n)); s.stone -= st;
      s.furnaceJob[kind] = { g, end: this.now() + DATA.furnaceTime(g) };
      this.log(`开始炼制${DATA.furnaceName(kind, g)}。`, "good"); this.after();
    },

    /* ---------- 炼丹 ---------- */
    danPer(g) { return Math.ceil(DATA.danTime(g) * (1 - DATA.furnaceBonus(this.s.furnace.dan) / 100)); },
    setDanType(t) { this.danType = t; this.render(); },
    startAlch(type, g, n) {
      const s = this.s, rec = DATA.danRecipe(type, g), st = DATA.danStone(g);
      if (s.alchJob) return this.log("炼丹炉正在使用中。", "sys");
      if (s.furnace.dan < g) return this.log(`需要${DATA.JIE[g]}及以上炼丹炉。`, "sys");
      // n = 0 表示能炼多少炼多少
      let max = Math.min(CFG.alchemy.MAX_BATCH, st > 0 ? Math.floor(s.stone / st) : 1e9);
      for (const m of rec) max = Math.min(max, Math.floor(this.countMat(m.kind, m.g) / m.n));
      n = n ? Math.min(n, max) : max;
      if (n <= 0) return this.log("药材或灵石不足。", "sys");
      rec.forEach(m => this.takeMat(m.kind, m.g, m.n * n)); s.stone -= st * n;
      const per = this.danPer(g);
      s.alchJob = { type, g, n, done: 0, per, next: this.now() + per };
      this.log(`开炉炼制${DATA.danName(type, g)} ×${n}。`, "good"); this.after();
    },
    // 停炉：退还没炼的材料、灵石
    stopAlch() {
      const s = this.s, a = s.alchJob; if (!a) return;
      const left = a.n - a.done;
      DATA.danRecipe(a.type, a.g).forEach(m => this.addMat(m.kind, DATA.matName(m.kind, m.g), m.g, m.n * left));
      s.stone += DATA.danStone(a.g) * left; s.alchJob = null;
      this.log(`停炉，退回 ${left} 枚的材料。`, "sys"); this.after();
    },

    /* ---------- 属性丹：背包、服用 ---------- */
    addDan(type, g, n = 1) {
      const it = this.s.bag.find(x => x.t === "dan" && x.type === type && x.g === g);
      if (it) { it.n += n; return true; }
      if (this.bagFull()) { this.log("背包已满，丹药无处存放，暂停出炉。", "bad"); return false; }
      this.s.bag.push({ t: "dan", type, g, n }); return true;
    },
    danLeft(type, g) { return DATA.danLimit(type) - (this.s.danEaten[type + "|" + g] || 0); },
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
      for (const key in this.s.danEaten) { const [t, g] = key.split("|"); if (t in b) b[t] += DATA.danVal(t, +g) * this.s.danEaten[key]; }
      return b;
    },

    /* ---------- 页面：炉子卡片（炼丹房、炼器室共用） ---------- */
    furnaceCard(kind) {
      const s = this.s, F = DATA.furnaces[kind], j = s.furnaceJob[kind], cur = s.furnace[kind];
      let h = `<div class="card"><h3>${F.name}<small>${cur >= 0 ? `当前 ${DATA.furnaceName(kind, cur)} · 缩短${kind === "dan" ? "炼丹" : "炼器"}时间 ${DATA.furnaceBonus(cur)}%` : "尚无"}</small></h3>`;
      if (j) h += `<div class="line"><div>正在炼制 ${DATA.furnaceName(kind, j.g)}<small>剩余 ${U.dur(Math.max(0, j.end - Date.now()) / 1000 + 59)}</small></div></div>`;
      const bps = s.blueprints[kind].slice().sort((a, b) => a - b);
      if (!bps.length) h += `<p class="desc">尚未学会${F.name}图纸，可在门派 → 宗门宝库兑换。</p>`;
      h += bps.map(g => { const mats = DATA.furnaceMats(kind, g), st = DATA.furnaceStone(g), own = cur >= g;
        return `<div class="line"><div>${DATA.furnaceName(kind, g)}<small>${this.matsText(mats)}、灵石 ${U.fmt(st)} · ${U.dur(DATA.furnaceTime(g) / 1000)}</small></div>
          <button class="sm" onclick="G.craftFurnace('${kind}',${g})" ${own || j || !this.hasMats(mats) || s.stone < st ? "disabled" : ""}>${own ? "已拥有" : "炼制"}</button></div>`; }).join("");
      return h + `</div>`;
    },
  },
});

/* 洞府 · 炼丹房 */
G.caveViews.alchemy = function () {
  const s = this.s, a = s.alchJob, fu = s.furnace.dan, type = this.danType || "atk";
  let h = this.furnaceCard("dan");
  if (a) {
    const left = a.next - Date.now();
    h += `<div class="card"><h3>丹炉中<small>${DATA.danName(a.type, a.g)} ${a.done} / ${a.n}</small></h3>
      <div class="line"><div>下一枚出炉<small>${U.dur(Math.max(0, left) / 1000 + 59)} · 每枚 ${U.dur(a.per / 1000)}</small></div>
      <button class="sm" onclick="G.stopAlch()">停炉</button></div></div>`;
  }
  h += `<div class="card"><h3>炼丹<small>${fu >= 0 ? `可炼一阶~${DATA.JIE[fu]}` : "需要炼丹炉"}</small></h3>
    <div class="sub-tabs scroll">${Object.keys(DATA.dans).map(t => `<button class="${type === t ? "active" : ""}" onclick="G.setDanType('${t}')">${DATA.dans[t].label}</button>`).join("")}</div>` +
    DATA.JIE.map((jn, g) => {
      const rec = DATA.danRecipe(type, g), st = DATA.danStone(g), ok = fu >= g && !a && this.hasMats(rec) && s.stone >= st;
      return `<div class="line"><div>${DATA.danName(type, g)}<span class="tag">${DATA.dans[type].label}+${U.num(DATA.danVal(type, g))}</span>
        <small>${this.matsText(rec)}、灵石 ${U.fmt(st)} · 每枚 ${U.dur(this.danPer(g) / 1000)} · 已服 ${DATA.danLimit(type) - this.danLeft(type, g)}/${DATA.danLimit(type)}</small></div>
        <div><button class="sm" onclick="G.startAlch('${type}',${g},1)" ${ok ? "" : "disabled"}>炼1</button>
        <button class="sm" onclick="G.startAlch('${type}',${g},0)" ${ok ? "" : "disabled"}>全部</button></div></div>`;
    }).join("") + `<p class="desc">丹阶不能高于炼丹炉阶；「全部」= 用现有材料最多炼 ${CFG.alchemy.MAX_BATCH} 枚。</p></div>`;
  return h;
};

/* 洞府 · 炼器室 */
G.caveViews.forge = function () {
  return this.furnaceCard("qi") + `<div class="card"><h3>炼器</h3><p class="desc">炼器器谱尚未开放。炼器炉会缩短日后的炼器时间。</p></div>`;
};
