---
sidebar_position: 2
title: "斜杠命令参考"
description: "交互式 CLI 和消息斜杠命令的完整参考"
---

# 斜杠命令参考

Hermes 有两个斜杠命令界面，都由 `hermes_cli/commands.py` 中的中央 `COMMAND_REGISTRY` 驱动：

- **交互式 CLI 斜杠命令** — 由 `cli.py` 分发，带有来自注册表的自动补全
- **消息斜杠命令** — 由 `gateway/run.py` 分发，带有从注册表生成的帮助文本和平台菜单

已安装的技能也会作为动态斜杠命令在这两个界面上暴露。这包括像 `/plan` 这样的捆绑技能，它打开计划模式并将 markdown 计划保存在活动工作区/后端工作目录下的 `.hermes/plans/` 中。

## 交互式 CLI 斜杠命令

在 CLI 中输入 `/` 打开自动补全菜单。内置命令不区分大小写。

### 会话

| 命令 | 描述 |
|---------|-------------|
| `/new`（别名：`/reset`） | 开始新会话（新的会话 ID + 历史记录） |
| `/clear` | 清屏并开始新会话 |
| `/history` | 显示对话历史 |
| `/save` | 保存当前对话 |
| `/retry` | 重试上一条消息（重新发送给代理） |
| `/undo` | 移除最后一次用户/助手交换 |
| `/title` | 为当前会话设置标题（用法：/title 我的会话名称） |
| `/compress [焦点主题]` | 手动压缩对话上下文（刷新记忆 + 摘要）。可选的焦点主题缩小摘要保留的范围。 |
| `/rollback` | 列出或恢复文件系统检查点（用法：/rollback [编号]） |
| `/snapshot [create\|restore <id>\|prune]`（别名：`/snap`） | 创建或恢复 Hermes 配置/状态的状态快照。`create [标签]` 保存快照，`restore <id>` 回滚到它，`prune [N]` 移除旧快照，或无参数列出所有。 |
| `/stop` | 终止所有正在运行的后台进程 |
| `/queue <提示>`（别名：`/q`） | 为下一轮排队一个提示（不中断当前代理响应）。**注意：** `/q` 被 `/queue` 和 `/quit` 同时声明；最后注册的获胜，所以 `/q` 在实践中解析为 `/quit`。请显式使用 `/queue`。 |
| `/resume [名称]` | 恢复之前命名的会话 |
| `/status` | 显示会话信息 |
| `/agents`（别名：`/tasks`） | 显示当前会话中的活跃代理和正在运行的任务。 |
| `/background <提示>`（别名：`/bg`） | 在单独的后台会话中运行提示。代理独立处理你的提示——你当前的会话保持空闲以处理其他工作。任务完成时结果作为面板显示。参见 [CLI 后台会话](/docs/user-guide/cli#background-sessions)。 |
| `/btw <问题>` | 使用会话上下文的临时旁路问题（无工具，不持久化）。用于快速澄清而不影响对话历史。 |
| `/branch [名称]`（别名：`/fork`） | 分支当前会话（探索不同的路径） |

### 配置

| 命令 | 描述 |
|---------|-------------|
| `/config` | 显示当前配置 |
| `/model [模型名称]` | 显示或更改当前模型。支持：`/model claude-sonnet-4`、`/model provider:model`（切换提供者）、`/model custom:model`（自定义端点）、`/model custom:name:model`（命名自定义提供者）、`/model custom`（从端点自动检测）。使用 `--global` 将更改持久化到 config.yaml。**注意：** `/model` 只能在已配置的提供者之间切换。要添加新提供者，退出会话并在终端运行 `hermes model`。 |
| `/personality` | 设置预定义的人格 |
| `/verbose` | 循环工具进度显示：关闭 → 新增 → 全部 → 详细。可以通过配置为[消息平台启用](#备注)。 |
| `/fast [normal\|fast\|status]` | 切换快速模式 — OpenAI 优先处理 / Anthropic 快速模式。选项：`normal`、`fast`、`status`。 |
| `/reasoning` | 管理推理力度和显示（用法：/reasoning [级别\|显示\|隐藏]） |
| `/skin` | 显示或更改显示皮肤/主题 |
| `/statusbar`（别名：`/sb`） | 切换上下文/模型状态栏的开或关 |
| `/voice [on\|off\|tts\|status]` | 切换 CLI 语音模式和语音播放。录音使用 `voice.record_key`（默认：`Ctrl+B`）。 |
| `/yolo` | 切换 YOLO 模式 — 跳过所有危险命令审批提示。 |

### 工具和技能

| 命令 | 描述 |
|---------|-------------|
| `/tools [list\|disable\|enable] [名称...]` | 管理工具：列出可用工具，或为当前会话禁用/启用特定工具。禁用工具会将其从代理的工具集中移除并触发会话重置。 |
| `/toolsets` | 列出可用工具集 |
| `/browser [connect\|disconnect\|status]` | 管理本地 Chrome CDP 连接。`connect` 将浏览器工具附加到正在运行的 Chrome 实例（默认：`ws://localhost:9222`）。`disconnect` 断开连接。`status` 显示当前连接。如果未检测到调试器，自动启动 Chrome。 |
| `/skills` | 从在线注册表搜索、安装、检查或管理技能 |
| `/cron` | 管理定时任务（列出、添加/创建、编辑、暂停、恢复、运行、移除） |
| `/reload-mcp`（别名：`/reload_mcp`） | 从 config.yaml 重新加载 MCP 服务器 |
| `/reload` | 将 `.env` 变量重新加载到正在运行的会话中（获取新的 API 密钥而无需重启） |
| `/plugins` | 列出已安装的插件及其状态 |

### 信息

| 命令 | 描述 |
|---------|-------------|
| `/help` | 显示此帮助消息 |
| `/usage` | 显示令牌使用量、成本明细和会话持续时间 |
| `/insights` | 显示使用洞察和分析（过去 30 天） |
| `/platforms`（别名：`/gateway`） | 显示网关/消息平台状态 |
| `/paste` | 附加剪贴板图像 |
| `/copy [编号]` | 将最后一次助手响应复制到剪贴板（或倒数第 N 次，带编号）。仅限 CLI。 |
| `/image <路径>` | 为你的下一个提示附加本地图像文件。 |
| `/terminal-setup [auto\|vscode\|cursor\|windsurf]` | 仅限 TUI：配置本地 VS Code 系列终端绑定，以获得更好的多行 + 撤销/重做一致性。 |
| `/debug` | 上传调试报告（系统信息 + 日志）并获取可分享链接。消息平台也可用。 |
| `/profile` | 显示活跃的 profile 名称和主目录 |
| `/gquota` | 显示 Google Gemini Code Assist 配额使用情况（仅在 `google-gemini-cli` 提供者活跃时可用）。 |

### 退出

| 命令 | 描述 |
|---------|-------------|
| `/quit` | 退出 CLI（也：`/exit`）。参见上面 `/queue` 下关于 `/q` 的说明。 |

### 动态 CLI 斜杠命令

| 命令 | 描述 |
|---------|-------------|
| `/<技能名称>` | 将任何已安装的技能作为按需命令加载。示例：`/gif-search`、`/github-pr-workflow`、`/excalidraw`。 |
| `/skills ...` | 从注册表和官方可选技能目录中搜索、浏览、检查、安装、审计、发布和配置技能。 |

### 快速命令

用户定义的快速命令将短别名映射到较长的提示。在 `~/.hermes/config.yaml` 中配置它们：

```yaml
quick_commands:
  review: "审查我最新的 git diff 并建议改进"
  deploy: "运行 scripts/deploy.sh 中的部署脚本并验证输出"
  morning: "检查我的日历、未读邮件，并总结今天的优先事项"
```

然后在 CLI 中输入 `/review`、`/deploy` 或 `/morning`。快速命令在分发时解析，不会显示在内置自动补全/帮助表中。

### 别名解析

命令支持前缀匹配：输入 `/h` 解析为 `/help`，`/mod` 解析为 `/model`。当一个前缀有歧义（匹配多个命令）时，注册顺序中的第一个匹配获胜。完整的命令名称和注册的别名始终优先于前缀匹配。

## 消息斜杠命令

消息网关支持以下内置命令，可在 Telegram、Discord、Slack、WhatsApp、Signal、Email 和 Home Assistant 聊天中使用：

| 命令 | 描述 |
|---------|-------------|
| `/new` | 开始新对话。 |
| `/reset` | 重置对话历史。 |
| `/status` | 显示会话信息。 |
| `/stop` | 终止所有正在运行的后台进程并中断正在运行的代理。 |
| `/model [provider:model]` | 显示或更改模型。支持提供者切换（`/model zai:glm-5`）、自定义端点（`/model custom:model`）、命名自定义提供者（`/model custom:local:qwen`）和自动检测（`/model custom`）。使用 `--global` 将更改持久化到 config.yaml。**注意：** `/model` 只能在已配置的提供者之间切换。要添加新提供者或设置 API 密钥，在终端中使用 `hermes model`（在聊天会话之外）。 |
| `/personality [名称]` | 为会话设置人格覆盖。 |
| `/fast [normal\|fast\|status]` | 切换快速模式 — OpenAI 优先处理 / Anthropic 快速模式。 |
| `/retry` | 重试上一条消息。 |
| `/undo` | 移除最后一次交换。 |
| `/sethome`（别名：`/set-home`） | 将当前聊天标记为平台家庭频道以接收投递。 |
| `/compress [焦点主题]` | 手动压缩对话上下文。可选的焦点主题缩小摘要保留的范围。 |
| `/title [名称]` | 设置或显示会话标题。 |
| `/resume [名称]` | 恢复之前命名的会话。 |
| `/usage` | 显示令牌使用量、估算成本明细（输入/输出）、上下文窗口状态和会话持续时间。 |
| `/insights [天数]` | 显示使用分析。 |
| `/reasoning [级别\|显示\|隐藏]` | 更改推理力度或切换推理显示。 |
| `/voice [on\|off\|tts\|join\|channel\|leave\|status]` | 控制聊天中的语音回复。`join`/`channel`/`leave` 管理 Discord 语音频道模式。 |
| `/rollback [编号]` | 列出或恢复文件系统检查点。 |
| `/background <提示>` | 在单独的后台会话中运行提示。任务完成时结果会投递回同一聊天。参见 [消息后台会话](/docs/user-guide/messaging/#background-sessions)。 |
| `/reload-mcp`（别名：`/reload_mcp`） | 从配置重新加载 MCP 服务器。 |
| `/yolo` | 切换 YOLO 模式 — 跳过所有危险命令审批提示。 |
| `/commands [页码]` | 浏览所有命令和技能（分页）。 |
| `/approve [session\|always]` | 批准并执行待处理的危险命令。`session` 仅对此会话批准；`always` 添加到永久允许列表。 |
| `/deny` | 拒绝待处理的危险命令。 |
| `/update` | 将 Hermes Agent 更新到最新版本。 |
| `/restart` | 在排空活跃运行后优雅重启网关。当网关重新上线时，它会向请求者的聊天/线程发送确认。 |
| `/debug` | 上传调试报告（系统信息 + 日志）并获取可分享链接。 |
| `/help` | 显示消息帮助。 |
| `/<技能名称>` | 按名称调用任何已安装的技能。 |

## 备注

- `/skin`、`/snapshot`、`/gquota`、`/reload`、`/tools`、`/toolsets`、`/browser`、`/config`、`/cron`、`/skills`、`/platforms`、`/paste`、`/image`、`/terminal-setup`、`/statusbar` 和 `/plugins` 是**仅限 CLI** 的命令。
- `/verbose` **默认仅限 CLI**，但可以通过在 `config.yaml` 中设置 `display.tool_progress_command: true` 为消息平台启用。启用后，它会循环 `display.tool_progress` 模式并保存到配置。
- `/sethome`、`/update`、`/restart`、`/approve`、`/deny` 和 `/commands` 是**仅限消息** 的命令。
- `/status`、`/background`、`/voice`、`/reload-mcp`、`/rollback`、`/debug`、`/fast` 和 `/yolo` 在 CLI 和消息网关中都**可用**。
- `/voice join`、`/voice channel` 和 `/voice leave` 仅在 Discord 上有意义。
