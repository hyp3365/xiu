/* =====================================================================
 * 模块：功法栏（功法 + 法术）
 * ---------------------------------------------------------------------
 * - 只显示已学会的，可按 心法/功诀/真经/秘诀/身法/法诀/法术 分类查看
 * - 已学会的功法全部生效，加成为固定数值
 * - 法术需放进背包“法术”栏才会在战斗中施放
 * - 每部 12 层，学会时为第 1 层；修炼升层消耗修为 + 时间，同时只能修炼一部
 * - 修炼按真实时间计算，离线也会继续
 * 存档字段：
 *   gongfa:  { "s1_0:mijue:huang": 3, "s1_0:sp:huo:huang": 1, ... }  已学 → 层数
 *   gfStudy: { id, end, total } | null   正在修炼的、完成时间、总时长（毫秒）
 * 学习入口在门派“功法殿”（modules/sect.js）。
 * ===================================================================== */
G.module({
  id: "gongfa",
  tab: "gongfa",

  defaults: () => ({ gongfa: {}, gfStudy: null }),

  // 每 10 秒检查修炼是否完成
  tick() {
    const st = this.s.gfStudy;
    if (st && this.now() >= st.end) {
      this.s.gongfa[st.id] = (this.s.gongfa[st.id] || 1) + 1;
      this.s.gfStudy = null;
      const info = DATA.skillInfo(st.id, this.s.gongfa[st.id]);
      this.log(`修炼有成，《${info.name}》（${info.tier.name}）提升至第 ${info.lv} 层！`, "gold");
      this.dirty();
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
      if (this.s.gfStudy && this.s.gfStudy.id.split(":").length === 2) this.s.gfStudy = null;
      delete this.s.gfActive;
    },

    // 所有已学功法的加成合计（法术不算）
    gongfaBonus() {
      const b = { def: 0, atk: 0, hp: 0, cultivate: 0, dodge: 0, mana: 0 };
      for (const id in this.s.gongfa) {
        if (DATA.isSpell(id)) continue;
        const info = DATA.gongfaInfo(id, this.s.gongfa[id]);
        if (info) b[info.type.stat] += info.value;
      }
      return b;
    },
    hasGongfa(id) { return !!this.s.gongfa[id]; },
    // 是否学会了秘诀（修炼的前提）
    hasMijue() { return Object.keys(this.s.gongfa).some(id => id.split(":")[1] === "mijue"); },

    // 开始修炼（升一层），消耗修为
    studyGongfa(id) {
      const lv = this.s.gongfa[id];
      if (!lv || lv >= DATA.GONGFA_MAX || this.s.gfStudy) return;
      const info = DATA.skillInfo(id, lv), cost = DATA.studyExp(info);
      if (this.s.exp < cost) return this.log(`修为不足，需要 ${U.fmt(cost)}。`, "sys");
      this.s.exp -= cost;
      const total = DATA.studyMin[lv - 1] * 60000;
      this.s.gfStudy = { id, end: this.now() + total, total };
      this.log(`消耗修为 ${U.fmt(cost)}，开始修炼《${info.name}》。`, "sys");
      this.after();
    },
    stopStudy() {
      if (!this.s.gfStudy || !confirm("中断修炼，消耗的修为不退还，确定？")) return;
      this.s.gfStudy = null; this.after();
    },
    setGfFilter(t) { this.gfFilter = t; this.render(); },

    // 数值显示：身法是闪避（两位小数），其余取整
    gfValue(info, v) { return info.kind === "gf" && info.type.stat === "dodge" ? v.toFixed(2) + "%" : U.fmt(v); },
    // 倒计时文字：时分秒
    countdown(ms) {
      const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
      return (h ? h + "小时" : "") + (h || m ? m + "分" : "") + s + "秒";
    },
    // 一行：功法或法术，带修炼按钮
    skillLine(g) {
      const s = this.s, max = g.lv >= DATA.GONGFA_MAX, studying = s.gfStudy && s.gfStudy.id === g.id;
      const desc = g.kind === "sp"
        ? `伤害 攻击×${g.pct}% + ${U.fmt(g.flat)}，耗法力 ${U.fmt(g.mana)}${max ? "" : `，下一层 +${U.fmt(g.perLv * (g.lv + 1))}`}`
        : `${g.type.label} +${this.gfValue(g, g.value)}${max ? "" : `，下一层 +${this.gfValue(g, g.perLv * (g.lv + 1))}`}`;
      const cost = max ? 0 : DATA.studyExp(g);
      return `<div class="line"><div>《${g.name}》<span class="tag">${g.tier.name}</span><span class="tag">${g.lv}/${DATA.GONGFA_MAX}层</span>
        <small>${desc}${max ? "" : `<br>修炼：${U.dur(DATA.studyMin[g.lv - 1] * 60)} · 修为 ${U.fmt(cost)}`}</small></div>
        ${max ? `<button class="sm" disabled>圆满</button>` : studying ? `<button class="sm on" disabled>修炼中</button>` :
          `<button class="sm" onclick="G.studyGongfa('${g.id}')" ${s.gfStudy || s.exp < cost ? "disabled" : ""}>修炼</button>`}</div>`;
    },
  },

  view() {
    const s = this.s, ids = Object.keys(s.gongfa), filter = this.gfFilter || "all";
    if (!ids.length) return `<div class="card"><h3>功法</h3><p class="desc">你尚未习得任何功法。拜入门派后，在功法殿用贡献学习。<br>注意：至少学会一部秘诀才能修炼。</p></div>`;

    const cats = [["all", "全部"], ...DATA.gongfaTypes.map(t => [t.id, t.name]), ["spell", "法术"]];
    const tabs = `<div class="room-grid">${cats.map(([k, n]) => `<button class="${filter === k ? "active" : ""}" onclick="G.setGfFilter('${k}')">${n}</button>`).join("")}</div>`;

    // 正在修炼（倒计时）
    let study = "";
    if (s.gfStudy) {
      const info = DATA.skillInfo(s.gfStudy.id, s.gongfa[s.gfStudy.id]);
      const total = s.gfStudy.total || DATA.studyMin[info.lv - 1] * 60000, left = Math.max(0, s.gfStudy.end - Date.now());
      study = `<div class="card"><h3>修炼中 ·《${info.name}》<small>第 ${info.lv} → ${info.lv + 1} 层</small></h3>
        <div class="bar tick"><div style="width:${100 - left / total * 100}%"></div></div>
        <div class="row small"><span>倒计时 <b>${this.countdown(left)}</b></span><button class="sm" onclick="G.stopStudy()">中断</button></div></div>`;
    }

    const all = ids.map(id => DATA.skillInfo(id, s.gongfa[id])).filter(Boolean);
    const groups = [...DATA.gongfaTypes.map(t => ({ key: t.id, title: t.name, sub: t.label, items: all.filter(g => g.kind === "gf" && g.type.id === t.id) })),
                    { key: "spell", title: "法术", sub: "放入背包法术栏后战斗中施放", items: all.filter(g => g.kind === "sp") }];
    const body = groups.filter(gr => filter === "all" || gr.key === filter).map(gr => {
      if (!gr.items.length) return filter === "all" ? "" : `<div class="card"><p class="desc">尚未学会任何${gr.title}。</p></div>`;
      gr.items.sort((a, b) => b.tier.idx - a.tier.idx);
      return `<div class="card"><h3>${gr.title}<small>${gr.sub}</small></h3>${gr.items.map(g => this.skillLine(g)).join("")}</div>`;
    }).join("");
    return tabs + study + body;
  },
});
