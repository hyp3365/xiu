/* =====================================================================
 * 模块：门派 · 悟道室 · 宗门秘法
 * ---------------------------------------------------------------------
 * 每个门派的悟道室有 7 种秘法：攻击 防御 修炼速度 气血 法力 命中 闪避。
 * 秘法属性 = 门派属性；同星级 12 个门派金木水火土雷各 2 个，所以每种秘法每个属性各 2 部。
 * 用灵石学习 / 升级（自己选学哪种），效果按百分比只加「境界基础属性」（不加装备、功法、丹药），灵根对秘法无效；
 * 学会的秘法离开门派也一直有效（可以在不同门派学不同的秘法，效果叠加）。
 * 数值全部在 js/config/wudao.js。
 * 存档：mifa { "门派id:类型": 等级 }
 * ===================================================================== */
G.module({
  id: "wudao",

  defaults: () => ({ mifa: {} }),

  api: {
    // 秘法名字：门派前缀 + 本门属性词 + 后缀，例如 青阳·离火破军秘法
    mifaName(sect, type) {
      const el = DATA.elById[sect.el], ti = Object.keys(CFG.wudao.types).indexOf(type);
      return `${sect.prefix}·${el.words[(ti * 2 + sect.star) % el.words.length]}${CFG.wudao.types[type].name}`;
    },
    // 一部秘法每级效果 %
    mifaPer(sect, type) { return CFG.wudao.types[type].pct * (CFG.wudao.STAR_PCT[sect.star - 1] || 1); },
    // 升到下一级需要的灵石
    mifaCost(sect, lv) { return Math.floor(CFG.wudao.COST_BASE * Math.pow(CFG.wudao.COST_RATE, lv) * (CFG.wudao.STAR_COST[sect.star - 1] || 1)); },
    // 全部已学秘法的加成合计 { atk: %, def: %, ... }
    wudaoPct() {
      const out = {}, m = this.s.mifa || {};
      for (const key in m) {
        const [sid, type] = key.split(":"), sect = DATA.sectById[sid];
        if (!sect || !CFG.wudao.types[type]) continue;
        out[type] = (out[type] || 0) + this.mifaPer(sect, type) * m[key];
      }
      return out;
    },
    learnMifa(type, times = 1) {
      const s = this.s, sect = this.sectInfo(); if (!sect) return;
      const key = sect.id + ":" + type;
      let k = 0;
      for (; k < times; k++) {
        const lv = s.mifa[key] || 0, c = this.mifaCost(sect, lv);
        if (lv >= CFG.wudao.MAX) { if (!k) this.log("已修至最高等级。", "sys"); break; }
        if (s.stone < c) { if (!k) this.log("灵石不足。", "sys"); break; }
        s.stone -= c; s.mifa[key] = lv + 1;
      }
      if (k) this.log(`《${this.mifaName(sect, type)}》提升至 ${s.mifa[key]} 级。`, "good");
      this.after();
    },
  },
});

/* 门派 · 悟道室页面（sect.js 调用） */
G.sectWudaoView = function () {
  const s = this.s, x = this.sectInfo(), tot = this.wudaoPct(), W = CFG.wudao;
  return `<div class="card"><h3>悟道室 · 宗门秘法<small>${DATA.elById[x.el].name}属性 · 灵石 ${U.fmt(s.stone)}</small></h3>` +
    Object.keys(W.types).map(t => {
      const lv = s.mifa[x.id + ":" + t] || 0, c = this.mifaCost(x, lv), max = lv >= W.MAX, T = W.types[t];
      return `<div class="line"><div>《${this.mifaName(x, t)}》<span class="tag">${lv} / ${W.MAX} 级</span>
        <small>${T.label} +${U.num(this.mifaPer(x, t))}% / 级 · 当前 +${U.num(this.mifaPer(x, t) * lv)}%${max ? "" : ` · 下一级 ${U.fmt(c)} 灵石`}</small></div>
        <div><button class="sm" onclick="G.learnMifa('${t}')" ${max || s.stone < c ? "disabled" : ""}>${lv ? "提升" : "学习"}</button>
        <button class="sm" onclick="G.learnMifa('${t}',10)" ${max || s.stone < c ? "disabled" : ""}>×10</button></div></div>`;
    }).join("") +
    `<p class="desc">秘法按百分比只加境界基础属性（不加装备、功法、丹药），灵根对秘法无效；各门派学的秘法效果叠加，离开门派也一直有效。</p></div>
    <div class="card"><h3>秘法总加成</h3><div class="stats">${Object.keys(W.types).map(t => `<div><span>${W.types[t].label}</span>+${U.num(tot[t] || 0)}%</div>`).join("")}</div></div>`;
};
