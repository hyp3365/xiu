/* =====================================================================
 * 模块：功法
 * ---------------------------------------------------------------------
 * 功法页只显示已学会的功法，按 心法/功诀/真经/秘诀/身法/法诀 分类。
 * 每类只能主修一部，主修的那部才生效。
 * 功法从门派“藏经阁”用贡献学习（见 modules/sect.js）。
 * 存档字段：
 *   gongfa: ["s1_0:mijue:1", ...]       已学会的功法 id
 *   gfActive: { mijue: "s1_0:mijue:1" }  每类主修的功法
 * ===================================================================== */
G.module({
  id: "gongfa",
  tab: "gongfa",

  defaults: () => ({ gongfa: [], gfActive: {} }),

  api: {
    // 汇总主修功法的加成：{ def, atk, hp, cultivate, dodge, mana }
    gongfaBonus() {
      const b = { def: 0, atk: 0, hp: 0, cultivate: 0, dodge: 0, mana: 0 };
      for (const t in this.s.gfActive) {
        const info = DATA.gongfaInfo(this.s.gfActive[t]);
        if (info) b[info.type.stat] += info.value;
      }
      return b;
    },
    setGongfa(id) {
      const info = DATA.gongfaInfo(id);
      this.s.gfActive[info.type.id] = id;
      this.log(`主修《${info.name}》。`, "sys"); this.after();
    },
    hasGongfa(id) { return this.s.gongfa.includes(id); },
  },

  view() {
    const s = this.s;
    if (!s.gongfa.length) return `<div class="card"><h3>功法</h3><p class="desc">你尚未习得任何功法。拜入门派后，可在藏经阁用贡献学习。</p></div>`;
    return DATA.gongfaTypes.map(type => {
      const list = s.gongfa.map(id => DATA.gongfaInfo(id)).filter(x => x && x.type.id === type.id)
        .sort((a, b) => b.value - a.value);
      if (!list.length) return "";
      return `<div class="card"><h3>${type.name}<small>加成${type.label}</small></h3>` + list.map(g => {
        const on = s.gfActive[type.id] === g.id;
        return `<div class="line"><div>《${g.name}》<span class="tag">${g.sect.star}星</span>
          <small>${type.label} +${g.value}${type.unit === "%" ? "%" : "%"}</small></div>
          ${on ? `<button class="sm on" disabled>主修中</button>` : `<button class="sm" onclick="G.setGongfa('${g.id}')">主修</button>`}</div>`;
      }).join("") + `</div>`;
    }).join("");
  },
});
