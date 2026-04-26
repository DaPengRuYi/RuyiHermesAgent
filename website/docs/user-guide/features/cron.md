---
sidebar_position: 5
title: "定时任务（Cron）"
description: "使用自然语言调度自动任务，通过一个 cron 工具管理，附加一个或多个技能"
---

# 定时任务（Cron）

使用自然语言或 cron 表达式调度任务自动运行。Hermes 通过一个统一的 `cronjob` 工具暴露 cron 管理，采用操作式而非单独的 schedule/list/remove 工具。

## Cron 现在能做什么

Cron 任务可以：

- 调度一次性或重复任务
- 暂停、恢复、编辑、触发和移除任务
- 为任务附加零个、一个或多个技能
- 将结果投递回来源聊天、本地文件或配置的平台目标
- 在新的代理会话中运行，使用正常的静态工具列表

:::warning
Cron 运行的会话不能递归创建更多 cron 任务。Hermes 在 cron 执行中禁用 cron 管理工具，以防止失控的调度循环。
:::

## 创建定时任务

### 在聊天中使用 `/cron`

```bash
/cron add 30m "Remind me to check the build"
/cron add "every 2h" "Check server status"
/cron add "every 1h" "Summarize new feed items" --skill blogwatcher
/cron add "every 1h" "Use both skills and combine the result" --skill blogwatcher --skill maps
```

### 从独立 CLI

```bash
hermes cron create "every 2h" "Check server status"
hermes cron create "every 1h" "Summarize new feed items" --skill blogwatcher
hermes cron create "every 1h" "Use both skills and combine the result" \
  --skill blogwatcher \
  --skill maps \
  --name "Skill combo"
```

### 通过自然对话

正常询问 Hermes：

```text
Every morning at 9am, check Hacker News for AI news and send me a summary on Telegram.
```

Hermes 会在内部使用统一的 `cronjob` 工具。

## 技能支持的 cron 任务

Cron 任务可以在运行提示之前加载一个或多个技能。

### 单个技能

```python
cronjob(
    action="create",
    skill="blogwatcher",
    prompt="Check the configured feeds and summarize anything new.",
    schedule="0 9 * * *",
    name="Morning feeds",
)
```

### 多个技能

按顺序加载技能。提示成为叠加在这些技能之上的任务指令。

```python
cronjob(
    action="create",
    skills=["blogwatcher", "maps"],
    prompt="Look for new local events and interesting nearby places, then combine them into one short brief.",
    schedule="every 6h",
    name="Local brief",
)
```

当你希望调度代理继承可重用工作流而不将完整技能文本塞入 cron 提示本身时，这很有用。

## 在项目目录中运行任务

Cron 任务默认与任何仓库分离运行——不加载 `AGENTS.md`、`CLAUDE.md` 或 `.cursorrules`，终端/文件/代码执行工具从网关启动时的工作目录运行。传递 `--workdir`（CLI）或 `workdir=`（工具调用）来更改：

```bash
# 独立 CLI
hermes cron create --schedule "every 1d at 09:00" \
  --workdir /home/me/projects/acme \
  --prompt "Audit open PRs, summarize CI health, and post to #eng"
```

```python
# 从聊天中，通过 cronjob 工具
cronjob(
    action="create",
    schedule="every 1d at 09:00",
    workdir="/home/me/projects/acme",
    prompt="Audit open PRs, summarize CI health, and post to #eng",
)
```

当设置了 `workdir` 时：

- 该目录的 `AGENTS.md`、`CLAUDE.md` 和 `.cursorrules` 被注入系统提示（与交互式 CLI 相同的发现顺序）
- `terminal`、`read_file`、`write_file`、`patch`、`search_files` 和 `execute_code` 都使用该目录作为工作目录（通过 `TERMINAL_CWD`）
- 路径必须是存在的绝对目录——相对路径和缺失的目录在创建/更新时被拒绝
- 编辑时传递 `--workdir ""`（或通过工具传递 `workdir=""`）清除它并恢复旧行为

:::note 序列化
带 `workdir` 的任务在调度器滴答时顺序运行，而非并行池中。这是有意的——`TERMINAL_CWD` 是进程全局的，两个 workdir 任务同时运行会相互破坏 cwd。无 workdir 的任务仍然像以前一样并行运行。
:::

## 编辑任务

你不需要删除并重新创建任务来更改它们。

### 聊天

```bash
/cron edit <job_id> --schedule "every 4h"
/cron edit <job_id> --prompt "Use the revised task"
/cron edit <job_id> --skill blogwatcher --skill maps
/cron edit <job_id> --remove-skill blogwatcher
/cron edit <job_id> --clear-skills
```

### 独立 CLI

```bash
hermes cron edit <job_id> --schedule "every 4h"
hermes cron edit <job_id> --prompt "Use the revised task"
hermes cron edit <job_id> --skill blogwatcher --skill maps
hermes cron edit <job_id> --add-skill maps
hermes cron edit <job_id> --remove-skill blogwatcher
hermes cron edit <job_id> --clear-skills
```

注意：

- 重复的 `--skill` 替换任务附加的技能列表
- `--add-skill` 追加到现有列表而不替换
- `--remove-skill` 移除特定附加的技能
- `--clear-skills` 移除所有附加的技能

## 生命周期操作

Cron 任务现在比仅创建/移除有更完整的生命周期。

### 聊天

```bash
/cron list
/cron pause <job_id>
/cron resume <job_id>
/cron run <job_id>
/cron remove <job_id>
```

### 独立 CLI

```bash
hermes cron list
hermes cron pause <job_id>
hermes cron resume <job_id>
hermes cron run <job_id>
hermes cron remove <job_id>
hermes cron status
hermes cron tick
```

它们的作用：

- `pause` — 保留任务但停止调度
- `resume` — 重新启用任务并计算下一次未来运行
- `run` — 在下一个调度器滴答触发任务
- `remove` — 完全删除

## 工作原理

**Cron 执行由网关守护进程处理。** 网关每 60 秒触发一次调度器，在隔离的代理会话中运行所有到期任务。

```bash
hermes gateway install     # 安装为用户服务
sudo hermes gateway install --system   # Linux：服务器启动时系统服务
hermes gateway             # 或前台运行

hermes cron list
hermes cron status
```

### 网关调度器行为

每次滴答时 Hermes：

1. 从 `~/.hermes/cron/jobs.json` 加载任务
2. 检查 `next_run_at` 与当前时间
3. 为每个到期任务启动新的 `AIAgent` 会话
4. 可选地向该新会话注入一个或多个附加技能
5. 运行提示直到完成
6. 投递最终响应
7. 更新运行元数据和下次调度时间

`~/.hermes/cron/.tick.lock` 的文件锁防止重叠的调度器滴答重复运行同一批任务。

## 投递选项

调度任务时，你指定输出去向：

| 选项 | 描述 | 示例 |
|------|------|------|
| `"origin"` | 回到任务创建的地方 | 消息平台上的默认值 |
| `"local"` | 仅保存到本地文件（`~/.hermes/cron/output/`） | CLI 上的默认值 |
| `"telegram"` | Telegram 主频道 | 使用 `TELEGRAM_HOME_CHANNEL` |
| `"telegram:123456"` | 按 ID 指定 Telegram 聊天 | 直接投递 |
| `"telegram:-100123:17585"` | 指定 Telegram 话题 | `chat_id:thread_id` 格式 |
| `"discord"` | Discord 主频道 | 使用 `DISCORD_HOME_CHANNEL` |
| `"discord:#engineering"` | 指定 Discord 频道 | 按频道名称 |
| `"slack"` | Slack 主频道 | |
| `"whatsapp"` | WhatsApp 主频道 | |
| `"signal"` | Signal | |
| `"matrix"` | Matrix 主房间 | |
| `"mattermost"` | Mattermost 主频道 | |
| `"email"` | 电子邮件 | |
| `"sms"` | 通过 Twilio 的短信 | |
| `"homeassistant"` | Home Assistant | |
| `"dingtalk"` | 钉钉 | |
| `"feishu"` | 飞书 | |
| `"wecom"` | 企业微信 | |
| `"weixin"` | 微信 | |
| `"bluebubbles"` | BlueBubbles（iMessage） | |
| `"qqbot"` | QQ 机器人（腾讯 QQ） | |

代理的最终响应会自动投递。你不需要在 cron 提示中调用 `send_message`。

### 响应包装

默认情况下，投递的 cron 输出会带有页眉和页脚包装，以便收件人知道它来自定时任务：

```
Cronjob Response: Morning feeds
-------------

<agent output here>

Note: The agent cannot see this message, and therefore cannot respond to it.
```

要投递不带包装的原始代理输出，将 `cron.wrap_response` 设为 `false`：

```yaml
# ~/.hermes/config.yaml
cron:
  wrap_response: false
```

### 静默抑制

如果代理的最终响应以 `[SILENT]` 开头，投递被完全抑制。输出仍保存在本地用于审计（在 `~/.hermes/cron/output/` 中），但不会向投递目标发送消息。

这对于仅在出问题时报告的监控任务很有用：

```text
Check if nginx is running. If everything is healthy, respond with only [SILENT].
Otherwise, report the issue.
```

失败的任务无论 `[SILENT]` 标记如何都会投递——只有成功的运行可以被静默。

## 脚本超时

预运行脚本（通过 `script` 参数附加）默认超时 120 秒。如果你的脚本需要更长时间——例如包含避免机器人式时间模式的随机延迟——你可以增加：

```yaml
# ~/.hermes/config.yaml
cron:
  script_timeout_seconds: 300   # 5 分钟
```

或设置 `HERMES_CRON_SCRIPT_TIMEOUT` 环境变量。解析顺序为：环境变量 → config.yaml → 120 秒默认值。

## 提供商恢复

Cron 任务继承你配置的故障转移提供商和凭据池轮换。如果主要 API 密钥被限速或提供商返回错误，cron 代理可以：

- **回退到备用提供商**，如果你在 `config.yaml` 中配置了 `fallback_providers`（或旧版 `fallback_model`）
- **轮换到下一个凭据**，在同一提供商的[凭据池](/docs/user-guide/configuration#credential-pool-strategies)中

这意味着高频运行或在高峰时段运行的 cron 任务更具弹性——单个限速密钥不会使整个运行失败。

## 调度格式

代理的最终响应会自动投递——你**不需要**在 cron 提示中为同一目标包含 `send_message`。如果 cron 运行调用 `send_message` 到调度器已经投递的完全相同的目标，Hermes 会跳过该重复发送，并告诉模型将用户可见内容放在最终响应中。仅对额外或不同的目标使用 `send_message`。

### 相对延迟（一次性）

```text
30m     → 30 分钟后运行一次
2h      → 2 小时后运行一次
1d      → 1 天后运行一次
```

### 间隔（重复）

```text
every 30m    → 每 30 分钟
every 2h     → 每 2 小时
every 1d     → 每天
```

### Cron 表达式

```text
0 9 * * *       → 每天上午 9:00
0 9 * * 1-5     → 工作日上午 9:00
0 */6 * * *     → 每 6 小时
30 8 1 * *      → 每月 1 日上午 8:30
0 0 * * 0       → 每周日午夜
```

### ISO 时间戳

```text
2026-03-15T09:00:00    → 一次性在 2026 年 3 月 15 日上午 9:00
```

## 重复行为

| 调度类型 | 默认重复 | 行为 |
|----------|---------|------|
| 一次性（`30m`、时间戳） | 1 | 运行一次 |
| 间隔（`every 2h`） | 永远 | 运行直到移除 |
| Cron 表达式 | 永远 | 运行直到移除 |

你可以覆盖它：

```python
cronjob(
    action="create",
    prompt="...",
    schedule="every 2h",
    repeat=5,
)
```

## 编程式管理任务

代理面向的 API 是一个工具：

```python
cronjob(action="create", ...)
cronjob(action="list")
cronjob(action="update", job_id="...")
cronjob(action="pause", job_id="...")
cronjob(action="resume", job_id="...")
cronjob(action="run", job_id="...")
cronjob(action="remove", job_id="...")
```

对于 `update`，传递 `skills=[]` 移除所有附加的技能。

## 任务存储

任务存储在 `~/.hermes/cron/jobs.json` 中。任务运行的输出保存到 `~/.hermes/cron/output/{job_id}/{timestamp}.md`。

任务可能将 `model` 和 `provider` 存储为 `null`。当这些字段被省略时，Hermes 在执行时从全局配置解析它们。它们仅在设置了每任务覆盖时出现在任务记录中。

存储使用原子文件写入，因此中断的写入不会留下部分写入的任务文件。

## 自包含提示仍然重要

:::warning 重要
Cron 任务在完全新的代理会话中运行。提示必须包含代理需要的所有内容，这些内容未由附加技能提供。
:::

**不好：** `"Check on that server issue"`

**好：** `"SSH into server 192.168.1.100 as user 'deploy', check if nginx is running with 'systemctl status nginx', and verify https://example.com returns HTTP 200."`

## 安全

定时任务提示在创建和更新时会扫描提示注入和凭据泄露模式。包含不可见 Unicode 技巧、SSH 后门尝试或明显密钥泄露载荷的提示会被阻止。
