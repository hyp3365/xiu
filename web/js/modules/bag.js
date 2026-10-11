/* =====================================================================
 * 模块：背包
 * ---------------------------------------------------------------------
 * 上方三个分页：
 *   装备：头盔 护甲 武器 腿甲 靴 吊坠 + 6 个戒指
 *   法宝：每个大境界开启 1 格，最多 12 格
 *   法术：每个大境界开启 1 格，最多 12 格（放入的法术在战斗中轮流施放）
 * 下方：储物格（扩充以后另做）。
 * 背包物品格式：
 *   丹药 { t: "pill", type: "juqi", g: 境界品质, n: 数量 }        同种同品质堆叠
 *   装备 { t: "eq", e: { slot, g, q, name } }                     每件占一格（法宝 slot = "fabao"）
 *   材料 { t: "mat", kind: "herb"|"ore", name, g, n }  药材、矿石，同名堆叠（g = 序号）
 *   属性丹 { t: "dan", type: "atk", g: 阶, n }                    见 craft.js
 *   炉子 { t: "fu", kind: "dan"|"qi", g: 阶, n }   点「使用」装进洞府
 *   图纸 { t: "bp", kind: "dan"|"qi", g: 阶 }      点「学习」后才能在炼器室炼制
 * ===================================================================== */
G.module({
  id: "bag",
  tab: "bag",

  defaults: () => ({
    stone: CFG.start.stone,                                   // 开局灵石（config/start.js）
    bag: CFG.start.pills.map(([type, g, n]) => ({ t: "pill", type, g, n })), // 开局丹药
    bagCap: DATA.BAG_START,
    equip: Object.fromEntries(DATA.equipSlots.map(k => [k, null])), // 装备栏
    fabao: [],                                                // 法宝栏
    spellSlots: [],                                           // 法术栏（法术 id）
  }),

  api: {
    // 旧存档：武器/护甲/饰品/法宝 四格 → 新装备栏
    fixEquip() {
      const s = this.s, old = s.equip || {};
      if (!("helmet" in old)) {
        s.equip = Object.fromEntries(DATA.equipSlots.map(k => [k, null]));
        if (old.weapon) s.equip.weapon = old.weapon;
        if (old.armor) s.equip.armor = old.armor;
        if (old.acc) s.equip.pendant = Object.assign(old.acc, { slot: "pendant", name: DATA.equipNames.pendant[old.acc.q] });
        if (old.fabao) s.fabao.push(old.fabao);
      }
      s.bagCap = Math.max(s.bagCap, DATA.BAG_START);
      // v10：内丹、灵血已删除；旧存档里的清掉
      s.bag = s.bag.filter(it => !(it.t === "mat" && (it.kind === "core" || it.kind === "blood")));
      if (s.explore && s.explore.loot) for (const k in s.explore.loot.mats) if (!/^(herb|ore)\|/.test(k)) delete s.explore.loot.mats[k];
      if (s.explore && !s.trained.includes(s.explore.map)) s.trained.push(s.explore.map); // 旧存档在探索的地图算已历练
      // v12：药材、矿石只剩 6 种，删掉的折算成灵石（按原出售价）
      const OLD = { 天魔花: 1020, 九幽莲: 1837, 渡劫花: 3306, 魔晶: 1020, 九幽玄铁: 1837, 天雷石: 3306 };
      let refund = 0;
      s.bag = s.bag.filter(it => {
        if (it.t !== "mat") return true;
        const names = it.kind === "herb" ? DATA.herbs : DATA.ores, g = names.indexOf(it.name);
        if (g >= 0) { it.g = g; return true; }
        refund += (OLD[it.name] || 100) * it.n; return false;
      });
      if (refund) { s.stone += refund; this.log(`药材、矿石改为 6 种，已下架的材料折算灵石 +${U.fmt(refund)}。`, "sys"); }
      if (s.explore && s.explore.loot) for (const k in s.explore.loot.mats) { const m = s.explore.loot.mats[k]; if ((m.kind === "herb" ? DATA.herbs : DATA.ores).indexOf(m.name) < 0) delete s.explore.loot.mats[k]; }
      const hmax = DATA.herbs.length - 1;
      if (s.seeds) s.seeds = s.seeds.filter(g => g <= hmax);
      if (s.fields) s.fields.forEach(f => { if (f.g > hmax) f.g = hmax; if (f.next != null && f.next > hmax) f.next = null; });
      s.bag.forEach(it => { if (it.t === "eq" && it.e.slot === "acc") { it.e.slot = "pendant"; it.e.name = DATA.equipNames.pendant[it.e.q]; } });
    },
    // 法宝栏、法术栏当前开启格数：每个大境界 1 格
    // 背包排序：先按类型（修炼丹 → 属性丹 → 药材 → 矿石 → 装备），同类型再按品阶从低到高
    sortBag() {
      const order = it => it.t === "pill" ? 0 : it.t === "dan" ? 1 : it.t === "mat" ? (it.kind === "herb" ? 2 : 3) : it.t === "fu" ? 4 : it.t === "bp" ? 5 : it.t === "eq" ? (it.e.slot === "fabao" ? 7 : 6) : 9;
      const grade = it => it.t === "eq" ? it.e.g * 10 + it.e.q : it.g || 0;
      const sub = it => it.t === "pill" || it.t === "dan" ? it.type : it.t === "eq" ? it.e.slot : it.kind || "";
      this.s.bag.sort((a, b) => order(a) - order(b) || grade(a) - grade(b) || (sub(a) < sub(b) ? -1 : sub(a) > sub(b) ? 1 : 0));
    },
    slotCount() { return Math.min(DATA.SLOT_MAX, this.r() + 1); },

    /* ---------- 装备属性 ---------- */
    equipStats(e) {
      const Le = e.g * 10 + CFG.equip.LAYER_OFFSET, f = Math.pow(DATA.GROW, Le), m = DATA.qualMult[e.q], k = e.q + 1, B = DATA.playerBase;
      const K = DATA.equipK[e.slot] || {}, out = {};
      for (const key in K) {
        if (key in B) out[key] = B[key] * f * m * K[key];               // 攻击/气血/防御/法力：随境界成长
        else if (key === "hit" || key === "dodge") out[key] = K[key] * k * (e.g + 1); // 命中/闪避：随品质和境界
        else out[key] = K[key] * k;                                      // 百分比、速度：随品质
      }
      return out;
    },
    equipDesc(e) {
      const n = { atk: "攻击", hp: "气血", def: "防御", mana: "法力", crit: "暴击%", hit: "命中", dodge: "闪避", speed: "速度", hpPct: "气血%" };
      const st = this.equipStats(e);
      return Object.keys(st).map(k => `${n[k]}+${U.num(st[k])}`).join(" ");
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
    addMat(kind, name, g, n = 1) {
      const it = this.s.bag.find(x => x.t === "mat" && x.name === name && x.g === g);
      if (it) { it.n += n; return true; }
      if (this.bagFull()) { if (!this.silent) this.log("背包已满，材料遗失了。", "bad"); return false; }
      this.s.bag.push({ t: "mat", kind, name, g, n }); return true;
    },
    addEquip(e) {
      if (this.bagFull()) { this.log("背包已满，装备遗失了。", "bad"); return false; }
      this.s.bag.push({ t: "eq", e }); return true;
    },
    removeAt(i, n = 1) {
      const it = this.s.bag[i];
      if (it.n > n) it.n -= n; else this.s.bag.splice(i, 1);
    },
    itemName(it) {
      if (it.t === "pill") return `${DATA.realms[it.g]}·${DATA.pills[it.type].name}`;
      if (it.t === "dan") return DATA.danName(it.type, it.g);
      if (it.t === "mat") return DATA.matFull(it.kind, it.g);
      if (it.t === "fu") return DATA.furnaceName(it.kind, it.g);
      if (it.t === "bp") return DATA.furnaceName(it.kind, it.g) + "图纸";
      return `${DATA.realms[it.e.g]}·${it.e.name}`;
    },
    sellPrice(it) {
      if (it.t === "pill") return Math.floor(DATA.pillPrice(it.type, it.g) * CFG.price.PILL_SELL);
      if (it.t === "dan") return DATA.danPrice(it.type, it.g);
      if (it.t === "mat") return DATA.matPrice(it.kind, it.g);
      if (it.t === "fu" || it.t === "bp") return Math.floor(DATA.blueprintCost(it.kind, it.g) * (it.t === "fu" ? 2 : 1));
      return Math.floor(CFG.price.EQUIP_SELL * Math.pow(DATA.STONE_GROW, it.e.g * 10) * (it.e.q + 1));
    },

    setBagTab(t) { this.bagTab = t; this.render(); },

    /* ---------- 弹窗：点储物格 ---------- */
    openItem(i) {
      const it = this.s.bag[i]; if (!it) return;
      const sell = it.n > 1
        ? `<button onclick="G.sellItem(${i},1)">出售1个（${U.fmt(this.sellPrice(it))}）</button><button onclick="G.sellItem(${i},${it.n})">全部出售</button>`
        : `<button onclick="G.sellItem(${i},1)">出售（${U.fmt(this.sellPrice(it))}）</button>`;
      let h = `<h2 class="q${it.t === "eq" ? it.e.q : 0}">${it.t === "eq" ? DATA.quals[it.e.q] + " " : ""}${this.itemName(it)}${it.n ? " ×" + it.n : ""}</h2>`;
      if (it.t === "pill") {
        const ok = this.canUsePill(it.g);
        h += `<p>修炼速度 +${Math.round(DATA.pillPct(it.type, it.g))}%，持续 ${DATA.pills[it.type].dur} 次修炼。<br>只有${DATA.realms[it.g]}期可服用。
          ${ok ? "" : "<br><span class='q5'>与你当前境界不符，无法服用。</span>"}</p>
          <div class="btns"><button class="primary" onclick="G.usePill(${i});G.closeModal()" ${ok ? "" : "disabled"}>服用</button>${sell}</div>`;
      } else if (it.t === "dan") {
        const left = this.danLeft(it.type, it.g), d = DATA.dans[it.type];
        h += `<p>服用后永久 ${d.label} +${U.num(DATA.danVal(it.type, it.g))}。<br>此阶已服 ${d.limit - left} / ${d.limit} 枚。</p>
          <div class="btns"><button class="primary" onclick="G.eatDan(${i},1)" ${left > 0 ? "" : "disabled"}>服用</button>
          <button onclick="G.eatDan(${i},${it.n})" ${left > 0 && it.n > 1 ? "" : "disabled"}>全部服用</button>${sell}</div>`;
      } else if (it.t === "fu") {
        const own = this.s.furnaces[it.kind].includes(it.g);
        h += `<p>${it.kind === "dan" ? "炼丹" : "炼器"}时间 -${DATA.furnaceBonus(it.kind, it.g)}%${it.kind === "dan" ? `，可炼一阶~${DATA.JIE[it.g]}丹` : ""}。<br>使用后装进洞府${it.kind === "dan" ? "炼丹房" : "炼器室"}，可随时更换。${own ? "<br><span class='q5'>洞府里已有同阶炉子。</span>" : ""}</p>
          <div class="btns"><button class="primary" onclick="G.installFurnace(${i})" ${own ? "disabled" : ""}>使用</button>${sell}</div>`;
      } else if (it.t === "bp") {
        const has = this.s.blueprints[it.kind].includes(it.g);
        h += `<p>学习后可在洞府炼器室炼制${DATA.furnaceName(it.kind, it.g)}。<br>材料：${this.matsText(DATA.furnaceMats(it.kind, it.g))}${has ? "<br><span class='q5'>已学会。</span>" : ""}</p>
          <div class="btns"><button class="primary" onclick="G.learnBlueprint(${i})" ${has ? "disabled" : ""}>学习</button>${sell}</div>`;
      } else if (it.t === "mat") {
        h += `<p>${{ herb: "药材，可用于炼丹。", ore: "矿石，可用于炼制炉子、日后炼器。" }[it.kind] || ""}</p><div class="btns">${sell}</div>`;
      } else {
        h += `<p>${DATA.slots[it.e.slot]} · ${this.equipDesc(it.e)}</p>
          <div class="btns"><button class="primary" onclick="G.equipItem(${i})">${it.e.slot === "fabao" ? "放入法宝栏" : "装备"}</button>${sell}</div>`;
      }
      this.modal(h + `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    // 点装备栏 / 法宝栏
    openEquip(key) {
      const e = key.startsWith("fb") ? this.s.fabao[+key.slice(2)] : this.s.equip[key]; if (!e) return;
      this.modal(`<h2 class="q${e.q}">${DATA.quals[e.q]} ${DATA.realms[e.g]}·${e.name}</h2><p>${DATA.slots[e.slot]} · ${this.equipDesc(e)}</p>
        <div class="btns"><button onclick="G.unequip('${key}')">卸下</button><button onclick="G.closeModal()">关闭</button></div>`);
    },
    equipItem(i) {
      const s = this.s, it = s.bag[i], e = it.e;
      if (e.slot === "fabao") {
        if (s.fabao.length >= this.slotCount()) return this.log("法宝栏已满（每个大境界开启一格）。", "sys");
        s.bag.splice(i, 1); s.fabao.push(e);
      } else {
        // 戒指放第一个空戒指位，都满了替换第一个
        const key = e.slot === "ring" ? (DATA.equipSlots.find(k => k.startsWith("ring") && !s.equip[k]) || "ring0") : e.slot;
        const old = s.equip[key];
        s.bag.splice(i, 1); s.equip[key] = e;
        if (old) s.bag.push({ t: "eq", e: old });
      }
      this.log(`装备了${DATA.quals[e.q]}${e.name}。`, "good"); this.closeModal(); this.after();
    },
    unequip(key) {
      if (this.bagFull()) return this.log("背包已满。", "sys");
      if (key.startsWith("fb")) this.s.bag.push({ t: "eq", e: this.s.fabao.splice(+key.slice(2), 1)[0] });
      else { this.s.bag.push({ t: "eq", e: this.s.equip[key] }); this.s.equip[key] = null; }
      this.closeModal(); this.after();
    },
    sellItem(i, n) {
      const it = this.s.bag[i], p = this.sellPrice(it) * n;
      this.s.stone += p; this.removeAt(i, n);
      this.log(`售出${this.itemName(it)} ×${n}，灵石 +${U.fmt(p)}。`, "sys"); this.closeModal(); this.after();
    },

    /* ---------- 法术栏 ---------- */
    autoSlotSpell(id) { if (this.s.spellSlots.length < this.slotCount() && !this.s.spellSlots.includes(id)) this.s.spellSlots.push(id); },
    openSpellPick() {
      const s = this.s, list = Object.keys(s.gongfa).filter(id => DATA.isSpell(id) && !s.spellSlots.includes(id));
      if (!list.length) return this.log("没有可放入的法术，请先去门派功法殿学习。", "sys");
      this.modal(`<h2>放入法术</h2>` + list.map(id => { const g = DATA.spellInfo(id, s.gongfa[id]);
        return `<div class="line"><div>《${g.name}》<span class="tag">${g.tier.name}</span><small>攻击×${g.pct}% + ${U.fmt(g.flat)} · 耗法力 ${U.fmt(g.mana)}</small></div>
          <button class="sm" onclick="G.slotSpell('${id}')">放入</button></div>`; }).join("") + `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    slotSpell(id) { if (this.s.spellSlots.length < this.slotCount()) this.s.spellSlots.push(id); this.closeModal(); this.after(); },
    unslotSpell(i) { this.s.spellSlots.splice(i, 1); this.closeModal(); this.after(); },
    // 点法术栏：显示详细，可卸下
    openSpellSlot(i) {
      const id = this.s.spellSlots[i], g = id && DATA.spellInfo(id, this.s.gongfa[id]); if (!g) return;
      this.modal(`<h2 class="q${g.tier.idx + 1}">《${g.name}》</h2><p>${g.el.name}系 · ${g.tier.name} · ${g.lv} 层<br>伤害 = 攻击 × ${g.pct}% + ${U.fmt(g.flat)}<br>耗法力 ${U.fmt(g.mana)}</p>
        <div class="btns"><button onclick="G.unslotSpell(${i})">卸下</button><button onclick="G.closeModal()">关闭</button></div>`);
    },
  },

  view() {
    const s = this.s, tab = this.bagTab || "eq", n = this.slotCount();
    const tabs = `<div class="sub-tabs">${[["eq", "装备"], ["fb", "法宝"], ["sp", "法术"]].map(([k, t]) =>
      `<button class="${tab === k ? "active" : ""}" onclick="G.setBagTab('${k}')">${t}</button>`).join("")}</div>`;
    const cell = (key, label, e) => `<div class="slot-eq ${e ? "q" + e.q : ""}" onclick="G.openEquip('${key}')"><b>${label}</b>
        ${e ? e.name : "空"}</div>`; // 只显示名字，点击看详细

    let top;
    if (tab === "eq") {
      top = `<div class="card"><h3>装备</h3><div class="equip four">${DATA.equipSlots.map(k => cell(k, DATA.slots[DATA.slotOf(k)], s.equip[k])).join("")}</div></div>`;
    } else if (tab === "fb") {
      let h = "";
      for (let i = 0; i < DATA.SLOT_MAX; i++) h += i < n ? cell("fb" + i, "法宝", s.fabao[i]) : `<div class="slot-eq lock"><b>法宝</b>${DATA.realms[i]}期开启</div>`;
      top = `<div class="card"><h3>法宝<small>已开启 ${n} / ${DATA.SLOT_MAX} 格</small></h3><div class="equip four">${h}</div></div>`;
    } else {
      let h = "";
      for (let i = 0; i < DATA.SLOT_MAX; i++) {
        const id = s.spellSlots[i];
        if (i >= n) h += `<div class="slot-eq lock"><b>法术</b>${DATA.realms[i]}期开启</div>`;
        else if (id) { const g = DATA.spellInfo(id, s.gongfa[id]); h += `<div class="slot-eq q${g.tier.idx + 1}" onclick="G.openSpellSlot(${i})"><b>法术</b>${g.name}</div>`; }
        else h += `<div class="slot-eq" onclick="G.openSpellPick()"><b>法术</b>空</div>`;
      }
      top = `<div class="card"><h3>法术<small>已开启 ${n} / ${DATA.SLOT_MAX} 格 · 点法术看详细</small></h3><div class="equip four">${h}</div>
        <p class="desc">战斗中按顺序轮流施放，法力不足时普通攻击。</p></div>`;
    }

    this.sortBag();
    let cells = "";
    for (let i = 0; i < s.bagCap; i++) {
      const it = s.bag[i];
      if (!it) cells += `<div class="cell"></div>`;
      // 格子里只显示名字和类型，点击才看品质、境界、效果
      else if (it.t === "pill") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 3))}" onclick="G.openItem(${i})">${DATA.pills[it.type].name}<span class="g">修炼丹</span><span class="n">${it.n}</span></div>`;
      else if (it.t === "dan") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})">${DATA.dans[it.type].name}<span class="g">属性丹</span><span class="n">${it.n}</span></div>`;
      else if (it.t === "mat") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})">${it.name}<span class="g">${DATA.matKinds[it.kind]}</span><span class="n">${U.fmt(it.n)}</span></div>`;
      else if (it.t === "fu") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})">${DATA.furnaceName(it.kind, it.g)}<span class="g">炉子</span>${it.n > 1 ? `<span class="n">${it.n}</span>` : ""}</div>`;
      else if (it.t === "bp") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})">${DATA.furnaceName(it.kind, it.g)}<span class="g">图纸</span></div>`;
      else cells += `<div class="cell q${it.e.q}" onclick="G.openItem(${i})">${it.e.name}<span class="g">${DATA.slots[it.e.slot]}</span></div>`;
    }
    return tabs + top + `<div class="card"><h3>储物格<small>${s.bag.length} / ${s.bagCap}</small></h3><div class="grid">${cells}</div></div>`;
  },
});
