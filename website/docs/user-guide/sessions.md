---
sidebar_position: 7
title: "会话"
description: "会话持久化、恢复、搜索、管理和每平台会话跟踪"
---

# 会话

Hermes Agent 自动将每个对话保存为会话。会话支持对话恢复、跨会话搜索和完整的对话历史管理。

## 会话的工作原理

每个对话——无论来自 CLI、Telegram、Discord、Slack、WhatsApp、Signal、Matrix 还是任何其他消息平台——都作为带有完整消息历史的会话存储。会话在两个互补的系统中跟踪：

1. **SQLite 数据库**（`~/.hermes/state.db`）——具有 FTS5 全文搜索的结构化会话元数据
2. **JSONL 转录**（`~/.hermes/sessions/`）——包括工具调用的原始对话转录（网关）

SQLite 数据库存储：
- 会话 ID、来源平台、用户 ID
- **会话标题**（唯一、人类可读的名称）
- 模型名称和配置
- 系统提示快照
- 完整消息历史（角色、内容、工具调用、工具结果）
- 令牌计数（输入/输出）
- 时间戳（started_at、ended_at）
- 父会话 ID（用于压缩触发的会话拆分）

### 会话来源

每个会话都标记有其来源平台：

| 来源 | 描述 |
|------|------|
| `cli` | 交互式 CLI（`hermes` 或 `hermes chat`） |
| `telegram` | Telegram 消息 |
| `discord` | Discord 服务器/DM |
| `slack` | Slack 工作区 |
| `whatsapp` | WhatsApp 消息 |
| `signal` | Signal 消息 |
| `matrix` | Matrix 房间和 DM |
| `mattermost` | Mattermost 频道 |
| `email` | 电子邮件（IMAP/SMTP） |
| `sms` | 通过 Twilio 的短信 |
| `dingtalk` | 钉钉消息 |
| `feishu` | 飞书消息 |
| `wecom` | 企业微信 |
| `weixin` | 微信（个人） |
| `bluebubbles` | 通过 BlueBubbles macOS 服务器的 Apple iMessage |
| `qqbot` | QQ 机器人（腾讯 QQ）通过官方 API v2 |
| `homeassistant` | Home Assistant 对话 |
| `webhook` | 传入 Webhook |
| `api-server` | API 服务器请求 |
| `acp` | ACP 编辑器集成 |
| `cron` | 定时任务 |
| `batch` | 批处理运行 |

## CLI 会话恢复

使用 `--continue` 或 `--resume` 从 CLI 恢复之前的对话：

### 继续上次会话

```bash
# 恢复最近的 CLI 会话
hermes --continue
hermes -c

# 或使用 chat 子命令
hermes chat --continue
hermes chat -c
```

这会从 SQLite 数据库中查找最近的 `cli` 会话并加载其完整对话历史。

### 按名称恢复

如果你给会话起了标题（参见下面的[会话命名](#会话命名)），可以按名称恢复：

```bash
# 恢复命名会话
hermes -c "我的项目"

# 如果有谱系变体（我的项目、我的项目 #2、我的项目 #3），
# 这会自动恢复最新的一个
hermes -c "我的项目"   # → 恢复 "我的项目 #3"
```

### 恢复特定会话

```bash
# 按 ID 恢复特定会话
hermes --resume 20250305_091523_a1b2c3d4
hermes -r 20250305_091523_a1b2c3d4

# 按标题恢复
hermes --resume "重构认证"

# 或使用 chat 子命令
hermes chat --resume 20250305_091523_a1b2c3d4
```

会话 ID 在你退出 CLI 会话时显示，也可以通过 `hermes sessions list` 找到。

### 恢复时的对话回顾

恢复会话时，Hermes 在输入提示之前以样式面板显示之前对话的紧凑回顾：

<img className="docs-terminal-figure" src="/img/docs/session-recap.svg" alt="恢复 Hermes 会话时显示的上一次对话回顾面板的风格化预览。" />
<p className="docs-figure-caption">恢复模式显示一个紧凑的回顾面板，在返回活动提示之前显示最近的用户和助手轮次。</p>

回顾：
- 显示**用户消息**（金色 `●`）和**助手响应**（绿色 `◆`）
- **截断**长消息（用户 300 字符，助手 200 字符 / 3 行）
- **折叠工具调用**为计数和工具名称（例如 `[3 tool calls: terminal, web_search]`）
- **隐藏**系统消息、工具结果和内部推理
- **限制**最后 10 次交换，带有"... N 条更早消息..."指示器
- 使用**暗淡样式**以区分于活动对话

要禁用回顾并保持最小单行行为，在 `~/.hermes/config.yaml` 中设置：

```yaml
display:
  resume_display: minimal   # 默认：full
```

:::tip
会话 ID 遵循格式 `YYYYMMDD_HHMMSS_<8-char-hex>`，例如 `20250305_091523_a1b2c3d4`。你可以按 ID 或标题恢复——两者都适用于 `-c` 和 `-r`。
:::

## 会话命名

给会话起人类可读的标题，以便轻松查找和恢复。

### 自动生成标题

Hermes 在第一次交换后自动为每个会话生成一个简短描述性标题（3–7 个词）。这在后台线程中使用快速辅助模型运行，因此不会增加延迟。当你使用 `hermes sessions list` 或 `hermes sessions browse` 浏览会话时，会看到自动生成的标题。

自动标题每个会话仅触发一次，如果你已手动设置标题则跳过。

### 手动设置标题

在任何聊天会话（CLI 或网关）中使用 `/title` 斜杠命令：

```
/title 我的研究项目
```

标题立即应用。如果会话尚未在数据库中创建（例如，你在发送第一条消息前运行 `/title`），它会被排队并在会话开始后应用。

你也可以从命令行重命名现有会话：

```bash
hermes sessions rename 20250305_091523_a1b2c3d4 "重构认证模块"
```

### 标题规则

- **唯一** —— 两个会话不能共享相同的标题
- **最多 100 个字符** —— 保持列表输出整洁
- **已清理** —— 控制字符、零宽字符和 RTL 覆盖会自动剥离
- **正常 Unicode 可以** —— 表情符号、CJK、带重音字符都可以

### 压缩时自动谱系

当会话的上下文被压缩（手动通过 `/compress` 或自动）时，Hermes 创建一个新的延续会话。如果原始会话有标题，新会话自动获得编号标题：

```
"我的项目" → "我的项目 #2" → "我的项目 #3"
```

当你按名称恢复时（`hermes -c "我的项目"`），它自动选择谱系中最新的会话。

### 消息平台中的 /title

`/title` 命令在所有网关平台（Telegram、Discord、Slack、WhatsApp）中有效：

- `/title 我的研究` —— 设置会话标题
- `/title` —— 显示当前标题

## 会话管理命令

Hermes 通过 `hermes sessions` 提供完整的会话管理命令集：

### 列出会话

```bash
# 列出最近的会话（默认：最近 20 个）
hermes sessions list

# 按平台过滤
hermes sessions list --source telegram

# 显示更多会话
hermes sessions list --limit 50
```

当会话有标题时，输出显示标题、预览和相对时间戳：

```
标题                  预览                                       最后活动      ID
────────────────────────────────────────────────────────────────────────────────────────────────
重构认证              帮我重构认证模块                              2 小时前      20250305_091523_a
我的项目 #3           你能检查测试失败吗？                          昨天          20250304_143022_e
—                     拉斯维加斯的天气怎么样？                      3 天前        20250303_101500_f
```

当没有会话有标题时，使用更简单的格式：

```
预览                                              最后活动      来源    ID
──────────────────────────────────────────────────────────────────────────────────────
帮我重构认证模块                                    2 小时前      cli    20250305_091523_a
拉斯维加斯的天气怎么样？                              3 天前        tele   20250303_101500_f
```

### 导出会话

```bash
# 将所有会话导出到 JSONL 文件
hermes sessions export backup.jsonl

# 导出特定平台的会话
hermes sessions export telegram-history.jsonl --source telegram

# 导出单个会话
hermes sessions export session.jsonl --session-id 20250305_091523_a1b2c3d4
```

导出的文件每行包含一个 JSON 对象，带有完整的会话元数据和所有消息。

### 删除会话

```bash
# 删除特定会话（带确认）
hermes sessions delete 20250305_091523_a1b2c3d4

# 不确认删除
hermes sessions delete 20250305_091523_a1b2c3d4 --yes
```

### 重命名会话

```bash
# 设置或更改会话标题
hermes sessions rename 20250305_091523_a1b2c3d4 "调试认证流程"

# CLI 中多词标题不需要引号
hermes sessions rename 20250305_091523_a1b2c3d4 调试认证流程
```

如果标题已被其他会话使用，会显示错误。

### 清理旧会话

```bash
# 删除超过 90 天的已结束会话（默认）
hermes sessions prune

# 自定义年龄阈值
hermes sessions prune --older-than 30

# 仅清理特定平台的会话
hermes sessions prune --source telegram --older-than 60

# 跳过确认
hermes sessions prune --older-than 30 --yes
```

:::info
清理仅删除**已结束**的会话（已明确结束或自动重置的会话）。活动会话永远不会被清理。
:::

### 会话统计

```bash
hermes sessions stats
```

输出：

```
总会话数：142
总消息数：3847
  cli：89 个会话
  telegram：38 个会话
  discord：15 个会话
数据库大小：12.4 MB
```

有关更深入的分析——令牌使用、费用估算、工具分类和活动模式——使用 [`hermes insights`](/docs/reference/cli-commands#hermes-insights)。

## 会话搜索工具

代理有一个内置的 `session_search` 工具，使用 SQLite 的 FTS5 引擎对所有过去的对话执行全文搜索。

### 工作原理

1. FTS5 搜索按相关性排序的匹配消息
2. 按会话分组结果，取前 N 个唯一会话（默认 3）
3. 加载每个会话的对话，截断到约 100K 字符，以匹配为中心
4. 发送到快速摘要模型进行聚焦摘要
5. 返回每个会话的摘要，带元数据和周围上下文

### FTS5 查询语法

搜索支持标准 FTS5 查询语法：

- 简单关键字：`docker deployment`
- 短语：`"精确短语"`
- 布尔：`docker OR kubernetes`、`python NOT java`
- 前缀：`deploy*`

### 何时使用

代理会自动被提示使用会话搜索：

> *"当用户引用过去的对话内容或你怀疑存在相关先前上下文时，使用 session_search 来回忆它，而不是让他们重复。"*

## 每平台会话跟踪

### 网关会话

在消息平台上，会话由从消息来源构建的确定性会话键控：

| 聊天类型 | 默认键格式 | 行为 |
|---------|-----------|------|
| Telegram DM | `agent:main:telegram:dm:<chat_id>` | 每个 DM 聊天一个会话 |
| Discord DM | `agent:main:discord:dm:<chat_id>` | 每个 DM 聊天一个会话 |
| WhatsApp DM | `agent:main:whatsapp:dm:<canonical_identifier>` | 每个 DM 用户一个会话（当映射存在时 LID/电话别名折叠为一个身份） |
| 群聊 | `agent:main:<platform>:group:<chat_id>:<user_id>` | 当平台暴露用户 ID 时群组内每用户 |
| 群组线程/话题 | `agent:main:<platform>:group:<chat_id>:<thread_id>` | 所有线程参与者共享会话（默认）。使用 `thread_sessions_per_user: true` 时每用户。 |
| 频道 | `agent:main:<platform>:channel:<chat_id>:<user_id>` | 当平台暴露用户 ID 时频道内每用户 |

当 Hermes 无法获取共享聊天的参与者标识符时，它回退到该房间的一个共享会话。

### 共享 vs 隔离群组会话

默认情况下，Hermes 在 `config.yaml` 中使用 `group_sessions_per_user: true`。这意味着：

- Alice 和 Bob 可以在同一个 Discord 频道中与 Hermes 对话而不共享转录历史
- 一个用户的长时间工具密集任务不会污染另一个用户的上下文窗口
- 中断处理也保持每用户，因为运行代理键与隔离会话键匹配

如果你想要一个共享的"房间大脑"，设置：

```yaml
group_sessions_per_user: false
```

这将群组/频道恢复为每个房间一个共享会话，这保留共享对话上下文但也共享令牌费用、中断状态和上下文增长。

### 会话重置策略

网关会话根据可配置的策略自动重置：

- **idle** —— N 分钟不活动后重置
- **daily** —— 每天特定时间重置
- **both** —— 以先到者为准（空闲或每日）
- **none** —— 永不自动重置

在会话自动重置之前，代理会获得一轮机会以保存对话中的任何重要记忆或技能。

具有**活动后台进程**的会话永远不会自动重置，无论策略如何。

## 存储位置

| 内容 | 路径 | 描述 |
|------|------|------|
| SQLite 数据库 | `~/.hermes/state.db` | 所有会话元数据 + 带 FTS5 的消息 |
| 网关转录 | `~/.hermes/sessions/` | 每个会话的 JSONL 转录 + sessions.json 索引 |
| 网关索引 | `~/.hermes/sessions/sessions.json` | 将会话键映射到活动会话 ID |

SQLite 数据库使用 WAL 模式支持并发读取者和单个写入者，非常适合网关的多平台架构。

### 数据库模式

`state.db` 中的关键表：

- **sessions** —— 会话元数据（id、source、user_id、model、title、timestamps、token_counts）。标题有唯一索引（允许 NULL 标题，仅非 NULL 必须唯一）。
- **messages** —— 完整消息历史（role、content、tool_calls、tool_name、token_count）
- **messages_fts** —— 用于跨消息内容全文搜索的 FTS5 虚拟表

## 会话过期和清理

### 自动清理

- 网关会话根据配置的重置策略自动重置
- 重置前，代理从即将过期的会话中保存记忆和技能
- 可选自动清理：当 `sessions.auto_prune` 为 `true` 时，在 CLI/网关启动时清理超过 `sessions.retention_days`（默认 90）的已结束会话
- 清理实际删除行后，`state.db` 会 `VACUUM` 以回收磁盘空间（SQLite 在普通 DELETE 上不会缩小文件）
- 清理最多每 `sessions.min_interval_hours`（默认 24）运行一次；上次运行时间戳在 `state.db` 本身中跟踪，因此在同一 `HERMES_HOME` 中的所有 Hermes 进程间共享

默认是**关闭** —— 会话历史对 `session_search` 回忆很有价值，静默删除可能会让用户感到意外。在 `~/.hermes/config.yaml` 中启用：

```yaml
sessions:
  auto_prune: true          # 选择加入——默认为 false
  retention_days: 90        # 保留已结束会话这么多天
  vacuum_after_prune: true  # 清理扫描后回收磁盘空间
  min_interval_hours: 24    # 不要更频繁地重新运行扫描
```

活动会话永远不会自动清理，无论年龄如何。

### 手动清理

```bash
# 清理超过 90 天的会话
hermes sessions prune

# 删除特定会话
hermes sessions delete <session_id>

# 清理前导出（备份）
hermes sessions export backup.jsonl
hermes sessions prune --older-than 30 --yes
```

:::tip
数据库增长缓慢（典型：数百个会话 10-15 MB），会话历史支持跨过去对话的 `session_search` 回忆，因此自动清理默认禁用。如果你运行繁重的网关/定时任务工作负载，其中 `state.db` 明显影响性能（观察到的失败模式：约 1000 个会话的 384 MB state.db 减慢 FTS5 插入和 `/resume` 列表），请启用它。使用 `hermes sessions prune` 进行一次性清理而不开启自动扫描。
:::
