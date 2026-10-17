# 文字修仙（纯ai开发）

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

## 一键卸载

删除全部玩家存档、日志、代码、服务和 nginx 配置，无法恢复：

```bash
sudo xiu-uninstall
```

或者（没装 xiu-uninstall 时）：

```bash
curl -fsSL https://raw.githubusercontent.com/hyp3365/xiu/main/deploy/uninstall.sh | sudo bash
```

## 日志

- 存档服务日志：`/var/lib/xiu/server.log`（不写系统日志）
- 网页更新日志：`/var/lib/xiu/update.log`
- 每次 `xiu-update` 时，超过 1MB 的日志只保留最后 200KB；nginx 不记录游戏的访问日志

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

