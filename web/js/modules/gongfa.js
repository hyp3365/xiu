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
    if (!s.gfStudy) this.nextStudy();
    while (s.gfStudy) {
      const st = s.gfStudy;
      let steps = Math.floor((this.now() - st.at) / STEP);
      if (steps <= 0) break;
      st.at += steps * STEP;
      // 修为够几步就走几步
      const can = Math.min(steps, Math.floor(s.exp / st.per), Math.ceil((st.total - st.done) / STEP));
      s.exp -= can * st.per; st.spent += can * st.per; st.done += can * STEP;
      st.stalled = can < steps && st.done < st.total;   // 修为不够，暂停
      if (st.done < st.total) break;
      // 完成，升一层
      s.gongfa[st.id] = (s.gongfa[st.id] || 1) + 1;
      const info = DATA.skillInfo(st.id, s.gongfa[st.id]);
      this.log(`修炼有成，《${info.name}》（${info.tier.name}）提升至第 ${info.lv} 层！共消耗修为 ${U.fmt(st.spent)}。`, "gold");
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
      const b = { def: 0, atk: 0, hp: 0, cultivate: 0, hit: 0, dodge: 0, mana: 0, res: {} }; // res：真诀加的各系抗性
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
        const info = DATA.skillInfo(id, lv), total = DATA.studyMin[lv - 1] * 60000;
        const steps = total / (DATA.STUDY_STEP * 1000);
        s.gfStudy = { id, total, done: 0, at: at || this.now(), per: Math.max(1, Math.ceil(DATA.studyExp(info) / steps)), spent: 0 };
      }
    },
    removeQueue(i) { this.s.gfQueue.splice(i, 1); this.after(); },
    stopStudy() {
      if (!this.s.gfStudy || !confirm("中断修炼，已消耗的修为不退还，确定？")) return;
      this.s.gfStudy = null; this.nextStudy(); this.after();
    },
    setGfFilter(t) { this.gfFilter = t; this.render(); },

    // 数值显示：身法是闪避（两位小数），其余取整
    gfValue(info, v) { return U.num(v); },
    // 倒计时文字：时分秒
    countdown(ms) {
      const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
      return (h ? h + "小时" : "") + (h || m ? m + "分" : "") + s + "秒";
    },
    // 一行：功法或法术，带修炼按钮
    skillLine(g) {
      const s = this.s, max = g.lv >= DATA.GONGFA_MAX, plan = this.plannedLv(g.id), full = plan >= DATA.GONGFA_MAX;
      const lg = this.s.lingen[g.el.id] || 0, lgTxt = lg ? `（${g.el.name}灵根 +${lg * (g.kind === "sp" ? CFG.lingen.SPELL_PCT : CFG.lingen.GONGFA_PCT)}%）` : "";
      const desc = g.kind === "sp"
        ? `伤害 攻击×${g.pct}% + ${U.fmt(g.flat)}${lgTxt}，耗法力 ${U.fmt(g.mana)}${max ? "" : `，下一层 +${U.fmt(g.perLv * (g.lv + 1))}`}`
        : `${g.label} +${this.gfValue(g, g.value * this.lingenGongfa(g.el.id))}${lgTxt}${max ? "" : `，下一层 +${this.gfValue(g, g.perLv * (g.lv + 1) * this.lingenGongfa(g.el.id))}`}`;
      const cost = max ? 0 : DATA.studyExp(g), steps = max ? 1 : DATA.studyMin[g.lv - 1] * 60 / DATA.STUDY_STEP;
      return `<div class="line"><div>《${g.name}》<span class="tag">${g.star}星</span><span class="tag">${DATA.gfSources[g.src].name}</span><span class="tag">${g.el.name}</span><span class="tag">${g.tier.name}</span><span class="tag">${g.lv}/${DATA.GONGFA_MAX}层</span>
        <small>${desc}${max ? "" : `<br>下一层：${U.dur(DATA.studyMin[g.lv - 1] * 60)} · 每5秒 ${U.fmt(Math.max(1, Math.ceil(cost / steps)))} 修为（共 ${U.fmt(cost)}）`}${plan > g.lv ? `<br>已排至第 ${plan} 层` : ""}</small></div>
        ${max ? `<button class="sm" disabled>圆满</button>` :
          `<button class="sm" onclick="G.studyGongfa('${g.id}')" ${full || s.gfQueue.length >= DATA.GF_QUEUE ? "disabled" : ""}>${full ? "已排满" : "修炼"}</button>`}</div>`;
    },
  },

  view() {
    const s = this.s, ids = Object.keys(s.gongfa), filter = this.gfFilter || "all";
    if (!ids.length) return `<div class="card"><h3>功法</h3><p class="desc">你尚未习得任何功法。拜入门派后在功法殿用贡献学习，或在世界 · 坊市用灵石购买。<br>注意：至少学会一部秘诀才能修炼。</p></div>`;

    const cats = [["all", "全部"], ...DATA.gongfaTypes.map(t => [t.id, t.name]), ["spell", "法术"]];
    const tabs = `<div class="room-grid">${cats.map(([k, n]) => `<button class="${filter === k ? "active" : ""}" onclick="G.setGfFilter('${k}')">${n}</button>`).join("")}</div>`;

    // 正在修炼（倒计时）
    let study = "";
    if (s.gfStudy) {
      const info = DATA.skillInfo(s.gfStudy.id, s.gongfa[s.gfStudy.id]);
      const st = s.gfStudy, done = st.stalled ? st.done : Math.min(st.total, st.done + (Date.now() - st.at)), left = st.total - done;
      study = `<div class="card"><h3>修炼中 ·《${info.name}》<small>第 ${info.lv} → ${info.lv + 1} 层</small></h3>
        <div class="bar tick"><div style="width:${done / st.total * 100}%"></div></div>
        <div class="row small"><span>${st.stalled ? "<b class='q5'>修为不足，暂停中</b>" : `倒计时 <b>${this.countdown(left)}</b>`}</span><button class="sm" onclick="G.stopStudy()">中断</button></div>
        <div class="row small"><span>每 5 秒消耗修为 <b>${U.fmt(st.per)}</b></span><span>已消耗 <b>${U.fmt(st.spent)}</b> / ${U.fmt(st.per * st.total / (DATA.STUDY_STEP * 1000))}</span></div>
        ${s.gfQueue.length ? `<h3 style="margin-top:8px">修炼队列<small>${s.gfQueue.length} / ${DATA.GF_QUEUE}</small></h3>` + s.gfQueue.map((id, i) => {
          const q = DATA.skillInfo(id); return `<div class="line"><div>${i + 1}. 《${q.name}》<span class="tag">${q.star}星</span><span class="tag">${q.tier.name}</span></div><button class="sm" onclick="G.removeQueue(${i})">移除</button></div>`; }).join("") : ""}</div>`;
    }

    const all = ids.map(id => DATA.skillInfo(id, s.gongfa[id])).filter(Boolean);
    const groups = [...DATA.gongfaTypes.map(t => ({ key: t.id, title: t.name, sub: t.label, items: all.filter(g => g.kind === "gf" && g.type.id === t.id) })),
                    { key: "spell", title: "法术", sub: "放入背包法术栏后战斗中施放", items: all.filter(g => g.kind === "sp") }];
    const body = groups.filter(gr => filter === "all" || gr.key === filter).map(gr => {
      if (!gr.items.length) return filter === "all" ? "" : `<div class="card"><p class="desc">尚未学会任何${gr.title}。</p></div>`;
      gr.items.sort((a, b) => a.star - b.star || a.tier.idx - b.tier.idx); // 星级低 → 高，黄 → 天
      return `<div class="card"><h3>${gr.title}<small>${gr.sub}</small></h3>${gr.items.map(g => this.skillLine(g)).join("")}</div>`;
    }).join("");
    return tabs + study + body;
  },
});
