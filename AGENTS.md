# Hermes Agent - 开发指南

面向 AI 编码助手和开发者的 HermesAgent 代码库开发指南。

## 开发环境

```bash
# 优先使用 .venv；如果检出的是 venv 则回退到 venv。
source .venv/bin/activate   # 或: source venv/bin/activate
```

`scripts/run_tests.sh` 会依次探测 `.venv`、`venv`、`$HOME/.hermes/hermes-agent/venv`（用于与主检出共享 venv 的 worktree）。

## 项目结构

文件数量持续变化——不要将下面的树状图视为详尽清单。权威来源是文件系统。注释标注了你实际会编辑的关键入口点。

```
hermes-agent/
├── run_agent.py          # AIAgent 类——核心对话循环（~12k LOC）
├── model_tools.py        # 工具编排，discover_builtin_tools()，handle_function_call()
├── toolsets.py           # 工具集定义，_HERMES_CORE_TOOLS 列表
├── cli.py                # HermesCLI 类——交互式 CLI 编排器（~11k LOC）
├── hermes_state.py       # SessionDB——SQLite 会话存储（FTS5 搜索）
├── hermes_constants.py   # get_hermes_home()，display_hermes_home()——profile 感知路径
├── hermes_logging.py     # setup_logging()——agent.log / errors.log / gateway.log（profile 感知）
├── batch_runner.py       # 并行批处理
├── agent/                # Agent 内部模块（提供商适配器、记忆、缓存、压缩等）
├── hermes_cli/           # CLI 子命令、设置向导、插件加载器、皮肤引擎
├── tools/                # 工具实现——通过 tools/registry.py 自动发现
│   └── environments/     # 终端后端（local, docker, ssh, modal, daytona, singularity）
├── gateway/              # 消息网关——run.py + session.py + platforms/
│   ├── platforms/        # 每平台适配器（telegram, discord, slack, whatsapp,
│   │                     #   homeassistant, signal, matrix, mattermost, email, sms,
│   │                     #   dingtalk, wecom, weixin, feishu, qqbot, bluebubbles,
│   │                     #   webhook, api_server, ...）。参见 ADDING_A_PLATFORM.md。
│   └── builtin_hooks/    # 始终注册的网关 hooks（boot-md, ...）
├── plugins/              # 插件系统（见下方"插件"章节）
│   ├── memory/           # 记忆提供者插件（honcho, mem0, supermemory, ...）
│   ├── context_engine/   # 上下文引擎插件
│   └── <others>/         # Dashboard、图像生成、磁盘清理、示例等
├── optional-skills/      # 较重/小众的技能，随仓库发布但默认不激活
├── skills/               # 随仓库捆绑的内置技能
├── ui-tui/               # Ink (React) 终端 UI——`hermes --tui`
│   └── src/              # entry.tsx, app.tsx, gatewayClient.ts + app/components/hooks/lib
├── tui_gateway/          # TUI 的 Python JSON-RPC 后端
├── acp_adapter/          # ACP 服务器（VS Code / Zed / JetBrains 集成）
├── cron/                 # 调度器——jobs.py, scheduler.py
├── environments/         # RL 训练环境（Atropos）
├── scripts/              # run_tests.sh, release.py, 辅助脚本
├── website/              # Docusaurus 文档站
└── tests/                # Pytest 测试套件（截至 2026 年 4 月约 15k 测试，~700 文件）
```

**用户配置：** `~/.hermes/config.yaml`（设置），`~/.hermes/.env`（仅 API 密钥）。
**日志：** `~/.hermes/logs/`——`agent.log`（INFO+），`errors.log`（WARNING+），
运行 Gateway 时还有 `gateway.log`。通过 `get_hermes_home()` 实现 profile 感知。
使用 `hermes logs [--follow] [--level ...] [--session ...]` 浏览日志。

## 文件依赖链

```
tools/registry.py  （无依赖——被所有工具文件导入）
       ↑
tools/*.py  （每个在导入时调用 registry.register()）
       ↑
model_tools.py  （导入 tools/registry + 触发工具发现）
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

---

## AIAgent 类（run_agent.py）

`AIAgent.__init__` 实际接受约 60 个参数（凭据、路由、回调、会话上下文、预算、凭据池等）。下面的签名是你通常会接触到的最小子集——完整列表请阅读 `run_agent.py`。

```python
class AIAgent:
    def __init__(self,
        base_url: str = None,
        api_key: str = None,
        provider: str = None,
        api_mode: str = None,              # "chat_completions" | "codex_responses" | ...
        model: str = "",                   # 空 → 稍后从 config/provider 解析
        max_iterations: int = 90,          # 工具调用迭代次数（与子 Agent 共享）
        enabled_toolsets: list = None,
        disabled_toolsets: list = None,
        quiet_mode: bool = False,
        save_trajectories: bool = False,
        platform: str = None,              # "cli", "telegram" 等
        session_id: str = None,
        skip_context_files: bool = False,
        skip_memory: bool = False,
        credential_pool=None,
        # ... 加上回调、thread/user/chat ID、iteration_budget、fallback_model、
        # checkpoints 配置、prefill_messages、service_tier、reasoning_config 等。
    ): ...

    def chat(self, message: str) -> str:
        """简单接口——返回最终响应字符串。"""

    def run_conversation(self, user_message: str, system_message: str = None,
                         conversation_history: list = None, task_id: str = None) -> dict:
        """完整接口——返回包含 final_response + messages 的字典。"""
```

### Agent 循环

核心循环位于 `run_conversation()` 内——完全同步，包含中断检查、预算跟踪和一次 grace call：

```python
while (api_call_count < self.max_iterations and self.iteration_budget.remaining > 0) \
        or self._budget_grace_call:
    if self._interrupt_requested: break
    response = client.chat.completions.create(model=model, messages=messages, tools=tool_schemas)
    if response.tool_calls:
        for tool_call in response.tool_calls:
            result = handle_function_call(tool_call.name, tool_call.args, task_id)
            messages.append(tool_result_message(result))
        api_call_count += 1
    else:
        return response.content
```

消息遵循 OpenAI 格式：`{"role": "system/user/assistant/tool", ...}`。
推理内容存储在 `assistant_msg["reasoning"]` 中。

---

## CLI 架构（cli.py）

- **Rich** 用于 banner/面板，**prompt_toolkit** 用于带自动补全的输入
- **KawaiiSpinner**（`agent/display.py`）——API 调用时的动画面孔，`┊` 活动流显示工具结果
- `cli.py` 中的 `load_cli_config()` 合并硬编码默认值 + 用户配置 YAML
- **皮肤引擎**（`hermes_cli/skin_engine.py`）——数据驱动的 CLI 主题；启动时从 `display.skin` 配置键初始化；皮肤自定义 banner 颜色、spinner 面孔/动词/翅膀、工具前缀、响应框、品牌文本
- `process_command()` 是 `HermesCLI` 的方法——通过 `resolve_command()` 从中央注册表解析规范命令名后分发
- 技能斜杠命令：`agent/skill_commands.py` 扫描 `~/.hermes/skills/`，作为**用户消息**注入（非系统提示词）以保持 prompt caching

### 斜杠命令注册表（`hermes_cli/commands.py`）

所有斜杠命令在中央 `COMMAND_REGISTRY` 列表中定义为 `CommandDef` 对象。每个下游消费者自动从该注册表派生：

- **CLI**——`process_command()` 通过 `resolve_command()` 解析别名，按规范名分发
- **Gateway**——`GATEWAY_KNOWN_COMMANDS` frozenset 用于 hook 发出，`resolve_command()` 用于分发
- **Gateway 帮助**——`gateway_help_lines()` 生成 `/help` 输出
- **Telegram**——`telegram_bot_commands()` 生成 BotCommand 菜单
- **Slack**——`slack_subcommand_map()` 生成 `/hermes` 子命令路由
- **自动补全**——`COMMANDS` 扁平字典供 `SlashCommandCompleter` 使用
- **CLI 帮助**——`COMMANDS_BY_CATEGORY` 字典供 `show_help()` 使用

### 添加斜杠命令

1. 在 `hermes_cli/commands.py` 的 `COMMAND_REGISTRY` 中添加 `CommandDef` 条目：
```python
CommandDef("mycommand", "命令描述", "Session",
           aliases=("mc",), args_hint="[arg]"),
```
2. 在 `cli.py` 的 `HermesCLI.process_command()` 中添加处理程序：
```python
elif canonical == "mycommand":
    self._handle_mycommand(cmd_original)
```
3. 如果命令在 Gateway 中可用，在 `gateway/run.py` 中添加处理程序：
```python
if canonical == "mycommand":
    return await self._handle_mycommand(event)
```
4. 对于持久化设置，使用 `cli.py` 中的 `save_config_value()`

**CommandDef 字段：**
- `name`——不带斜杠的规范名（如 `"background"`）
- `description`——人类可读描述
- `category`——`"Session"`、`"Configuration"`、`"Tools & Skills"`、`"Info"`、`"Exit"` 之一
- `aliases`——替代名称元组（如 `("bg",)`）
- `args_hint`——帮助中显示的参数占位符（如 `"<prompt>"`、`"[name]"`）
- `cli_only`——仅在交互式 CLI 中可用
- `gateway_only`——仅在消息平台中可用
- `gateway_config_gate`——配置点路径（如 `"display.tool_progress_command"`）；当设置在 `cli_only` 命令上时，如果配置值为真，则该命令在 Gateway 中也可用。`GATEWAY_KNOWN_COMMANDS` 始终包含配置门控命令以便 Gateway 可以分发它们；帮助/菜单仅在门控打开时显示。

**添加别名**只需在现有 `CommandDef` 的 `aliases` 元组中添加即可。无需修改其他文件——分发、帮助文本、Telegram 菜单、Slack 映射和自动补全都会自动更新。

---

## TUI 架构（ui-tui + tui_gateway）

TUI 是经典（prompt_toolkit）CLI 的完整替代品，通过 `hermes --tui` 或 `HERMES_TUI=1` 激活。

### 进程模型

```
hermes --tui
  └─ Node (Ink)  ──stdio JSON-RPC──  Python (tui_gateway)
       │                                  └─ AIAgent + tools + sessions
       └─ 渲染对话、输入框、提示、活动
```

TypeScript 负责屏幕渲染。Python 负责会话、工具、模型调用和斜杠命令逻辑。

### 传输

通过 stdio 的换行分隔 JSON-RPC。Ink 发送请求，Python 发送事件。完整的方法/事件目录请参见 `tui_gateway/server.py`。

### 关键界面

| 界面 | Ink 组件 | Gateway 方法 |
|------|---------|-------------|
| 聊天流式 | `app.tsx` + `messageLine.tsx` | `prompt.submit` → `message.delta/complete` |
| 工具活动 | `thinking.tsx` | `tool.start/progress/complete` |
| 审批 | `prompts.tsx` | `approval.respond` ← `approval.request` |
| 确认/sudo/密码 | `prompts.tsx`、`maskedPrompt.tsx` | `clarify/sudo/secret.respond` |
| 会话选择器 | `sessionPicker.tsx` | `session.list/resume` |
| 斜杠命令 | 本地处理 + 回退 | `slash.exec` → `_SlashWorker`、`command.dispatch` |
| 补全 | `useCompletion` hook | `complete.slash`、`complete.path` |
| 主题 | `theme.ts` + `branding.tsx` | `gateway.ready` 包含皮肤数据 |

### 斜杠命令流程

1. 内置客户端命令（`/help`、`/quit`、`/clear`、`/resume`、`/copy`、`/paste` 等）在 `app.tsx` 中本地处理
2. 其他所有命令 → `slash.exec`（在持久 `_SlashWorker` 子进程中运行）→ `command.dispatch` 回退

### 开发命令

```bash
cd ui-tui
npm install       # 首次安装
npm run dev       # 监听模式（重建 hermes-ink + tsx --watch）
npm start         # 生产模式
npm run build     # 完整构建（hermes-ink + tsc）
npm run type-check # 仅类型检查（tsc --noEmit）
npm run lint      # eslint
npm run fmt       # prettier
npm test          # vitest
```

### Dashboard 中的 TUI（`hermes dashboard` → `/chat`）

Dashboard 嵌入的是真实的 `hermes --tui`——**不是**重写。参见 `hermes_cli/pty_bridge.py` + `hermes_cli/web_server.py` 中的 `@app.websocket("/api/pty")` 端点。

- 浏览器加载 `web/src/pages/ChatPage.tsx`，挂载 xterm.js 的 `Terminal`，使用 WebGL 渲染器、`@xterm/addon-fit` 用于容器驱动的调整大小、`@xterm/addon-unicode11` 用于现代宽字符宽度。
- `/api/pty?token=…` 升级为 WebSocket；认证使用与 REST 相同的临时 `_SESSION_TOKEN`，通过查询参数传递（浏览器在 WS 升级时无法设置 `Authorization`）。
- 服务器通过 `ptyprocess`（POSIX PTY——WSL 可用，原生 Windows 不支持）生成与 `hermes --tui` 相同的进程。
- 帧：双向原始 PTY 字节；通过 `\x1b[RESIZE:<cols>;<rows>]` 在服务器端拦截并应用 `TIOCSWINSZ` 进行调整大小。

**不要在 React 中重新实现主要聊天体验。** 主对话流、输入框/编辑器（包括斜杠命令行为）和 PTY 支持的终端属于嵌入的 `hermes --tui`——你在 Ink 中添加的任何新内容都会自动出现在 Dashboard 中。如果你发现自己在为 Dashboard 重建对话流或编辑器，请停止并改为扩展 Ink。

**当不是第二个聊天界面时，允许在 TUI 周围构建结构化 React UI。** 侧边栏小部件、检查器、摘要、状态面板和类似的支持视图（如 `ChatSidebar`、`ModelPickerDialog`、`ToolCall`）在补充嵌入 TUI 时是合适的，而不是替换对话/编辑器/终端。保持它们的状态独立于 PTY 子进程的会话，并以非破坏性方式显示它们的故障，使终端窗格保持正常工作。

---

## 添加新工具

需要修改 **2 个文件**：

**1. 创建 `tools/your_tool.py`：**
```python
import json, os
from tools.registry import registry

def check_requirements() -> bool:
    return bool(os.getenv("EXAMPLE_API_KEY"))

def example_tool(param: str, task_id: str = None) -> str:
    return json.dumps({"success": True, "data": "..."})

registry.register(
    name="example_tool",
    toolset="example",
    schema={"name": "example_tool", "description": "...", "parameters": {...}},
    handler=lambda args, **kw: example_tool(param=args.get("param", ""), task_id=kw.get("task_id")),
    check_fn=check_requirements,
    requires_env=["EXAMPLE_API_KEY"],
)
```

**2. 添加到 `toolsets.py`**——添加到 `_HERMES_CORE_TOOLS`（所有平台）或新建工具集。

自动发现：任何包含顶层 `registry.register()` 调用的 `tools/*.py` 文件都会被自动导入——无需维护手动导入列表。

注册表处理 schema 收集、分发、可用性检查和错误包装。所有处理程序必须返回 JSON 字符串。

**工具 schema 中的路径引用**：如果 schema 描述中提到文件路径（如默认输出目录），使用 `display_hermes_home()` 使其 profile 感知。Schema 在导入时生成，此时 `_apply_profile_override()` 已设置 `HERMES_HOME`。

**状态文件**：如果工具存储持久状态（缓存、日志、检查点），使用 `get_hermes_home()` 作为基础目录——永远不要使用 `Path.home() / ".hermes"`。这确保每个 profile 拥有自己的状态。

**Agent 级工具**（todo、memory）：在 `handle_function_call()` 之前被 `run_agent.py` 拦截。参见 `tools/todo_tool.py` 了解模式。

---

## 添加配置

### config.yaml 选项：
1. 添加到 `hermes_cli/config.py` 的 `DEFAULT_CONFIG`
2. 仅在需要主动迁移/转换现有用户配置时（重命名键、更改结构）才递增 `_config_version`（检查 `DEFAULT_CONFIG` 顶部的当前值）。向现有部分添加新键由深度合并自动处理，不需要版本递增。

### .env 变量（仅限密钥——API 密钥、令牌、密码）：
1. 添加到 `hermes_cli/config.py` 的 `OPTIONAL_ENV_VARS` 并附带元数据：
```python
"NEW_API_KEY": {
    "description": "用途说明",
    "prompt": "显示名称",
    "url": "https://...",
    "password": True,
    "category": "tool",  # provider, tool, messaging, setting
},
```

非密钥设置（超时、阈值、功能标志、路径、显示偏好）属于 `config.yaml`，而非 `.env`。如果内部代码需要 env var 镜像以保持向后兼容性，请在代码中从 `config.yaml` 桥接到 env var（参见 `gateway_timeout`、`terminal.cwd` → `TERMINAL_CWD`）。

### 配置加载器（三条路径——知道你在哪条上）：

| 加载器 | 使用者 | 位置 |
|--------|-------|------|
| `load_cli_config()` | CLI 模式 | `cli.py`——合并 CLI 特定默认值 + 用户 YAML |
| `load_config()` | `hermes tools`、`hermes setup`、大多数 CLI 子命令 | `hermes_cli/config.py`——合并 `DEFAULT_CONFIG` + 用户 YAML |
| 直接 YAML 加载 | Gateway 运行时 | `gateway/run.py` + `gateway/config.py`——直接读取用户 YAML |

如果你添加了新键但 CLI 能看到而 Gateway 看不到（或反之），说明你在错误的加载器上。检查 `DEFAULT_CONFIG` 覆盖范围。

### 工作目录：
- **CLI**——使用进程的当前目录（`os.getcwd()`）。
- **消息平台**——使用 `config.yaml` 中的 `terminal.cwd`。Gateway 将此桥接到子工具的 `TERMINAL_CWD` env var。**`MESSAGING_CWD` 已被移除**——如果在 `.env` 中设置了它，配置加载器会打印弃用警告。`.env` 中的 `TERMINAL_CWD` 同理；规范设置是 `config.yaml` 中的 `terminal.cwd`。

---

## 皮肤/主题系统

皮肤引擎（`hermes_cli/skin_engine.py`）提供数据驱动的 CLI 视觉自定义。皮肤是**纯数据**——添加新皮肤无需修改代码。

### 架构

```
hermes_cli/skin_engine.py    # SkinConfig 数据类、内置皮肤、YAML 加载器
~/.hermes/skins/*.yaml       # 用户安装的自定义皮肤（拖放即可）
```

- `init_skin_from_config()`——CLI 启动时调用，从配置读取 `display.skin`
- `get_active_skin()`——返回当前皮肤的缓存 `SkinConfig`
- `set_active_skin(name)`——运行时切换皮肤（`/skin` 命令使用）
- `load_skin(name)`——优先加载用户皮肤，然后内置皮肤，最后回退到默认值
- 缺失的皮肤值自动从 `default` 皮肤继承

### 皮肤自定义内容

| 元素 | 皮肤键 | 使用者 |
|------|--------|-------|
| Banner 面板边框 | `colors.banner_border` | `banner.py` |
| Banner 面板标题 | `colors.banner_title` | `banner.py` |
| Banner 节标题 | `colors.banner_accent` | `banner.py` |
| Banner 暗文本 | `colors.banner_dim` | `banner.py` |
| Banner 正文 | `colors.banner_text` | `banner.py` |
| 响应框边框 | `colors.response_border` | `cli.py` |
| Spinner 面孔（等待） | `spinner.waiting_faces` | `display.py` |
| Spinner 面孔（思考） | `spinner.thinking_faces` | `display.py` |
| Spinner 动词 | `spinner.thinking_verbs` | `display.py` |
| Spinner 翅膀（可选） | `spinner.wings` | `display.py` |
| 工具输出前缀 | `tool_prefix` | `display.py` |
| 每工具 emoji | `tool_emojis` | `display.py` → `get_tool_emoji()` |
| Agent 名称 | `branding.agent_name` | `banner.py`、`cli.py` |
| 欢迎消息 | `branding.welcome` | `cli.py` |
| 响应框标签 | `branding.response_label` | `cli.py` |
| 提示符号 | `branding.prompt_symbol` | `cli.py` |

### 内置皮肤

- `default`——经典 Hermes 金色/可爱风格（当前外观）
- `ares`——深红/青铜战神主题，带自定义 spinner 翅膀
- `mono`——简洁灰度单色
- `slate`——冷蓝色开发者主题

### 添加内置皮肤

在 `hermes_cli/skin_engine.py` 的 `_BUILTIN_SKINS` 字典中添加：

```python
"mytheme": {
    "name": "mytheme",
    "description": "简短描述",
    "colors": { ... },
    "spinner": { ... },
    "branding": { ... },
    "tool_prefix": "┊",
},
```

### 用户皮肤（YAML）

用户创建 `~/.hermes/skins/<name>.yaml`：

```yaml
name: cyberpunk
description: 霓虹终端主题

colors:
  banner_border: "#FF00FF"
  banner_title: "#00FFFF"
  banner_accent: "#FF1493"

spinner:
  thinking_verbs: ["接入中", "解密中", "上传中"]
  wings:
    - ["⟨⚡", "⚡⟩"]

branding:
  agent_name: "赛博 Agent"
  response_label: " ⚡ 赛博 "

tool_prefix: "▏"
```

通过 `/skin cyberpunk` 或 config.yaml 中的 `display.skin: cyberpunk` 激活。

---

## 插件

Hermes 有两个插件表面。它们都位于仓库的 `plugins/` 下，以便仓库发布的插件可以与 `~/.hermes/plugins/` 中的用户安装插件和 pip 安装的 entry points 一起被发现。

### 通用插件（`hermes_cli/plugins.py` + `plugins/<name>/`）

`PluginManager` 从 `~/.hermes/plugins/`、`./.hermes/plugins/` 和 pip entry points 发现插件。每个插件暴露一个 `register(ctx)` 函数，可以：

- 注册 Python 回调生命周期 hooks：
  `pre_tool_call`、`post_tool_call`、`pre_llm_call`、`post_llm_call`、
  `on_session_start`、`on_session_end`
- 通过 `ctx.register_tool(...)` 注册新工具
- 通过 `ctx.register_cli_command(...)` 注册 CLI 子命令——插件的 argparse 树在启动时接入 `hermes`，使 `hermes <pluginname> <subcmd>` 无需修改 `main.py` 即可工作

Hooks 从 `model_tools.py`（pre/post tool）和 `run_agent.py`（生命周期）调用。**发现时机陷阱：** `discover_plugins()` 仅作为导入 `model_tools.py` 的副作用运行。读取插件状态但未导入 `model_tools.py` 的代码路径必须显式调用 `discover_plugins()`（它是幂等的）。

### 记忆提供者插件（`plugins/memory/<name>/`）

可插拔记忆后端的独立发现系统。当前内置提供者包括 **honcho、mem0、supermemory、byterover、hindsight、holographic、openviking、retaindb**。

每个提供者实现 `MemoryProvider` ABC（参见 `agent/memory_provider.py`），由 `agent/memory_manager.py` 编排。生命周期 hooks 包括 `sync_turn(turn_messages)`、`prefetch(query)`、`shutdown()`，以及可选的 `post_setup(hermes_home, config)` 用于设置向导集成。

**通过 `plugins/memory/<name>/cli.py` 的 CLI 命令：** 如果记忆插件定义了 `register_cli(subparser)`，`discover_plugin_cli_commands()` 在 argparse 设置时发现它并接入 `hermes <plugin>`。框架仅为**当前激活的**记忆提供者（从 config.yaml 的 `memory.provider` 读取）暴露 CLI 命令，因此禁用的提供者不会使 `hermes --help` 变得杂乱。

**规则：** 插件不得修改核心文件（`run_agent.py`、`cli.py`、`gateway/run.py`、`hermes_cli/main.py` 等）。如果插件需要框架未暴露的能力，请扩展通用插件表面（新 hook、新 ctx 方法）——永远不要将插件特定逻辑硬编码到核心中。

### Dashboard / 上下文引擎 / 图像生成插件目录

`plugins/context_engine/`、`plugins/image_gen/`、`plugins/example-dashboard/` 等遵循相同模式（ABC + 编排器 + 每插件目录）。上下文引擎接入 `agent/context_engine.py`；图像生成提供者接入 `agent/image_gen_provider.py`。

---

## 技能

两个并行表面：

- **`skills/`**——内置技能，随仓库发布并默认可加载。按类别目录组织（如 `skills/github/`、`skills/mlops/`）。
- **`optional-skills/`**——较重或小众的技能，随仓库发布但默认不激活。通过 `hermes skills install official/<category>/<skill>` 显式安装。适配器位于 `tools/skills_hub.py`（`OptionalSkillSource`）。类别包括 `autonomous-ai-agents`、`blockchain`、`communication`、`creative`、`devops`、`email`、`health`、`mcp`、`migration`、`mlops`、`productivity`、`research`、`security`、`web-development`。

审查技能 PR 时，检查它们的目标目录——重依赖或小众技能应放在 `optional-skills/` 中。

### SKILL.md frontmatter

标准字段：`name`、`description`、`version`、`platforms`（操作系统门控列表：`[macos]`、`[linux, macos]` 等）、`metadata.hermes.tags`、`metadata.hermes.category`、`metadata.hermes.config`（技能所需的 config.yaml 设置——存储在 `skills.config.<key>` 下，设置时提示，加载时注入）。

---

## 重要策略

### Prompt Caching 不得被破坏

Hermes-Agent 确保缓存在整个对话中保持有效。**不要实施以下更改：**
- 在对话中途修改过去的上下文
- 在对话中途更改工具集
- 在对话中途重新加载记忆或重建系统提示词

缓存破坏会导致成本急剧上升。我们唯一修改上下文的时机是上下文压缩时。

修改系统提示词状态的斜杠命令（技能、工具、记忆等）必须**缓存感知**：默认延迟失效（更改在下次会话生效），提供可选的 `--now` 标志用于立即失效。参见 `/skills install --now` 了解规范模式。

### 后台进程通知（Gateway）

当使用 `terminal(background=true, notify_on_complete=true)` 时，Gateway 运行一个监视器检测进程完成并触发新的 Agent 回合。通过 config.yaml 中的 `display.background_process_notifications`（或 `HERMES_BACKGROUND_NOTIFICATIONS` env var）控制后台进程消息的详细程度：

- `all`——运行时输出更新 + 最终消息（默认）
- `result`——仅最终完成消息
- `error`——仅退出码 != 0 时的最终消息
- `off`——完全不显示监视器消息

---

## Profiles：多实例支持

Hermes 支持 **profiles**——多个完全隔离的实例，每个拥有自己的 `HERMES_HOME` 目录（配置、API 密钥、记忆、会话、技能、Gateway 等）。

核心机制：`hermes_cli/main.py` 中的 `_apply_profile_override()` 在任何模块导入之前设置 `HERMES_HOME`。所有 `get_hermes_home()` 引用自动限定到活动 profile。

### Profile 安全代码规则

1. **对所有 HERMES_HOME 路径使用 `get_hermes_home()`。** 从 `hermes_constants` 导入。永远不要在读写状态的代码中硬编码 `~/.hermes` 或 `Path.home() / ".hermes"`。
   ```python
   # 正确
   from hermes_constants import get_hermes_home
   config_path = get_hermes_home() / "config.yaml"

   # 错误——破坏 profiles
   config_path = Path.home() / ".hermes" / "config.yaml"
   ```

2. **对面向用户的消息使用 `display_hermes_home()`。** 从 `hermes_constants` 导入。默认返回 `~/.hermes`，profile 返回 `~/.hermes/profiles/<name>`。
   ```python
   # 正确
   from hermes_constants import display_hermes_home
   print(f"配置已保存到 {display_hermes_home()}/config.yaml")

   # 错误——profile 时显示错误路径
   print("配置已保存到 ~/.hermes/config.yaml")
   ```

3. **模块级常量没问题**——它们在导入时缓存 `get_hermes_home()`，此时 `_apply_profile_override()` 已设置 env var。只需使用 `get_hermes_home()`，而非 `Path.home() / ".hermes"`。

4. **模拟 `Path.home()` 的测试也必须设置 `HERMES_HOME`**——因为代码现在使用 `get_hermes_home()`（读取 env var），而非 `Path.home() / ".hermes"`：
   ```python
   with patch.object(Path, "home", return_value=tmp_path), \
        patch.dict(os.environ, {"HERMES_HOME": str(tmp_path / ".hermes")}):
       ...
   ```

5. **Gateway 平台适配器应使用令牌锁**——如果适配器使用唯一凭据（bot token、API key）连接，在 `connect()`/`start()` 方法中调用 `gateway.status` 的 `acquire_scoped_lock()`，在 `disconnect()`/`stop()` 中调用 `release_scoped_lock()`。这防止两个 profile 使用相同凭据。参见 `gateway/platforms/telegram.py` 了解规范模式。

6. **Profile 操作是 HOME 锚定的，而非 HERMES_HOME 锚定的**——`_get_profiles_root()` 返回 `Path.home() / ".hermes" / "profiles"`，而非 `get_hermes_home() / "profiles"`。这是有意为之——它允许 `hermes -p coder profile list` 无论活动 profile 是哪个都能看到所有 profiles。

## 已知陷阱

### 不要硬编码 `~/.hermes` 路径
代码路径使用 `hermes_constants` 的 `get_hermes_home()`。面向用户的打印/日志消息使用 `display_hermes_home()`。硬编码 `~/.hermes` 会破坏 profiles——每个 profile 有自己的 `HERMES_HOME` 目录。这是 PR #3575 中修复的 5 个 bug 的根源。

### 不要引入新的 `simple_term_menu` 用法
`hermes_cli/main.py` 中的现有调用点仅作为遗留回退保留；首选 UI 是 curses（stdlib），因为 `simple_term_menu` 在 tmux/iTerm2 中使用方向键时有幽灵复制渲染 bug。新的交互式菜单必须使用 `hermes_cli/curses_ui.py`——参见 `hermes_cli/tools_config.py` 了解规范模式。

### 不要在 spinner/display 代码中使用 `\033[K`（ANSI 擦除到行尾）
在 `prompt_toolkit` 的 `patch_stdout` 下会泄露为字面 `?[K` 文本。使用空格填充：`f"\r{line}{' ' * pad}"`。

### `_last_resolved_tool_names` 是 `model_tools.py` 中的进程全局变量
`delegate_tool.py` 中的 `_run_single_child()` 在子 Agent 执行前后保存和恢复此全局变量。如果你添加了读取此全局变量的新代码，注意它在子 Agent 运行期间可能暂时过时。

### 不要在 schema 描述中硬编码跨工具引用
工具 schema 描述不得按名称提及其他工具集的工具（如 `browser_navigate` 说"优先使用 web_search"）。这些工具可能不可用（缺少 API 密钥、禁用的工具集），导致模型幻觉调用不存在的工具。如果需要交叉引用，请在 `model_tools.py` 的 `get_tool_definitions()` 中动态添加——参见 `browser_navigate` / `execute_code` 后处理块了解模式。

### Gateway 有两个消息守卫——两者都必须绕过审批/控制命令
当 Agent 运行时，消息通过两个连续守卫：(1) **base adapter**（`gateway/platforms/base.py`）在 `session_key in self._active_sessions` 时将消息排队到 `_pending_messages`，(2) **gateway runner**（`gateway/run.py`）在消息到达 `running_agent.interrupt()` 之前拦截 `/stop`、`/new`、`/queue`、`/status`、`/approve`、`/deny`。任何在 Agent 阻塞时必须到达 runner 的新命令（如审批提示）必须绕过两个守卫并内联分发，而非通过 `_process_message_background()`（它会与会话生命周期竞争）。

### 从过时分支进行 squash merge 会静默撤销最近的修复
在 squash merge PR 之前，确保分支与 `main` 保持同步（在 worktree 中 `git fetch origin main && git reset --hard origin/main`，然后重新应用 PR 的提交）。过时分支的不相关文件版本在 squash 时会静默覆盖 main 上的最近修复。合并后用 `git diff HEAD~1..HEAD` 验证——意外删除是危险信号。

### 不要在没有 E2E 验证的情况下接入死代码
未发布的未使用代码之所以是死的，是有原因的。在将未使用模块接入活跃代码路径之前，使用真实导入（非模拟）针对临时 `HERMES_HOME` 进行 E2E 测试。

### 测试不得写入 `~/.hermes/`
`tests/conftest.py` 中的 `_isolate_hermes_home` autouse fixture 将 `HERMES_HOME` 重定向到临时目录。永远不要在测试中硬编码 `~/.hermes/` 路径。

**Profile 测试**：测试 profile 功能时，还要模拟 `Path.home()` 以便 `_get_profiles_root()` 和 `_get_default_hermes_home()` 在临时目录内解析。使用 `tests/hermes_cli/test_profiles.py` 中的模式：
```python
@pytest.fixture
def profile_env(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setenv("HERMES_HOME", str(home))
    return home
```

---

## 测试

**始终使用 `scripts/run_tests.sh`**——不要直接调用 `pytest`。该脚本强制与 CI 保持环境一致性（清除凭据变量、TZ=UTC、LANG=C.UTF-8、4 个 xdist workers 匹配 GHA ubuntu-latest）。在 16+ 核开发者机器上直接 `pytest` 且设置了 API 密钥会与 CI 产生差异，已导致多次"本地通过、CI 失败"的事故（反之亦然）。

```bash
scripts/run_tests.sh                                  # 完整套件，CI 一致性
scripts/run_tests.sh tests/gateway/                   # 单个目录
scripts/run_tests.sh tests/agent/test_foo.py::test_x  # 单个测试
scripts/run_tests.sh -v --tb=long                     # 透传 pytest 标志
```

### 为什么需要包装器（以及为什么旧的"直接调用 pytest"不再有效）

脚本解决了五个真实的本地 vs CI 差异源：

| | 无包装器 | 有包装器 |
|---|---|---|
| 提供商 API 密钥 | 你环境中的任何值（自动检测池） | 所有 `*_API_KEY`/`*_TOKEN` 等被清除 |
| HOME / `~/.hermes/` | 你的真实 config+auth.json | 每个测试使用临时目录 |
| 时区 | 本地 TZ（PDT 等） | UTC |
| Locale | 任意设置 | C.UTF-8 |
| xdist workers | `-n auto` = 所有核心（工作站上 20+） | `-n 4` 匹配 CI |

`tests/conftest.py` 还作为 autouse fixture 强制执行第 1-4 点，因此任何 pytest 调用（包括 IDE 集成）都会获得一致行为——但包装器是双重保险。

### 不使用包装器运行（仅在必须时）

如果你无法使用包装器（如在 Windows 或直接调用 pytest 的 IDE 中），至少激活 venv 并传递 `-n 4`：

```bash
source .venv/bin/activate   # 或: source venv/bin/activate
python -m pytest tests/ -q -n 4
```

Worker 数量超过 4 会暴露 CI 从未看到的测试排序问题。

推送更改前始终运行完整套件。

### 不要编写变更检测测试

如果测试在**预期会变化**的数据更新时失败——模型目录、配置版本号、枚举计数、提供商模型的硬编码列表——那么它就是**变更检测测试**。这些测试不增加行为覆盖；它们只保证常规源更新会破坏 CI 并花费工程时间来"修复"。

**不要写：**

```python
# 目录快照——每次模型发布都破坏
assert "gemini-2.5-pro" in _PROVIDER_MODELS["gemini"]
assert "MiniMax-M2.7" in models

# 配置版本字面量——每次 schema 升级都破坏
assert DEFAULT_CONFIG["_config_version"] == 21

# 枚举计数——每次添加技能/提供商都破坏
assert len(_PROVIDER_MODELS["huggingface"]) == 8
```

**应该写：**

```python
# 行为：目录管道是否正常工作？
assert "gemini" in _PROVIDER_MODELS
assert len(_PROVIDER_MODELS["gemini"]) >= 1

# 行为：迁移是否将用户版本升级到最新？
assert raw["_config_version"] == DEFAULT_CONFIG["_config_version"]

# 不变量：仅 plan 模型不得泄露到遗留列表
assert not (set(moonshot_models) & coding_plan_only_models)

# 不变量：目录中的每个模型都有上下文长度条目
for m in _PROVIDER_MODELS["huggingface"]:
    assert m.lower() in DEFAULT_CONTEXT_LENGTHS_LOWER
```

规则：如果测试读起来像当前数据的快照，删除它。如果读起来像两条数据之间必须保持的关系契约，保留它。当 PR 添加新提供商/模型且你想要测试时，让测试断言关系（如"目录条目都有上下文长度"），而非具体名称。

审查者应拒绝新的变更检测测试；作者应在重新请求审查前将其转换为不变量。
