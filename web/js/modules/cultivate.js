/* =====================================================================
 * 模块：修炼（灵气 → 修为、突破、丹药加速）
 * ---------------------------------------------------------------------
 * 修炼速度 = 基础修炼速度 × (1 + (聚灵阵% + 丹药% + 修炼室%) / 100)（百分比加成全部相加，不连乘）
 *   基础修炼速度 = 境界基础 + 秘诀（开局不再随机灵根）
 * 聚灵阵开关在本页；开关只影响修炼速度（关闭后没有聚灵阵倍率），不影响聚灵。
 * 修炼前提：学会至少一部秘诀，且不在自动探索中。
 * 每 10 秒修炼一次：消耗 灵气 = 修炼速度，获得同等修为（1 灵气 = 1 修为）
 * 灵气不够时，只能把剩下的灵气全部转化；灵气为 0 时无法修炼（进度条不走）。
 * 修为满了不会自动突破，必须手动点“突破”。修为会继续累积，不会浪费。
 * 渡劫：从 config/trib.js 的 START 层开始（默认突破筑基期一层起），每层突破都要渡劫：
 *   点「突破」进渡劫准备页，开始后撑过劫云 TIME 秒没倒 = 突破成功（详见 modules/trib.js）。
 * 没有雷劫的突破：小境界 100% 成功；大境界有成功率，失败损失 30% 修为。
 * ===================================================================== */
G.module({
  id: "cultivate",
  tab: "cultivate",

  defaults: () => ({
    auto: false,      // 自动修炼开关
    manual: false,    // 正在进行“修炼一次”
    buffs: {},        // 丹药效果 { juqi: {pct, left} }，left = 剩余修炼次数
    autoPill: { juqi: false, juling: false, peiyuan: false }, // 自动服丹开关
    lackWarned: false,
    trib: null,       // 正在进行（或刚结束未关闭）的渡劫（modules/trib.js）
  }),

  tick(offline) {
    const s = this.s;
    if (s.trib) this.advanceTrib(); // 渡劫（离线也会算完）
    if (!this.isCultivating()) return;
    if (!this.hasMijue() || this.exBlocksCult()) { s.manual = false; return; } // 未学秘诀 / 探索中（出窍除外）：不能修炼

    // 1. 自动服丹：效果用完就吃背包里能吃的最高品质
    for (const t in DATA.pills) {
      const b = s.buffs[t];
      if (s.autoPill[t] && (!b || b.left <= 0)) {
        const i = this.bestPillIndex(t);
        if (i >= 0) this.usePill(i, true);
      }
    }

    // 2. 修炼室：免费修炼室（每天 N 次，每次若干次修炼）优先，用完再按付费修炼室扣
    if (this.freeCultOn()) {
      if (--s.freeCult.left <= 0) { s.freeCult.left = 0; s.freeCult.on = false; this.dirty(); this.log(`${CFG.sect.freeRoom.name}次数已用完。`, "sys"); }
    } else if (s.room >= 0 && s.sect) {
      const c = this.roomCost(s.room);
      if (s.contrib >= c) s.contrib -= c;
      else { s.room = -1; this.dirty(); this.log("门派贡献不足，已离开修炼室。", "bad"); }
    } else if (s.shopRoom >= 0 && DATA.shopRooms.cult[s.shopRoom]) {   // v27：坊市修炼室扣灵石
      const c = DATA.shopRooms.cult[s.shopRoom].cost;
      if (s.stone >= c) s.stone -= c;
      else { s.shopRoom = -1; this.dirty(); this.log("灵石不足，已离开坊市修炼室。", "bad"); }
    }

    // 3. 灵气不足且开了自动补充：用灵石补
    const sp = this.speed().total;
    if (s.ling < sp && s.array.autoRefill && s.stone >= 1) {
      const rate = this.lingPerStone();
      const pay = Math.min(Math.ceil((sp - s.ling) / rate), Math.floor(s.stone));
      s.stone -= pay; s.ling += pay * rate;
    }

    // 4. 灵气转修为
    const gain = Math.min(Math.floor(s.ling), sp);
    if (gain <= 0) {           // 没有灵气，本次修炼不生效
      if (!s.lackWarned) { this.log("灵气耗尽，无法修炼。请开启聚灵阵或用灵石补充灵气。", "bad"); s.lackWarned = true; }
      s.manual = false;
      return;
    }
    s.ling -= gain; s.exp += gain;
    if (gain < sp * 0.999) {
      if (!s.lackWarned) { this.log("灵气不足，修炼受阻。请开启聚灵阵或用灵石补充灵气。", "bad"); s.lackWarned = true; }
    } else s.lackWarned = false;

    // 5. 丹药持续次数 -1
    for (const t in s.buffs) {
      const b = s.buffs[t];
      if (b.left > 0 && --b.left === 0) { this.dirty(); this.log(`${DATA.pills[t].name}药力耗尽。`, "sys"); }
    }
    s.manual = false;
  },

  api: {
    isCultivating() { return this.s.auto || this.s.manual; },
    // 有灵气（或开了自动补充且有灵石）才能修炼
    // 探索、历练中不能修炼；元婴出窍探索时可以继续修炼
    exBlocksCult() { return !!(this.s.explore && !this.s.explore.cq); },
    canCultivate() { return this.hasMijue() && !this.exBlocksCult() && (this.s.ling >= 1 || (this.s.array.autoRefill && this.s.stone >= 1)); },
    // 不能修炼的原因（能修炼返回空）
    cultivateBlock() {
      if (!this.hasMijue()) return "未学秘诀，无法修炼（门派功法殿学习）";
      if (this.exBlocksCult()) return this.s.explore.once ? "历练中，无法修炼" : "自动探索中，无法修炼";
      if (!this.canCultivate()) return "灵气耗尽，修炼停滞";
      return "";
    },

    computeSpeed() {
      const st = this.stats(), s = this.s;
      const mifa = this.mifaBonus().expSpeed || 0;          // 宗门秘法「聚元」：固定加基础修炼速度
      const base = st.cultivate + this.gongfaBonus().cultivate + mifa;
      const arr = this.arrayFactor();                     // 聚灵阵常开
      let pill = 0;
      for (const t in s.buffs) { const b = s.buffs[t]; if (b && b.left > 0) pill += b.pct; }
      const room = this.freeCultOn() ? this.freeCultPct() : s.room >= 0 && s.sect ? this.roomPct(s.room) : s.shopRoom >= 0 && DATA.shopRooms.cult[s.shopRoom] ? DATA.shopRooms.cult[s.shopRoom].pct : 0;
      // 所有百分比加成相加后再乘：总速度 = 基础 × (1 + (聚灵阵% + 丹药% + 修炼室%) / 100)，避免数值连乘爆炸
      const arrPct = (arr - 1) * 100, mfPct = this.mifaBonus().expSpeedPct || 0, svPct = this.servantPct("cult");   // 聚元秘法圆满额外 %、道童辅助修炼 %
      return { base, arr, pill, room, mifa, mfPct, svPct, total: base * (1 + (arrPct + pill + room + mfPct + svPct) / 100),
        gather: this.gatherAmount() };                                     // 每 10 秒聚灵（开关不影响）
    },

    toggleAuto() {
      this.s.auto = !this.s.auto;
      if (this.s.auto) this._lastTick = Date.now();
      this.log(this.s.auto ? "开启自动修炼。" : "停止自动修炼。", "sys");
      this.after();
    },
    cultivateOnce() {
      if (this.isCultivating()) return;
      if (!this.canCultivate()) return this.log(this.cultivateBlock() + "。", "bad");
      this.s.manual = true; this._lastTick = Date.now(); this.render();
    },
    // 修炼肉身界面（modules/body.js）
    openBody(on) { this.cultView = on ? "body" : ""; this.render(); },
    // 修炼加成（弹窗）：修炼速度构成 + 丹药
    openBoost() {
      const s = this.s, st = this.stats(), sp = this.speed(), arrPct = (this.arrayFactor() - 1) * 100;
      this.modal(`<h2>修炼加成<small> · ${U.num(sp.total)} 修为 / 10秒</small></h2>
        <div class="line"><div>基础修炼速度<small>境界 ${U.num(st.cultivate)} + 秘诀 ${U.num(this.gongfaBonus().cultivate)} + 秘法 ${U.num(sp.mifa)}</small></div><b>${U.num(sp.base)}</b></div>
        <div class="line"><div>聚灵阵<small>${s.array.lv} 级</small></div><b>+${U.num(arrPct)}%</b></div>
        <div class="line"><div>聚元秘法圆满</div><b>+${U.num(sp.mfPct)}%</b></div>
        <div class="line"><div>道童辅助修炼</div><b>+${U.num(sp.svPct)}%</b></div>
        <div class="line"><div>丹药</div><b>+${Math.round(sp.pill)}%</b></div>
        <div class="line"><div>修炼室<small>${this.freeCultOn() ? `${CFG.sect.freeRoom.name}（剩余 ${s.freeCult.left} 次）` : s.room >= 0 && s.sect ? DATA.rooms[s.room].name : s.shopRoom >= 0 && DATA.shopRooms.cult[s.shopRoom] ? "坊市 · " + DATA.shopRooms.cult[s.shopRoom].name : "未使用"}</small></div><b>+${Math.round(sp.room)}%</b></div>
        <h3 style="margin-top:10px">丹药</h3>
        ${Object.keys(DATA.pills).map(t => {
          const b = s.buffs[t], on = b && b.left > 0, i = this.bestPillIndex(t);
          const cnt = s.bag.filter(x => x.t === "pill" && x.type === t && this.canUsePill(x.g)).reduce((a, x) => a + x.n, 0);
          if (!on && !cnt) return "";   // v42：没生效、也没有能吃的就不显示
          return `<div class="line"><div><img src="${DATA.pillIcon(t)}" alt="" style="width:30px;height:30px;float:left;margin-right:6px">${DATA.pills[t].name}<small>${on ? `+${Math.round(b.pct)}%，剩余 ${b.left} 次修炼` : "未生效"} · 可用 ${cnt} 枚</small></div>
          <div><button class="sm" onclick="G.manualPill('${t}');G.openBoost()" ${i < 0 ? "disabled" : ""}>服用</button>
          <button class="sm ${s.autoPill[t] ? "on" : ""}" onclick="G.toggleAutoPill('${t}');G.openBoost()">自动${s.autoPill[t] ? "开" : "关"}</button></div></div>`;
        }).join("")}
        <div class="btns"><button onclick="G.closeModal()">关闭</button></div>`);
    },

    canBreak() { return this.s.exp >= this.needExp() && (this.s.mortal || this.s.L < DATA.realms.length * DATA.LAYERS - 1); },
    isMajor() { return !this.s.mortal && this.layer() === DATA.LAYERS - 1; },
    // 这次突破是否要渡雷劫（突破后的层序 ≥ trib.START）
    needTrib() { return !this.s.mortal && this.s.L + 1 >= CFG.trib.START; },

    // 渡劫（准备页、劫云、结算）在 modules/trib.js

    // 手动突破
    breakthrough() {
      if (this.s.trib) return this.openTrib();
      if (!this.canBreak()) return;
      const s = this.s, major = this.isMajor();
      if (this.needTrib()) return this.openTrib();   // 进渡劫准备页
      if (s.mortal) { // 凡人 → 练气期一层
        s.exp -= this.needExp(); s.mortal = false; this.dirty();
        const st = this.stats(); s.hp = st.hp; s.mana = st.mana;
        this.log("引气入体，你正式踏入仙途——【练气期一层】！", "gold");
        return this.after();
      }
      // 不需要渡劫的突破：修为够了直接成功
      s.exp -= this.needExp(); s.L++;
      this.dirty();
      const st = this.stats(); s.hp = st.hp; s.mana = st.mana;
      this.log(major ? `天地异象！你成功踏入【${this.realmName()}】！` : `突破至【${this.realmName()}】。`, major ? "gold" : "good");
      this.after();
    },

    /* ---------- 丹药（只加修炼速度） ---------- */
    canUsePill(grade) { return grade === this.r(); }, // 只能服用与当前境界对应品质的丹药
    // 找背包里能吃的最高品质丹药
    bestPillIndex(type) {
      let best = -1;
      this.s.bag.forEach((it, i) => {
        if (it.t === "pill" && it.type === type && this.canUsePill(it.g) && (best < 0 || it.g > this.s.bag[best].g)) best = i;
      });
      return best;
    },
    usePill(i, silent) {
      const it = this.s.bag[i];
      if (!it || it.t !== "pill") return false;
      if (!this.canUsePill(it.g)) { this.log(`${this.itemName(it)}品质过低，你已无法服用。`, "sys"); return false; }
      const p = DATA.pills[it.type], pct = DATA.pillPct(it.type, it.g), b = this.s.buffs[it.type];
      // 同类丹药效果不叠加加成，取较高值，持续次数累加
      if (b && b.left > 0) { b.pct = Math.max(b.pct, pct); b.left += p.dur; }
      else this.s.buffs[it.type] = { pct, left: p.dur };
      this.log(`服下${this.itemName(it)}，修炼速度 +${Math.round(pct)}%（剩余${this.s.buffs[it.type].left}次修炼）`, "good");
      this.removeAt(i);
      this.dirty();
      if (!silent) this.after();
      return true;
    },
    manualPill(t) {
      const i = this.bestPillIndex(t);
      if (i < 0) return this.log(`背包里没有可服用的${DATA.pills[t].name}，可去 世界→坊市 购买。`, "sys");
      this.usePill(i);
    },
    toggleAutoPill(t) { this.s.autoPill[t] = !this.s.autoPill[t]; this.after(); },
  },

  view() {
    const s = this.s, st = this.stats(), sp = this.speed(), cap = this.lingCap();
    if (this.cultView === "body") return this.bodyView();   // 修炼肉身（modules/body.js）
    const can = this.canBreak(), major = this.isMajor();
    const next = s.mortal ? "引气入体（突破至练气期）" : major ? `突破至${DATA.realmLabel(this.r() + 1)}` : "突破";
    const block = this.isCultivating() ? this.cultivateBlock() : "";
    const boost = sp.pill || sp.room || this.arrayFactor() > 1 || sp.mifa, R0 = this.regen(false), R1 = this.regenStep();
    return `
    <div class="card">
      <h3>${this.realmName()}<small>${this.needTrib() ? "下次突破需渡劫" : ""}</small></h3>
      <div class="row small"><span>修炼速度 <b class="q4">${U.num(sp.total)}</b> 修为 / 10秒</span>
        <button class="sm ${boost ? "on" : ""}" onclick="G.openBoost()">修炼加成${sp.pill ? ` · 丹药+${Math.round(sp.pill)}%` : ""}</button></div>
      <div class="row small"><span>本次修炼</span><span>${!this.isCultivating() ? "未修炼" : block ? `<b class='q5'>${block}</b>` : `${s.auto ? "自动修炼中" : "修炼中"} · <b id="tick-left"></b>`}</span></div>
      <div class="bar tick"><div id="tick-bar"></div></div>
      <div class="row small"><span>灵气</span><span>${U.fmt(s.ling)} / ${U.fmt(cap)}</span></div>
      <div class="bar ling"><div style="width:${Math.min(100, s.ling / cap * 100)}%"></div></div>
      <div class="btns">
        <button class="${s.auto ? "on" : "primary"}" onclick="G.toggleAuto()">自动修炼：${s.auto ? "开" : "关"}</button>
        <button onclick="G.openBody(true)">修炼肉身</button>
        <button class="primary" style="flex-basis:100%" onclick="G.breakthrough()" ${can || s.trib ? "" : "disabled"}>
          ${s.trib ? (s.trib.result ? "查看渡劫结果" : "渡劫中…查看劫云") : can ? next : `修为未满，还差 ${U.fmt(this.needExp() - s.exp)}`}</button>
      </div>
      <div class="row small" style="margin-top:8px"><span>修为</span><span>${U.fmt(s.exp)} / ${U.fmt(this.needExp())}</span></div>
      <div class="bar"><div style="width:${Math.min(100, s.exp / this.needExp() * 100)}%"></div></div>
    </div>
    <div class="card"><h3>人物属性</h3><div class="stats">
      <div><span>生命</span>${U.fmt(s.hp)}/${U.fmt(st.hp)}</div><div><span>法力</span>${U.fmt(s.mana)}/${U.fmt(st.mana)}</div>
      <div><span>攻击</span>${U.fmt(st.atk)}</div><div><span>防御</span>${U.fmt(st.def)}</div>
      <div><span>命中</span>${U.num(st.hit)}</div><div><span>闪避</span>${U.num(st.dodge)}</div>
      <div><span>速度</span>${U.fmt(st.speed)}</div><div><span>暴击</span>${st.crit.toFixed(1)}%</div>
      ${DATA.elements.map(e => `<div><span>${e.name}抗</span>${U.fmt(st.res[e.id])}</div>`).join("")}
      <div style="grid-column:1/3"><span>修炼速度</span>${U.fmt(sp.total)} / 10秒</div>
    </div><p class="desc" style="margin-top:4px">平时每 10 秒恢复 生命 ${U.num(R0.hp)}% · 法力 ${U.num(R0.mana)}%；历练/探索每走一步恢复 生命 ${U.num(R1.hp)}% · 法力 ${U.num(R1.mana)}%</p></div>`;
  },
});
