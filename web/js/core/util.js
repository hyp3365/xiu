/* =====================================================================
 * 核心：通用工具函数
 * ===================================================================== */
const $ = s => document.querySelector(s);

const U = {
  // a~b 之间的随机整数（含两端）
  rand: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
  // 从数组里随机取一个
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  // 按权重随机，返回下标
  weighted(ws) {
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ws.length; i++) if ((r -= ws[i]) < 0) return i;
    return 0;
  },
  // 大数字显示：万、亿、兆、京……
  UNITS: [[1e48, "极"], [1e44, "载"], [1e40, "正"], [1e36, "涧"], [1e32, "沟"], [1e28, "穰"],
          [1e24, "秭"], [1e20, "垓"], [1e16, "京"], [1e12, "兆"], [1e8, "亿"], [1e4, "万"]],
  fmt(n) {
    if (!isFinite(n)) return "∞";
    n = Math.floor(n);
    if (n >= 1e52) return n.toExponential(2).replace("e+", "e");
    for (const [v, u] of U.UNITS) if (n >= v) { const x = (n / v).toFixed(n / v >= 100 ? 0 : 2); return (x.includes(".") ? x.replace(/\.?0+$/, "") : x) + u; } // 只去掉小数部分末尾的 0（400万 不能变成 4万）
    return String(n);
  },
  // 小数字保留 1 位小数（如 1.6），大数字同 fmt
  num(n) { return n < 100 ? String(Math.floor(n * 10) / 10) : U.fmt(n); },
  // 秒数 → “X天X小时X分”
  dur(sec) {
    sec = Math.floor(sec);
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
    return (d ? d + "天" : "") + (h ? h + "小时" : "") + (m || (!d && !h) ? m + "分钟" : "");
  },
};
