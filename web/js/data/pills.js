/* =====================================================================
 * 数据：丹药
 * ---------------------------------------------------------------------
 * 丹药只增加修炼速度，不会直接给修为。
 * 每种丹药每个大境界都有一个品质（grade = 境界序号）。
 * 规则：品质为某境界的丹药，只能该境界及以下的修士服用。
 *   例：筑基品质聚气丹，练气期、筑基期可服；金丹期不可服。
 * pct：练气品质时的修炼速度加成（%），每高一个品质 ×(1 + GRADE_STEP)
 * dur：持续多少次修炼（每次 10 秒，180 次 = 30 分钟）
 * price：练气品质在坊市的价格，每高一个品质 ×PRICE_STEP
 * ===================================================================== */
DATA.pills = {
  juqi:    { name: "聚气丹", pct: 30,  dur: 180, price: 60,  desc: "增加修炼速度" },
  juling:  { name: "聚灵丹", pct: 70,  dur: 180, price: 200, desc: "大幅增加修炼速度" },
  peiyuan: { name: "培元丹", pct: 150, dur: 180, price: 700, desc: "极大增加修炼速度" },
};
DATA.PILL_GRADE_STEP = 0.5;
DATA.PILL_PRICE_STEP = 1.8;

DATA.pillPct = (type, grade) => DATA.pills[type].pct * (1 + grade * DATA.PILL_GRADE_STEP);
DATA.pillPrice = (type, grade) => Math.floor(DATA.pills[type].price * Math.pow(DATA.PILL_PRICE_STEP, grade));
