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
      this.fixRealmV2();
      const s = this.s, old = s.equip || {};
      if (!("helmet" in old)) {
        s.equip = Object.fromEntries(DATA.equipSlots.map(k => [k, null]));
        if (old.weapon) s.equip.weapon = old.weapon;
        if (old.armor) s.equip.armor = old.armor;
        if (old.acc) s.equip.pendant = Object.assign(old.acc, { slot: "pendant", name: DATA.equipNames.pendant[old.acc.q] });
        if (old.fabao) s.fabao.push(old.fabao);
      }
      s.bagCap = Math.max(s.bagCap, DATA.BAG_START);
      // 法宝 36 种：旧法宝按属性归类
      s.bag.forEach(it => it.t === "eq" && DATA.fixFabao(it.e)); (s.fabao || []).forEach(DATA.fixFabao);
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
      const order = it => it.t === "pill" ? 0 : it.t === "dan" ? 1 : it.t === "mat" ? (it.kind === "herb" ? 2 : 3) : it.t === "fu" ? 4 : it.t === "bp" || it.t === "ss" || it.t === "rbp" || it.t === "hx" || it.t === "sm" ? 5 : it.t === "eq" ? (it.e.slot === "fabao" ? 7 : 6) : it.t === "cu" ? 8 : 9;
      const grade = it => it.t === "eq" ? it.e.g * 10 + it.e.q : it.g || 0;
      const sub = it => it.t === "pill" || it.t === "dan" ? it.type : it.t === "eq" ? it.e.slot : it.kind || "";
      this.s.bag.sort((a, b) => order(a) - order(b) || grade(a) - grade(b) || (sub(a) < sub(b) ? -1 : sub(a) > sub(b) ? 1 : 0));
    },
    slotCount() { return Math.min(DATA.SLOT_MAX, this.r() + 1); },

    /* ---------- 装备属性 ---------- */
    equipStats(e) {
      if (e.attrs && e.slot === "fabao") return {};   // v25 炼制法宝：不加属性，战斗中祭出造成属性伤害（world.js battle）
      if (e.attrs) { const out = {}; for (const a of e.attrs) out[a.k] = (out[a.k] || 0) + DATA.attrVal(a, e.g, e); return out; } // 炼制装备 / 戒指（data/forge.js）
      if (e.cid) { const d = this.cuDef(e.cid); return d ? this.cuStats(d) : {}; } // 自定义装备/法宝：属性见 content/items.js
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
      if (e.attrs) {
        let head = "";
        if (e.slot === "fabao") { const f = DATA.fabaoInfo(e); head = `${DATA.elById[e.el].name}属性法宝 · 每次祭出消耗法力 ${U.fmt(f.mana)}<br>`; }
        return head + e.attrs.map(a => `<span class="ac${a.c}">${DATA.attrText(a, e)}</span>`).join("<br>");
      }
      const st = this.equipStats(e);
      if (e.cid) { const d = this.cuDef(e.cid); return (d && d.desc ? d.desc + "<br>" : "") + this.cuStatText(st); }
      return Object.keys(st).map(k => `${n[k]}+${U.num(st[k])}`).join(" ");
    },
    eqQual(e) { return e.attrs ? "" : (DATA.quals[e.q] || "") + " "; },   // 炼制装备没有「凡品」等品质名，按属性颜色区分
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
      if (it.t === "cu") return it.name;
      if (it.t === "ss") return DATA.stoneName(it.g);
      if (it.t === "hx") return "火髓";
      if (it.t === "sm") return DATA.smName(it.k, it.ft);
      if (it.t === "rbp") return DATA.ringBpName(it.g, it.r);
      if (it.e.cid) return it.e.name;
      if (it.e.attrs && it.e.slot === "fabao") return `${DATA.JIE[it.e.g]}·${DATA.elById[it.e.el].name}·${it.e.name}${it.e.enh ? ` +${it.e.enh}` : ""}`;
      if (it.e.attrs) return `${DATA.JIE[it.e.g]}·${it.e.name}`;
      return `${DATA.realms[it.e.g]}·${it.e.name}`;
    },
    sellPrice(it) {
      if (it.t === "pill") return Math.floor(DATA.pillPrice(it.type, it.g) * CFG.price.PILL_SELL);
      if (it.t === "dan") return DATA.danPrice(it.type, it.g);
      if (it.t === "mat") return DATA.matPrice(it.kind, it.g);
      if (it.t === "cu") { const d = this.cuDef(it.name); return d ? d.sell || 0 : 0; }
      if (it.t === "eq" && it.e.cid) { const d = this.cuDef(it.e.cid); if (d && d.sell !== undefined) return d.sell; }
      if (it.t === "ss") return 0;
      if (it.t === "hx") return CFG.forge.reset.SELL || 0;
      if (it.t === "sm") return (CFG.mijing.items[it.k] || {}).sell || 0;
      if (it.t === "rbp") return CFG.forge.ring.bpSell[it.g] || 0;
      if (it.t === "eq" && it.e.attrs) return (it.e.slot === "ring" ? CFG.forge.ring.sell : CFG.forge.equip.sell)[it.e.g] || 0;
      if (it.t === "fu" || it.t === "bp") return Math.floor(DATA.blueprintCost(it.kind, it.g) * (it.t === "fu" ? 2 : 1));
      return Math.floor(CFG.price.EQUIP_SELL * Math.pow(DATA.STONE_GROW, it.e.g * 10) * (it.e.q + 1));
    },

    setBagTab(t) { this.bagTab = t; this.render(); },
    // 物品图片（没有就返回 ""）
    itemIcon(it) {
      switch (it.t) {
        case "eq": return DATA.eqIcon(it.e);
        case "mat": return DATA.matImg(it.kind, it.g);
        case "pill": return DATA.pillIcon(it.type);
        case "dan": return DATA.danIcon(it.type);
        case "fu": return DATA.furnaceIcon(it.kind);
        case "ss": return DATA.iconImg("ss");
        case "hx": return DATA.iconImg("hx");
        case "sm": return DATA.smIcon(it.k, it.ft);
        case "bp": case "rbp": return DATA.iconImg("bp");
        case "cu": return DATA.cuIcon(this.cuDef(it.name));
      }
      return "";
    },
    setBagFilter(k) { this.bagFilter = k; this.bagSell = false; this.render(); },
    openSellPage() { this.bagSell = true; this.render(); },
    closeSellPage() { this.bagSell = false; this.render(); },
    // v26：出售页（按上面的分类筛选），只有这里能卖东西
    sellPageView(match) {
      const s = this.s, flt = this.bagFilter || "all";
      const rows = s.bag.map((it, i) => [it, i]).filter(([it]) => match(it)).map(([it, i]) => {
        const p = this.sellPrice(it), n = it.n || 1, q = it.t === "eq" ? it.e.q : it.t === "cu" ? ((this.cuDef(it.name) || {}).q || 0) : 0;
        const src = this.itemIcon(it), img = src ? `<img src="${src}" alt="" style="width:28px;height:28px;vertical-align:middle;margin-right:4px">` : "";
        return `<div class="line"><div>${img}<span class="q${q}">${it.t === "eq" ? this.eqQual(it.e) : ""}${this.itemName(it)}</span>${n > 1 ? ` ×${U.fmt(n)}` : ""}<small>单价 ${U.fmt(p)} 灵石</small></div>
          <div><button class="sm" onclick="G.sellItem(${i},1)" ${p > 0 ? "" : "disabled"}>卖1个</button>${n > 1 ? ` <button class="sm" onclick="G.sellItem(${i},${n})" ${p > 0 ? "" : "disabled"}>全部</button>` : ""}</div></div>`;
      }).join("");
      return `<div class="card"><h3>出售<small>${{ all: "全部", dan: "丹药", herb: "药材", ore: "矿石" }[flt]} · 灵石 ${U.fmt(s.stone)}</small></h3>${rows || `<p class="desc">没有可出售的物品。</p>`}
        <div class="btns"><button onclick="G.closeSellPage()">返回储物格</button></div></div>`;
    },

    /* ---------- 弹窗：点储物格 ---------- */
    openItem(i) {
      const it = this.s.bag[i]; if (!it) return;
      const sell = "";   // v26：背包里不能直接出售，去「出售」页
      const _sell = it.n > 1
        ? `<button onclick="G.sellItem(${i},1)">出售1个（${U.fmt(this.sellPrice(it))}）</button><button onclick="G.sellItem(${i},${it.n})">全部出售</button>`
        : `<button onclick="G.sellItem(${i},1)">出售（${U.fmt(this.sellPrice(it))}）</button>`;
      const cq = it.t === "cu" ? ((this.cuDef(it.name) || {}).q || 0) : 0;
      const big = it.t === "mat" ? "" : this.itemIcon(it);
      let h = (big ? `<img class="item-img${it.t === "eq" ? DATA.eqCls(it.e) : ""}" src="${big}" alt="">` : "") + `<h2 class="q${it.t === "eq" ? it.e.q : cq}">${it.t === "eq" ? this.eqQual(it.e) : ""}${this.itemName(it)}${it.n ? " ×" + it.n : ""}</h2>`;
      if (it.t === "pill") {
        const ok = this.canUsePill(it.g);
        h += `<p>修炼速度 +${Math.round(DATA.pillPct(it.type, it.g))}%，持续 ${DATA.pills[it.type].dur} 次修炼。<br>只有${DATA.realmLabel(it.g)}可服用。
          ${ok ? "" : "<br><span class='q5'>与你当前境界不符，无法服用。</span>"}</p>
          <div class="btns"><button class="primary" onclick="G.usePill(${i});G.closeModal()" ${ok ? "" : "disabled"}>服用</button>${sell}</div>`;
      } else if (it.t === "dan") {
        const left = this.danLeft(it.type, it.g), d = DATA.dans[it.type];
        h += `<p>服用后永久 ${d.label} +${U.num(DATA.danVal(it.type, it.g))}。<br>此阶已服 ${d.limit - left} / ${d.limit} 枚。</p>
          <div class="btns"><button class="primary" onclick="G.eatDan(${i},1)" ${left > 0 ? "" : "disabled"}>服用</button>
          <button onclick="G.eatDan(${i},${it.n})" ${left > 0 && it.n > 1 ? "" : "disabled"}>全部服用</button>${sell}</div>`;
      } else if (it.t === "fu") {
        const own = this.s.furnaces[it.kind].includes(it.g);
        h += `<p>${this.furnaceDesc(it.kind, it.g)}。<br>使用后装进洞府${DATA.isDanFu(it.kind) ? "炼丹房" : "炼器室"}，可随时更换。${own ? "<br><span class='q5'>洞府里已有同阶炉子。</span>" : ""}</p>
          <div class="btns"><button class="primary" onclick="G.installFurnace(${i})" ${own ? "disabled" : ""}>使用</button>${sell}</div>`;
      } else if (it.t === "bp") {
        const has = this.s.blueprints[it.kind].includes(it.g);
        h += `<p>学习后可在洞府炼器室炼制${DATA.furnaceName(it.kind, it.g)}。<br>材料：${this.matsText(DATA.furnaceMats(it.kind, it.g))}${has ? "<br><span class='q5'>已学会。</span>" : ""}</p>
          <div class="btns"><button class="primary" onclick="G.learnBlueprint(${i})" ${has ? "disabled" : ""}>学习</button>${sell}</div>`;
      } else if (it.t === "ss") {
        const left = this.stoneLeft(it.g);
        h += `<p>使用后储物格 +1。此阶已用 ${CFG.forge.stone.MAX_USE - left} / ${CFG.forge.stone.MAX_USE} 个。</p>
          <div class="btns"><button class="primary" onclick="G.useStone(${i},1)" ${left > 0 ? "" : "disabled"}>使用</button>
          <button onclick="G.useStone(${i},${it.n})" ${left > 0 && it.n > 1 ? "" : "disabled"}>全部使用</button></div>`;
      } else if (it.t === "hx") {
        h += `<p>用来洗练装备、戒指、法宝的属性（详情里的「洗练」，法宝的紫色、金色属性只能这样得到），也是强化的材料。可以锁定属性，每锁定一条消耗翻一倍。</p><div class="btns">${sell}</div>`;
      } else if (it.t === "sm") {
        h += `<p>${(CFG.mijing.items[it.k] || {}).desc || ""}</p><div class="btns">${sell}</div>`;
      } else if (it.t === "rbp") {
        const has = it.r === undefined ? this.s.forgeKnown.includes(this.forgeKey("ring", it.g)) : this.ringKnown(it.r, it.g);
        h += `<p>学习后可在洞府炼器室把${DATA.JIE[it.g - 1]}${DATA.ringNames[it.r] || "戒指（全部 9 种）"}升为${DATA.JIE[it.g]}（上一阶同种戒指 + 三种矿石）。${has ? "<br><span class='q5'>已学会。</span>" : ""}</p>
          <div class="btns"><button class="primary" onclick="G.learnRingBp(${i})" ${has ? "disabled" : ""}>学习</button>${sell}</div>`;
      } else if (it.t === "cu") {
        h += this.customItemHtml(i, it, sell);   // 自定义物品，见 custom.js
      } else if (it.t === "mat") {
        h += `<img class="item-img" src="${DATA.matImg(it.kind, it.g)}" alt=""><p>${{ herb: "药材，可用于炼丹。", ore: "矿石，可用于炼制炉子、日后炼器。" }[it.kind] || ""}</p><div class="btns">${sell}</div>`;
      } else {
        h += `<p>${DATA.slots[it.e.slot]} · ${this.equipDesc(it.e)}</p>
          <div class="btns"><button class="primary" onclick="G.equipItem(${i})">${it.e.slot === "fabao" ? "放入法宝栏" : "装备"}</button>${it.e.attrs ? `<button onclick="G.openReset('b${i}')">洗练</button>` : ""}${this.canEnhance(it.e) ? `<button onclick="G.openEnhance('b${i}')">强化</button>` : ""}${sell}</div>`;
      }
      this.modal(h + `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    // 点装备栏 / 法宝栏
    openEquip(key) {
      const e = key.startsWith("fb") ? this.s.fabao[+key.slice(2)] : this.s.equip[key]; if (!e) return;
      const src = DATA.eqIcon(e);
      this.modal(`${src ? `<img class="item-img${DATA.eqCls(e)}" src="${src}" alt="">` : ""}<h2 class="q${e.q}">${this.eqQual(e)}${this.itemName({ t: "eq", e })}</h2><p>${DATA.slots[e.slot]} · ${this.equipDesc(e)}</p>
        <div class="btns"><button onclick="G.unequip('${key}')">卸下</button>${key.startsWith("fb") ? `<button onclick="G.openFabaoPick(${+key.slice(2)})">更换</button>` : ""}${e.attrs ? `<button onclick="G.openReset('${key}')">洗练</button>` : ""}${this.canEnhance(e) ? `<button onclick="G.openEnhance('${key}')">强化</button>` : ""}<button onclick="G.closeModal()">关闭</button></div>`);
    },

    /* ---------- 强化（config/forge.js 的 forge.enhance）：每条属性分别强化 ---------- */
    canEnhance(e) { return !!(e && e.attrs && e.attrs.some(a => DATA.attrEnhOK(a, e))); },
    // 第 i 条属性下一次强化的消耗 { fire 火髓, jj 炼宝玄晶, mats 三种矿石 }
    enhCost(e, i) {
      const E = DATA.enhCfg(e), a = e.attrs[i], k = 1 + ((a && a.enh) || 0) * (E.COST_STEP || 0);
      return { fire: Math.ceil((E.FIRE[e.g] || 1) * k), jj: Math.ceil(((E.SPECIAL || [])[e.g] || 0) * k),
        mats: DATA.parseMats(E.ORES[e.g] || E.ORES[0]).map(m => Object.assign(m, { n: Math.ceil(m.n * k) })) };
    },
    enhHave(c) { return this.fireCount() >= c.fire && this.smCount("jj") >= c.jj && this.hasMats(c.mats); },
    // 成功率 0~1 = 炼器成功率 − 这一条已强化次数 × RATE_DROP
    enhRate(e, i) { return Math.max(0, this.craftRate("qi", e.g) - ((e.attrs[i] && e.attrs[i].enh) || 0) * (DATA.enhCfg(e).RATE_DROP || 0) / 100); },
    openEnhance(src) { const e = this.resetTarget(src); if (!this.canEnhance(e)) return; DATA.fixEnh(e); this._enhObj = e; this.drawEnhance(); },
    drawEnhance() {
      const e = this._enhObj; if (!e) return;
      const E = DATA.enhCfg(e);
      this.modal(`<img class="item-img${DATA.eqCls(e)}" src="${DATA.eqIcon(e)}" alt=""><h2 class="q${e.q}">强化 · ${this.itemName({ t: "eq", e })}</h2>
        <p class="desc">火髓 ${U.fmt(this.fireCount())}${e.slot === "fabao" ? ` · ${DATA.smName("jj")} ${U.fmt(this.smCount("jj"))}` : ""} · 失败只扣材料，不掉强化等级。</p>` +
        e.attrs.map((a, i) => {
          if (!DATA.attrEnhOK(a, e)) return `<div class="line"><div><span class="ac${a.c}">${DATA.attrText(a, e)}</span><small>不能强化</small></div></div>`;
          const n = a.enh || 0, max = n >= E.MAX, c = this.enhCost(e, i), base = DATA.attrBase(a, e.g, e);
          return `<div class="line"><div><span class="ac${a.c}">${DATA.attrText(a, e)}</span>
            <small>强化 ${n}/${E.MAX}${max ? " · 已满" : ` → ${U.num(base * DATA.enhMult(a, e, n + 1))} · <span class="${this.fireCount() >= c.fire ? "" : "q5"}">火髓 ${c.fire}</span>${c.jj ? `、<span class="${this.smCount("jj") >= c.jj ? "" : "q5"}">${DATA.smName("jj")} ${c.jj}</span>` : ""}、${this.matsText(c.mats)} · 成功率 ${this.ratePct(this.enhRate(e, i))}`}</small></div>
            <button class="sm" onclick="G.doEnhance(${i})" ${!max && this.enhHave(c) ? "" : "disabled"}>强化</button></div>`;
        }).join("") +
        `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    doEnhance(i) {
      const e = this._enhObj; if (!this.canEnhance(e)) return;
      const a = e.attrs[i]; if (!a || !DATA.attrEnhOK(a, e)) return;
      const E = DATA.enhCfg(e), c = this.enhCost(e, i);
      if ((a.enh || 0) >= E.MAX) return;
      if (!this.enhHave(c)) return this.log("材料不足。", "sys");
      this.takeFire(c.fire); if (c.jj) this.takeSm("jj", c.jj); c.mats.forEach(m => this.takeMat(m.kind, m.g, m.n));
      if (Math.random() < this.enhRate(e, i)) { a.enh = (a.enh || 0) + 1; this.log(`强化成功！${this.itemName({ t: "eq", e })}：${DATA.attrText(a, e)}`, "gold"); }
      else this.log(`强化失败，材料已耗尽，${e.name}完好无损。`, "bad");
      this.after(); this.drawEnhance();
    },

    /* ---------- v25 火髓 ---------- */
    fireCount() { const it = this.s.bag.find(x => x.t === "hx"); return it ? it.n : 0; },
    addFire(n) {
      const it = this.s.bag.find(x => x.t === "hx");
      if (it) { it.n += n; return true; }
      if (this.bagFull()) { if (!this.silent) this.log("背包已满，火髓遗失了。", "bad"); return false; }
      this.s.bag.push({ t: "hx", n }); return true;
    },
    takeFire(n) { const i = this.s.bag.findIndex(x => x.t === "hx"); if (i < 0 || this.s.bag[i].n < n) return false; this.removeAt(i, n); return true; },
    /* ---------- 秘境专用材料：空间晶核 kj、炼宝玄晶 jj、模具 mold（ft = 法宝种类） ---------- */
    smFind(k, ft) { return this.s.bag.findIndex(x => x.t === "sm" && x.k === k && (k !== "mold" || x.ft === ft)); },
    smCount(k, ft) { const i = this.smFind(k, ft); return i < 0 ? 0 : this.s.bag[i].n; },
    addSm(k, n, ft) {
      const i = this.smFind(k, ft);
      if (i >= 0) { this.s.bag[i].n += n; return true; }
      if (this.bagFull()) { if (!this.silent) this.log(`背包已满，${DATA.smName(k, ft)}遗失了。`, "bad"); return false; }
      const it = { t: "sm", k, n }; if (k === "mold") it.ft = ft;
      this.s.bag.push(it); return true;
    },
    takeSm(k, n, ft) { const i = this.smFind(k, ft); if (i < 0 || this.s.bag[i].n < n) return false; this.removeAt(i, n); return true; },
    // 找到要洗练 / 强化的那件：b序号 = 背包，fb序号 = 法宝栏，其它 = 装备栏
    resetTarget(src) {
      if (src[0] === "b" && src[1] !== undefined && !isNaN(+src.slice(1))) { const it = this.s.bag[+src.slice(1)]; return it && it.t === "eq" ? it.e : null; }
      if (src.startsWith("fb")) return this.s.fabao[+src.slice(2)] || null;
      return this.s.equip[src] || null;
    },
    // 洗练弹窗：点属性切换锁定（记住装备对象本身，背包重新排序也不会找错）
    openReset(src) {
      const e = this.resetTarget(src); if (!e || !e.attrs) return;
      if (this._resetObj !== e) this._locks = [];
      this._resetObj = e; this.drawReset();
    },
    drawReset() {
      const e = this._resetObj; if (!e) return;
      const L = this._locks || (this._locks = []), cost = DATA.resetCost(e, L.length);
      const wash = e.slot === "fabao", nm = "洗练";
      this.modal(`<h2 class="q${e.q}">火髓${nm} · ${this.itemName({ t: "eq", e })}</h2>
        <p class="desc">点属性锁定 / 解锁，锁定的属性不变。每锁定一条，火髓消耗翻一倍。</p>` +
        e.attrs.map((a, i) => `<div class="line"><div><span class="ac${a.c}">${DATA.attrText(a, e)}</span></div>
          <button class="sm ${L.includes(i) ? "active" : ""}" onclick="G.toggleLock(${i})">${L.includes(i) ? "已锁定" : "锁定"}</button></div>`).join("") +
        `<p>消耗火髓 <b>${cost}</b>（拥有 ${this.fireCount()}）</p>
        ${wash ? `<p class="desc">炼制、购买得到的法宝属性最高绿色，紫色、金色只能洗练得到。</p>` : ""}
        <div class="btns"><button class="primary" onclick="G.doReset()" ${this.fireCount() >= cost && L.length < e.attrs.length ? "" : "disabled"}>${nm}</button><button onclick="G.closeModal()">关闭</button></div>`);
    },
    toggleLock(i) { const L = this._locks || (this._locks = []), j = L.indexOf(i); j >= 0 ? L.splice(j, 1) : L.push(i); this.drawReset(); },
    doReset() {
      const e = this._resetObj; if (!e || !e.attrs) return;
      const L = this._locks || [], cost = DATA.resetCost(e, L.length);
      if (L.length >= e.attrs.length) return;
      if (!this.takeFire(cost)) return this.log("火髓不足。", "sys");
      const keep = L.map(i => e.attrs[i]);
      DATA.rerollForged(e, L);
      this._locks = keep.map(a => e.attrs.indexOf(a)).filter(i => i >= 0);   // 条数变了，锁定的序号跟着属性走
      this.log(`消耗火髓 ${cost}，洗练了${this.itemName({ t: "eq", e })}的属性。`, "good");
      this.after(); this.drawReset();
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
      this.log(`装备了${this.eqQual(e)}${e.name}。`, "good"); this.closeModal(); this.after();
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
    // rep：更换第几格（不写 = 放入空格）
    openSpellPick(rep) {
      const s = this.s, list = Object.keys(s.gongfa).filter(id => DATA.isSpell(id) && !s.spellSlots.includes(id)), r = rep === undefined ? "" : "," + rep;
      if (!list.length) return this.log(rep === undefined ? "没有可放入的法术，请先去门派功法殿学习。" : "没有可更换的法术。", "sys");
      this.modal(`<h2>${rep === undefined ? "放入" : "更换"}法术</h2>` + list.map(id => { const g = DATA.spellInfo(id, s.gongfa[id]);
        return `<div class="line"><div>《${g.name}》<span class="tag">${g.tier.name}</span><small>攻击×${g.pct}% + ${U.fmt(g.flat)} · 耗法力 ${U.fmt(g.mana)}</small></div>
          <button class="sm" onclick="G.slotSpell('${id}'${r})">${rep === undefined ? "放入" : "更换"}</button></div>`; }).join("") + `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    slotSpell(id, rep) {
      const sl = this.s.spellSlots;
      if (rep !== undefined && sl[rep] !== undefined) sl[rep] = id; else if (sl.length < this.slotCount()) sl.push(id);
      this.closeModal(); this.after();
    },
    // 更换法宝：k 法宝栏第几格；从背包里选一件法宝换上，原来的放回背包
    openFabaoPick(k) {
      const s = this.s, list = s.bag.map((it, i) => i).filter(i => s.bag[i].t === "eq" && s.bag[i].e.slot === "fabao");
      if (!list.length) return this.log("背包里没有可更换的法宝。", "sys");
      this.modal(`<h2>更换法宝</h2>` + list.map(i => { const e = s.bag[i].e;
        return `<div class="line"><div><span class="q${e.q}">${this.eqQual(e)}${this.itemName(s.bag[i])}</span><small>${this.equipDesc(e)}</small></div>
          <button class="sm" onclick="G.swapFabao(${k},${i})">更换</button></div>`; }).join("") + `<div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },
    swapFabao(k, i) {
      const s = this.s, it = s.bag[i], old = s.fabao[k];
      if (!it || it.t !== "eq" || it.e.slot !== "fabao" || !old) return;
      s.fabao[k] = it.e; s.bag[i] = { t: "eq", e: old };
      this.log(`装备了${this.eqQual(it.e)}${it.e.name}。`, "good"); this.closeModal(); this.after();
    },
    unslotSpell(i) { this.s.spellSlots.splice(i, 1); this.closeModal(); this.after(); },
    // 点法术栏：显示详细，可卸下
    openSpellSlot(i) {
      const id = this.s.spellSlots[i], g = id && DATA.spellInfo(id, this.s.gongfa[id]); if (!g) return;
      this.modal(`<h2 class="q${g.tier.idx + 1}">《${g.name}》</h2><p>${g.el.name}系 · ${g.tier.name} · ${g.lv} 层<br>伤害 = 攻击 × ${g.pct}% + ${U.fmt(g.flat)}<br>耗法力 ${U.fmt(g.mana)}</p>
        <div class="btns"><button onclick="G.unslotSpell(${i})">卸下</button><button onclick="G.openSpellPick(${i})">更换</button><button onclick="G.closeModal()">关闭</button></div>`);
    },
  },

  view() {
    const s = this.s, tab = this.bagTab || "eq", n = this.slotCount();
    const tabs = `<div class="sub-tabs">${[["eq", "装备"], ["fb", "法宝"], ["sp", "法术"]].map(([k, t]) =>
      `<button class="${tab === k ? "active" : ""}" onclick="G.setBagTab('${k}')">${t}</button>`).join("")}</div>`;
    const cell = (key, label, e) => { const src = DATA.eqIcon(e); return `<div class="slot-eq ${e ? "q" + e.q : ""}${DATA.eqCls(e)}" onclick="G.openEquip('${key}')"><b>${label}</b>
        ${src ? `<img class="si" src="${src}" alt="">` : ""}${e ? e.name : "空"}</div>`; }; // 只显示名字，点击看详细

    let top;
    if (tab === "eq") {
      top = `<div class="card"><h3>装备</h3><div class="equip four">${DATA.equipSlots.map(k => cell(k, DATA.slots[DATA.slotOf(k)], s.equip[k])).join("")}</div></div>`;
    } else if (tab === "fb") {
      let h = "";
      for (let i = 0; i < DATA.SLOT_MAX; i++) h += i < n ? cell("fb" + i, "法宝", s.fabao[i]) : `<div class="slot-eq lock"><b>法宝</b>${DATA.realmLabel(i)}开启</div>`;
      top = `<div class="card"><h3>法宝<small>已开启 ${n} / ${DATA.SLOT_MAX} 格</small></h3><div class="equip four">${h}</div></div>`;
    } else {
      let h = "";
      for (let i = 0; i < DATA.SLOT_MAX; i++) {
        const id = s.spellSlots[i];
        if (i >= n) h += `<div class="slot-eq lock"><b>法术</b>${DATA.realmLabel(i)}开启</div>`;
        else if (id) { const g = DATA.spellInfo(id, s.gongfa[id]); h += `<div class="slot-eq q${g.tier.idx + 1}" onclick="G.openSpellSlot(${i})"><b>法术</b><img class="si" src="${DATA.skillIcon(g)}" alt="">${g.name}</div>`; }
        else h += `<div class="slot-eq" onclick="G.openSpellPick()"><b>法术</b>空</div>`;
      }
      top = `<div class="card"><h3>法术<small>已开启 ${n} / ${DATA.SLOT_MAX} 格 · 点法术看详细</small></h3><div class="equip four">${h}</div>
        <p class="desc">战斗中按顺序轮流施放，法力不足时普通攻击。</p></div>`;
    }

    this.sortBag();
    // v26：储物格分类（全部 丹药 药材 矿石）+ 出售页
    const flt = this.bagFilter || "all", match = it => flt === "all" || (flt === "dan" ? it.t === "pill" || it.t === "dan" : it.t === "mat" && it.kind === flt);
    const ftabs = `<div class="bag-tabs">${[["all", "全部"], ["dan", "丹药"], ["herb", "药材"], ["ore", "矿石"]].map(([k, t]) =>
      `<button class="${flt === k && !this.bagSell ? "active" : ""}" onclick="G.setBagFilter('${k}')">${t}</button>`).join("")}
      <button class="sell ${this.bagSell ? "active" : ""}" onclick="G.openSellPage()">出售</button></div>`;
    if (this.bagSell) return tabs + top + `<div class="card"><h3>储物格<small>${s.bag.length} / ${s.bagCap}</small></h3>${ftabs}</div>` + this.sellPageView(match);
    let cells = "", shown = 0;
    for (let i = 0; i < s.bagCap; i++) {
      const it = s.bag[i];
      if (it && !match(it)) continue;
      shown++;
      if (!it) { if (flt !== "all") continue; cells += `<div class="cell"></div>`; }
      // 格子里只显示名字和类型，点击才看品质、境界、效果
      else if (it.t === "pill") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 3))}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.pillIcon(it.type)}" alt="">${DATA.pills[it.type].name}<span class="n">${it.n}</span></div>`;
      else if (it.t === "dan") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.danIcon(it.type)}" alt="">${DATA.dans[it.type].name}<span class="n">${it.n}</span></div>`;
      else if (it.t === "mat") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.matImg(it.kind, it.g)}" alt="">${it.name}<span class="n">${U.fmt(it.n)}</span></div>`;
      else if (it.t === "fu") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.furnaceIcon(it.kind)}" alt="">${DATA.furnaceName(it.kind, it.g)}${it.n > 1 ? `<span class="n">${it.n}</span>` : ""}</div>`;
      else if (it.t === "bp") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.iconImg("bp")}" alt="">${DATA.furnaceName(it.kind, it.g)}</div>`;
 else if (it.t === "sm") cells += `<div class="cell q3" onclick="G.openItem(${i})"><img class="mi${it.k === "mold" ? " mold" : ""}" src="${DATA.smIcon(it.k, it.ft)}" alt="">${DATA.smName(it.k, it.ft)}<span class="n">${U.fmt(it.n)}</span></div>`;
 else if (it.t === "hx") cells += `<div class="cell q4" onclick="G.openItem(${i})"><img class="mi" src="${DATA.iconImg("hx")}" alt="">火髓<span class="n">${U.fmt(it.n)}</span></div>`;
      else if (it.t === "rbp") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.iconImg("bp")}" alt="">${DATA.ringNames[it.r] || "戒指"}图纸${it.n > 1 ? `<span class="n">${it.n}</span>` : ""}</div>`;
 else if (it.t === "ss") cells += `<div class="cell q${Math.min(5, Math.floor(it.g / 2))}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.iconImg("ss")}" alt="">${DATA.JIE[it.g]}空间石<span class="n">${it.n}</span></div>`;
      else if (it.t === "cu") { const d = this.cuDef(it.name); cells += `<div class="cell q${d ? d.q || 0 : 0}" onclick="G.openItem(${i})"><img class="mi" src="${DATA.cuIcon(d)}" alt="">${it.name}<span class="n">${U.fmt(it.n)}</span></div>`; }
      else { const src = DATA.eqIcon(it.e); cells += `<div class="cell q${it.e.q}${DATA.eqCls(it.e)}" onclick="G.openItem(${i})">${src ? `<img class="mi" src="${src}" alt="">` : ""}${it.e.name}${it.e.enh ? `<span class="n">+${it.e.enh}</span>` : ""}${src ? "" : `<span class="g">${DATA.slots[it.e.slot]}</span>`}</div>`; }
    }
    return tabs + top + `<div class="card"><h3>储物格<small>${s.bag.length} / ${s.bagCap}</small></h3>${ftabs}<div class="grid">${cells || `<p class="desc">没有这类物品。</p>`}</div></div>`;
  },
});
