/* =====================================================================
 * 数据：境界 & 人物成长
 * ---------------------------------------------------------------------
 * 改境界名字、层数、修为需求、每层属性成长，都在这个文件里。
 * 总层序 L：境界序号 × 10 + 层(0~9)。例如 筑基期三层 = 1*10 + 2 = 12
 * ===================================================================== */
window.DATA = window.DATA || {};

// 24 个大境界（顺序即进阶顺序；v21 改）
// 名字在 config/names.js 的 realm（这里是原名）
DATA.NM_DEF.realm = [
  "练气", "筑基", "金丹", "元婴", "出窍", "化神", "练虚", "合体", "洞真", "大乘", "渡劫",
  "散仙", "游仙", "地仙", "天仙", "金仙", "太乙金仙", "大罗金仙", "玄仙", "仙君", "帝仙", "准圣", "天道圣人", "大道圣人",
];
DATA.realms = DATA.nmArr(CFG.names.realm, DATA.NM_DEF.realm);
// 显示：序号 → "练气期" / "散仙"（仙人以上不加「期」）；-1 = 凡人
DATA.REALM_TEXT = { mortal: DATA.nmPick(CFG.names.realmText, "mortal", "凡人"), suffix: DATA.nmPick(CFG.names.realmText, "suffix", "期") };
DATA.realmLabel = i => i < 0 ? DATA.REALM_TEXT.mortal : DATA.realms[i] + (i <= 10 ? DATA.REALM_TEXT.suffix : "");
// v21 之前的 18 境界序号 → 现在的序号（旧存档转换用）
DATA.REALM_V1_MAP = [0, 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 16, 17, 21, 22, 23];

// 每个大境界的层数
DATA.LAYERS = 10;
DATA.layerNames = DATA.nmArr(CFG.names.layer, ["一层", "二层", "三层", "四层", "五层", "六层", "七层", "八层", "九层", "十层"]);
// 法宝的境界倍率（config/forge.js 的 DMG_REALM / MANA_REALM）按境界名写：境界改名后把键换成新名
for (const k of ["DMG_REALM", "MANA_REALM"]) {
  const o = ((CFG.forge || {}).fabao || {})[k];
  if (!o || Array.isArray(o)) continue;
  const ent = Object.keys(o).map(n => { const i = DATA.NM_DEF.realm.indexOf(n); return [i >= 0 ? DATA.realms[i] : n, o[n]]; });
  Object.keys(o).forEach(n => delete o[n]); ent.forEach(([n, v]) => { o[n] = v; });
}

/* 以下数值都来自 js/config/ 下的数值文件（数值设置文件），这里只做计算 */
const _R = CFG.realm, _P = CFG.player;
// 每层需要的修为：练气一层→二层 FIRST_EXP，之后每层 × EXP_RATE
DATA.needExp = L => _R.FIRST_EXP * Math.pow(_R.EXP_RATE, L);
DATA.MORTAL_EXP = _R.MORTAL_EXP; // 凡人 → 练气一层

// 人物属性（base 随境界 × GROW；fixed 不随境界）
DATA.GROW = _P.GROW;
DATA.playerBase = _P.base;
DATA.playerFixed = _P.fixed;
// 闪避几率 % = (防守方闪避 - 进攻方命中) ÷ 进攻方命中 × 100 ÷ DODGE_DIV，最低 0，最高 DODGE_CAP
DATA.DODGE_CAP = _P.DODGE_CAP;
DATA.dodgeChance = (hit, dodge) => Math.min(_P.DODGE_CAP, Math.max(0, (dodge - hit) / Math.max(1, hit) * 100 / _P.DODGE_DIV));
DATA.CRIT_CAP = _P.CRIT_CAP;


/* 突破：小境界 100%；大境界成功率随境界降低，失败损失部分修为 */
DATA.majorBreakChance = realmIndex => Math.max(_R.MAJOR_MIN, _R.MAJOR_BASE - realmIndex * _R.MAJOR_DROP);
DATA.MAJOR_FAIL_LOSS = _R.MAJOR_FAIL_LOSS;

// 修炼节奏：每 10 秒结算一次
DATA.TICK = 10;
