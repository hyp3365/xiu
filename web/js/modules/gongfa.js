/* =====================================================================
 * 模块：功法栏
 * ---------------------------------------------------------------------
 * - 只显示已学会的功法，可按 心法/功诀/真经/秘诀/身法/法诀 分类查看
 * - 已学会的功法全部生效，加成为固定数值
 * - 每部功法 12 层，学会时为第 1 层
 * - 参悟升层只需时间（见 data/gongfa.js 的 gongfaStudyMin），同时只能参悟一部
 * - 参悟按真实时间计算，离线也会继续
 * 存档字段：
 *   gongfa:  { "s1_0:mijue": 3, ... }   已学功法 → 层数
 *   gfStudy: { id, end } | null          正在参悟的功法、完成时间（毫秒）
 * 功法的学习入口在门派“功法殿”（modules/sect.js）。
 * ===================================================================== */
G.module({
  id: "gongfa",
  tab: "gongfa",

  defaults: () => ({ gongfa: {}, gfStudy: null }),

  // 每 10 秒检查参悟是否完成
  tick() {
    const st = this.s.gfStudy;
    if (st && this.now() >= st.end) {
      this.s.gongfa[st.id] = (this.s.gongfa[st.id] || 1) + 1;
      this.s.gfStudy = null;
      const info = DATA.gongfaInfo(st.id, this.s.gongfa[st.id]);
      this.log(`参悟有成，《${info.name}》提升至第 ${info.lv} 层！`, "gold");
      this.dirty();
    }
  },

  api: {
    // 旧存档（数组格式）转换为新格式
    fixGongfa() {
      if (Array.isArray(this.s.gongfa)) {
        const m = {};
        this.s.gongfa.forEach(id => { const k = id.split(":").slice(0, 2).join(":"); m[k] = 1; });
        this.s.gongfa = m;
      }
      delete this.s.gfActive;
    },

    // 所有已学功法的加成合计：{ def, atk, hp, cultivate, dodge, mana }
    gongfaBonus() {
      const b = { def: 0, atk: 0, hp: 0, cultivate: 0, dodge: 0, mana: 0 };
      for (const id in this.s.gongfa) {
        const info = DATA.gongfaInfo(id, this.s.gongfa[id]);
        if (info) b[info.type.stat] += info.value;
      }
      return b;
    },
    hasGongfa(id) { return !!this.s.gongfa[id]; },

    // 开始参悟（升一层）
    studyGongfa(id) {
      const lv = this.s.gongfa[id];
      if (!lv || lv >= DATA.GONGFA_MAX || this.s.gfStudy) return;
      this.s.gfStudy = { id, end: this.now() + DATA.gongfaStudyMin[lv - 1] * 60000 };
      this.log(`开始参悟《${DATA.gongfaInfo(id).name}》。`, "sys");
      this.after();
    },
    stopStudy() {
      if (!this.s.gfStudy || !confirm("中断参悟，进度将清零，确定？")) return;
      this.s.gfStudy = null; this.after();
    },
    setGfFilter(t) { this.gfFilter = t; this.render(); },

    // 数值显示：身法是闪避（带一位小数），其余取整
    gfValue(info, v) { return info.type.stat === "dodge" ? v.toFixed(2) : U.fmt(v); },
  },

  view() {
    this.fixGongfa();
    const s = this.s, ids = Object.keys(s.gongfa), filter = this.gfFilter || "all";
    if (!ids.length) return `<div class="card"><h3>功法</h3><p class="desc">你尚未习得任何功法。拜入门派后，可在功法殿用贡献学习。</p></div>`;

    const tabs = `<div class="sub-tabs scroll"><button class="${filter === "all" ? "active" : ""}" onclick="G.setGfFilter('all')">全部</button>` +
      DATA.gongfaTypes.map(t => `<button class="${filter === t.id ? "active" : ""}" onclick="G.setGfFilter('${t.id}')">${t.name}</button>`).join("") + `</div>`;

    // 正在参悟
    let study = "";
    if (s.gfStudy) {
      const info = DATA.gongfaInfo(s.gfStudy.id, s.gongfa[s.gfStudy.id]);
      const total = DATA.gongfaStudyMin[info.lv - 1] * 60000, left = Math.max(0, s.gfStudy.end - Date.now());
      study = `<div class="card"><h3>参悟中 ·《${info.name}》<small>第 ${info.lv} → ${info.lv + 1} 层</small></h3>
        <div class="bar tick"><div style="width:${100 - left / total * 100}%"></div></div>
        <div class="row small"><span>剩余 ${U.dur(left / 1000)}${left < 60000 ? " " + Math.ceil(left / 1000) + "秒" : ""}</span>
        <button class="sm" onclick="G.stopStudy()">中断</button></div></div>`;
    }

    const list = ids.map(id => DATA.gongfaInfo(id, s.gongfa[id])).filter(x => x && (filter === "all" || x.type.id === filter));
    const body = DATA.gongfaTypes.filter(t => filter === "all" || t.id === filter).map(t => {
      const items = list.filter(g => g.type.id === t.id);
      if (!items.length) return filter === "all" ? "" : `<div class="card"><p class="desc">尚未学会任何${t.name}。</p></div>`;
      return `<div class="card"><h3>${t.name}<small>${t.label}</small></h3>` + items.map(g => {
        const max = g.lv >= DATA.GONGFA_MAX, studying = s.gfStudy && s.gfStudy.id === g.id;
        return `<div class="line"><div>《${g.name}》<span class="tag">${g.lv}/${DATA.GONGFA_MAX}层</span>
          <small>${t.label} +${this.gfValue(g, g.value)}${max ? "" : `，下一层 +${this.gfValue(g, g.perLv * (g.lv + 1))}`}</small></div>
          ${max ? `<button class="sm" disabled>圆满</button>` : studying ? `<button class="sm on" disabled>参悟中</button>` :
            `<button class="sm" onclick="G.studyGongfa('${g.id}')" ${s.gfStudy ? "disabled" : ""}>参悟 ${U.dur(DATA.gongfaStudyMin[g.lv - 1] * 60)}</button>`}</div>`;
      }).join("") + `</div>`;
    }).join("");
    return tabs + study + body;
  },
});
