/* =====================================================================
 * 模块：渡劫（突破时的劫云）
 * ---------------------------------------------------------------------
 * 数值全部在 js/config/trib.js。
 * 流程：修为满了点「突破」→ 渡劫准备页（SLOTS 个格子，放法宝 / 法术 / 丹药，丹药每格 1 颗）
 *       → 「开始渡劫」→ 渡劫页（上方劫云，下方人物）
 * 劫云只有攻击，每 HIT_SEC 秒劈一次，人物不还手；撑过 TIME 秒没倒 = 突破成功。
 * 按 G.now() 计时：关掉页面、关掉游戏，劫云照样劈，回来时一次算完。
 * 格子里的法宝 / 法术 / 丹药目前只是带进渡劫，效果之后再加（tribUse 留好了入口）。
 *
 * 存档：
 *   s.tribSlots  [格子]：{ k: "fb", uid } 法宝 / { k: "sp", id } 法术 / { k: "it", name } 丹药；空格 null
 *   s.trib       正在进行（或刚结束还没关）的渡劫：
 *                { v: 2, L 突破后层序, start 开始时间, time 时长秒, sec 已过秒, atk, crit, taken 共承受, hits 被劈次数, log, result }
 * ===================================================================== */
G.module({
  id: "trib",

  defaults: () => ({
    tribSlots: [],
  }),

  api: {
    /* ---------- 数值 ---------- */
    // 渡劫时长（秒）：按突破后的大境界查 TIME（键 = 境界原名或改名后的名字）
    tribTime(L) {
      const T = CFG.trib, ri = Math.floor(L / DATA.LAYERS), o = T.TIME || {};
      const v = o[DATA.realms[ri]] !== undefined ? o[DATA.realms[ri]] : o[DATA.NM_DEF.realm[ri]];
      return Math.max(1, v !== undefined ? v : T.TIME_DEFAULT || 60);
    },
    // 劫云：攻击 = 突破后那一层的参考攻击 × ATK_MULT
    makeTrib(L) {
      const T = CFG.trib, st = DATA.refStats(Math.floor(L / DATA.LAYERS), L % DATA.LAYERS + 1, T.GF === undefined ? 4 : T.GF);
      return { atk: st.atk * (T.ATK_MULT === undefined ? 1 : T.ATK_MULT), crit: T.crit === undefined ? 5 : T.crit };
    },
    // 劫云劈一次的伤害 [伤害, 是否暴击]
    tribHit(x) {
      const BT = CFG.battle, def = this.stats().def;
      let d = Math.max(x.atk * BT.MIN_DMG, x.atk - def * BT.DEF_RATE) * (BT.RAND_MIN + Math.random() * (BT.RAND_MAX - BT.RAND_MIN));
      const c = Math.random() * 100 < Math.min(DATA.CRIT_CAP || 100, x.crit);
      return [c ? d * BT.CRIT_MULT : d, c];
    },

    /* ---------- 准备页的格子 ---------- */
    tribSlotN() { return CFG.trib.SLOTS || 10; },
    // 找格子里的东西；找不到（卖了、用了、遗忘了）返回 null
    tribFind(c) {
      const s = this.s; if (!c) return null;
      if (c.k === "fb") {
        const e = (s.fabao || []).find(e => e && e.uid === c.uid) || ((s.bag.find(it => it.t === "eq" && it.e.uid === c.uid) || {}).e);
        return e ? { name: this.itemName({ t: "eq", e }), img: DATA.eqIcon(e), tag: "法宝" } : null;
      }
      if (c.k === "sp") { const g = s.gongfa[c.id] && DATA.spellInfo(c.id, s.gongfa[c.id]); return g ? { name: `《${g.name}》`, img: "", tag: "法术" } : null; }
      if (c.k === "it") {
        const it = s.bag.find(it => (it.t === "pill" || it.t === "dan") && this.itemName(it) === c.name);
        return it ? { name: c.name, img: this.itemIcon(it), tag: "丹药" } : null;
      }
      return null;
    },
    // 同一颗丹药在格子里放了几颗（每格 1 颗，背包数量不够就放不进）
    tribPillUsed(name) { return this.s.tribSlots.filter(c => c && c.k === "it" && c.name === name).length; },
    tribPick(i) {
      const s = this.s, used = c => s.tribSlots.some(x => x && x.k === c.k && (x.uid || x.id) === (c.uid || c.id));
      const row = (img, name, tag, call) => `<div class="line"><div>${img ? DATA.li(img) : ""}${name}<small>${tag}</small></div><button class="sm" onclick="${call}">放入</button></div>`;
      let h = "";
      const fbs = [...(s.fabao || []).filter(Boolean), ...s.bag.filter(it => it.t === "eq" && it.e.slot === "fabao").map(it => it.e)];
      fbs.forEach(e => { if (!e.uid) e.uid = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); });
      const fb = fbs.filter(e => !used({ k: "fb", uid: e.uid }));
      const sp = Object.keys(s.gongfa).filter(id => DATA.isSpell(id) && !used({ k: "sp", id }));
      const names = [...new Set(s.bag.filter(it => it.t === "pill" || it.t === "dan").map(it => this.itemName(it)))];
      const pills = names.map(n => ({ n, it: s.bag.find(it => (it.t === "pill" || it.t === "dan") && this.itemName(it) === n) }))
        .filter(p => (this.bagCount()[p.n] || 0) > this.tribPillUsed(p.n));
      if (fb.length) h += `<p class="desc">法宝</p>` + fb.map(e => row(DATA.eqIcon(e), this.itemName({ t: "eq", e }), "法宝", `G.tribPut(${i},'fb','${e.uid}')`)).join("");
      if (sp.length) h += `<p class="desc">法术</p>` + sp.map(id => { const g = DATA.spellInfo(id, s.gongfa[id]); return row("", `《${g.name}》`, `${g.tier.name}`, `G.tribPut(${i},'sp','${id}')`); }).join("");
      if (pills.length) h += `<p class="desc">丹药（每格 1 颗）</p>` + pills.map(p => row(this.itemIcon(p.it), p.n, `剩 ${U.fmt((this.bagCount()[p.n] || 0) - this.tribPillUsed(p.n))} 颗可放`, `G.tribPut(${i},'it','${p.n}')`)).join("");
      this.modal(`<h2>第 ${i + 1} 格</h2>${h || `<p class="desc">没有可放入的法宝、法术、丹药。</p>`}
        <div class="btns">${s.tribSlots[i] ? `<button onclick="G.tribPut(${i})">清空这格</button>` : ""}<button onclick="G.closeModal()">关闭</button></div>`);
    },
    tribPut(i, k, v) {
      const sl = this.s.tribSlots;
      while (sl.length < this.tribSlotN()) sl.push(null);
      sl[i] = !k ? null : k === "fb" ? { k, uid: v } : k === "sp" ? { k, id: v } : { k, name: v };
      this.closeModal(); this.tribRender(true); this.save && this.save();
    },

    /* ---------- 进入 / 开始 / 结束 ---------- */
    // 「突破」按钮：有渡劫在进行就看渡劫页，没有就进准备页
    openTrib() { this.tribOpen = true; this.tribRender(true); },
    closeTrib() {
      this.tribOpen = false; $("#trib").classList.add("hidden"); $("#trib").innerHTML = "";
      if (this.s.trib && this.s.trib.result) this.s.trib = null;   // 结束后离开才清除记录
      this.render();
    },
    startTrib() {
      const s = this.s; if (s.trib || !this.canBreak() || !this.needTrib()) return;
      const L = s.L + 1, t = this.makeTrib(L), st = this.stats();
      s.hp = st.hp; s.mana = st.mana;   // 开始时气血法力回满
      s.trib = { v: 2, L, start: this.now(), time: this.tribTime(L), sec: 0, atk: t.atk, crit: t.crit, taken: 0, hits: 0, log: [], result: "" };
      this.log(`劫云压顶，${this.realmName(L)}天劫降临！`, "gold");
      this.tribOpen = true; this.save && this.save(); this.tribRender(true);
    },
    // 按时间推进：每 HIT_SEC 秒劈一次（离线回来一次算完）
    advanceTrib() {
      const s = this.s, x = s.trib; if (!x || x.result) return;
      if (x.v !== 2) { s.trib = null; return; }   // 旧版雷劫存档：作废
      const HS = CFG.trib.HIT_SEC || 1;
      let hit = null;
      while (!x.result) {
        const nextHit = (Math.floor(x.sec / HS) + 1) * HS;
        if (nextHit > x.time) { if (this.now() >= x.start + x.time * 1000) { x.sec = x.time; this.endTrib(true); } break; }
        if (this.now() < x.start + nextHit * 1000) break;
        x.sec = nextHit;
        const [d, c] = this.tribHit(x); s.hp -= d; x.taken += d; x.hits++;
        hit = { d, c };
        x.log.unshift(`第${x.sec}秒：劫雷劈中你 ${U.fmt(d)}${c ? "（暴击）" : ""}`);
        if (x.log.length > 60) x.log.length = 60;
        if (s.hp <= 0) this.endTrib(false);
        else if (x.sec >= x.time) this.endTrib(true);
      }
      if (hit) this._tribHit = hit;
    },
    endTrib(win) {
      const s = this.s, x = s.trib;
      if (win) {
        s.exp -= this.needExp(); s.L = x.L; this.dirty();
        const st = this.stats(); s.hp = st.hp; s.mana = st.mana;
        x.result = `渡劫成功！你扛过 ${x.time} 秒劫雷，踏入【${this.realmName()}】。`;
        this.log(x.result, "gold");
      } else {
        s.hp = 1;
        const loss = Math.floor(s.exp * CFG.trib.FAIL_LOSS); s.exp -= loss;
        x.result = `渡劫失败：第 ${x.sec} 秒被劫雷劈倒，修为 -${U.fmt(loss)}。`;
        this.log(x.result, "bad");
      }
      this.dirty(); if (!this.silent) { this.save(); this.render(); }
    },

    /* ---------- 画面 ---------- */
    // 每秒调用：full = 整页重画，否则只更新数字、血条、闪电
    showTrib() { if (this.tribOpen) this.tribRender(false); },
    tribRender(full) {
      const el = $("#trib"); if (!this.tribOpen || !el) return;
      el.classList.remove("hidden");
      const x = this.s.trib;
      if (!x) { if (full || el.dataset.mode !== "prep") { el.dataset.mode = "prep"; el.innerHTML = this.tribPrepHtml(); } return; }
      const mode = x.result ? "end" : "run";
      if (full || el.dataset.mode !== mode) { el.dataset.mode = mode; el.innerHTML = this.tribRunHtml(); this._tribHit = null; return; }
      // 只更新会变的部分
      const s = this.s, st = this.stats(), hpPct = Math.max(0, s.hp) / st.hp * 100;
      const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
      set("tj-left", x.time - x.sec); set("tj-hp", `${U.fmt(Math.max(0, s.hp))} / ${U.fmt(st.hp)}`); set("tj-taken", U.fmt(x.taken));
      const bar = document.getElementById("tj-hpbar"); if (bar) bar.style.width = hpPct + "%";
      const tb = document.getElementById("tj-timebar"); if (tb) tb.style.width = x.sec / x.time * 100 + "%";
      const lg = document.getElementById("tj-log"); if (lg) lg.innerHTML = x.log.slice(0, 8).map(l => `<p>${l}</p>`).join("");
      if (this._tribHit) { this.tribBolt(this._tribHit); this._tribHit = null; }
    },
    // 一道闪电 + 人物身上飘伤害
    tribBolt(h) {
      const sky = document.getElementById("tj-sky"), hero = document.getElementById("tj-hero"); if (!sky || !hero) return;
      const x = 20 + Math.random() * 60, pts = [[x, 0]];
      for (let y = 12; y < 100; y += 12) pts.push([x + (Math.random() - 0.5) * 14, y]);
      pts.push([50, 100]);
      const b = document.createElement("div"); b.className = "tj-bolt";
      b.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts.map(p => p.join(",")).join(" ")}"/></svg>`;
      sky.appendChild(b); setTimeout(() => b.remove(), 450);
      const f = document.getElementById("trib"); f.classList.remove("tj-flash"); void f.offsetWidth; f.classList.add("tj-flash");
      hero.classList.remove("tj-shake"); void hero.offsetWidth; hero.classList.add("tj-shake");
      const n = document.createElement("div"); n.className = "tj-dmg" + (h.c ? " crit" : ""); n.textContent = "-" + U.fmt(h.d) + (h.c ? " 暴击" : "");
      n.style.left = 35 + Math.random() * 30 + "%"; hero.appendChild(n); setTimeout(() => n.remove(), 1100);
    },
    // 劫云（几团乌云叠起来）
    tribCloudHtml() {
      return `<div class="tj-sky" id="tj-sky"><div class="tj-cloud c1"></div><div class="tj-cloud c2"></div><div class="tj-cloud c3"></div><div class="tj-cloud c4"></div><div class="tj-glow"></div></div>`;
    },
    // 人物：打坐的剪影
    tribHeroHtml(dead) {
      return `<div class="tj-hero${dead ? " dead" : ""}" id="tj-hero"><div class="tj-aura"></div>
        <svg viewBox="0 0 120 120"><circle cx="60" cy="28" r="12"/><path d="M60 8 l-4 8 h8z"/>
        <path d="M60 40 C44 42 38 58 40 80 L80 80 C82 58 76 42 60 40Z"/>
        <path d="M22 96 C24 82 40 78 60 80 C80 78 96 82 98 96 C86 102 34 102 22 96Z"/>
        <path d="M42 62 C36 70 40 80 54 84 L66 84 C80 80 84 70 78 62 C72 72 48 72 42 62Z" opacity=".75"/></svg></div>`;
    },
    tribPrepHtml() {
      const s = this.s, N = this.tribSlotN(), L = s.L + 1, t = this.makeTrib(L), st = this.stats(), T = this.tribTime(L);
      const ok = this.canBreak() && this.needTrib();
      const cells = Array.from({ length: N }, (_, i) => {
        const c = s.tribSlots[i], f = this.tribFind(c);
        return `<div class="tj-slot${f ? " on" : c ? " lost" : ""}" onclick="G.tribPick(${i})">${f ? `${f.img ? `<img src="${f.img}" alt="">` : `<span class="tj-ic">${f.tag.slice(0, 1)}</span>`}<small>${f.name}</small>` : c ? "<small>已失效</small>" : "<span class='tj-plus'>＋</span>"}</div>`;
      }).join("");
      return `<div class="tj-wrap">
        <div class="tj-head"><button class="sm" onclick="G.closeTrib()">返回</button><b>渡劫准备 · ${this.realmName(L)}</b><span></span></div>
        ${this.tribCloudHtml()}
        <div class="tj-info">
          <div class="row small"><span>渡劫时长 ${T} 秒</span><span>劫雷每 ${CFG.trib.HIT_SEC || 1} 秒一击</span></div>
          <div class="row small"><span>劫云攻击 ${U.fmt(t.atk)} · 暴击 ${t.crit}%</span><span>你的气血 ${U.fmt(st.hp)} · 防御 ${U.fmt(st.def)}</span></div>
          <p class="desc">撑过 ${T} 秒没倒即突破成功；被劈倒则失败，损失当前修为的 ${Math.round(CFG.trib.FAIL_LOSS * 100)}%。开始时气血法力回满，渡劫中不恢复，离开游戏也会继续。</p>
        </div>
        <div class="tj-slots">${cells}</div>
        <p class="desc" style="text-align:center">点格子放入法宝、法术、丹药（丹药每格 1 颗）</p>
        <div class="btns"><button class="primary" style="flex-basis:100%" onclick="G.startTrib()" ${ok ? "" : "disabled"}>开始渡劫</button></div>
      </div>`;
    },
    tribRunHtml() {
      const s = this.s, x = s.trib, st = this.stats(), end = !!x.result, win = end && /成功/.test(x.result);
      const cells = (this.s.tribSlots || []).map(c => this.tribFind(c)).filter(Boolean)
        .map(f => `<div class="tj-slot on sm" onclick="G.tribUse()">${f.img ? `<img src="${f.img}" alt="">` : `<span class="tj-ic">${f.tag.slice(0, 1)}</span>`}<small>${f.name}</small></div>`).join("");
      return `<div class="tj-wrap${end ? win ? " win" : " lose" : ""}">
        <div class="tj-head"><button class="sm" onclick="G.closeTrib()">${end ? "离开" : "返回（渡劫继续）"}</button><b>渡劫 · ${this.realmName(x.L)}</b><span></span></div>
        ${this.tribCloudHtml()}
        <div class="tj-timer">${end ? (win ? "渡劫成功" : "渡劫失败") : `<b id="tj-left">${x.time - x.sec}</b><small> 秒</small>`}</div>
        <div class="bar tick"><div id="tj-timebar" style="width:${x.sec / x.time * 100}%"></div></div>
        ${this.tribHeroHtml(end && !win)}
        <div class="row small"><span>气血 <b id="tj-hp">${U.fmt(Math.max(0, s.hp))} / ${U.fmt(st.hp)}</b></span><span>共承受 <b id="tj-taken">${U.fmt(x.taken)}</b></span></div>
        <div class="bar hp"><div id="tj-hpbar" style="width:${Math.max(0, s.hp) / st.hp * 100}%"></div></div>
        ${end ? `<p class="${win ? "q4" : "q5"}" style="text-align:center"><b>${x.result}</b></p>` : ""}
        ${cells && !end ? `<div class="tj-slots run">${cells}</div>` : ""}
        <div class="trib-log" id="tj-log">${x.log.slice(0, 8).map(l => `<p>${l}</p>`).join("") || "<p>乌云压顶，雷光翻涌……</p>"}</div>
        ${end ? `<div class="btns"><button class="primary" style="flex-basis:100%" onclick="G.closeTrib()">离开</button></div>` : ""}
      </div>`;
    },
    // 渡劫中点格子：法宝、法术、丹药的效果还没做
    tribUse() {
      const n = $("#toast"); if (!n) return;
      n.innerHTML = `<p class="sys">渡劫中使用法宝、法术、丹药的效果尚未开放</p>`; n.classList.add("show");
      clearTimeout(this._toastT); this._toastT = setTimeout(() => n.classList.remove("show"), 2000);
    },
  },
});
