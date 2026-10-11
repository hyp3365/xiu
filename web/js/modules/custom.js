/* =====================================================================
 * 模块：自定义物品（物品定义在 js/content/items.js 的 ITEMS.list）
 * ---------------------------------------------------------------------
 * 背包里：消耗品 / 永久属性 / 礼包 / 杂物 存成 { t: "cu", name, n }
 *         装备、法宝 存成普通装备 { t: "eq", e: { slot, g, q, name, cid } }，cid = 物品名，属性按 ITEMS.list 算
 * 存档字段：cuUsed { 物品名: 已使用个数 }（永久属性类）
 * 坊市（ITEMS.shop）见 world.js，宗门宝库（ITEMS.treasury）见 sect.js，地图掉落（ITEMS.drops）见 world.js
 * ===================================================================== */
window.ITEMS = window.ITEMS || {};
DATA.cuTypes = { use: "消耗品", perm: "永久属性", equip: "装备", fabao: "法宝", box: "礼包", misc: "杂物" };
DATA.cuStatNames = { hp: "气血", atk: "攻击", def: "防御", mana: "法力", hit: "命中", dodge: "闪避", speed: "速度", crit: "暴击%", hpPct: "气血%" };

G.module({
  id: "custom",
  defaults: () => ({ cuUsed: {} }),

  api: {
    cuDef(name) { return (ITEMS.list || {})[name] || null; },
    // 属性（固定数值）：perm / equip / fabao 通用
    cuStats(d) {
      const out = {};
      for (const k in DATA.cuStatNames) if (d[k]) out[k] = d[k];
      if (d.res) out.res = Object.assign({}, d.res);
      return out;
    },
    cuStatText(st) {
      const a = Object.keys(st).filter(k => k !== "res").map(k => `${DATA.cuStatNames[k]}+${U.num(st[k])}`);
      if (st.res) for (const e in st.res) if (DATA.elById[e]) a.push(`${DATA.elById[e].name}抗+${U.num(st.res[e])}`);
      return a.join(" ");
    },
    // 放进背包：装备/法宝成为装备，其余叠放
    addCustom(name, n = 1) {
      const d = this.cuDef(name); if (!d || n <= 0) return false;
      if (d.type === "equip" || d.type === "fabao") {
        for (let i = 0; i < n; i++) if (!this.addEquip({ slot: d.type === "fabao" ? "fabao" : (d.slot || "weapon"), g: d.realm || 0, q: d.q || 0, name, cid: name })) return false;
        return true;
      }
      const it = this.s.bag.find(x => x.t === "cu" && x.name === name);
      if (it) { it.n += n; return true; }
      if (this.bagFull()) { if (!this.silent) this.log("背包已满，物品遗失了。", "bad"); return false; }
      this.s.bag.push({ t: "cu", name, n }); return true;
    },
    // 永久属性合计（加进 computeStats）
    customBonus() {
      const b = { hp: 0, atk: 0, def: 0, mana: 0, hit: 0, dodge: 0, speed: 0, crit: 0, res: {} };
      for (const name in this.s.cuUsed || {}) {
        const d = this.cuDef(name), n = this.s.cuUsed[name]; if (!d || d.type !== "perm") continue;
        for (const k in b) if (k !== "res" && d[k]) b[k] += d[k] * n;
        if (d.res) for (const e in d.res) b.res[e] = (b.res[e] || 0) + d.res[e] * n;
      }
      return b;
    },
    cuLeft(name) { const d = this.cuDef(name); return d && d.limit ? Math.max(0, d.limit - ((this.s.cuUsed || {})[name] || 0)) : Infinity; },
    // 使用 n 个
    useCustom(i, n = 1) {
      const s = this.s, it = s.bag[i]; if (!it || it.t !== "cu") return;
      const d = this.cuDef(it.name); if (!d) return;
      n = Math.min(n, it.n);
      if (d.type === "perm") {
        n = Math.min(n, this.cuLeft(it.name)); if (n <= 0) return this.log(`${it.name}已用到上限。`, "sys");
        s.cuUsed[it.name] = (s.cuUsed[it.name] || 0) + n;
        this.log(`使用${it.name} ×${n}，${this.cuStatText(this.cuStats(d))}（×${n}）。`, "good");
      } else if (d.type === "use") {
        const st = this.stats(), got = [];
        for (let k = 0; k < n; k++) {
          if (d.hp || d.hpPct) s.hp = Math.min(st.hp, s.hp + (d.hp || 0) + st.hp * (d.hpPct || 0) / 100);
          if (d.mana || d.manaPct) s.mana = Math.min(st.mana, s.mana + (d.mana || 0) + st.mana * (d.manaPct || 0) / 100);
          if (d.stone) s.stone += d.stone;
          if (d.ling) s.ling += d.ling;
          if (d.contrib) s.contrib += d.contrib;
          if (d.exp) s.exp += d.exp;
        }
        if (d.hp || d.hpPct) got.push("气血已恢复"); if (d.mana || d.manaPct) got.push("法力已恢复");
        if (d.stone) got.push(`灵石+${U.fmt(d.stone * n)}`); if (d.ling) got.push(`灵气+${U.fmt(d.ling * n)}`);
        if (d.contrib) got.push(`贡献+${U.fmt(d.contrib * n)}`); if (d.exp) got.push(`修为+${U.fmt(d.exp * n)}`);
        this.log(`使用${it.name} ×${n}${got.length ? "，" + got.join("，") : ""}。`, "good");
      } else if (d.type === "box") {
        const got = [];
        this.removeAt(i, n); i = -1;
        for (let k = 0; k < n; k++) {
          if (d.stone) s.stone += d.stone;
          for (const name in d.items || {}) this.giveByName(name, d.items[name]);
        }
        if (d.stone) got.push(`灵石${U.fmt(d.stone * n)}`);
        for (const name in d.items || {}) got.push(`${name}×${U.fmt(d.items[name] * n)}`);
        this.log(`打开${it.name} ×${n}，获得 ${got.join("、") || "无"}。`, "gold");
      } else return;
      if (i >= 0) this.removeAt(i, n);
      this.closeModal(); this.after();
    },
    // 按名字发放：自定义物品 / 药材 / 矿石
    giveByName(name, n) {
      if (this.cuDef(name)) return this.addCustom(name, n);
      const m = DATA.matByName && DATA.matByName[name];
      if (m) return this.addMat(m.kind, name, m.g, n);
      return false;
    },
    // 背包弹窗内容（bag.js 的 openItem 调用）
    customItemHtml(i, it, sell) {
      const d = this.cuDef(it.name);
      if (!d) return `<p>此物已失传（物品库里没有这个名字）。</p><div class="btns"><button onclick="G.removeAt(${i},${it.n});G.closeModal();G.after()">丢弃</button></div>`;
      let h = `<p>${DATA.cuTypes[d.type] || "物品"}${d.desc ? "<br>" + d.desc : ""}`, btn = "";
      if (d.type === "perm") {
        const left = this.cuLeft(it.name);
        h += `<br>使用后永久 ${this.cuStatText(this.cuStats(d))}${d.limit ? `<br>已使用 ${d.limit - left} / ${d.limit}` : ""}`;
        btn = `<button class="primary" onclick="G.useCustom(${i},1)" ${left > 0 ? "" : "disabled"}>使用</button>
          <button onclick="G.useCustom(${i},${it.n})" ${left > 0 && it.n > 1 ? "" : "disabled"}>全部使用</button>`;
      } else if (d.type === "use" || d.type === "box") {
        btn = `<button class="primary" onclick="G.useCustom(${i},1)">${d.type === "box" ? "打开" : "使用"}</button>${it.n > 1 ? `<button onclick="G.useCustom(${i},${it.n})">全部${d.type === "box" ? "打开" : "使用"}</button>` : ""}`;
      }
      return h + `</p><div class="btns">${btn}${(d.sell || 0) > 0 ? sell : ""}</div>`;
    },
  },
});
