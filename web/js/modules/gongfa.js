/* =====================================================================
 * 模块：功法栏（功法 + 法术）
 * ---------------------------------------------------------------------
 * - 只显示已学会的，可按 心法/功诀/真经/秘诀/身法/法诀/法术 分类查看
 * - 已学会的功法全部生效，加成为固定数值
 * - 法术需放进背包“法术”栏才会在战斗中施放
 * - 每部 12 层，学会时为第 1 层
 * - 修炼升层需要时间，修炼期间每 5 秒消耗一次修为（修为不够就暂停，等有修为再继续）
 * - 修炼队列最多 15 个，当前这部练完自动开始下一个；离线也会继续
 * 存档字段：
 *   gongfa:  { "s1_0:mijue:huang": 3, "s1_0:sp:huo:huang": 1, ... }  已学 → 层数
 *   gfStudy: { id, total, done, at, per, spent } | null
 *            正在修炼：总时长、已修炼时长（毫秒）、上次结算时间、每 5 秒消耗、已消耗修为
 *   gfQueue: [id, ...]   排队中的（同一部可排多次，每次升一层）
 * 学习入口在门派“功法殿”（modules/sect.js）。
 * ===================================================================== */
G.module({
  id: "gongfa",
  tab: "gongfa",

  defaults: () => ({ gongfa: {}, gfStudy: null, gfQueue: [] }),

  // 每 10 秒结算修炼：按 5 秒一步扣修为、累计进度
  tick() {
    const s = this.s, STEP = DATA.STUDY_STEP * 1000;
    this.cqTick();   // 元婴出窍秘法修炼（sect.js）
    if (!s.gfStudy) this.nextStudy();
    while (s.gfStudy) {
      const st = s.gfStudy;
      let steps = Math.floor((this.now() - st.at) / STEP);
      if (steps <= 0) break;
      st.at += steps * STEP;
      // v27：练功房（宗门扣贡献 / 坊市扣灵石）：进度 ×(1+pct%)，每步修为同比例多扣，总消耗不变
      let R = this.gfRoomNow();
      if (R && R.cost > 0 && Math.floor(s[R.cur] / Math.max(1, R.cost)) < Math.min(steps, Math.ceil((st.total - st.done) / STEP))) { this.leaveGfRoom(R.cur === "stone" ? "灵石不足" : "门派贡献不足"); R = null; }
      const mul = R ? 1 + R.pct / 100 : 1, per = st.per * mul;
      // 修为（秘法还要灵石）够几步就走几步
      const sp = (st.stone || 0) * mul;
      const can = Math.min(steps, Math.floor(s.exp / per), sp ? Math.floor(s.stone / sp) : Infinity, Math.ceil((st.total - st.done) / (STEP * mul)));
      s.exp -= can * per; st.spent += can * per; st.done = Math.min(st.total, st.done + can * STEP * mul);
      if (sp) { s.stone -= can * sp; st.spentStone = (st.spentStone || 0) + can * sp; }
      if (R) s[R.cur] -= can * R.cost;
      st.stalled = can < steps && st.done < st.total;   // 修为 / 灵石不够，暂停
      if (st.done < st.total) break;
      // 完成，升一层
      s.gongfa[st.id] = (s.gongfa[st.id] || 1) + 1;
      const info = DATA.skillInfo(st.id, s.gongfa[st.id]);
      this.log(`修炼有成，《${info.name}》（${info.tier.name}）提升至第 ${info.lv} 层！共消耗修为 ${U.fmt(st.spent)}${st.spentStone ? `、灵石 ${U.fmt(st.spentStone)}` : ""}。`, "gold");
      s.gfStudy = null; this.dirty();
      this.nextStudy(st.at);
    }
  },

  api: {
    // 旧存档格式转换：v3 数组 → 对象；v4 无阶 id → 黄阶
    fixGongfa() {
      let g = this.s.gongfa;
      if (Array.isArray(g)) { const m = {}; g.forEach(id => { m[id.split(":").slice(0, 2).join(":")] = 1; }); g = m; }
      const m = {};
      for (const id in g) m[id.split(":").length === 2 ? id + ":huang" : id] = g[id];
      this.s.gongfa = m;
      if (this.s.gfStudy && (this.s.gfStudy.id.split(":").length === 2 || this.s.gfStudy.done === undefined)) this.s.gfStudy = null; // 旧格式的修炼直接作废
      if (!this.s.gfQueue) this.s.gfQueue = [];
      delete this.s.gfActive;
    },

    // 所有已学功法的加成合计（法术不算）
    gongfaBonus() {
      const b = { def: 0, atk: 0, hp: 0, cultivate: 0, hit: 0, dodge: 0, mana: 0, body: 0, res: {} };   // body：肉身秘诀加的肉身修炼速度 // res：真诀加的各系抗性
      for (const id in this.s.gongfa) {
        if (DATA.isSpell(id)) continue;
        const info = DATA.gongfaInfo(id, this.s.gongfa[id]);
        if (!info) continue;
        const v = info.value * this.lingenGongfa(info.el.id);  // 灵根加成
        if (info.type.stat === "res") b.res[info.el.id] = (b.res[info.el.id] || 0) + v;
        else b[info.type.stat] += v;
      }
      return b;
    },
    hasGongfa(id) { return !!this.s.gongfa[id]; },
    // 这一层的修炼时间（秒）= STUDY_MIN − 宗门秘法「悟法 / 悟道」减少的秒数，最少 STUDY_MIN_SEC（修炼秘法本身不减少）
    studySec(g) {
      const m = this.mifaBonus(), red = g.kind === "mf" ? 0 : g.kind === "sp" ? m.spStudy : m.gfStudy;
      return Math.max(Math.min(CFG.wudao.STUDY_MIN_SEC || 10, DATA.studyMin[g.lv - 1] * 60), DATA.studyMin[g.lv - 1] * 60 - red);
    },
    // 是否学会了秘诀（修炼的前提）
    hasMijue() { return Object.keys(this.s.gongfa).some(id => id.split(":")[1] === "mijue"); },

    // 本部功法计划达到的层数（当前层 + 正在修炼 + 队列中）
    plannedLv(id) {
      const s = this.s;
      return (s.gongfa[id] || 0) + (s.gfStudy && s.gfStudy.id === id ? 1 : 0) + s.gfQueue.filter(x => x === id).length;
    },
    // 加入修炼队列
    studyGongfa(id) {
      const s = this.s;
      if (!s.gongfa[id] || this.plannedLv(id) >= DATA.GONGFA_MAX) return;
      if (s.gfQueue.length >= DATA.GF_QUEUE) return this.log(`修炼队列已满（最多 ${DATA.GF_QUEUE} 个）。`, "sys");
      s.gfQueue.push(id);
      if (!s.gfStudy) this.nextStudy();
      this.after();
    },
    // 从队列取下一个开始修炼
    nextStudy(at) {
      const s = this.s;
      while (!s.gfStudy && s.gfQueue.length) {
        const id = s.gfQueue.shift(), lv = s.gongfa[id];
        if (!lv || lv >= DATA.GONGFA_MAX) continue;
        const info = DATA.skillInfo(id, lv), total = this.studySec(info) * 1000;
        s.gfStudy = { id, total, done: 0, at: at || this.now(), per: DATA.studyPer(info), spent: 0, stone: info.stonePer || 0 };   // per：每 5 秒消耗修为；stone：秘法每 5 秒灵石
      }
    },
    removeQueue(i) { this.s.gfQueue.splice(i, 1); this.after(); },
    stopStudy() {
      if (!this.s.gfStudy || !confirm("中断修炼，已消耗的修为不退还，确定？")) return;
      this.s.gfStudy = null; this.nextStudy(); this.after();
    },
    setGfFilter(t) { this.gfFilter = t; this.render(); },
    // 排序 / 隐藏满级：「按等级」「按星级」一直开着，点击切换方向（v42）
    //   默认 等级 低层 → 高层（lvUp = true）、星级 高星 → 低星（starUp = false）
    //   三个设置存在浏览器本地（localStorage），刷新网页不变
    gfPref() {
      if (!this._gfPref) { let p = {}; try { p = JSON.parse(localStorage.getItem("xiu_gf_pref2") || "{}") || {}; } catch (e) {}
        let hide = p.hide; if (hide === undefined) { try { hide = !!(JSON.parse(localStorage.getItem("xiu_gf_pref") || "{}") || {}).hide; } catch (e) { hide = false; } }
        this._gfPref = { lvUp: p.lvUp !== false, starUp: p.starUp === true, hide: !!hide }; }
      return this._gfPref;
    },
    toggleGfPref(k) { const p = this.gfPref(); p[k] = !p[k]; try { localStorage.setItem("xiu_gf_pref2", JSON.stringify(p)); } catch (e) {} this.render(); },
    setGfSort(k) { this.toggleGfPref(k === "lv" ? "lvUp" : "starUp"); },
    toggleGfHideMax() { this.toggleGfPref("hide"); },

    // 数值显示：身法是闪避（两位小数），其余取整
    gfValue(info, v) { return U.num(v); },
    // 倒计时文字：时分秒
    countdown(ms) {
      const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
      return (h ? h + "小时" : "") + (h || m ? m + "分" : "") + s + "秒";
    },
    // 「修炼队列」页：正在修炼（倒计时、进度、消耗）+ 排队中的
    gfQueueView() {
      const s = this.s;
      let html = "";
      if (s.gfStudy) {
        const info = DATA.skillInfo(s.gfStudy.id, s.gongfa[s.gfStudy.id]);
        const R = this.gfRoomNow(), mul = R ? 1 + R.pct / 100 : 1;
        const st = s.gfStudy, done = st.stalled ? st.done : Math.min(st.total, st.done + Math.max(0, Date.now() - st.at) * mul), left = (st.total - done) / mul;
        html += `<div class="card"><h3>修炼中 ·《${info ? info.name : st.id}》<small>${info ? `第 ${info.lv} → ${info.lv + 1} 层` : ""}</small></h3>
        <div class="bar tick"><div style="width:${done / st.total * 100}%"></div></div>
        <div class="row small"><span>${st.stalled ? `<b class='q5'>${st.stone ? "修为或灵石" : "修为"}不足，暂停中</b>` : `倒计时 <b>${this.countdown(left)}</b>`}</span><button class="sm" onclick="G.stopStudy()">中断</button></div>
        <div class="row small"><span>每 5 秒 <b>${U.fmt(st.per)}</b>${st.stone ? ` + ${U.fmt(st.stone)} 灵石` : ""} · 已消耗 <b>${U.fmt(st.spent)}</b> / ${U.fmt(st.per * st.total / (DATA.STUDY_STEP * 1000))}</span><span>${R ? `${R.name} +${U.num(R.pct)}%` : "未进练功房"}</span></div></div>`;
      } else html += `<div class="card"><p class="desc">当前没有在修炼的功法。在各分类里点「修炼」加入队列。</p></div>`;
      html += `<div class="card"><h3>排队中<small>${s.gfQueue.length} / ${DATA.GF_QUEUE}</small></h3>` +
        (s.gfQueue.length ? s.gfQueue.map((id, i) => {
          const q = DATA.skillInfo(id); if (!q) return "";
          return `<div class="line"><div>${i + 1}. 《${q.name}》<span class="tag">${q.star}星</span><span class="tag">${q.tier.name}</span></div><button class="sm" onclick="G.removeQueue(${i})">移除</button></div>`; }).join("")
          : `<p class="desc">队列为空。</p>`) + `</div>`;
      return html;
    },
    // 法术伤害文字（背包法术栏等处用）：没有灵根加成 = 白色；有加成 = 绿色（数值已含加成）并注明灵根加成
    spellDmgTxt(g) {
      const lg = this.s.lingen[g.el.id] || 0, m = this.lingenSpell(g.el.id);
      const cv = v => `<b class="${lg ? "gf-up" : "gf-base"}">${v}</b>`;
      return `攻击 × ${cv(U.dec(g.pct * m) + "%")} + ${cv(U.fmt(g.flat * m))}${lg ? `（${g.el.name}灵根 +${U.dec(this.lingenPct(lg, "sp"))}%）` : ""}`;
    },
    // 一行：功法或法术，带修炼按钮
    skillLine(g) {
      const s = this.s, max = g.lv >= DATA.GONGFA_MAX, plan = this.plannedLv(g.id), full = plan >= DATA.GONGFA_MAX;
      const lg = g.kind === "mf" ? 0 : this.s.lingen[g.el.id] || 0, lgTxt = lg ? `（${g.el.name}灵根 +${U.dec(this.lingenPct(lg, g.kind))}%）` : "";
      // 属性数值颜色：没有灵根加成 = 白色，有加成 = 绿色（数值已含加成）
      const spm = g.kind === "sp" ? this.lingenSpell(g.el.id) : 1;   // 法术伤害的灵根倍率（显示含加成后的数值）
      const cv = v => `<b class="${lg ? "gf-up" : "gf-base"}">${v}</b>`;
      const mfv = v => `${g.mk.sign}${U.num(v)}${g.mk.unit}`;
      const desc = g.kind === "mf"
        ? (g.mk.id === "explore" ? `${g.label} ${max ? mfv(g.value) : `圆满后 ${mfv(g.perLv)}`}` : `${g.label} ${mfv(g.value)}${max ? "" : `，下一层 ${mfv(g.next)}`}`)
        : g.kind === "sp"
        ? `伤害 攻击×${cv(U.dec(g.pct * spm) + "%")} + ${cv(U.fmt(g.flat * spm))}${lgTxt}，耗法力 ${U.fmt(g.mana)}${max ? "" : `，下一层 +${cv(U.fmt(g.next * spm))}`}`
        : `${g.label} ${cv("+" + this.gfValue(g, g.value * this.lingenGongfa(g.el.id)))}${lgTxt}${max ? "" : `，下一层 ${cv("+" + this.gfValue(g, g.next * this.lingenGongfa(g.el.id)))}`}`;
      const sec = max ? 0 : this.studySec(g), n = Math.ceil(sec / DATA.STUDY_STEP), per = max ? 0 : DATA.studyPer(g), sp = max ? 0 : g.stonePer || 0;
      return `<div class="line"><div>${DATA.skillIco(g)}《${g.name}》<span class="tag">${g.star}星</span>${g.kind === "mf" ? "" : `<span class="tag">${g.el.name}</span>`}<span class="tag">${g.tier.name}</span><span class="tag">${g.lv}/${DATA.GONGFA_MAX}层</span>
        <small>${desc}${max ? "" : `<br>下一层：${U.dur(sec)} · 每5秒 ${U.fmt(per)} 修为${sp ? ` + ${U.fmt(sp)} 灵石` : ""}（共 ${U.fmt(per * n)}${sp ? ` 修为、${U.fmt(sp * n)} 灵石` : ""}）`}${plan > g.lv ? `<br>已排至第 ${plan} 层` : ""}</small></div>
        ${max ? `<button class="sm" disabled>圆满</button>` :
          `<button class="sm" onclick="G.studyGongfa('${g.id}')" ${full || s.gfQueue.length >= DATA.GF_QUEUE ? "disabled" : ""}>${full ? "已排满" : "修炼"}</button>`}</div>`;
    },
  },

  view() {
    const s = this.s, ids = Object.keys(s.gongfa), filter = this.gfFilter || "all";
    if (!ids.length && !s.cqLv) return `<div class="card"><h3>功法</h3><p class="desc">你尚未习得任何功法。拜入门派后在功法殿用贡献学习，或在世界 · 坊市用灵石购买。<br>注意：至少学会一部秘诀才能修炼。</p></div>`;

    // 分类按钮 + 「修炼队列」按钮（修炼中的功法、排队情况都在这里看）
    const qn = (s.gfStudy ? 1 : 0) + s.gfQueue.length;
    const cats = [["all", "全部"], ...DATA.gongfaTypes.map(t => [t.id, t.name]), ["spell", "法术"], ["mifa", "秘法"], ["queue", `修炼队列${qn ? `(${qn})` : ""}`]];
    const tabs = `<div class="room-grid">${cats.map(([k, n]) => `<button class="${filter === k ? "active" : ""}" onclick="G.setGfFilter('${k}')">${n}</button>`).join("")}</div>`;

    if (filter === "queue") return tabs + this.gfQueueView();

    // 排序 / 隐藏满级
    const P = this.gfPref(), hide = P.hide;
    const tools = `<div class="row small" style="gap:6px;justify-content:flex-start;margin:6px 0">
      <button class="sm active" onclick="G.setGfSort('lv')">按等级 ${P.lvUp ? "低→高" : "高→低"}</button>
      <button class="sm active" onclick="G.setGfSort('star')">按星级 ${P.starUp ? "低→高" : "高→低"}</button>
      <button class="sm ${hide ? "active" : ""}" onclick="G.toggleGfHideMax()">${hide ? "显示满级" : "隐藏满级"}</button></div>`;

    const all = ids.map(id => DATA.skillInfo(id, s.gongfa[id])).filter(Boolean).filter(g => !hide || g.lv < DATA.GONGFA_MAX);
    const groups = [...DATA.gongfaTypes.map(t => ({ key: t.id, title: t.name, sub: t.label, items: all.filter(g => g.kind === "gf" && g.type.id === t.id) })),
                    { key: "spell", title: "法术", sub: "放入背包法术栏后战斗中施放", items: all.filter(g => g.kind === "sp") },
                    { key: "mifa", title: "秘法", sub: "宗门悟道室学习 · 修炼消耗修为和灵石", items: all.filter(g => g.kind === "mf") }];
    // 先按等级，同等级再按星级；同星级 天 → 黄
    const sortFn = (a, b) => (P.lvUp ? a.lv - b.lv : b.lv - a.lv) || (P.starUp ? a.star - b.star : b.star - a.star) || b.tier.idx - a.tier.idx;
    const body = groups.filter(gr => filter === "all" || gr.key === filter).map(gr => {
      if (gr.key === "mifa" && s.cqLv) { gr.items.sort(sortFn); return `<div class="card"><h3>${gr.title}<small>${gr.sub}</small></h3>${this.cqLine()}${gr.items.map(g => this.skillLine(g)).join("")}</div>`; }   // 元婴出窍秘法
      if (!gr.items.length) return filter === "all" ? "" : `<div class="card"><p class="desc">${hide ? "没有未满级的" : "尚未学会任何"}${gr.title}。</p></div>`;
      gr.items.sort(sortFn);
      return `<div class="card"><h3>${gr.title}<small>${gr.sub}</small></h3>${gr.items.map(g => this.skillLine(g)).join("")}</div>`;
    }).join("");
    return tabs + tools + (body || `<div class="card"><p class="desc">没有可显示的功法。</p></div>`);
  },
});
