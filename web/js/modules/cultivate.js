/* =====================================================================
 * 模块：修炼（灵气 → 修为、突破、丹药加速）
 * ---------------------------------------------------------------------
 * 修炼速度 = 基础修炼速度 × 聚灵阵倍率 × (1 + 丹药%) × (1 + 练功房%)
 *   基础修炼速度 = (境界基础 + 秘诀) × 灵根倍率
 * 聚灵阵开关在本页；开关只影响修炼速度（关闭后没有聚灵阵倍率），不影响聚灵。
 * 修炼前提：学会至少一部秘诀，且不在自动探索中。
 * 每 10 秒修炼一次：消耗 灵气 = 修炼速度，获得同等修为（1 灵气 = 1 修为）
 * 灵气不够时，只能把剩下的灵气全部转化；灵气为 0 时无法修炼（进度条不走）。
 * 修为满了不会自动突破，必须手动点“突破”。修为会继续累积，不会浪费。
 * 小境界突破 100% 成功；大境界突破有成功率，失败损失 30% 修为。
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
  }),

  tick(offline) {
    const s = this.s;
    if (!this.isCultivating()) return;
    if (!this.hasMijue() || s.explore) { s.manual = false; return; } // 未学秘诀 / 探索中：不能修炼

    // 1. 自动服丹：效果用完就吃背包里能吃的最高品质
    for (const t in DATA.pills) {
      const b = s.buffs[t];
      if (s.autoPill[t] && (!b || b.left <= 0)) {
        const i = this.bestPillIndex(t);
        if (i >= 0) this.usePill(i, true);
      }
    }

    // 2. 练功房：每次修炼扣门派贡献，不够就自动离开
    if (s.room >= 0 && s.sect) {
      const c = this.roomCost(s.room);
      if (s.contrib >= c) s.contrib -= c;
      else { s.room = -1; this.dirty(); this.log("门派贡献不足，已离开练功房。", "bad"); }
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
    canCultivate() { return this.hasMijue() && !this.s.explore && (this.s.ling >= 1 || (this.s.array.autoRefill && this.s.stone >= 1)); },
    // 不能修炼的原因（能修炼返回空）
    cultivateBlock() {
      if (!this.hasMijue()) return "未学秘诀，无法修炼（门派功法殿学习）";
      if (this.s.explore) return "自动探索中，无法修炼";
      if (!this.canCultivate()) return "灵气耗尽，修炼停滞";
      return "";
    },

    computeSpeed() {
      const st = this.stats(), s = this.s;
      const base = (st.cultivate + this.gongfaBonus().cultivate) * this.root().mult;
      const arr = this.arrayFactor();                     // 聚灵阵常开
      let pill = 0;
      for (const t in s.buffs) { const b = s.buffs[t]; if (b && b.left > 0) pill += b.pct; }
      const room = s.room >= 0 && s.sect ? this.roomPct(s.room) : 0;
      return { base, arr, pill, room, total: base * arr * (1 + pill / 100) * (1 + room / 100),
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

    canBreak() { return this.s.exp >= this.needExp() && (this.s.mortal || this.s.L < DATA.realms.length * DATA.LAYERS - 1); },
    isMajor() { return !this.s.mortal && this.layer() === DATA.LAYERS - 1; },
    breakChance() { return this.s.mortal ? 1 : this.isMajor() ? Math.min(0.99, DATA.majorBreakChance(this.r()) + (this.root().mult - 1) * 0.05) : 1; },

    // 手动突破
    breakthrough() {
      if (!this.canBreak()) return;
      const s = this.s, major = this.isMajor();
      if (s.mortal) { // 凡人 → 练气期一层
        s.exp -= this.needExp(); s.mortal = false; this.dirty();
        const st = this.stats(); s.hp = st.hp; s.mana = st.mana;
        this.log("引气入体，你正式踏入仙途——【练气期一层】！", "gold");
        return this.after();
      }
      if (Math.random() < this.breakChance()) {
        s.exp -= this.needExp(); s.L++;
        this.dirty();
        const st = this.stats(); s.hp = st.hp; s.mana = st.mana;
        this.log(major ? `天地异象！你成功踏入【${this.realmName()}】！` : `突破至【${this.realmName()}】。`, major ? "gold" : "good");
      } else {
        const loss = Math.floor(s.exp * DATA.MAJOR_FAIL_LOSS);
        s.exp -= loss;
        this.log(`冲击大境界失败，修为 -${U.fmt(loss)}。`, "bad");
      }
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
    const can = this.canBreak(), major = this.isMajor();
    const next = s.mortal ? "引气入体（突破至练气期）" : major ? `突破至${DATA.realms[this.r() + 1]}期` : "突破";
    const block = this.isCultivating() ? this.cultivateBlock() : "";
    const arrPct = (this.arrayFactor() - 1) * 100;
    return `
    <div class="card">
      <h3>${this.realmName()}<small>${this.root().name}</small></h3>
      <div class="row small"><span>本次修炼</span><span>${!this.isCultivating() ? "未修炼" : block ? `<b class='q5'>${block}</b>` : `${s.auto ? "自动修炼中" : "修炼中"} · <b id="tick-left"></b>`}</span></div>
      <div class="bar tick"><div id="tick-bar"></div></div>
      <div class="row small"><span>修炼速度</span><b class="q4">${U.num(sp.total)} 修为 / 10秒</b></div>
      <div class="chips">
        <span class="${arrPct > 0 ? "on" : ""}">聚灵阵 +${U.num(arrPct)}%</span>
        <span class="${sp.pill ? "on" : ""}">丹药 +${Math.round(sp.pill)}%</span>
        <span class="${sp.room ? "on" : ""}">练功房 +${Math.round(sp.room)}%</span></div>
      <div class="row small"><span>灵气</span><span>${U.fmt(s.ling)} / ${U.fmt(cap)}</span></div>
      <div class="bar ling"><div style="width:${Math.min(100, s.ling / cap * 100)}%"></div></div>
      <div class="btns">
        <button class="${s.auto ? "on" : "primary"}" onclick="G.toggleAuto()">自动修炼：${s.auto ? "开" : "关"}</button>
        <button onclick="G.cultivateOnce()" ${this.isCultivating() ? "disabled" : ""}>修炼一次（10秒）</button>
        <button class="primary" style="flex-basis:100%" onclick="G.breakthrough()" ${can ? "" : "disabled"}>
          ${can ? `${next}（成功率 ${Math.round(this.breakChance() * 100)}%）` : `修为未满，还差 ${U.fmt(this.needExp() - s.exp)}`}</button>
      </div>
    </div>
    <div class="card"><h3>人物属性</h3><div class="stats">
      <div><span>气血</span>${U.fmt(s.hp)}/${U.fmt(st.hp)}</div><div><span>法力</span>${U.fmt(s.mana)}/${U.fmt(st.mana)}</div>
      <div><span>攻击</span>${U.fmt(st.atk)}</div><div><span>防御</span>${U.fmt(st.def)}</div>
      <div><span>命中</span>${U.num(st.hit)}</div><div><span>闪避</span>${U.num(st.dodge)}</div>
      <div><span>速度</span>${U.fmt(st.speed)}</div><div><span>暴击</span>${st.crit.toFixed(1)}%</div>
      <div style="grid-column:1/3"><span>修炼速度</span>${U.fmt(sp.total)} / 10秒</div>
    </div><p class="desc" style="margin-top:4px">气血、法力每 10 秒恢复 1%</p></div>
    <div class="card"><h3>修炼速度构成</h3>
      <div class="line"><div>基础修炼速度<small>(境界 ${U.num(st.cultivate)} + 秘诀 ${U.num(this.gongfaBonus().cultivate)}) × 灵根 ${this.root().mult}</small></div><b>${U.num(sp.base)}</b></div>
      <div class="line"><div>聚灵阵<small>${s.array.lv} 级</small></div><b>×${sp.arr >= 100 ? U.fmt(sp.arr) : sp.arr.toFixed(2)}</b></div>
      <div class="line"><div>丹药</div><b>+${Math.round(sp.pill)}%</b></div>
      <div class="line"><div>门派练功房<small>${s.room >= 0 && s.sect ? DATA.rooms[s.room].name : "未使用"}</small></div><b>+${Math.round(sp.room)}%</b></div>
    </div>
    <div class="card"><h3>丹药<small>只增加修炼速度</small></h3>
      ${Object.keys(DATA.pills).map(t => {
        const b = s.buffs[t], on = b && b.left > 0, i = this.bestPillIndex(t);
        const cnt = s.bag.filter(x => x.t === "pill" && x.type === t && this.canUsePill(x.g)).reduce((a, x) => a + x.n, 0);
        return `<div class="line"><div>${DATA.pills[t].name}<small>${on ? `+${Math.round(b.pct)}%，剩余 ${b.left} 次修炼` : "未生效"} · 可用 ${cnt} 枚</small></div>
        <div><button class="sm" onclick="G.manualPill('${t}')" ${i < 0 ? "disabled" : ""}>服用</button>
        <button class="sm ${s.autoPill[t] ? "on" : ""}" onclick="G.toggleAutoPill('${t}')">自动${s.autoPill[t] ? "开" : "关"}</button></div></div>`;
      }).join("")}
    </div>`;
  },
});
