/* =====================================================================
 * 模块：洞府
 * ---------------------------------------------------------------------
 * 房间：聚灵阵、炼丹房、炼器室、画符室、灵药园、灵兽室、洞府阵法、道童居
 * （房间列表在 data/cave.js 的 DATA.caveRooms；炼丹房、炼器室见 craft.js，灵药园见 garden.js）
 *
 * 聚灵阵：
 * - 每 10 秒聚集一次灵气（有进度条），灵气是修炼的“燃料”
 * - 同时给修炼速度加倍率（见 data/cave.js 的 factor）
 * - 聚灵速度只由聚灵阵等级决定，境界提升不会增加
 * - 初始 0 级；开关在“修炼”页，开关只影响修炼加成，不影响聚灵
 * - 可以用灵石手动补充灵气，或开启“灵气不足时自动补充”
 * ===================================================================== */
G.module({
  id: "cave",
  tab: "cave",

  defaults: () => ({
    ling: 50,                                     // 当前灵气
    array: { lv: 0, on: true, autoRefill: false }, // 聚灵阵（初始 0 级）
  }),

  // 每 10 秒聚集灵气
  tick() {
    this.s.ling = Math.min(this.lingCap(), this.s.ling + this.speed().gather);
  },

  api: {
    // 其他房间的页面（炼丹房、炼器室、灵药园在各自模块里登记：G.caveViews.房间id = function）
    caveViews: {},
    arrayFactor() { return DATA.array.factor(this.s.array.lv); },
    // 每 10 秒聚灵量（只由等级决定，开关不影响）
    gatherAmount() { return DATA.array.gather(this.s.array.lv); },
    lingCap() { const sp = this.speed(); return Math.max(100, sp.gather * DATA.LING_CAP_GATHER + sp.total * DATA.LING_CAP_SPEED); },
    lingPerStone() { return DATA.array.STONE_LING; }, // 固定数值

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
    setCaveRoom(id) { this.caveRoom = id; this.render(); },
  },

  view() {
    const s = this.s, a = s.array, cur = this.caveRoom || "array";
    const rooms = `<div class="room-grid">${DATA.caveRooms.map(r =>
      `<button class="${cur === r.id ? "active" : ""}" onclick="G.setCaveRoom('${r.id}')">${r.name}${r.open ? "" : "<small>未开放</small>"}</button>`).join("")}</div>`;

    const room = DATA.caveRooms.find(r => r.id === cur);
    if (this.caveViews[cur]) return rooms + this.caveViews[cur].call(this);
    if (!room.open) return rooms + `<div class="card"><h3>${room.name}</h3><p class="desc">${room.desc}</p><p class="desc">尚在营建，敬请期待。</p></div>`;

    // 聚灵阵
    const cap = this.lingCap(), max = a.lv >= DATA.array.MAX, f = this.arrayFactor();
    return rooms + `<div class="card"><h3>聚灵阵 · ${a.lv} / ${DATA.array.MAX} 级<small>修炼加成${a.on ? "开启" : "关闭"}（修炼页切换）</small></h3>
      <div class="row small"><span>聚灵中（每 10 秒 +${U.num(this.gatherAmount())} 灵气）</span></div>
      <div class="bar tick"><div id="gather-bar"></div></div>
      <div class="row small"><span>灵气</span><span>${U.fmt(s.ling)} / ${U.fmt(cap)}</span></div>
      <div class="bar ling"><div style="width:${Math.min(100, s.ling / cap * 100)}%"></div></div>
      <div class="line"><div>每 10 秒聚灵</div><b>+${U.num(this.gatherAmount())}</b></div>
      <div class="line"><div>修炼速度加成</div><b>+${U.num((f - 1) * 100)}%</b></div>
      <div class="line"><div>下一级<small>加成 +${U.num((DATA.array.factor(a.lv + 1) - 1) * 100)}%，聚灵 +${U.num(DATA.array.gather(a.lv + 1))}</small></div><b>${max ? "满级" : U.fmt(DATA.array.cost(a.lv)) + " 灵石"}</b></div>
      <div class="btns">
        <button class="primary" onclick="G.upgradeArray(1)" ${max ? "disabled" : ""}>升级</button>
        <button onclick="G.upgradeArray(10)" ${max ? "disabled" : ""}>连升10级</button>
        <button onclick="G.upgradeArray(${DATA.array.MAX})" ${max ? "disabled" : ""}>灵石全部升级</button>
      </div></div>
      <div class="card"><h3>补充灵气<small>1 灵石 = ${U.fmt(this.lingPerStone())} 灵气</small></h3>
      <div class="btns"><button onclick="G.buyLing(100)">用 100 灵石</button><button onclick="G.buyLing('fill')">补满</button>
      <button class="${a.autoRefill ? "on" : ""}" style="flex-basis:100%" onclick="G.toggleRefill()">灵气不足时自动用灵石补充：${a.autoRefill ? "开" : "关"}</button></div></div>`;
  },
});
