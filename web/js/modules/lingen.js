/* =====================================================================
 * 模块：灵根（金 木 水 火 土 雷 六种）
 * ---------------------------------------------------------------------
 * 每种灵根可单独升级（消耗灵石），最高 CFG.lingen.MAX 级：
 *   - 对应属性的法术伤害：每级 +SPELL_PCT %
 *   - 对应属性的功法效果：每级 +GONGFA_PCT %
 * 门派功法、法术的属性 = 门派属性（见 data/sects.js）。
 * 数值在 js/config/numbers.js 的 lingen 部分。
 * 存档字段：lingen: { jin: 0, mu: 0, shui: 0, huo: 0, tu: 0, lei: 0 }
 * ===================================================================== */
G.module({
  id: "lingen",
  tab: "lingen",

  defaults: () => ({ lingen: { jin: 0, mu: 0, shui: 0, huo: 0, tu: 0, lei: 0 } }),

  api: {
    lingenCost(lv) { const C = CFG.lingen; return Math.floor(C.COST_BASE * Math.pow(C.COST_RATE, lv)); },
    // 加成倍率（1 = 无加成）
    lingenSpell(el) { return 1 + ((this.s.lingen || {})[el] || 0) * CFG.lingen.SPELL_PCT / 100; },
    lingenGongfa(el) { return 1 + ((this.s.lingen || {})[el] || 0) * CFG.lingen.GONGFA_PCT / 100; },
    // 升级 el 灵根，最多 times 级
    upgradeLingen(el, times) {
      const s = this.s; let n = 0;
      while (n < times && s.lingen[el] < CFG.lingen.MAX) {
        const c = this.lingenCost(s.lingen[el]);
        if (s.stone < c) break;
        s.stone -= c; s.lingen[el]++; n++;
      }
      if (!n) return this.log(s.lingen[el] >= CFG.lingen.MAX ? "此灵根已达极限。" : "灵石不足。", "sys");
      this.log(`${DATA.elById[el].name}灵根提升至 ${s.lingen[el]} 级。`, "good");
      this.dirty(); this.after();
    },
  },

  view() {
    const s = this.s, C = CFG.lingen;
    return `<div class="card"><h3>灵根<small>灵石 ${U.fmt(s.stone)}</small></h3>
      <p class="desc">每升一级：对应属性法术伤害 +${C.SPELL_PCT}%，对应属性功法效果 +${C.GONGFA_PCT}%。最高 ${C.MAX} 级。</p></div>` +
      DATA.elements.map(e => {
        const lv = s.lingen[e.id] || 0, max = lv >= C.MAX, c = this.lingenCost(lv);
        return `<div class="card"><div class="line"><div><b>${e.name}灵根</b><span class="tag">${lv} / ${C.MAX} 级</span>
          <small>${e.name}系法术伤害 +${lv * C.SPELL_PCT}% · ${e.name}系功法效果 +${lv * C.GONGFA_PCT}%</small></div></div>
          <div class="btns">${max ? `<button disabled>已达极限</button>` :
            `<button onclick="G.upgradeLingen('${e.id}',1)" ${s.stone < c ? "disabled" : ""}>升级（${U.fmt(c)} 灵石）</button>
             <button onclick="G.upgradeLingen('${e.id}',10)" ${s.stone < c ? "disabled" : ""}>升 10 级</button>`}</div></div>`;
      }).join("");
  },
});
