---
sidebar_position: 12
title: "Cron 故障排除"
description: "诊断和修复常见的 Hermes cron 问题 — 作业未触发、投递失败、技能加载错误和性能问题"
---

# Cron 故障排除

当 cron 作业未按预期运行时，按顺序进行这些检查。大多数问题属于四个类别之一：时间、投递、权限或技能加载。

---

## 作业未触发

### 检查 1：验证作业存在且处于活动状态

```bash
hermes cron list
```

查找作业并确认其状态为 `[active]`（不是 `[paused]` 或 `[completed]`）。如果显示 `[completed]`，重复次数可能已耗尽 — 编辑作业以重置。

### 检查 2：确认调度正确

格式错误的调度会静默默认为一次性触发或被完全拒绝。测试你的表达式：

| 你的表达式 | 应该解析为 |
|----------------|-------------------|
| `0 9 * * *` | 每天上午 9:00 |
| `0 9 * * 1` | 每周一上午 9:00 |
| `every 2h` | 从现在起每 2 小时 |
| `30m` | 从现在起 30 分钟 |
| `2025-06-01T09:00:00` | 2025 年 6 月 1 日 UTC 上午 9:00 |

如果作业触发一次然后从列表中消失，它是一次性调度（`30m`、`1d` 或 ISO 时间戳）— 这是预期行为。

### 检查 3：网关是否在运行？

Cron 作业由网关的后台计时线程触发，每 60 秒跳动一次。普通的 CLI 聊天会话**不会**自动触发 cron 作业。

如果你希望作业自动触发，你需要一个运行中的网关（`hermes gateway` 或 `hermes serve`）。对于一次性调试，你可以使用 `hermes cron tick` 手动触发一次跳动。

### 检查 4：检查系统时钟和时区

作业使用本地时区。如果你机器的时钟错误或处于不同的时区，作业将在错误的时间触发。验证：

```bash
date
hermes cron list   # 将 next_run 时间与本地时间比较
```

---

## 投递失败

### 检查 1：验证投递目标正确

投递目标区分大小写，并且需要配置正确的平台。配置错误的目标会静默丢弃响应。

| 目标 | 需要 |
|--------|----------|
| `telegram` | `~/.hermes/.env` 中的 `TELEGRAM_BOT_TOKEN` |
| `discord` | `~/.hermes/.env` 中的 `DISCORD_BOT_TOKEN` |
| `slack` | `~/.hermes/.env` 中的 `SLACK_BOT_TOKEN` |
| `whatsapp` | 已配置 WhatsApp 网关 |
| `signal` | 已配置 Signal 网关 |
| `matrix` | 已配置 Matrix 服务器 |
| `email` | 在 `config.yaml` 中配置了 SMTP |
| `sms` | 已配置 SMS 提供者 |
| `local` | 对 `~/.hermes/cron/output/` 有写权限 |
| `origin` | 投递到创建作业的聊天 |

其他支持的平台包括 `mattermost`、`homeassistant`、`dingtalk`、`feishu`、`wecom`、`weixin`、`bluebubbles`、`qqbot` 和 `webhook`。你也可以使用 `platform:chat_id` 语法指定特定聊天（例如 `telegram:-1001234567890`）。

如果投递失败，作业仍然运行 — 只是不会发送到任何地方。检查 `hermes cron list` 中更新的 `last_error` 字段（如果可用）。

### 检查 2：检查 `[SILENT]` 用法

如果你的 cron 作业没有输出或代理响应了 `[SILENT]`，投递会被抑制。这对监控作业是有意为之 — 但确保你的提示没有意外地抑制所有内容。

提示说 "如果没有变化则响应 [SILENT]" 也会静默吞掉非空响应。检查你的条件逻辑。

### 检查 3：平台令牌权限

每个消息平台机器人需要特定权限才能接收消息。如果投递静默失败：

- **Telegram**：机器人必须是目标群组/频道的管理员
- **Discord**：机器人必须有在目标频道发送消息的权限
- **Slack**：机器人必须已添加到工作区并具有 `chat:write` 范围

### 检查 4：响应包装

默认情况下，cron 响应带有页眉和页脚包装（`config.yaml` 中的 `cron.wrap_response: true`）。某些平台或集成可能无法很好地处理。要禁用：

```yaml
cron:
  wrap_response: false
```

---

## 技能加载失败

### 检查 1：验证技能已安装

```bash
hermes skills list
```

技能必须先安装才能附加到 cron 作业。如果技能缺失，先使用 `hermes skills install <skill-name>` 或在 CLI 中通过 `/skills` 安装。

### 检查 2：检查技能名称与技能文件夹名称

技能名称区分大小写，必须与已安装技能的文件夹名称匹配。如果你的作业指定了 `ai-funding-daily-report` 但技能文件夹是 `ai-funding-daily-report`，请从 `hermes skills list` 确认确切名称。

### 检查 3：需要交互式工具的技能

Cron 作业在禁用 `cronjob`、`messaging` 和 `clarify` 工具集的情况下运行。这可以防止递归 cron 创建、直接消息发送（投递由调度器处理）和交互式提示。如果技能依赖这些工具集，它在 cron 上下文中无法工作。

检查技能的文档以确认它在非交互式（无头）模式下工作。

### 检查 4：多技能排序

使用多个技能时，它们按顺序加载。如果技能 A 依赖技能 B 的上下文，确保 B 先加载：

```bash
/cron add "0 9 * * *" "..." --skill context-skill --skill target-skill
```

在此示例中，`context-skill` 在 `target-skill` 之前加载。

---

## 作业错误和失败

### 检查 1：查看最近的作业输出

如果作业运行并失败，你可能在以下位置看到错误上下文：

1. 作业投递的聊天中（如果投递成功）
2. `~/.hermes/logs/agent.log` 中的调度器消息（或 `errors.log` 中的警告）
3. 通过 `hermes cron list` 的作业 `last_run` 元数据

### 检查 2：常见错误模式

**脚本的 "No such file or directory"**
`script` 路径必须是绝对路径（或相对于 Hermes 配置目录）。验证：
```bash
ls ~/.hermes/scripts/your-script.py   # 必须存在
hermes cron edit <job_id> --script ~/.hermes/scripts/your-script.py
```

**作业执行时的 "Skill not found"**
技能必须安装在运行调度器的机器上。如果你在机器之间切换，技能不会自动同步 — 使用 `hermes skills install <skill-name>` 重新安装。

**作业运行但不投递任何内容**
可能是投递目标问题（参见上面的投递失败）或静默抑制的响应（`[SILENT]`）。

**作业挂起或超时**
调度器使用基于不活动的超时（默认 600 秒，可通过 `HERMES_CRON_TIMEOUT` 环境变量配置，`0` 表示无限）。代理可以运行任意长时间，只要它在积极调用工具 — 计时器仅在持续不活动后触发。长时间运行的作业应使用脚本来处理数据收集，只投递结果。

### 检查 3：锁争用

调度器使用基于文件的锁来防止重叠跳动。如果两个网关实例正在运行（或 CLI 会话与网关冲突），作业可能会延迟或跳过。

杀死重复的网关进程：
```bash
ps aux | grep hermes
# 杀死重复进程，只保留一个
```

### 检查 4：jobs.json 的权限

作业存储在 `~/.hermes/cron/jobs.json` 中。如果此文件不可被你的用户读/写，调度器将静默失败：

```bash
ls -la ~/.hermes/cron/jobs.json
chmod 600 ~/.hermes/cron/jobs.json   # 你的用户应该拥有它
```

---

## 性能问题

### 作业启动慢

每个 cron 作业创建一个新的 AIAgent 会话，可能涉及提供者认证和模型加载。对于时间敏感的调度，添加缓冲时间（例如 `0 8 * * *` 而不是 `0 9 * * *`）。

### 太多重叠的作业

调度器在每个跳动内顺序执行作业。如果多个作业同时到期，它们会一个接一个运行。考虑错开调度（例如 `0 9 * * *` 和 `5 9 * * *` 而不是两者都在 `0 9 * * *`）以避免延迟。

### 大型脚本输出

输出数兆字节的脚本会减慢代理速度并可能达到 token 限制。在脚本层面过滤/总结 — 只输出代理需要推理的内容。

---

## 诊断命令

```bash
hermes cron list                    # 显示所有作业、状态、next_run 时间
hermes cron run <job_id>            # 调度到下一个跳动（用于测试）
hermes cron edit <job_id>           # 修复配置问题
hermes logs                         # 查看最近的 Hermes 日志
hermes skills list                  # 验证已安装的技能
```

---

## 获取更多帮助

如果你已经完成了本指南但问题仍然存在：

1. 使用 `hermes cron run <job_id>` 运行作业（在下一个网关跳动时触发）并在聊天输出中观察错误
2. 检查 `~/.hermes/logs/agent.log` 中的调度器消息和 `~/.hermes/logs/errors.log` 中的警告
3. 在 GitHub 上提交 issue，包含：
   - 作业 ID 和调度
   - 投递目标
   - 你期望的 vs 实际发生的
   - 日志中的相关错误消息

---

*有关完整的 cron 参考，请参见[使用 Cron 自动化任何事情](/docs/guides/automate-with-cron)和[定时任务（Cron）](/docs/user-guide/features/cron)。*
