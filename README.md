# 问道长生 · 文字修仙

手机网页文字修仙放置游戏。账号登录，存档保存在服务器，离线也会继续修炼。

## 一键安装（Debian / Ubuntu）

```bash
curl -fsSL https://raw.githubusercontent.com/hyp3699/xiu/main/deploy/install.sh | sudo bash
```

装好后访问 `https://你的IP或域名/xiuxian/`

## 更新

改完代码推到 GitHub 后，在服务器上运行：

```bash
sudo xiu-update
```

会自动拉取最新代码并重启存档服务。玩家存档在 `/var/lib/xiu/xiu.db`，更新不会丢档。

## 目录结构

```
web/                       网页（前端）
├─ index.html              页面骨架 + 脚本加载顺序
├─ css/style.css           样式（手机优先）
└─ js/
   ├─ data/                ★ 数值和内容，平时改这里就够了
   │  ├─ realms.js         境界名、层数、修为需求、属性成长、突破成功率
   │  ├─ roots.js          灵根
   │  ├─ pills.js          丹药（聚气丹 / 聚灵丹 / 培元丹）
   │  ├─ cave.js           聚灵阵数值（倍率、升级花费、满级 3000）
   │  ├─ sects.js          90 个门派（1~9 星）、练功房
   │  ├─ gongfa.js         六类功法（心法/功诀/真经/秘诀/身法/法诀）
   │  ├─ items.js          装备、法宝、背包格子
   │  └─ maps.js           历练地图、怪物、掉落
   ├─ core/                核心框架
   │  ├─ util.js           工具函数（数字显示等）
   │  ├─ api.js            登录、云存档接口
   │  └─ game.js           主循环、离线补算、存档、模块注册
   └─ modules/             各个玩法，一个文件一个
      ├─ player.js         人物属性、气血法力恢复
      ├─ cave.js           洞府 · 聚灵阵
      ├─ bag.js            背包、装备
      ├─ gongfa.js         功法页
      ├─ sect.js           门派、练功房、藏经阁
      ├─ cultivate.js      修炼、突破、丹药
      ├─ world.js          世界：历练地图、坊市、设置
      └─ account.js        登录注册、创建角色
server/server.py           存档服务器（纯 Python 标准库，SQLite）
deploy/                    安装脚本、更新命令、systemd、nginx 配置
```

## 加一个新玩法（比如炼丹）

1. 新建 `web/js/modules/liandan.js`：

```js
G.module({
  id: "liandan",
  tab: "liandan",                       // 底部标签名
  defaults: () => ({ furnace: null }),  // 存档里需要的字段（老存档会自动补上）
  tick(offline) {                       // 每 10 秒执行；离线时也会补算
    // 例如：炼丹进度 +1，满了就出丹
  },
  api: {                                 // 按钮调用：onclick="G.startLiandan()"
    startLiandan() { /* ... */ this.after(); },
  },
  view() { return `<div class="card">丹炉</div>`; },
});
```

2. 在 `index.html` 里加一行 `<script src="js/modules/liandan.js"></script>`，底部 `#tabs` 加一个按钮。

写在 `tick` 里的东西，玩家离线期间会自动继续进行。

## 规则速查

- 18 个大境界，每境界 10 层；练气一层→二层 10 修为，之后每层翻倍
- 每 10 秒修炼一次，消耗灵气 1:1 转修为；可开关自动修炼
- 修为满必须手动突破；大境界有成功率
- 修炼速度 = 神识 × 灵根 × (1+秘诀%) × 聚灵阵倍率 × (1+丹药%) × (1+练功房%)
- 聚灵阵速度只随聚灵阵等级提升，与境界无关
- 境界提升：少量增加气血、攻击、防御、法力、神识；闪避、暴击不随境界增长
- 气血、法力每 10 秒恢复 1%
- 丹药只加修炼速度；某境界品质的丹药只能该境界及以下服用
