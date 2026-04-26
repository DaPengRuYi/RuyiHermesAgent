---
sidebar_position: 2
---

# 配置文件：运行多个代理

在同一台机器上运行多个独立的 Hermes 代理——每个都有自己的配置、API 密钥、记忆、会话、技能和网关状态。

## 什么是配置文件？

配置文件是一个独立的 Hermes 主目录。每个配置文件获得自己的目录，包含自己的 `config.yaml`、`.env`、`SOUL.md`、记忆、会话、技能、定时任务和状态数据库。配置文件允许你为不同目的运行独立的代理——编码助手、个人机器人、研究代理——而不混淆 Hermes 状态。

当你创建配置文件时，它会自动成为自己的命令。创建名为 `coder` 的配置文件，你立即拥有 `coder chat`、`coder setup`、`coder gateway start` 等命令。

## 快速开始

```bash
hermes profile create coder       # 创建配置文件 + "coder" 命令别名
coder setup                       # 配置 API 密钥和模型
coder chat                        # 开始聊天
```

就是这样。`coder` 现在是自己的 Hermes 配置文件，有自己的配置、记忆和状态。

## 创建配置文件

### 空白配置文件

```bash
hermes profile create mybot
```

创建一个全新的配置文件，已预设捆绑技能。运行 `mybot setup` 配置 API 密钥、模型和网关令牌。

### 仅克隆配置（`--clone`）

```bash
hermes profile create work --clone
```

将当前配置文件的 `config.yaml`、`.env` 和 `SOUL.md` 复制到新配置文件。相同的 API 密钥和模型，但全新的会话和记忆。编辑 `~/.hermes/profiles/work/.env` 使用不同的 API 密钥，或 `~/.hermes/profiles/work/SOUL.md` 使用不同的个性。

### 克隆所有内容（`--clone-all`）

```bash
hermes profile create backup --clone-all
```

复制**所有内容**——配置、API 密钥、个性、所有记忆、完整会话历史、技能、定时任务、插件。完整的快照。适用于备份或分叉已有上下文的代理。

### 从特定配置文件克隆

```bash
hermes profile create work --clone --clone-from coder
```

:::tip Honcho 记忆 + 配置文件
启用 Honcho 时，`--clone` 会自动为新配置文件创建专用的 AI 对等体，同时共享相同的用户工作区。每个配置文件建立自己的观察和身份。详见 [Honcho —— 多代理/配置文件](./features/memory-providers.md#honcho)。
:::

## 使用配置文件

### 命令别名

每个配置文件自动在 `~/.local/bin/<name>` 获得命令别名：

```bash
coder chat                    # 与 coder 代理聊天
coder setup                   # 配置 coder 的设置
coder gateway start           # 启动 coder 的网关
coder doctor                  # 检查 coder 的健康状态
coder skills list             # 列出 coder 的技能
coder config set model.model anthropic/claude-sonnet-4
```

别名适用于所有 hermes 子命令——底层只是 `hermes -p <name>`。

### `-p` 标志

你也可以对任何命令明确指定配置文件：

```bash
hermes -p coder chat
hermes --profile=coder doctor
hermes chat -p coder -q "你好"    # 在任何位置都有效
```

### 固定默认值（`hermes profile use`）

```bash
hermes profile use coder
hermes chat                   # 现在指向 coder
hermes tools                  # 配置 coder 的工具
hermes profile use default    # 切换回来
```

设置默认值，使普通的 `hermes` 命令指向该配置文件。类似 `kubectl config use-context`。

### 知道你在哪里

CLI 始终显示哪个配置文件处于活动状态：

- **提示符**：`coder ❯` 而不是 `❯`
- **横幅**：启动时显示 `Profile: coder`
- **`hermes profile`**：显示当前配置文件名称、路径、模型、网关状态

## 配置文件 vs 工作区 vs 沙箱

配置文件经常与工作区或沙箱混淆，但它们是不同的东西：

- **配置文件**给 Hermes 自己的状态目录：`config.yaml`、`.env`、`SOUL.md`、会话、记忆、日志、定时任务和网关状态。
- **工作区**或**工作目录**是终端命令启动的位置。这由 `terminal.cwd` 单独控制。
- **沙箱**是限制文件系统访问的东西。配置文件**不会**沙箱化代理。

在默认的 `local` 终端后端上，代理仍然拥有与你的用户帐户相同的文件系统访问权限。配置文件不会阻止它访问配置文件目录外的文件夹。

如果你想让配置文件在特定项目文件夹中启动，请在该配置文件的 `config.yaml` 中设置明确的绝对 `terminal.cwd`：

```yaml
terminal:
  backend: local
  cwd: /absolute/path/to/project
```

在本地后端使用 `cwd: "."` 表示"Hermes 启动的目录"，而不是"配置文件目录"。

另请注意：

- `SOUL.md` 可以引导模型，但不会强制执行工作区边界。
- 对 `SOUL.md` 的更改在新会话中生效。现有会话可能仍在使用旧的提示状态。
- 询问模型"你在哪个目录？"不是可靠的隔离测试。如果你需要工具的可预测起始目录，请明确设置 `terminal.cwd`。

## 运行网关

每个配置文件作为独立进程运行自己的网关，拥有自己的机器人令牌：

```bash
coder gateway start           # 启动 coder 的网关
assistant gateway start       # 启动 assistant 的网关（独立进程）
```

### 不同的机器人令牌

每个配置文件有自己的 `.env` 文件。在每个中配置不同的 Telegram/Discord/Slack 机器人令牌：

```bash
# 编辑 coder 的令牌
nano ~/.hermes/profiles/coder/.env

# 编辑 assistant 的令牌
nano ~/.hermes/profiles/assistant/.env
```

### 安全：令牌锁定

如果两个配置文件意外使用了相同的机器人令牌，第二个网关会被阻止，并显示明确的错误命名冲突的配置文件。支持 Telegram、Discord、Slack、WhatsApp 和 Signal。

### 持久服务

```bash
coder gateway install         # 创建 hermes-gateway-coder systemd/launchd 服务
assistant gateway install     # 创建 hermes-gateway-assistant 服务
```

每个配置文件获得自己的服务名称。它们独立运行。

## 配置配置文件

每个配置文件有自己的：

- **`config.yaml`** —— 模型、提供商、工具集、所有设置
- **`.env`** —— API 密钥、机器人令牌
- **`SOUL.md`** —— 个性和指令

```bash
coder config set model.model anthropic/claude-sonnet-4
echo "你是一个专注的编码助手。" > ~/.hermes/profiles/coder/SOUL.md
```

如果你想让此配置文件默认在特定项目中工作，还要设置自己的 `terminal.cwd`：

```bash
coder config set terminal.cwd /absolute/path/to/project
```

## 更新

`hermes update` 拉取代码一次（共享）并将新的捆绑技能同步到**所有**配置文件：

```bash
hermes update
# → 代码已更新（12 个提交）
# → 技能已同步：default（最新），coder（+2 个新技能），assistant（+2 个新技能）
```

用户修改的技能永远不会被覆盖。

## 管理配置文件

```bash
hermes profile list           # 显示所有配置文件及状态
hermes profile show coder     # 单个配置文件的详细信息
hermes profile rename coder dev-bot   # 重命名（更新别名 + 服务）
hermes profile export coder   # 导出为 coder.tar.gz
hermes profile import coder.tar.gz   # 从归档导入
```

## 删除配置文件

```bash
hermes profile delete coder
```

这会停止网关、移除 systemd/launchd 服务、移除命令别名并删除所有配置文件数据。你将被要求输入配置文件名称以确认。

使用 `--yes` 跳过确认：`hermes profile delete coder --yes`

:::note
你无法删除默认配置文件（`~/.hermes`）。要移除所有内容，请使用 `hermes uninstall`。
:::

## Tab 补全

```bash
# Bash
eval "$(hermes completion bash)"

# Zsh
eval "$(hermes completion zsh)"
```

将该行添加到你的 `~/.bashrc` 或 `~/.zshrc` 以获得持久补全。补全 `-p` 后的配置文件名称、配置文件子命令和顶层命令。

## 工作原理

配置文件使用 `HERMES_HOME` 环境变量。当你运行 `coder chat` 时，包装脚本在启动 hermes 前设置 `HERMES_HOME=~/.hermes/profiles/coder`。由于代码库中 119+ 个文件通过 `get_hermes_home()` 解析路径，Hermes 状态自动限定到配置文件的目录——配置、会话、记忆、技能、状态数据库、网关 PID、日志和定时任务。

这与终端工作目录分开。工具执行从 `terminal.cwd`（或本地后端上 `cwd: "."` 时的启动目录）开始，而不是自动从 `HERMES_HOME` 开始。

默认配置文件就是 `~/.hermes` 本身。无需迁移——现有安装完全相同。
