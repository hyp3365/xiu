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
 *   抗性（金木水火土雷各一）= RES_BASE×成长^层序 + 本系真诀；法术伤害按 防御 + 对应抗性 抵消
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
    const R = this.regen(false);   // 平时恢复：每 10 秒 % 上限
    if (s.hp < st.hp) s.hp = Math.min(st.hp, s.hp + st.hp * R.hp / 100);
    if (s.mana < st.mana) s.mana = Math.min(st.mana, s.mana + st.mana * R.mana / 100);
  },

  api: {
    r() { return Math.floor(this.s.L / DATA.LAYERS); },          // 当前大境界序号
    layer() { return this.s.L % DATA.LAYERS; },
    // 境界够不够：req = -1 凡人即可，否则需要（非凡人且）大境界 ≥ req
    // v21：18 境界 → 24 境界。旧存档按原境界名字换算序号（层数不变），丹药、旧装备的境界品质一起换算
    fixRealmV2() {
      const s = this.s; if (s.realmV === 2) return;
      const M = i => DATA.REALM_V1_MAP[i] !== undefined ? DATA.REALM_V1_MAP[i] : i;
      s.L = M(Math.floor(s.L / DATA.LAYERS)) * DATA.LAYERS + s.L % DATA.LAYERS;
      const fe = e => { if (e && !e.cid && !e.attrs && e.g !== undefined) e.g = M(e.g); };
      (s.bag || []).forEach(it => { if (it.t === "pill") it.g = M(it.g); else if (it.t === "eq") fe(it.e); });
      Object.values(s.equip || {}).forEach(fe); (s.fabao || []).forEach(fe);
      if (s.trib && !s.trib.result) s.trib = null;
      s.realmV = 2; this.dirty && this.dirty();
    },
    realmOK(req) { return req < 0 || (!this.s.mortal && this.r() >= req); },                    // 当前层（0~9）
    needExp() { return this.s.mortal ? DATA.MORTAL_EXP : DATA.needExp(this.s.L); },
    realmName(L) {
      if (L === undefined) { if (this.s.mortal) return "凡人"; L = this.s.L; }
      return DATA.realmLabel(Math.floor(L / 10)) + DATA.layerNames[L % 10];
    },

    // 汇总装备加成
    equipTotal() {
      const add = { atk: 0, hp: 0, def: 0, mana: 0, crit: 0, hit: 0, dodge: 0, speed: 0, hpPct: 0, res: {} };
      const all = [...Object.values(this.s.equip), ...this.s.fabao.slice(0, this.slotCount())]; // 装备 + 法宝
      for (const e of all) if (e) {
        const st = this.equipStats(e);
        for (const k in st) {
          if (k === "res") { for (const el in st.res) add.res[el] = (add.res[el] || 0) + st.res[el]; }   // 自定义装备的抗性
          else if (k in add) add[k] += st[k];
        }
      }
      return add;
    },

    // 恢复百分比：battle = true 战斗中每回合，false 平时每 10 秒（config/player.js + 宗门秘法）
    regen(battle) {
      const m = this.mifaBonus();
      if (battle) return { hp: m.hpBattle, mana: m.mpBattle };   // 战斗中只有秘法恢复
      const b = CFG.player.REGEN_IDLE || {};
      return { hp: (b.hp || 0) + m.hpIdle, mana: (b.mana || 0) + m.mpIdle };
    },
    computeStats() {
      const L = this.s.L, f = Math.pow(DATA.GROW, L), B = DATA.playerBase, F = DATA.playerFixed;
      const eq = this.equipTotal(), gf = this.gongfaBonus(), dn0 = this.danBonus(), cu = this.customBonus();
      // 属性丹 + 自定义物品永久属性（content/items.js 里 type: "perm"）合在一起
      const dn = {}; for (const k of ["hp", "atk", "def", "mana", "hit", "dodge", "crit"]) dn[k] = (dn0[k] || 0) + (cu[k] || 0); // gongfaBonus 见 gongfa.js，danBonus（属性丹）见 craft.js
      return {
        hp:      (B.hp * f + eq.hp + gf.hp + dn.hp) * (1 + eq.hpPct / 100),
        atk:     B.atk * f + eq.atk + gf.atk + dn.atk,
        def:     B.def * f + eq.def + gf.def + dn.def,
        mana:    B.mana * f + eq.mana + gf.mana + dn.mana,
        cultivate: B.cultivate * f,
        speed:   B.speed * f + eq.speed + cu.speed,
        hit:     B.hit * f + eq.hit + gf.hit + dn.hit,
        dodge:   B.dodge * f + eq.dodge + gf.dodge + dn.dodge,
        crit:    Math.min(DATA.CRIT_CAP, F.crit + eq.crit + dn.crit),
        res:     Object.fromEntries(DATA.elements.map(e => [e.id, (CFG.player.RES_BASE || 0) * f + (gf.res[e.id] || 0) + (eq.res[e.id] || 0) + (cu.res[e.id] || 0)])),
      };
    },
  },
});
