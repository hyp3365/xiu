/* =====================================================================
 * 数据：功法
 * ---------------------------------------------------------------------
 * 六大类功法，每类加成一种属性（固定数值，不是百分比）：
 *   心法 → 防御      功诀 → 攻击      真经 → 气血上限
 *   秘诀 → 修炼速度  身法 → 闪避      法诀 → 法力上限
 * 每个门派每类一部，名字 = 门派前缀 + 后缀，例如：
 *   青阳心法、青阳诀、青阳真经、青阳秘诀、青阳身法、青阳法诀
 *
 * 每部功法 12 层。在门派“功法殿”第一次学习消耗贡献，学会即为第 1 层。
 * 之后在“功法”页参悟提升层数，只花时间（离线也会计时），同时只能参悟一部。
 *
 * 加成数值 = 类别系数 × 门派强度 × 层数
 *   门派强度 = 成长^(门派入门层序 + 5)，星级越高越强（见 sectPower）
 *   身法（闪避）不随门派强度成长：0.25 × 星级 × 层数
 * ===================================================================== */
DATA.gongfaTypes = [
  { id: "xinfa",    name: "心法", suffix: "心法", stat: "def",       k: DATA.playerBase.def * 0.06,     label: "防御" },
  { id: "gongjue",  name: "功诀", suffix: "诀",   stat: "atk",       k: DATA.playerBase.atk * 0.06,     label: "攻击" },
  { id: "zhenjing", name: "真经", suffix: "真经", stat: "hp",        k: DATA.playerBase.hp * 0.06,      label: "气血上限" },
  { id: "mijue",    name: "秘诀", suffix: "秘诀", stat: "cultivate", k: DATA.playerBase.shenshi * 0.06, label: "修炼速度" },
  { id: "shenfa",   name: "身法", suffix: "身法", stat: "dodge",     k: 0,                              label: "闪避" },
  { id: "fajue",    name: "法诀", suffix: "法诀", stat: "mana",      k: DATA.playerBase.mana * 0.06,    label: "法力上限" },
];
DATA.GONGFA_MAX = 12;

// 参悟升级所需时间（分钟）：第 1 层 → 第 2 层 3 分钟 …… 第 11 层 → 第 12 层 15 小时
DATA.gongfaStudyMin = [3, 10, 30, 60, 120, 240, 360, 480, 600, 720, 900];

// 门派强度：星级越高，功法数值越大
DATA.sectPower = sect => Math.pow(DATA.GROW, sect.reqRealm * DATA.LAYERS + 5);

// 功法 id 规则："门派id:类别id"，例如 "s1_0:mijue"
DATA.gongfaId = (sectId, typeId) => `${sectId}:${typeId}`;

// 由 id 解析出功法信息；lv 为层数
DATA.gongfaInfo = (id, lv = 1) => {
  const [sectId, typeId] = id.split(":");
  const sect = DATA.sectById[sectId];
  const type = DATA.gongfaTypes.find(x => x.id === typeId);
  if (!sect || !type) return null;
  const value = type.stat === "dodge" ? 0.25 * sect.star * lv : type.k * DATA.sectPower(sect) * lv;
  return {
    id, sect, type, lv,
    name: sect.prefix + type.suffix,
    value,                          // 当前层的加成（固定数值）
    perLv: value / lv,              // 每层加成
    cost: 50 * sect.star * sect.star, // 功法殿首次学习所需贡献
  };
};
