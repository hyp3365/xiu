/* =====================================================================
 * 模块：洞府 · 聚灵阵
 * ---------------------------------------------------------------------
 * - 聚灵阵每 10 秒聚集灵气（开启时），灵气是修炼的“燃料”
 * - 聚灵阵同时给修炼速度加倍率（见 data/cave.js 的 factor）
 * - 聚灵速度只由聚灵阵等级决定，境界提升不会增加
 * - 可以用灵石手动补充灵气，或开启“灵气不足时自动补充”
 * - 关闭聚灵阵：只剩天地自然灵气（每 10 秒 AMBIENT 点）
 * ===================================================================== */
DATA.AMBIENT = 2;

G.module({
  id: "cave",
  tab: "cave",

  defaults: () => ({
    ling: 50,                                     // 当前灵气
    array: { lv: 1, on: true, autoRefill: false }, // 聚灵阵
  }),

  // 每 10 秒聚集灵气
  tick() {
    this.s.ling = Math.min(this.lingCap(), this.s.ling + this.speed().gather);
  },

  api: {
    arrayFactor() { return DATA.array.factor(this.s.array.lv); },
    gatherAmount() { return DATA.AMBIENT + (this.s.array.on ? DATA.array.GATHER_BASE * this.arrayFactor() : 0); },
    lingCap() { const sp = this.speed(); return sp.gather * DATA.LING_CAP_GATHER + sp.total * DATA.LING_CAP_SPEED; },
    lingPerStone() { return DATA.array.STONE_LING * this.arrayFactor(); },

    // 用灵石补充灵气，stones 为 "fill" 时补满
    buyLing(stones) {
      const cap = this.lingCap(), rate = this.lingPerStone();
      const need = Math.ceil((cap - this.s.ling) / rate);
      if (stones === "fill") stones = need;
      stones = Math.min(stones, need, Math.floor(this.s.stone));
      if (stones <= 0) return this.log(this.s.ling >= cap ? "灵气已满。" : "灵石不足。", "sys");
      this.s.stone -= stones;
      this.s.ling = Math.min(cap, this.s.ling + stones * rate);
      this.log(`消耗 ${U.fmt(stones)} 灵石，补充灵气 ${U.fmt(stones * rate)}。`, "good");
      this.after();
    },
    toggleArray() { this.s.array.on = !this.s.array.on; this.log(`聚灵阵已${this.s.array.on ? "开启" : "关闭"}。`, "sys"); this.after(); },
    toggleRefill() { this.s.array.autoRefill = !this.s.array.autoRefill; this.after(); },

    // 升级聚灵阵，times 为最多升几级
    upgradeArray(times) {
      let n = 0;
      while (n < times && this.s.array.lv < DATA.array.MAX) {
        const c = DATA.array.cost(this.s.array.lv);
        if (this.s.stone < c) break;
        this.s.stone -= c; this.s.array.lv++; n++;
      }
      if (n) this.log(`聚灵阵升至 ${this.s.array.lv} 级。`, "gold");
      else this.log(this.s.array.lv >= DATA.array.MAX ? "聚灵阵已满级。" : "灵石不足。", "sys");
      this.after();
    },
  },

  view() {
    const s = this.s, a = s.array, cap = this.lingCap(), max = a.lv >= DATA.array.MAX;
    return `<div class="card"><h3>聚灵阵 · ${a.lv} / ${DATA.array.MAX} 级<small>${a.on ? "运转中" : "已关闭"}</small></h3>
      <div class="line"><div>修炼速度倍率</div><b>×${this.arrayFactor() >= 100 ? U.fmt(this.arrayFactor()) : this.arrayFactor().toFixed(2)}</b></div>
      <div class="line"><div>每 10 秒聚集灵气<small>含天地自然灵气 ${DATA.AMBIENT}</small></div><b>${U.fmt(this.gatherAmount())}</b></div>
      <div class="row small" style="margin-top:6px"><span>灵气</span><span>${U.fmt(s.ling)} / ${U.fmt(cap)}</span></div>
      <div class="bar ling"><div style="width:${Math.min(100, s.ling / cap * 100)}%"></div></div>
      <div class="btns">
        <button class="${a.on ? "on" : ""}" onclick="G.toggleArray()">${a.on ? "聚灵阵：开" : "聚灵阵：关"}</button>
        <button onclick="G.upgradeArray(1)" ${max ? "disabled" : ""}>${max ? "已满级" : `升级（${U.fmt(DATA.array.cost(a.lv))} 灵石）`}</button>
        <button onclick="G.upgradeArray(10)" ${max ? "disabled" : ""}>连升10级</button>
        <button onclick="G.upgradeArray(${DATA.array.MAX})" ${max ? "disabled" : ""}>灵石全部升级</button>
      </div></div>
      <div class="card"><h3>补充灵气<small>1 灵石 = ${U.fmt(this.lingPerStone())} 灵气</small></h3>
      <div class="btns"><button onclick="G.buyLing(100)">用 100 灵石</button><button onclick="G.buyLing('fill')">补满</button>
      <button class="${a.autoRefill ? "on" : ""}" style="flex-basis:100%" onclick="G.toggleRefill()">灵气不足时自动用灵石补充：${a.autoRefill ? "开" : "关"}</button></div></div>`;
  },
});
