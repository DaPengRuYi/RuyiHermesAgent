---
sidebar_position: 4
title: "教程：团队 Telegram 助手"
description: "设置 Telegram 机器人的分步指南，让整个团队可以用于代码帮助、研究、系统管理等"
---

# 设置团队 Telegram 助手

本教程引导你设置一个由 Hermes Agent 驱动的 Telegram 机器人，多个团队成员可以使用。最终，你的团队将拥有一个共享的 AI 助手，可以发消息寻求代码、研究、系统管理等帮助 — 通过每用户授权确保安全。

## 我们在构建什么

一个 Telegram 机器人：

- **任何授权的团队成员**都可以发 DM 寻求帮助 — 代码审查、研究、shell 命令、调试
- **在你的服务器上运行**，具有完整的工具访问 — 终端、文件编辑、网络搜索、代码执行
- **每用户会话** — 每个人获得自己的对话上下文
- **默认安全** — 只有批准的用户可以交互，有两种授权方法
- **定时任务** — 每日站会、健康检查和提醒投递到团队频道

---

## 前提条件

开始前，确保你有：

- **Hermes Agent 已安装**在服务器或 VPS 上（不是你的笔记本 — 机器人需要保持运行）。如果还没有，请按照[安装指南](/docs/getting-started/installation)操作。
- **你自己的 Telegram 账户**（机器人所有者）
- **已配置 LLM 提供者** — 至少在 `~/.hermes/.env` 中有 OpenAI、Anthropic 或其他支持提供者的 API 密钥

:::tip
每月 $5 的 VPS 足够运行网关。Hermes 本身很轻量 — LLM API 调用才是花钱的，那些是远程发生的。
:::

---

## 步骤 1：创建 Telegram 机器人

每个 Telegram 机器人都从 **@BotFather** 开始 — Telegram 官方的创建机器人的机器人。

1. **打开 Telegram** 并搜索 `@BotFather`，或访问 [t.me/BotFather](https://t.me/BotFather)

2. **发送 `/newbot`** — BotFather 会问你两件事：
   - **显示名称** — 用户看到的（例如 `Team Hermes Assistant`）
   - **用户名** — 必须以 `bot` 结尾（例如 `myteam_hermes_bot`）

3. **复制机器人令牌** — BotFather 回复类似：
   ```
   Use this token to access the HTTP API:
   7123456789:AAH1bGciOiJSUzI1NiIsInR5cCI6Ikp...
   ```
   保存这个令牌 — 下一步需要它。

4. **设置描述**（可选但推荐）：
   ```
   /setdescription
   ```
   选择你的机器人，然后输入类似：
   ```
   由 Hermes Agent 驱动的团队 AI 助手。发 DM 给我寻求代码、研究、调试等帮助。
   ```

5. **设置机器人命令**（可选 — 给用户一个命令菜单）：
   ```
   /setcommands
   ```
   选择你的机器人，然后粘贴：
   ```
   new - 开始新对话
   model - 显示或更改 AI 模型
   status - 显示会话信息
   help - 显示可用命令
   stop - 停止当前任务
   ```

:::warning
保持你的机器人令牌保密。任何有令牌的人都可以控制机器人。如果泄露，在 BotFather 中使用 `/revoke` 生成新的。
:::

---

## 步骤 2：配置网关

你有两个选项：交互式设置向导（推荐）或手动配置。

### 选项 A：交互式设置（推荐）

```bash
hermes gateway setup
```

这引导你完成所有操作，使用方向键选择。选择 **Telegram**，粘贴你的机器人令牌，并在提示时输入你的用户 ID。

### 选项 B：手动配置

在 `~/.hermes/.env` 中添加这些行：

```bash
# 来自 BotFather 的 Telegram 机器人令牌
TELEGRAM_BOT_TOKEN=7123456789:AAH1bGciOiJSUzI1NiIsInR5cCI6Ikp...

# 你的 Telegram 用户 ID（数字）
TELEGRAM_ALLOWED_USERS=123456789
```

### 查找你的用户 ID

你的 Telegram 用户 ID 是数字值（不是你的用户名）。要查找：

1. 在 Telegram 上给 [@userinfobot](https://t.me/userinfobot) 发消息
2. 它立即回复你的数字用户 ID
3. 将该数字复制到 `TELEGRAM_ALLOWED_USERS`

:::info
Telegram 用户 ID 是永久数字如 `123456789`。它们与你的 `@username` 不同，后者可以更改。始终使用数字 ID 作为允许列表。
:::

---

## 步骤 3：启动网关

### 快速测试

先在前台运行网关确保一切正常：

```bash
hermes gateway
```

你应该看到类似输出：

```
[Gateway] Starting Hermes Gateway...
[Gateway] Telegram adapter connected
[Gateway] Cron scheduler started (tick every 60s)
```

打开 Telegram，找到你的机器人，给它发消息。如果它回复，你就成功了。按 `Ctrl+C` 停止。

### 生产：安装为服务

用于持久部署，重启后存活：

```bash
hermes gateway install
sudo hermes gateway install --system   # 仅 Linux：启动时系统服务
```

这创建一个后台服务：Linux 上默认为用户级 **systemd** 服务，macOS 上为 **launchd** 服务，或如果传 `--system` 则为 Linux 启动时系统服务。

```bash
# Linux — 管理默认用户服务
hermes gateway start
hermes gateway stop
hermes gateway status

# 查看实时日志
journalctl --user -u hermes-gateway -f

# SSH 注销后保持运行
sudo loginctl enable-linger $USER

# Linux 服务器 — 显式系统服务命令
sudo hermes gateway start --system
sudo hermes gateway status --system
journalctl -u hermes-gateway -f
```

```bash
# macOS — 管理服务
hermes gateway start
hermes gateway stop
tail -f ~/.hermes/logs/gateway.log
```

:::tip macOS PATH
launchd plist 在安装时捕获你的 shell PATH，以便网关子进程可以找到 Node.js 和 ffmpeg 等工具。如果你后来安装了新工具，重新运行 `hermes gateway install` 更新 plist。
:::

### 验证正在运行

```bash
hermes gateway status
```

然后在 Telegram 上给你的机器人发测试消息。你应该在几秒内收到回复。

---

## 步骤 4：设置团队访问

现在让我们给你的队友访问权限。有两种方法。

### 方法 A：静态允许列表

收集每个团队成员的 Telegram 用户 ID（让他们给 [@userinfobot](https://t.me/userinfobot) 发消息）并添加为逗号分隔的列表：

```bash
# 在 ~/.hermes/.env 中
TELEGRAM_ALLOWED_USERS=123456789,987654321,555555555
```

更改后重启网关：

```bash
hermes gateway stop && hermes gateway start
```

### 方法 B：DM 配对（推荐用于团队）

DM 配对更灵活 — 你不需要预先收集用户 ID。工作原理：

1. **队友给机器人发 DM** — 因为他们不在允许列表中，机器人回复一次性配对码：
   ```
   🔐 配对码：XKGH5N7P
   将此码发送给机器人所有者以获取批准。
   ```

2. **队友把码发给你**（通过任何渠道 — Slack、邮件、当面）

3. **你在服务器上批准**：
   ```bash
   hermes pairing approve telegram XKGH5N7P
   ```

4. **他们进来了** — 机器人立即开始回复他们的消息

**管理配对用户：**

```bash
# 查看所有待处理和已批准的用户
hermes pairing list

# 撤销某人的访问
hermes pairing revoke telegram 987654321

# 清除过期的待处理码
hermes pairing clear-pending
```

:::tip
DM 配对非常适合团队，因为添加新用户时不需要重启网关。批准立即生效。
:::

### 安全考虑

- **永远不要在具有终端访问权限的机器人上设置 `GATEWAY_ALLOW_ALL_USERS=true`** — 任何找到你机器人的人都可以在你的服务器上运行命令
- 配对码在 **1 小时**后过期，使用加密随机性
- 速率限制防止暴力攻击：每用户每 10 分钟 1 个请求，每平台最多 3 个待处理码
- 5 次失败的批准尝试后，平台进入 1 小时锁定
- 所有配对数据以 `chmod 0600` 权限存储

---

## 步骤 5：配置机器人

### 设置主频道

**主频道**是机器人投递 cron 作业结果和主动消息的地方。没有它，定时任务没有地方发送输出。

**选项 1：** 在机器人是成员的任何 Telegram 群组或聊天中使用 `/sethome` 命令。

**选项 2：** 在 `~/.hermes/.env` 中手动设置：

```bash
TELEGRAM_HOME_CHANNEL=-1001234567890
TELEGRAM_HOME_CHANNEL_NAME="Team Updates"
```

要查找频道 ID，将 [@userinfobot](https://t.me/userinfobot) 添加到群组 — 它会报告群组的聊天 ID。

### 配置工具进度显示

控制机器人使用工具时显示多少细节。在 `~/.hermes/config.yaml` 中：

```yaml
display:
  tool_progress: new    # off | new | all | verbose
```

| 模式 | 你看到什么 |
|------|-------------|
| `off` | 仅干净的回复 — 无工具活动 |
| `new` | 每个新工具调用的简要状态（推荐用于消息） |
| `all` | 每个工具调用带详情 |
| `verbose` | 完整工具输出包括命令结果 |

用户也可以在聊天中通过 `/verbose` 命令按会话更改此设置。

### 使用 SOUL.md 设置个性

通过编辑 `~/.hermes/SOUL.md` 自定义机器人的沟通方式：

有关完整指南，请参见[在 Hermes 中使用 SOUL.md](/docs/guides/use-soul-with-hermes)。

```markdown
# 灵魂
你是一个有帮助的团队助手。简洁且技术性。
对任何代码使用代码块。跳过客套 — 团队重视直接。
调试时，在猜测解决方案前始终要求错误日志。
```

### 添加项目上下文

如果你的团队在特定项目上工作，创建上下文文件让机器人知道你的技术栈：

```markdown
<!-- ~/.hermes/AGENTS.md -->
# 团队上下文
- 我们使用 Python 3.12 和 FastAPI 和 SQLAlchemy
- 前端是 React 和 TypeScript
- CI/CD 在 GitHub Actions 上运行
- 生产部署到 AWS ECS
- 始终建议为新代码编写测试
```

:::info
上下文文件注入每个会话的系统提示。保持简洁 — 每个字符都计入你的 token 预算。
:::

---

## 步骤 6：设置定时任务

网关运行后，你可以安排定期任务将结果投递到你的团队频道。

### 每日站会摘要

在 Telegram 上给机器人发消息：

```
每个工作日上午 9 点，检查 GitHub 仓库
github.com/myorg/myproject 的：
1. 过去 24 小时内打开/合并的拉取请求
2. 创建或关闭的 issue
3. 主分支上的任何 CI/CD 失败
格式化为简要的站会风格摘要。
```

代理自动创建 cron 作业并将结果投递到你询问的聊天（或主频道）。

### 服务器健康检查

```
每 6 小时，用 'df -h' 检查磁盘使用，用 'free -h' 检查内存，
用 'docker ps' 检查 Docker 容器状态。报告任何异常 —
分区超过 80%、重启的容器或高内存使用。
```

### 管理定时任务

```bash
# 从 CLI
hermes cron list          # 查看所有定时作业
hermes cron status        # 检查调度器是否在运行

# 从 Telegram 聊天
/cron list                # 查看作业
/cron remove <job_id>     # 移除作业
```

:::warning
Cron 作业提示在完全全新的会话中运行，没有之前对话的记忆。确保每个提示包含代理需要的**所有**上下文 — 文件路径、URL、服务器地址和清晰的指令。
:::

---

## 生产技巧

### 使用 Docker 确保安全

在共享团队机器人上，使用 Docker 作为终端后端，使代理命令在容器中而不是在主机上运行：

```bash
# 在 ~/.hermes/.env 中
TERMINAL_BACKEND=docker
TERMINAL_DOCKER_IMAGE=nikolaik/python-nodejs:python3.11-nodejs20
```

或在 `~/.hermes/config.yaml` 中：

```yaml
terminal:
  backend: docker
  container_cpu: 1
  container_memory: 5120
  container_persistent: true
```

这样，即使有人让机器人运行破坏性东西，你的主机系统也受到保护。

### 监控网关

```bash
# 检查网关是否在运行
hermes gateway status

# 查看实时日志（Linux）
journalctl --user -u hermes-gateway -f

# 查看实时日志（macOS）
tail -f ~/.hermes/logs/gateway.log
```

### 保持 Hermes 更新

从 Telegram，给机器人发 `/update` — 它会拉取最新版本并重启。或从服务器：

```bash
hermes update
hermes gateway stop && hermes gateway start
```

### 日志位置

| 内容 | 位置 |
|------|----------|
| 网关日志 | `journalctl --user -u hermes-gateway`（Linux）或 `~/.hermes/logs/gateway.log`（macOS） |
| Cron 作业输出 | `~/.hermes/cron/output/{job_id}/{timestamp}.md` |
| Cron 作业定义 | `~/.hermes/cron/jobs.json` |
| 配对数据 | `~/.hermes/pairing/` |
| 会话历史 | `~/.hermes/sessions/` |

---

## 更进一步

你已经有了一个工作的团队 Telegram 助手。以下是一些后续步骤：

- **[安全指南](/docs/user-guide/security)** — 深入了解授权、容器隔离和命令审批
- **[消息网关](/docs/user-guide/messaging)** — 网关架构、会话管理和聊天命令的完整参考
- **[Telegram 设置](/docs/user-guide/messaging/telegram)** — 平台特定细节包括语音消息和 TTS
- **[定时任务](/docs/user-guide/features/cron)** — 高级 cron 调度，带投递选项和 cron 表达式
- **[上下文文件](/docs/user-guide/features/context-files)** — AGENTS.md、SOUL.md 和 .cursorrules 用于项目知识
- **[个性](/docs/user-guide/features/personality)** — 内置个性预设和自定义角色定义
- **添加更多平台** — 同一个网关可以同时运行 [Discord](/docs/user-guide/messaging/discord)、[Slack](/docs/user-guide/messaging/slack) 和 [WhatsApp](/docs/user-guide/messaging/whatsapp)

---

*问题或 issue？在 GitHub 上提交 issue — 欢迎贡献。*
