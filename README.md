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
