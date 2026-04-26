---
sidebar_position: 1
title: "命令行界面"
description: "掌握 Hermes Agent 终端界面——命令、快捷键、个性设置等"
---

# 命令行界面

Hermes Agent 的命令行界面是一个完整的终端用户界面（TUI）——而非网页界面。它支持多行编辑、斜杠命令自动补全、对话历史、中断与重定向，以及流式工具输出。专为终端用户打造。

:::tip
Hermes 还提供了一个现代 TUI，支持模态覆盖层、鼠标选择和非阻塞输入。使用 `hermes --tui` 启动——参见 [TUI](tui.md) 指南。
:::

## 运行命令行

```bash
# 启动交互式会话（默认）
hermes

# 单次查询模式（非交互式）
hermes chat -q "你好"

# 使用指定模型
hermes chat --model "anthropic/claude-sonnet-4"

# 使用指定提供商
hermes chat --provider nous        # 使用 Nous Portal
hermes chat --provider openrouter  # 强制使用 OpenRouter

# 使用指定工具集
hermes chat --toolsets "web,terminal,skills"

# 启动时预加载一个或多个技能
hermes -s hermes-agent-dev,github-auth
hermes chat -s github-pr-workflow -q "打开一个草稿 PR"

# 恢复之前的会话
hermes --continue             # 恢复最近的 CLI 会话（-c）
hermes --resume <session_id>  # 按 ID 恢复指定会话（-r）

# 详细模式（调试输出）
hermes chat --verbose

# 隔离的 git 工作树（用于并行运行多个代理）
hermes -w                         # 工作树中的交互模式
hermes -w -q "修复问题 #123"       # 工作树中的单次查询
```

## 界面布局

<img className="docs-terminal-figure" src="/img/docs/cli-layout.svg" alt="Hermes CLI 布局的风格化预览，展示横幅、对话区域和固定输入提示符。" />
<p className="docs-figure-caption">Hermes CLI 横幅、对话流和固定输入提示符，以稳定的文档图形呈现，而非脆弱的文本艺术。</p>

欢迎横幅显示你的模型、终端后端、工作目录、可用工具和已安装的技能一览。

### 状态栏

输入区域上方有一个持久状态栏，实时更新：

```
 ⚕ claude-sonnet-4-20250514 │ 12.4K/200K │ [██████░░░░] 6% │ $0.06 │ 15m
```

| 元素 | 描述 |
|------|------|
| 模型名称 | 当前模型（超过 26 个字符时截断） |
| 令牌数 | 已用上下文令牌 / 最大上下文窗口 |
| 上下文条 | 带颜色编码阈值的视觉填充指示器 |
| 费用 | 预估会话费用（对于未知/零价格模型显示 `n/a`） |
| 时长 | 会话已用时间 |

状态栏会适应终端宽度——≥ 76 列时完整布局，52–75 列时紧凑布局，低于 52 列时最小化（仅模型 + 时长）。

**上下文颜色编码：**

| 颜色 | 阈值 | 含义 |
|------|------|------|
| 绿色 | < 50% | 空间充足 |
| 黄色 | 50–80% | 逐渐填满 |
| 橙色 | 80–95% | 接近限制 |
| 红色 | ≥ 95% | 即将溢出——考虑使用 `/compress` |

使用 `/usage` 查看详细分类费用（输入 vs 输出令牌）。

### 会话恢复显示

恢复之前的会话时（`hermes -c` 或 `hermes --resume <id>`），横幅和输入提示符之间会出现"上一次对话"面板，显示对话历史的紧凑摘要。详见[会话——恢复时的对话回顾](sessions.md#conversation-recap-on-resume)。

## 快捷键

| 按键 | 操作 |
|------|------|
| `Enter` | 发送消息 |
| `Alt+Enter` 或 `Ctrl+J` | 换行（多行输入） |
| `Alt+V` | 在终端支持时从剪贴板粘贴图片 |
| `Ctrl+V` | 粘贴文本并附带剪贴板图片 |
| `Ctrl+B` | 启用语音模式时开始/停止录音（`voice.record_key`，默认：`ctrl+b`） |
| `Ctrl+C` | 中断代理（2 秒内按两次强制退出） |
| `Ctrl+D` | 退出 |
| `Ctrl+Z` | 将 Hermes 挂起到后台（仅 Unix）。在 shell 中运行 `fg` 恢复。 |
| `Tab` | 接受自动建议（幽灵文本）或自动补全斜杠命令 |

## 斜杠命令

输入 `/` 查看自动补全下拉菜单。Hermes 支持大量 CLI 斜杠命令、动态技能命令和用户自定义快捷命令。

常见示例：

| 命令 | 描述 |
|------|------|
| `/help` | 显示命令帮助 |
| `/model` | 显示或更改当前模型 |
| `/tools` | 列出当前可用工具 |
| `/skills browse` | 浏览技能中心和官方可选技能 |
| `/background <prompt>` | 在单独的后台会话中运行提示 |
| `/skin` | 显示或切换活动 CLI 皮肤 |
| `/voice on` | 启用 CLI 语音模式（按 `Ctrl+B` 录音） |
| `/voice tts` | 切换 Hermes 回复的语音播放 |
| `/reasoning high` | 增加推理力度 |
| `/title 我的会话` | 命名当前会话 |

完整的内置 CLI 和消息列表，请参见[斜杠命令参考](../reference/slash-commands.md)。

设置、提供商、静默调优和消息/Discord 语音使用，请参见[语音模式](features/voice-mode.md)。

:::tip
命令不区分大小写——`/HELP` 和 `/help` 效果相同。已安装的技能也会自动成为斜杠命令。
:::

## 快捷命令

你可以定义自定义命令来立即运行 shell 命令，无需调用 LLM。这些命令在 CLI 和消息平台（Telegram、Discord 等）中均可使用。

```yaml
# ~/.hermes/config.yaml
quick_commands:
  status:
    type: exec
    command: systemctl status hermes-agent
  gpu:
    type: exec
    command: nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader
```

然后在任何聊天中输入 `/status` 或 `/gpu`。更多示例请参见[配置指南](/docs/user-guide/configuration#quick-commands)。

## 启动时预加载技能

如果你已经知道要在会话中激活哪些技能，可以在启动时传入：

```bash
hermes -s hermes-agent-dev,github-auth
hermes chat -s github-pr-workflow -s github-auth
```

Hermes 会在第一轮之前将每个命名的技能加载到会话提示中。相同的标志在交互模式和单次查询模式中均有效。

## 技能斜杠命令

`~/.hermes/skills/` 中每个已安装的技能都会自动注册为斜杠命令。技能名称即为命令：

```
/gif-search 搞笑猫咪
/axolotl 帮我在我的数据集上微调 Llama 3
/github-pr-workflow 为认证重构创建 PR

# 仅输入技能名称会加载它并让代理询问你需要什么：
/excalidraw
```

## 个性设置

设置预定义个性以更改代理的语气：

```
/personality pirate
/personality kawaii
/personality concise
```

内置个性包括：`helpful`、`concise`、`technical`、`creative`、`teacher`、`kawaii`、`catgirl`、`pirate`、`shakespeare`、`surfer`、`noir`、`uwu`、`philosopher`、`hype`。

你也可以在 `~/.hermes/config.yaml` 中定义自定义个性：

```yaml
personalities:
  helpful: "你是一个乐于助人、友好的 AI 助手。"
  kawaii: "你是一个可爱的助手！使用可爱的表达方式..."
  pirate: "啊！你正在和 Hermes 船长说话..."
  # 添加你自己的！
```

## 多行输入

有两种方式输入多行消息：

1. **`Alt+Enter` 或 `Ctrl+J`** —— 插入新行
2. **反斜杠续行** —— 以 `\` 结尾继续下一行：

```
❯ 编写一个函数：\
  1. 接受一个数字列表\
  2. 返回总和
```

:::info
支持粘贴多行文本——使用 `Alt+Enter` 或 `Ctrl+J` 插入换行符，或直接粘贴内容。
:::

## 中断代理

你可以在任何时候中断代理：

- **输入新消息 + Enter** 当代理正在工作时——它会中断并处理你的新指令
- **`Ctrl+C`** —— 中断当前操作（2 秒内按两次强制退出）
- 进行中的终端命令会立即终止（SIGTERM，1 秒后 SIGKILL）
- 中断期间输入的多条消息会被合并为一个提示

### 繁忙输入模式

`display.busy_input_mode` 配置项控制当代理正在工作时你按 Enter 会发生什么：

| 模式 | 行为 |
|------|------|
| `"interrupt"`（默认） | 你的消息中断当前操作并立即处理 |
| `"queue"` | 你的消息被静默排队，代理完成后作为下一轮发送 |

```yaml
# ~/.hermes/config.yaml
display:
  busy_input_mode: "queue"   # 或 "interrupt"（默认）
```

队列模式适用于你想准备后续消息而不小心取消正在进行的工作时。未知值会回退到 `"interrupt"`。

你也可以在 CLI 内更改：

```text
/busy queue
/busy interrupt
/busy status
```

### 挂起到后台

在 Unix 系统上，按 **`Ctrl+Z`** 将 Hermes 挂起到后台——就像任何终端进程一样。Shell 会打印确认信息：

```
Hermes Agent 已被挂起。运行 `fg` 恢复 Hermes Agent。
```

在 shell 中输入 `fg` 即可恢复会话到中断前的状态。Windows 不支持此功能。

## 工具进度显示

CLI 在代理工作时显示动画反馈：

**思考动画**（API 调用期间）：
```
  ◜ (｡•́︿•̀｡) 思考中... (1.2s)
  ◠ (⊙_⊙) 分析中... (2.4s)
  ✧٩(ˊᗜˋ*)و✧ 明白了！(3.1s)
```

**工具执行反馈：**
```
  ┊ 💻 terminal `ls -la` (0.3s)
  ┊ 🔍 web_search (1.2s)
  ┊ 📄 web_extract (2.1s)
```

使用 `/verbose` 切换显示模式：`off → new → all → verbose`。此命令也可在消息平台上启用——参见[配置](/docs/user-guide/configuration#display-settings)。

### 工具预览长度

`display.tool_preview_length` 配置项控制工具调用预览行中显示的最大字符数（例如文件路径、终端命令）。默认为 `0`，表示无限制——显示完整路径和命令。

```yaml
# ~/.hermes/config.yaml
display:
  tool_preview_length: 80   # 将工具预览截断为 80 个字符（0 = 无限制）
```

这在窄终端或工具参数包含很长的文件路径时很有用。

## 会话管理

### 恢复会话

退出 CLI 会话时，会打印恢复命令：

```
使用以下命令恢复此会话：
  hermes --resume 20260225_143052_a1b2c3

会话：        20260225_143052_a1b2c3
时长：        12m 34s
消息数：      28（5 条用户消息，18 次工具调用）
```

恢复选项：

```bash
hermes --continue                          # 恢复最近的 CLI 会话
hermes -c                                  # 简写形式
hermes -c "我的项目"                        # 恢复命名会话（谱系中最新的）
hermes --resume 20260225_143052_a1b2c3     # 按 ID 恢复指定会话
hermes --resume "重构认证"                  # 按标题恢复
hermes -r 20260225_143052_a1b2c3           # 简写形式
```

恢复会从 SQLite 加载完整的对话历史。代理会看到所有之前的消息、工具调用和响应——就像你从未离开过一样。

在聊天中使用 `/title 我的会话名称` 命名当前会话，或在命令行使用 `hermes sessions rename <id> <title>`。使用 `hermes sessions list` 浏览过去的会话。

### 会话存储

CLI 会话存储在 Hermes 的 SQLite 状态数据库中，位于 `~/.hermes/state.db`。数据库保存：

- 会话元数据（ID、标题、时间戳、令牌计数器）
- 消息历史
- 压缩/恢复会话之间的谱系
- `session_search` 使用的全文搜索索引

一些消息适配器也会在数据库旁边保存每个平台的转录文件，但 CLI 本身从 SQLite 会话存储中恢复。

### 上下文压缩

长对话在接近上下文限制时会自动总结：

```yaml
# 在 ~/.hermes/config.yaml 中
compression:
  enabled: true
  threshold: 0.50    # 默认在上下文限制的 50% 时压缩

# 摘要模型在 auxiliary 下配置：
auxiliary:
  compression:
    model: "google/gemini-3-flash-preview"  # 用于摘要的模型
```

当压缩触发时，中间轮次会被总结，而前 3 轮和后 4 轮始终保留。

## 后台会话

在单独的后台会话中运行提示，同时继续使用 CLI 处理其他工作：

```
/background 分析 /var/log 中的日志并总结今天的任何错误
```

Hermes 立即确认任务并返回提示：

```
🔄 后台任务 #1 已启动："分析 /var/log 中的日志并总结..."
   任务 ID：bg_143022_a1b2c3
```

### 工作原理

每个 `/background` 提示都会在一个守护线程中生成一个**完全独立的代理会话**：

- **隔离的对话** —— 后台代理对当前会话的历史一无所知。它只接收你提供的提示。
- **相同的配置** —— 后台代理继承当前会话的模型、提供商、工具集、推理设置和回退模型。
- **非阻塞** —— 你的前台会话保持完全交互。你可以聊天、运行命令，甚至启动更多后台任务。
- **多任务** —— 你可以同时运行多个后台任务。每个任务都有一个编号 ID。

### 结果

当后台任务完成时，结果会以面板形式出现在终端中：

```
╭─ ⚕ Hermes（后台 #1）──────────────────────────────────────╮
│ 今天在 syslog 中发现 3 个错误：                              │
│ 1. 03:22 调用了 OOM killer——终止了进程 nginx                 │
│ 2. 07:15 /dev/sda1 上磁盘 I/O 错误                          │
│ 3. 14:30 来自 192.168.1.50 的 SSH 登录尝试失败               │
╰──────────────────────────────────────────────────────────────╯
```

如果任务失败，你会看到错误通知。如果配置中启用了 `display.bell_on_complete`，任务完成时终端铃声会响。

### 使用场景

- **长时间研究** —— "/background 研究量子纠错的最新进展"同时你继续编写代码
- **文件处理** —— "/background 分析此仓库中的所有 Python 文件并列出任何安全问题"同时你继续对话
- **并行调查** —— 启动多个后台任务同时探索不同方向

:::info
后台会话不会出现在主对话历史中。它们是独立的会话，有自己的任务 ID（例如 `bg_143022_a1b2c3`）。
:::

## 安静模式

默认情况下，CLI 在安静模式下运行，该模式：
- 抑制工具的详细日志
- 启用可爱风格的动画反馈
- 保持输出简洁友好

获取调试输出：
```bash
hermes chat --verbose
```
