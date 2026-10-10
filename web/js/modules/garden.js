/* =====================================================================
 * 模块：灵药园 · 灵田（洞府）
 * ---------------------------------------------------------------------
 * - 用灵石开启灵田，最多 30 块（价格见 numbers.js garden）
 * - 种子在 门派 → 宗门宝库 兑换，每种只需兑换一次（之后永久可种）
 * - 灵田成熟后自动收获（药材进背包），并自动继续种同一种
 * - 灵田管理：更换种植类型（等当前这一季成熟后才换）、铲除（立即清空，本季作废）
 * - 按 G.now() 计时，写在 tick 里，离线也会继续收获
 * 存档：
 *   seeds  [品...]                     已拥有的种子（药材品级 0~8）
 *   fields [{ g: 品|-1, start, next }] 每块灵田；g=-1 空地；next = 成熟后要换种的品级
 * ===================================================================== */
G.module({
  id: "garden",

  defaults: () => ({ seeds: [], fields: [] }),

  tick() {
    const s = this.s, now = this.now();
    s.fields.forEach(f => {
      while (f.g >= 0 && now >= f.start + DATA.growTime(f.g)) {
        f.start += DATA.growTime(f.g);
        const n = DATA.growYield(f.g);
        this.addMat("herb", DATA.herbs[f.g], f.g, n);
        if (f.next !== undefined && f.next !== null) { f.g = f.next; f.next = null; } // 当季结束才换种
      }
    });
  },

  api: {
    openField() {
      const s = this.s, i = s.fields.length, c = DATA.fieldCost(i);
      if (i >= DATA.GARDEN_MAX) return this.log("灵田已达上限。", "sys");
      if (s.stone < c) return this.log("灵石不足。", "sys");
      s.stone -= c; s.fields.push({ g: -1, start: 0, next: null });
      this.log(`开辟第 ${i + 1} 块灵田。`, "good"); this.after();
    },
    // 点灵田：空地直接选种；已种的打开管理
    openFieldMenu(i) {
      const s = this.s, f = s.fields[i];
      if (!s.seeds.length) return this.log("没有种子，可在门派 → 宗门宝库兑换。", "sys");
      const seeds = s.seeds.slice().sort((a, b) => a - b).map(g =>
        `<button onclick="G.plantField(${i},${g})" ${f.g === g && f.next == null ? "disabled" : ""}>${DATA.PIN[g]}${DATA.herbs[g]}<small>${U.dur(DATA.growTime(g) / 1000)} · ${DATA.growYield(g)}株</small></button>`).join("");
      this.modal(`<h2>第 ${i + 1} 块灵田</h2>
        <p>${f.g < 0 ? "空地，选择要种植的灵药：" : `正在种植 ${DATA.PIN[f.g]}${DATA.herbs[f.g]}${f.next != null ? `，本季结束后改种 ${DATA.herbs[f.next]}` : ""}。<br>更换种植类型要等这一季成熟后才生效。`}</p>
        <div class="room-grid">${seeds}</div>
        <div class="btns">${f.g >= 0 ? `<button onclick="G.clearField(${i})">铲除</button>` : ""}<button onclick="G.closeModal()">关闭</button></div>`);
    },
    plantField(i, g) {
      const f = this.s.fields[i];
      if (f.g < 0) { f.g = g; f.start = this.now(); f.next = null; this.log(`第 ${i + 1} 块灵田种下${DATA.herbs[g]}。`, "good"); }
      else { f.next = f.g === g ? null : g; this.log(f.next == null ? "已取消换种。" : `本季结束后改种${DATA.herbs[g]}。`, "sys"); }
      this.closeModal(); this.after();
    },
    clearField(i) {
      if (!confirm("铲除后本季作物作废，确定？")) return;
      Object.assign(this.s.fields[i], { g: -1, start: 0, next: null });
      this.closeModal(); this.after();
    },
  },
});

/* 洞府 · 灵药园 */
G.caveViews.garden = function () {
  const s = this.s, n = s.fields.length, now = Date.now();
  const cells = s.fields.map((f, i) => {
    if (f.g < 0) return `<div class="slot-eq" onclick="G.openFieldMenu(${i})"><b>灵田${i + 1}</b>空地</div>`;
    const T = DATA.growTime(f.g), p = Math.min(100, (now - f.start) / T * 100);
    return `<div class="slot-eq q${Math.min(5, Math.floor(f.g / 2))}" onclick="G.openFieldMenu(${i})"><b>灵田${i + 1}</b>${DATA.herbs[f.g]}
      <br><span class="g">${U.dur(Math.max(0, f.start + T - now) / 1000 + 59)}</span>${f.next != null ? `<br><span class="g">→${DATA.herbs[f.next]}</span>` : ""}
      <div class="bar"><div style="width:${p}%"></div></div></div>`;
  }).join("");
  const full = n >= DATA.GARDEN_MAX, c = DATA.fieldCost(n);
  return `<div class="card"><h3>灵药园<small>灵田 ${n} / ${DATA.GARDEN_MAX} · 种子 ${s.seeds.length} 种</small></h3>
    ${n ? `<div class="equip four">${cells}</div>` : `<p class="desc">还没有灵田。</p>`}
    <div class="btns"><button class="primary" onclick="G.openField()" ${full || s.stone < c ? "disabled" : ""}>${full ? "灵田已满" : `开辟灵田（${U.fmt(c)} 灵石）`}</button></div>
    <p class="desc">成熟自动收获进背包，并自动继续种植。点灵田可种植、换种、铲除。种子在门派宗门宝库兑换，每种只需一次。</p></div>`;
};
