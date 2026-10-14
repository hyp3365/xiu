/* =====================================================================
 * 模块：战斗设置（世界 → 战斗）
 * ---------------------------------------------------------------------
 * 存档 s.bset：
 *   r       第一 ~ 三回合（每回合第一次出手）：[ "auto" 按出手方式 / "atk" 普通攻击 / "sp:法术id" / "fb:法宝栏序号" ] × 3
 *   mode    出手方式："rot" 法术、法宝轮流 / "sp" 优先法术 / "fb" 优先法宝 / "max" 伤害最高优先 / "cheap" 消耗最低优先 / "list" 按列表顺序
 *   order   列表顺序 [key]（「按列表顺序」用）
 *   lowPct  气血低于百分之几时（0 = 不用）……
 *   lowKey  ……先用这个法宝 / 法术（例如盾）；可以动用保留的法力
 *   keep    保留法力 %：平时出招后法力不能低于法力上限的这个比例（留给第一回合和低血时用）
 *   off     不使用的法术 / 法宝 [key]
 * 战斗逻辑在 world.js 的 battle()。
 * ===================================================================== */
G.module({
  id: "battleset",

  defaults: () => ({ bset: { r: ["auto", "auto", "auto"], mode: "rot", lowPct: 0, lowKey: "", keep: 0, off: [], order: [] } }),

  api: {
    bsetGet() {
      const b = this.s.bset || (this.s.bset = {});
      if (!Array.isArray(b.off)) b.off = [];
      if (!Array.isArray(b.order)) b.order = [];
      if (!Array.isArray(b.r)) { b.r = [b.first || "auto", "auto", "auto"]; delete b.first; }   // 旧存档：只有第一回合
      if (!["rot", "sp", "fb", "max", "cheap", "list"].includes(b.mode)) b.mode = "rot";
      return b;
    },
    // 列表顺序：现有招式按 order 排，没排过的放后面
    bsetSorted() { const b = this.bsetGet(), acts = this.bsetActs(), ix = a => { const i = b.order.indexOf(a.key); return i < 0 ? 999 + acts.indexOf(a) : i; };
      return acts.slice().sort((x, y) => ix(x) - ix(y)); },
    bsetMove(key, dir) {
      const b = this.bsetGet(), L = this.bsetSorted().map(a => a.key), i = L.indexOf(key), j = i + dir;
      if (i < 0 || j < 0 || j >= L.length) return;
      [L[i], L[j]] = [L[j], L[i]]; b.order = L; this.dirty(); this.render();
    },
    bsetRound(i, v) { this.bsetGet().r[i] = v; this.dirty(); this.render(); },
    // 现在法术栏、法宝栏里生效的招式 [{ key, name, shield }]
    bsetActs() {
      const s = this.s, n = this.slotCount(), out = [];
      s.spellSlots.slice(0, n).forEach(id => { const g = id && DATA.spellInfo(id, s.gongfa[id]); if (g) out.push({ key: "sp:" + id, name: `法术·${g.name}` }); });
      s.fabao.slice(0, n).forEach((e, i) => { if (e && e.attrs) { const f = DATA.fabaoInfo(e); out.push({ key: "fb:" + i, name: `法宝·${f.name}`, shield: !!f.shield }); } });
      return out;
    },
    bsetSet(k, v) { const b = this.bsetGet(); b[k] = k === "lowPct" || k === "keep" ? Math.max(0, Math.min(100, Math.floor(+v || 0))) : v; this.dirty(); this.render(); },
    bsetToggle(key) { const b = this.bsetGet(), i = b.off.indexOf(key); if (i >= 0) b.off.splice(i, 1); else b.off.push(key); this.dirty(); this.render(); },
    bsetView() {
      const b = this.bsetGet(), acts = this.bsetActs(), esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      const opt = (opts, cur) => opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(cur || "") ? "selected" : ""}>${esc(t)}</option>`).join("");
      const sel = (k, opts) => `<select onchange="G.bsetSet('${k}',this.value)">${opt(opts, b[k])}</select>`;
      const num = k => `<input type="number" min="0" max="100" value="${b[k] || 0}" onchange="G.bsetSet('${k}',this.value)" style="width:5em">%`;
      const lost = key => key && key !== "auto" && key !== "atk" && !acts.some(a => a.key === key) ? `<small class="q5">已不在法术栏 / 法宝栏</small>` : "";
      const actOpts = acts.map(a => [a.key, a.name]);
      return `<div class="card"><h3>战斗设置</h3>
        ${["第一回合", "第二回合", "第三回合"].map((t, i) => `<div class="line"><div>${t}${lost(b.r[i])}</div><select onchange="G.bsetRound(${i},this.value)">${opt([["auto", "按出手方式"], ["atk", "普通攻击"], ...actOpts], b.r[i])}</select></div>`).join("")}
        <div class="line"><div>出手方式</div>${sel("mode", [["rot", "法术、法宝轮流"], ["sp", "优先法术"], ["fb", "优先法宝"], ["max", "伤害最高优先"], ["cheap", "消耗最低优先"], ["list", "按列表顺序"]])}</div>
        <div class="line"><div>气血低于</div>${num("lowPct")}</div>
        <div class="line"><div>先使用${lost(b.lowKey)}</div>${sel("lowKey", [["", "不使用"], ...acts.filter(a => a.shield).map(a => [a.key, a.name]), ...acts.filter(a => !a.shield).map(a => [a.key, a.name])])}</div>
        <div class="line"><div>保留法力</div>${num("keep")}</div></div>
        <div class="card"><h3>法术、法宝列表</h3>${this.bsetSorted().map((a, i, L) => { const on = !b.off.includes(a.key), k = esc(a.key);
          return `<div class="line"><div>${i + 1}. ${esc(a.name)}</div><div><button class="sm" onclick="G.bsetMove('${k}',-1)" ${i ? "" : "disabled"}>↑</button><button class="sm" onclick="G.bsetMove('${k}',1)" ${i < L.length - 1 ? "" : "disabled"}>↓</button><button class="sm ${on ? "on" : ""}" onclick="G.bsetToggle('${k}')">${on ? "使用" : "不使用"}</button></div></div>`; }).join("")}</div>`;
    },
  },
});
