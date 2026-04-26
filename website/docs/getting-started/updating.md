---
sidebar_position: 3
title: "更新与卸载"
description: "如何将 Hermes Agent 更新到最新版本或卸载它"
---

# 更新与卸载

## 更新

使用一条命令更新到最新版本：

```bash
hermes update
```

这会拉取最新代码、更新依赖项，并提示你配置自上次更新以来添加的新选项。

:::tip
`hermes update` 会自动检测新的配置选项并提示你添加。如果你跳过了该提示，可以手动运行 `hermes config check` 查看缺失的选项，然后运行 `hermes config migrate` 交互式添加它们。
:::

### 更新期间发生了什么

当你运行 `hermes update` 时，会执行以下步骤：

1. **Git pull** — 从 `main` 分支拉取最新代码并更新子模块
2. **依赖安装** — 运行 `uv pip install -e ".[all]"` 获取新增或变更的依赖
3. **配置迁移** — 检测自你的版本以来添加的新配置选项并提示你设置
4. **网关自动重启** — 如果网关服务正在运行（Linux 上的 systemd，macOS 上的 launchd），更新完成后会**自动重启**，使新代码立即生效

预期输出类似：

```
$ hermes update
Updating Hermes Agent...
📥 Pulling latest code...
Already up to date.  (or: Updating abc1234..def5678)
📦 Updating dependencies...
✅ Dependencies updated
🔍 Checking for new config options...
✅ Config is up to date  (or: Found 2 new options — running migration...)
🔄 Restarting gateway service...
✅ Gateway restarted
✅ Hermes Agent updated successfully!
```

### 推荐的更新后验证

`hermes update` 处理了主要的更新路径，但快速验证可以确认一切正常：

1. `git status --short` — 如果工作树意外变脏，在继续之前检查
2. `hermes doctor` — 检查配置、依赖和服务健康状况
3. `hermes --version` — 确认版本号已按预期更新
4. 如果你使用网关：`hermes gateway status`
5. 如果 `doctor` 报告 npm audit 问题：在标记的目录中运行 `npm audit fix`

:::warning 更新后工作树变脏
如果 `hermes update` 后 `git status --short` 显示意外变更，请在继续之前停止并检查。这通常意味着本地修改被重新应用到更新后的代码上，或依赖步骤刷新了锁文件。
:::

### 如果你的终端在更新中断开连接

`hermes update` 自身具有防止意外终端丢失的保护：

- 更新忽略 `SIGHUP`，因此关闭 SSH 会话或终端窗口不再会在安装过程中杀死它。`pip` 和 `git` 子进程继承此保护，因此 Python 环境不会因连接断开而处于半安装状态。
- 更新运行期间，所有输出都会同步到 `~/.hermes/logs/update.log`。如果你的终端消失，重新连接并检查日志以查看更新是否完成以及网关重启是否成功：

```bash
tail -f ~/.hermes/logs/update.log
```

- `Ctrl-C`（SIGINT）和系统关机（SIGTERM）仍然有效——这些是故意的取消，不是意外。

你不再需要将 `hermes update` 包装在 `screen` 或 `tmux` 中来应对终端断开。

### 检查当前版本

```bash
hermes version
```

在 [GitHub releases 页面](https://github.com/NousResearch/hermes-agent/releases)与最新版本进行比较。

### 从消息平台更新

你也可以直接从 Telegram、Discord、Slack 或 WhatsApp 发送以下内容来更新：

```
/update
```

这会拉取最新代码、更新依赖并重启网关。机器人会在重启期间短暂离线（通常 5-15 秒），然后恢复。

### 手动更新

如果你是手动安装的（不是通过快速安装程序）：

```bash
cd /path/to/hermes-agent
export VIRTUAL_ENV="$(pwd)/venv"

# 拉取最新代码和子模块
git pull origin main
git submodule update --init --recursive

# 重新安装（获取新依赖）
uv pip install -e ".[all]"
uv pip install -e "./tinker-atropos"

# 检查新配置选项
hermes config check
hermes config migrate   # 交互式添加缺失的选项
```

### 回滚说明

如果更新引入了问题，你可以回滚到之前的版本：

```bash
cd /path/to/hermes-agent

# 列出最近的版本
git log --oneline -10

# 回滚到特定提交
git checkout <commit-hash>
git submodule update --init --recursive
uv pip install -e ".[all]"

# 如果正在运行，重启网关
hermes gateway restart
```

回滚到特定发布标签：

```bash
git checkout v0.6.0
git submodule update --init --recursive
uv pip install -e ".[all]"
```

:::warning
如果添加了新选项，回滚可能会导致配置不兼容。回滚后运行 `hermes config check`，如果遇到错误，请从 `config.yaml` 中删除无法识别的选项。
:::

### Nix 用户说明

如果你通过 Nix flake 安装，更新通过 Nix 包管理器管理：

```bash
# 更新 flake 输入
nix flake update hermes-agent

# 或使用最新版本重建
nix profile upgrade hermes-agent
```

Nix 安装是不可变的——回滚由 Nix 的代际系统处理：

```bash
nix profile rollback
```

更多详情请参阅 [Nix 设置](./nix-setup.md)。

---

## 卸载

```bash
hermes uninstall
```

卸载程序会给你保留配置文件（`~/.hermes/`）的选项，以便将来重新安装。

### 手动卸载

```bash
rm -f ~/.local/bin/hermes
rm -rf /path/to/hermes-agent
rm -rf ~/.hermes            # 可选——如果你计划重新安装则保留
```

:::info
如果你将网关安装为系统服务，请先停止并禁用它：
```bash
hermes gateway stop
# Linux: systemctl --user disable hermes-gateway
# macOS: launchctl remove ai.hermes.gateway
```
:::
