/* =====================================================================
 * 数据：功法
 * ---------------------------------------------------------------------
 * 六大类功法，每类加成一种属性：
 *   心法 → 防御      功诀 → 攻击      真经 → 气血上限
 *   秘诀 → 修炼速度  身法 → 闪避      法诀 → 法力上限
 * 每个门派每类各有 5 重（共 30 部），名字 = 门派前缀 + 类名 + 第几重
 *   例：青阳心法·一重、青阳诀·三重、青阳秘诀·五重
 * 每类功法同时只能主修一部（生效一部）。
 *
 * 加成数值 = 类别基础值 × 门派星级 × 重数
 *   例：3 星门派的 秘诀·二重 → 修炼速度 +8 × 3 × 2 = +48%
 * 学习消耗门派贡献 = 20 × 星级 × 重数²
 * ===================================================================== */
DATA.gongfaTypes = [
  { id: "xinfa",  name: "心法", suffix: "心法", stat: "def",     unit: "%", base: 6,   label: "防御" },
  { id: "gongjue",name: "功诀", suffix: "诀",   stat: "atk",     unit: "%", base: 6,   label: "攻击" },
  { id: "zhenjing",name:"真经", suffix: "真经", stat: "hp",      unit: "%", base: 6,   label: "气血上限" },
  { id: "mijue",  name: "秘诀", suffix: "秘诀", stat: "cultivate",unit:"%", base: 8,   label: "修炼速度" },
  { id: "shenfa", name: "身法", suffix: "身法", stat: "dodge",   unit: "",  base: 0.4, label: "闪避" },
  { id: "fajue",  name: "法诀", suffix: "法诀", stat: "mana",    unit: "%", base: 6,   label: "法力上限" },
];
DATA.GONGFA_TIERS = 5;
DATA.tierNames = ["一重", "二重", "三重", "四重", "五重"];

// 功法 id 规则："门派id:类别id:重数"，例如 "qingyang:mijue:2"
DATA.gongfaId = (sectId, typeId, tier) => `${sectId}:${typeId}:${tier}`;

// 由 id 解析出完整功法信息（名字、加成、学习条件）
DATA.gongfaInfo = id => {
  const [sectId, typeId, t] = id.split(":");
  const sect = DATA.sectById[sectId];
  const type = DATA.gongfaTypes.find(x => x.id === typeId);
  const tier = Number(t);
  if (!sect || !type) return null;
  return {
    id, sect, type, tier,
    name: `${sect.prefix}${type.suffix}·${DATA.tierNames[tier - 1]}`,
    value: type.base * sect.star * tier,              // 加成数值
    cost: 20 * sect.star * tier * tier,                // 学习所需贡献
    reqRealm: Math.min(DATA.realms.length - 1, sect.reqRealm + Math.floor((tier - 1) / 2)), // 学习所需大境界
  };
};
