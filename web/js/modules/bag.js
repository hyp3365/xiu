/* =====================================================================
 * 模块：背包（上：装备 & 法宝  下：储物格子，可扩充）
 * ---------------------------------------------------------------------
 * 背包物品格式：
 *   丹药 { t: "pill", type: "juqi", g: 境界品质, n: 数量 }   同种同品质自动堆叠
 *   装备 { t: "eq", e: { slot, g, q, name } }                每件占一格
 * ===================================================================== */
G.module({
  id: "bag",
  tab: "bag",

  defaults: () => ({
    stone: 100,                                               // 灵石
    bag: [{ t: "pill", type: "juqi", g: 0, n: 3 }],          // 开局送 3 枚聚气丹
    bagCap: DATA.BAG_START,
    bagExp: 0,                                                // 已扩充次数
    equip: { weapon: null, armor: null, acc: null, fabao: null },
  }),

  api: {
    /* ---------- 装备属性 ---------- */
    equipStats(e) {
      const Le = e.g * 10 + 5, f = Math.pow(DATA.GROW, Le), m = DATA.qualMult[e.q], k = e.q + 1, B = DATA.playerBase;
      switch (e.slot) {
        case "weapon": return { atk: B.atk * f * m * 3, crit: k };
        case "armor":  return { hp: B.hp * f * m * 3, def: B.def * f * m * 3 };
        case "acc":    return { ssPct: 5 * k, speed: 2 * k };
        case "fabao":  return { dodge: k, crit: k, hpPct: 5 * k };
      }
    },
    equipDesc(e) {
      const n = { atk: "攻击", hp: "气血", def: "防御", crit: "暴击%", dodge: "闪避%", speed: "速度", ssPct: "神识%", hpPct: "气血%" };
      const st = this.equipStats(e);
      return Object.keys(st).map(k => `${n[k]}+${U.fmt(st[k])}`).join(" ");
    },
    makeEquip(slot, g, q) { return { slot, g, q, name: DATA.equipNames[slot][Math.min(5, q)] }; },

    /* ---------- 存取物品 ---------- */
    bagFull() { return this.s.bag.length >= this.s.bagCap; },
    addPill(type, g, n = 1) {
      const it = this.s.bag.find(x => x.t === "pill" && x.type === type && x.g === g);
      if (it) { it.n += n; return true; }
      if (this.bagFull()) { this.log("背包已满，物品遗失了。", "bad"); return false; }
      this.s.bag.push({ t: "pill", type, g, n }); return true;
    },
    addEquip(e) {
      if (this.bagFull()) { this.log("背包已满，装备遗失了。", "bad"); return false; }
      this.s.bag.push({ t: "eq", e }); return true;
    },
    removeAt(i, n = 1) {
      const it = this.s.bag[i];
      if (it.t === "pill" && it.n > n) it.n -= n; else this.s.bag.splice(i, 1);
    },
    itemName(it) {
      return it.t === "pill" ? `${DATA.realms[it.g]}·${DATA.pills[it.type].name}` : `${DATA.realms[it.e.g]}·${it.e.name}`;
    },
    sellPrice(it) {
      return it.t === "pill" ? Math.floor(DATA.pillPrice(it.type, it.g) * 0.3)
        : Math.floor(150 * Math.pow(DATA.STONE_GROW, it.e.g * 10) * (it.e.q + 1));
    },

    expandBag() {
      const cost = DATA.bagExpandCost(this.s.bagExp);
      if (this.s.bagCap >= DATA.BAG_MAX) return;
      if (this.s.stone < cost) return this.log("灵石不足。", "sys");
      this.s.stone -= cost; this.s.bagCap += DATA.BAG_STEP; this.s.bagExp++;
      this.log(`背包扩充至 ${this.s.bagCap} 格。`, "good"); this.after();
    },

    /* ---------- 弹窗：点格子 ---------- */
    openItem(i) {
      const it = this.s.bag[i]; if (!it) return;
      let h = `<h2 class="q${it.t === "eq" ? it.e.q : 0}">${it.t === "eq" ? DATA.quals[it.e.q] + " " : ""}${this.itemName(it)}${it.t === "pill" ? " ×" + it.n : ""}</h2>`;
      if (it.t === "pill") {
        const ok = this.canUsePill(it.g);
        h += `<p>修炼速度 +${Math.round(DATA.pillPct(it.type, it.g))}%，持续 ${DATA.pills[it.type].dur} 次修炼。<br>${DATA.realms[it.g]}期品质：${DATA.realms[it.g]}期及以下可服用。
          ${ok ? "" : "<br><span class='q5'>你的境界已超过此丹品质，无法服用。</span>"}</p>
          <div class="btns"><button class="primary" onclick="G.usePill(${i});G.closeModal()" ${ok ? "" : "disabled"}>服用</button>
          <button onclick="G.sellItem(${i},1)">出售1个（${U.fmt(this.sellPrice(it))}）</button>
          <button onclick="G.sellItem(${i},${it.n})">全部出售</button></div>`;
      } else {
        h += `<p>${DATA.slots[it.e.slot]} · ${this.equipDesc(it.e)}</p>
          <div class="btns"><button class="primary" onclick="G.equipItem(${i})">装备</button>
          <button onclick="G.sellItem(${i},1)">出售（${U.fmt(this.sellPrice(it))}）</button></div>`;
      }
      this.modal(h + `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    openEquip(sl) {
      const e = this.s.equip[sl]; if (!e) return;
      this.modal(`<h2 class="q${e.q}">${DATA.quals[e.q]} ${DATA.realms[e.g]}·${e.name}</h2><p>${DATA.slots[sl]} · ${this.equipDesc(e)}</p>
        <div class="btns"><button onclick="G.unequip('${sl}')">卸下</button><button onclick="G.closeModal()">关闭</button></div>`);
    },
    equipItem(i) {
      const it = this.s.bag[i], sl = it.e.slot, old = this.s.equip[sl];
      this.s.bag.splice(i, 1); this.s.equip[sl] = it.e;
      if (old) this.s.bag.push({ t: "eq", e: old });
      this.log(`装备了${DATA.quals[it.e.q]}${it.e.name}。`, "good"); this.closeModal(); this.after();
    },
    unequip(sl) {
      if (this.bagFull()) return this.log("背包已满。", "sys");
      this.s.bag.push({ t: "eq", e: this.s.equip[sl] }); this.s.equip[sl] = null; this.closeModal(); this.after();
    },
    sellItem(i, n) {
      const it = this.s.bag[i], p = this.sellPrice(it) * n;
      this.s.stone += p; this.removeAt(i, n);
      this.log(`售出${this.itemName(it)} ×${n}，灵石 +${U.fmt(p)}。`, "sys"); this.closeModal(); this.after();
    },
  },

  view() {
    const s = this.s;
    const eq = Object.keys(DATA.slots).map(sl => {
      const e = s.equip[sl];
      return `<div class="slot-eq ${e ? "q" + e.q : ""}" onclick="G.openEquip('${sl}')"><b>${DATA.slots[sl]}</b>
        ${e ? `${DATA.quals[e.q]}<br>${e.name}<br><span class="g">${DATA.realms[e.g]}</span>` : "空"}</div>`;
    }).join("");
    let cells = "";
    for (let i = 0; i < s.bagCap; i++) {
      const it = s.bag[i];
      if (!it) cells += `<div class="cell"></div>`;
      else if (it.t === "pill") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 3))}" onclick="G.openItem(${i})">${DATA.pills[it.type].name}<span class="g">${DATA.realms[it.g]}</span><span class="n">${it.n}</span></div>`;
      else cells += `<div class="cell q${it.e.q}" onclick="G.openItem(${i})">${it.e.name}<span class="g">${DATA.realms[it.e.g]}</span></div>`;
    }
    return `<div class="card"><h3>装备 · 法宝</h3><div class="equip">${eq}</div></div>
      <div class="card"><h3>储物格<small>${s.bag.length} / ${s.bagCap}</small></h3><div class="grid">${cells}</div>
      <div class="btns"><button onclick="G.expandBag()" ${s.bagCap >= DATA.BAG_MAX ? "disabled" : ""}>扩充 ${DATA.BAG_STEP} 格（${U.fmt(DATA.bagExpandCost(s.bagExp))} 灵石）</button></div></div>`;
  },
});
