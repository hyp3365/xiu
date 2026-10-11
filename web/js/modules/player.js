/* =====================================================================
 * 模块：人物（境界、属性、气血法力自动恢复）
 * 开局为“凡人”，修为满 100 突破为练气期一层。
 * ---------------------------------------------------------------------
 * 属性计算公式（computeStats）：
 *   气血 = (基础×成长^层序 + 装备 + 真经) × (1 + 装备气血%)
 *   攻击 =  基础×成长^层序 + 装备 + 功诀
 *   防御 =  基础×成长^层序 + 装备 + 心法
 *   法力 =  基础×成长^层序 + 装备 + 法诀
 *   （功法加成都是固定数值；以上各项再加 属性丹 永久加成）
 *   基础修炼速度 = 基础×成长^层序（不显示为属性）
 *   速度 = 基础×成长^层序 + 装备
 *   命中 = 基础×成长^层序 + 装备 + 身法 + 丹药；闪避 = 基础×成长^层序 + 装备 + 遁术 + 丹药
 *   暴击：固定基础值 + 装备 + 丹药，不随境界成长
 * ===================================================================== */
G.module({
  id: "player",

  defaults: () => ({
    mortal: true, // 凡人（尚未踏入练气期）
    L: 0,        // 总层序（境界×10+层）
    exp: 0,      // 当前修为
    hp: CFG.player.base.hp,     // 当前气血
    mana: CFG.player.base.mana, // 当前法力
    kills: 0,    // 斩妖数
  }),

  // 每 10 秒：气血、法力各恢复上限的 1%
  tick() {
    const st = this.stats(), s = this.s;
    if (s.hp < st.hp) s.hp = Math.min(st.hp, s.hp + st.hp * DATA.REGEN);
    if (s.mana < st.mana) s.mana = Math.min(st.mana, s.mana + st.mana * DATA.REGEN);
  },

  api: {
    r() { return Math.floor(this.s.L / DATA.LAYERS); },          // 当前大境界序号
    layer() { return this.s.L % DATA.LAYERS; },                    // 当前层（0~9）
    needExp() { return this.s.mortal ? DATA.MORTAL_EXP : DATA.needExp(this.s.L); },
    realmName(L) {
      if (L === undefined) { if (this.s.mortal) return "凡人"; L = this.s.L; }
      return DATA.realms[Math.floor(L / 10)] + "期" + DATA.layerNames[L % 10];
    },

    // 汇总装备加成
    equipTotal() {
      const add = { atk: 0, hp: 0, def: 0, mana: 0, crit: 0, hit: 0, dodge: 0, speed: 0, hpPct: 0 };
      const all = [...Object.values(this.s.equip), ...this.s.fabao.slice(0, this.slotCount())]; // 装备 + 法宝
      for (const e of all) if (e) { const st = this.equipStats(e); for (const k in st) add[k] += st[k]; }
      return add;
    },

    computeStats() {
      const L = this.s.L, f = Math.pow(DATA.GROW, L), B = DATA.playerBase, F = DATA.playerFixed;
      const eq = this.equipTotal(), gf = this.gongfaBonus(), dn = this.danBonus(); // gongfaBonus 见 gongfa.js，danBonus（属性丹）见 craft.js
      const mf = this.wudaoPct(), p = k => 1 + (mf[k] || 0) / 100;               // 宗门秘法（悟道室）百分比加成，见 wudao.js
      return {
        hp:      (B.hp * f + eq.hp + gf.hp + dn.hp) * (1 + eq.hpPct / 100) * p("hp"),
        atk:     (B.atk * f + eq.atk + gf.atk + dn.atk) * p("atk"),
        def:     (B.def * f + eq.def + gf.def + dn.def) * p("def"),
        mana:    (B.mana * f + eq.mana + gf.mana + dn.mana) * p("mana"),
        cultivate: B.cultivate * f,
        speed:   B.speed * f + eq.speed,
        hit:     (B.hit * f + eq.hit + gf.hit + dn.hit) * p("hit"),
        dodge:   (B.dodge * f + eq.dodge + gf.dodge + dn.dodge) * p("dodge"),
        crit:    Math.min(DATA.CRIT_CAP, F.crit + eq.crit + dn.crit),
      };
    },
  },
});
