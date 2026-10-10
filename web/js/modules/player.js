/* =====================================================================
 * 模块：人物（境界、属性、气血法力自动恢复）
 * ---------------------------------------------------------------------
 * 属性计算公式（computeStats）：
 *   气血 = (基础×成长^层序 + 装备 + 真经) × (1 + 装备气血%)
 *   攻击 =  基础×成长^层序 + 装备 + 功诀
 *   防御 =  基础×成长^层序 + 装备 + 心法
 *   法力 =  基础×成长^层序 + 法诀
 *   （功法加成都是固定数值）
 *   神识 =  基础×成长^层序 × (1 + 装备神识%)
 *   速度 / 闪避 / 暴击：固定基础值 + 装备 + 身法，不随境界成长
 * ===================================================================== */
G.module({
  id: "player",

  defaults: () => ({
    L: 0,        // 总层序（境界×10+层）
    exp: 0,      // 当前修为
    hp: 100,     // 当前气血
    mana: 50,    // 当前法力
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
    needExp() { return DATA.needExp(this.s.L); },
    realmName(L = this.s.L) { return DATA.realms[Math.floor(L / 10)] + "期" + DATA.layerNames[L % 10]; },
    root() { return DATA.roots.find(r => r.id === this.s.root); },

    // 汇总装备加成
    equipTotal() {
      const add = { atk: 0, hp: 0, def: 0, crit: 0, dodge: 0, speed: 0, ssPct: 0, hpPct: 0 };
      for (const sl in this.s.equip) {
        const e = this.s.equip[sl];
        if (e) { const st = this.equipStats(e); for (const k in st) add[k] += st[k]; }
      }
      return add;
    },

    computeStats() {
      const L = this.s.L, f = Math.pow(DATA.GROW, L), B = DATA.playerBase, F = DATA.playerFixed;
      const eq = this.equipTotal(), gf = this.gongfaBonus(); // gongfaBonus 见 modules/gongfa.js
      return {
        hp:      (B.hp * f + eq.hp + gf.hp) * (1 + eq.hpPct / 100),
        atk:     B.atk * f + eq.atk + gf.atk,
        def:     B.def * f + eq.def + gf.def,
        mana:    B.mana * f + gf.mana,
        shenshi: B.shenshi * f * (1 + eq.ssPct / 100),
        speed:   F.speed + eq.speed,
        dodge:   Math.min(DATA.DODGE_CAP, F.dodge + eq.dodge + gf.dodge),
        crit:    Math.min(DATA.CRIT_CAP, F.crit + eq.crit),
      };
    },
  },
});
