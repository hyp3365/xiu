/* =====================================================================
 * 核心：游戏主体 G
 * ---------------------------------------------------------------------
 * 所有玩法都写成“模块”，放在 js/modules/ 下，用 G.module({...}) 注册：
 *
 *   G.module({
 *     id: "liandan",                 // 模块名
 *     tab: "liandan",                // （可选）底部标签对应的页面
 *     defaults: () => ({ ... }),     // （可选）新存档时该模块需要的字段
 *     tick(offline) { ... },         // （可选）每 10 秒执行一次；离线也会补算
 *     view() { return "<html>"; },   // （可选）页面内容
 *   });
 *
 * 每 10 秒 G 会依次调用所有模块的 tick()。
 * 打开网页时，会按“离开的时间 ÷ 10 秒”把 tick 全部补算一遍，
 * 所以以后加炼丹、炼器，只要写在 tick 里，离线就会自动继续进行。
 * ===================================================================== */
const G = {
  s: null,             // 当前存档（整个游戏状态都在这里，会存到服务器）
  modules: [],         // 已注册的模块
  views: {},           // 标签页 → 渲染函数
  tab: "cultivate",    // 当前底部标签
  silent: false,       // 离线补算时为 true，不刷新界面
  _ver: 0, _cache: null,
  _lastTick: 0, _lastUpload: 0, _dirtySave: false,

  /* ---------- 模块注册 ---------- */
  module(m) {
    this.modules.push(m);
    if (m.tab && m.view) this.views[m.tab] = m.view;
    if (m.api) Object.assign(this, m.api); // 模块对外的函数挂到 G 上，按钮用 G.xxx() 调用
  },

  /* ---------- 属性缓存：状态变化后调用 dirty() 让属性重新计算 ---------- */
  dirty() { this._ver++; this._cache = null; },
  calc() {
    if (!this._cache) {
      this._cache = { stats: this.computeStats() };   // 先算属性
      this._cache.speed = this.computeSpeed();         // 修炼速度依赖属性（神识）
    }
    return this._cache;
  },
  stats() { return this.calc().stats; },
  speed() { return this.calc().speed; },

  /* ---------- 当前时间 ----------
   * 离线补算时返回“模拟时间”，所以按时间计算的功能（功法参悟、事务堂）
   * 写成 G.now() 而不是 Date.now()，离线就能正确补算。 */
  _simNow: 0,
  now() { return this._simNow || Date.now(); },

  /* ---------- 日志 ---------- */
  log(m, c = "") {
    if (this.silent) return;
    this.s.log.unshift({ m, c });
    if (this.s.log.length > 60) this.s.log.length = 60;
    this.renderLog();
    // 信息栏只在修炼页显示，其他页面用浮动提示
    if (this.tab !== "cultivate") {
      const t = $("#toast"); if (!t) return;
      t.innerHTML = `<p class="${c}">${m}</p>`; t.classList.add("show");
      clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove("show"), 2500);
    }
  },

  /* ---------- 存档 ---------- */
  newSave(name, root) {
    let s = { v: 5, name, root, last: Date.now(), log: [] };
    for (const m of this.modules) if (m.defaults) Object.assign(s, m.defaults());
    return s;
  },
  // 旧存档缺字段时，用模块默认值补上（以后加新功能不会坏档）
  migrate(s) {
    for (const m of this.modules) if (m.defaults) {
      const d = m.defaults();
      for (const k in d) if (s[k] === undefined) s[k] = d[k];
    }
    return s;
  },
  save(force) {
    this.s.last = Date.now();
    localStorage.setItem("xiu_local_" + API.user, JSON.stringify(this.s)); // 本地备份
    this._dirtySave = true;
    if (force || Date.now() - this._lastUpload > 30000) this.upload();
  },
  async upload() {
    if (!API.token || !this._dirtySave) return;
    this._dirtySave = false; this._lastUpload = Date.now();
    try { await API.upload(this.s); this.setSync("已同步"); }
    catch (e) { this._dirtySave = true; this.setSync("同步失败"); if (/登录/.test(e.message)) this.relogin(); }
  },
  setSync(t) { const el = $("#sync"); if (el) el.textContent = t; },

  /* ---------- 每 10 秒的结算 ---------- */
  tickAll(offline) {
    for (const m of this.modules) if (m.tick) m.tick.call(this, offline);
  },

  // 离线补算：离开多久就补多久，不封顶
  offline() {
    const sec = (Date.now() - this.s.last) / 1000;
    let n = Math.floor(sec / DATA.TICK);
    if (n < 1) return;
    const before = { exp: this.s.exp, ling: this.s.ling, stone: this.s.stone };
    this.silent = true;
    const MAX = 3e6; // 安全上限（约 347 天），防止浏览器卡死
    const runs = Math.min(n, MAX);
    const t0 = this.s.last;
    for (let i = 0; i < runs; i++) { this._simNow = t0 + (i + 1) * DATA.TICK * 1000; this.tickAll(true); }
    this._simNow = 0;
    this.silent = false;
    this.s.last = Date.now() - (sec % DATA.TICK) * 1000;
    const parts = [];
    if (this.s.exp > before.exp) parts.push(`修为 +${U.fmt(this.s.exp - before.exp)}`);
    if (this.s.stone !== before.stone) parts.push(`灵石 ${this.s.stone > before.stone ? "+" : "-"}${U.fmt(Math.abs(this.s.stone - before.stone))}`);
    this.log(`你离开了 ${U.dur(sec)}，${this.s.explore ? "自动探索未曾停歇" : this.s.auto ? "自动修炼未曾停歇" : "聚灵阵仍在运转"}${parts.length ? "：" + parts.join("，") : ""}。`, "gold");
    this.dirty();
  },

  /* ---------- 主循环（每 0.2 秒检查一次） ---------- */
  loop() {
    if (this._stopped) return;
    const now = Date.now();
    if (now - this._lastTick >= DATA.TICK * 1000) {
      this._lastTick = now;
      this.tickAll(false);
      this.save();
      this.render();
    }
    // 修炼进度条（10 秒走满）
    const pct = Math.min(100, (now - this._lastTick) / (DATA.TICK * 10)) + "%";
    const tb = $("#tick-bar");
    if (tb) tb.style.width = this.isCultivating() && this.canCultivate() ? pct : "0%";
    const gb = $("#gather-bar"); // 洞府聚灵阵进度条（一直聚灵）
    if (gb) gb.style.width = pct;
    const tl = $("#tick-left");  // 本次修炼倒计时
    if (tl) tl.textContent = Math.max(0, Math.ceil(DATA.TICK - (now - this._lastTick) / 1000)) + " 秒";
  },

  /* ---------- 操作后统一调用：重算属性、存档、刷新 ---------- */
  after() {
    this.dirty();
    const st = this.stats();
    this.s.hp = Math.min(this.s.hp, st.hp);
    this.s.mana = Math.min(this.s.mana, st.mana);
    this.save();
    this.render();
  },

  /* ---------- 界面 ---------- */
  render() {
    const s = this.s; if (!s || this.silent) return;
    $("#p-name").textContent = s.name;
    $("#p-realm").textContent = this.realmName();
    $("#p-exp").textContent = `${U.fmt(s.exp)} / ${U.fmt(this.needExp())}`;
    $("#p-stone").textContent = U.fmt(s.stone);
    $("#exp-bar").style.width = Math.min(100, s.exp / this.needExp() * 100) + "%";
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === this.tab));
    // 顶部（道号、修为、灵石）和信息栏只在修炼页显示
    const main = this.tab === "cultivate";
    $("#top").style.display = main ? "" : "none";
    $("#log-wrap").style.display = main ? "" : "none";
    const v = $("#view"), top = v.scrollTop;
    v.innerHTML = this.views[this.tab] ? this.views[this.tab].call(this) : "";
    v.scrollTop = top;
  },
  renderLog() { $("#log").innerHTML = this.s.log.map(l => `<p class="${l.c}">${l.m}</p>`).join(""); },
  modal(html) { $("#modal-box").innerHTML = html; $("#modal").classList.remove("hidden"); },
  closeModal() { $("#modal").classList.add("hidden"); },

  /* ---------- 启动 ---------- */
  start() {
    this.dirty();
    this._lastTick = Date.now();
    this.save(true); this.render(); this.renderLog();
    setInterval(() => this.loop(), 200);
    // 倒计时刷新（只在有倒计时的页面）
    setInterval(() => { if (this.s && this.s.explore) this.advanceExplore(); }, 1000); // 自动探索每秒走一步
    setInterval(() => { if ((this.tab === "gongfa" && this.s.gfStudy) || (this.tab === "sect" && this.sectTab === "affair") || (this.tab === "world" && this.s.explore)) this.render(); }, 1000);
    // 切到后台 / 关闭页面时立即上传
    document.addEventListener("visibilitychange", () => { if (document.hidden && !this._stopped) { this.save(); API.beacon(this.s); } });
    window.addEventListener("pagehide", () => { if (!this._stopped) API.beacon(this.s); });
  },

  init() {
    document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
      this.tab = b.dataset.tab; $("#view").scrollTop = 0; this.render();
    });
    $("#modal").onclick = e => { if (e.target.id === "modal" && this.s && !this._lockModal) this.closeModal(); };
    this.showLogin(); // 见 modules/account.js
  },
};
