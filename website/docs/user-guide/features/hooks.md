---
sidebar_position: 6
title: "事件钩子"
description: "在关键生命周期点运行自定义代码——记录活动、发送警报、发布到 webhook"
---

# 事件钩子

Hermes 有三个钩子系统，在关键生命周期点运行自定义代码：

| 系统 | 注册方式 | 运行环境 | 用例 |
|------|---------|---------|------|
| **[网关钩子](#网关事件钩子)** | `HOOK.yaml` + `handler.py` 在 `~/.hermes/hooks/` | 仅网关 | 日志记录、警报、webhook |
| **[插件钩子](#插件钩子)** | `ctx.register_hook()` 在[插件](/docs/user-guide/features/plugins)中 | CLI + 网关 | 工具拦截、指标、护栏 |
| **[Shell 钩子](#shell-钩子)** | `~/.hermes/config.yaml` 中的 `hooks:` 块指向 shell 脚本 | CLI + 网关 | 即用脚本用于阻止、自动格式化、上下文注入 |

所有三个系统都是非阻塞的——任何钩子中的错误被捕获并记录，永远不会崩溃代理。

## 网关事件钩子

网关钩子在网关运行期间（Telegram、Discord、Slack、WhatsApp）自动触发，不阻塞主管线。

### 创建钩子

每个钩子是 `~/.hermes/hooks/` 下的目录，包含两个文件：

```text
~/.hermes/hooks/
└── my-hook/
    ├── HOOK.yaml      # 声明要监听的事件
    └── handler.py     # Python 处理函数
```

#### HOOK.yaml

```yaml
name: my-hook
description: Log all agent activity to a file
events:
  - agent:start
  - agent:end
  - agent:step
```

`events` 列表决定哪些事件触发你的处理器。你可以订阅任何事件组合，包括通配符如 `command:*`。

#### handler.py

```python
import json
from datetime import datetime
from pathlib import Path

LOG_FILE = Path.home() / ".hermes" / "hooks" / "my-hook" / "activity.log"

async def handle(event_type: str, context: dict):
    """Called for each subscribed event. Must be named 'handle'."""
    entry = {
        "timestamp": datetime.now().isoformat(),
        "event": event_type,
        **context,
    }
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")
```

**处理器规则：**
- 必须命名为 `handle`
- 接收 `event_type`（字符串）和 `context`（字典）
- 可以是 `async def` 或普通 `def`——两者都有效
- 错误被捕获并记录，永远不会崩溃代理

### 可用事件

| 事件 | 触发时机 | 上下文键 |
|------|---------|---------|
| `gateway:startup` | 网关进程启动 | `platforms`（活跃平台名称列表） |
| `session:start` | 新消息会话创建 | `platform`、`user_id`、`session_id`、`session_key` |
| `session:end` | 会话结束（重置前） | `platform`、`user_id`、`session_key` |
| `session:reset` | 用户运行 `/new` 或 `/reset` | `platform`、`user_id`、`session_key` |
| `agent:start` | 代理开始处理消息 | `platform`、`user_id`、`session_id`、`message` |
| `agent:step` | 工具调用循环的每次迭代 | `platform`、`user_id`、`session_id`、`iteration`、`tool_names` |
| `agent:end` | 代理完成处理 | `platform`、`user_id`、`session_id`、`message`、`response` |
| `command:*` | 执行任何斜杠命令 | `platform`、`user_id`、`command`、`args` |

#### 通配符匹配

为 `command:*` 注册的处理器对任何 `command:` 事件触发（`command:model`、`command:reset` 等）。用单个订阅监控所有斜杠命令。

### 示例

#### 启动检查清单（BOOT.md）——内置

网关附带内置的 `boot-md` 钩子，每次启动时查找 `~/.hermes/BOOT.md`。如果文件存在，代理在后台会话中运行其指令。无需安装——只需创建文件。

**创建 `~/.hermes/BOOT.md`：**

```markdown
# Startup Checklist

1. Check if any cron jobs failed overnight — run `hermes cron list`
2. Send a message to Discord #general saying "Gateway restarted, all systems go"
3. Check if /opt/app/deploy.log has any errors from the last 24 hours
```

代理在后台线程中运行这些指令，因此不阻塞网关启动。如果无需关注，代理回复 `[SILENT]`，不投递消息。

:::tip
没有 BOOT.md？钩子静默跳过——零开销。需要启动自动化时创建文件，不需要时删除。
:::

#### 长任务 Telegram 警报

当代理执行超过 10 步时给自己发送消息：

```yaml
# ~/.hermes/hooks/long-task-alert/HOOK.yaml
name: long-task-alert
description: Alert when agent is taking many steps
events:
  - agent:step
```

```python
# ~/.hermes/hooks/long-task-alert/handler.py
import os
import httpx

THRESHOLD = 10
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_HOME_CHANNEL")

async def handle(event_type: str, context: dict):
    iteration = context.get("iteration", 0)
    if iteration == THRESHOLD and BOT_TOKEN and CHAT_ID:
        tools = ", ".join(context.get("tool_names", []))
        text = f"⚠️ Agent has been running for {iteration} steps. Last tools: {tools}"
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": CHAT_ID, "text": text},
            )
```

#### 命令使用记录器

跟踪哪些斜杠命令被使用：

```yaml
# ~/.hermes/hooks/command-logger/HOOK.yaml
name: command-logger
description: Log slash command usage
events:
  - command:*
```

```python
# ~/.hermes/hooks/command-logger/handler.py
import json
from datetime import datetime
from pathlib import Path

LOG = Path.home() / ".hermes" / "logs" / "command_usage.jsonl"

def handle(event_type: str, context: dict):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "ts": datetime.now().isoformat(),
        "command": context.get("command"),
        "args": context.get("args"),
        "platform": context.get("platform"),
        "user": context.get("user_id"),
    }
    with open(LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")
```

#### 会话启动 Webhook

新会话时 POST 到外部服务：

```yaml
# ~/.hermes/hooks/session-webhook/HOOK.yaml
name: session-webhook
description: Notify external service on new sessions
events:
  - session:start
  - session:reset
```

```python
# ~/.hermes/hooks/session-webhook/handler.py
import httpx

WEBHOOK_URL = "https://your-service.example.com/hermes-events"

async def handle(event_type: str, context: dict):
    async with httpx.AsyncClient() as client:
        await client.post(WEBHOOK_URL, json={
            "event": event_type,
            **context,
        }, timeout=5)
```

### 工作原理

1. 网关启动时，`HookRegistry.discover_and_load()` 扫描 `~/.hermes/hooks/`
2. 每个包含 `HOOK.yaml` + `handler.py` 的子目录被动态加载
3. 处理器注册其声明的事件
4. 在每个生命周期点，`hooks.emit()` 触发所有匹配的处理器
5. 任何处理器中的错误被捕获并记录——损坏的钩子永远不会崩溃代理

:::info
网关钩子仅在**网关**（Telegram、Discord、Slack、WhatsApp）中触发。CLI 不加载网关钩子。要在所有地方工作的钩子，请使用[插件钩子](#插件钩子)。
:::

## 插件钩子

[插件](/docs/user-guide/features/plugins)可以注册在 **CLI 和网关**会话中都触发的钩子。这些通过插件 `register()` 函数中的 `ctx.register_hook()` 编程式注册。

```python
def register(ctx):
    ctx.register_hook("pre_tool_call", my_tool_observer)
    ctx.register_hook("post_tool_call", my_tool_logger)
    ctx.register_hook("pre_llm_call", my_memory_callback)
    ctx.register_hook("post_llm_call", my_sync_callback)
    ctx.register_hook("on_session_start", my_init_callback)
    ctx.register_hook("on_session_end", my_cleanup_callback)
```

**所有钩子的通用规则：**

- 回调接收**关键字参数**。始终接受 `**kwargs` 以实现前向兼容——未来版本可能添加新参数而不破坏你的插件。
- 如果回调**崩溃**，它被记录并跳过。其他钩子和代理正常继续。行为不端的插件永远不会破坏代理。
- 两个钩子的返回值影响行为：[`pre_tool_call`](#pre_tool_call) 可以**阻止**工具，[`pre_llm_call`](#pre_llm_call) 可以向 LLM 调用**注入上下文**。所有其他钩子是发射即忘的观察者。

### 快速参考

| 钩子 | 触发时机 | 返回值 |
|------|---------|--------|
| [`pre_tool_call`](#pre_tool_call) | 任何工具执行前 | `{"action": "block", "message": str}` 以否决调用 |
| [`post_tool_call`](#post_tool_call) | 任何工具返回后 | 忽略 |
| [`pre_llm_call`](#pre_llm_call) | 每轮一次，工具调用循环前 | `{"context": str}` 以向前置上下文到用户消息 |
| [`post_llm_call`](#post_llm_call) | 每轮一次，工具调用循环后 | 忽略 |
| [`on_session_start`](#on_session_start) | 新会话创建（仅第一轮） | 忽略 |
| [`on_session_end`](#on_session_end) | 会话结束 | 忽略 |
| [`on_session_finalize`](#on_session_finalize) | CLI/网关拆卸活跃会话（刷新、保存、统计） | 忽略 |
| [`on_session_reset`](#on_session_reset) | 网关交换新会话键（例如 `/new`、`/reset`） | 忽略 |
| [`subagent_stop`](#subagent_stop) | `delegate_task` 子级已退出 | 忽略 |
| [`pre_gateway_dispatch`](#pre_gateway_dispatch) | 网关收到用户消息，认证 + 调度前 | `{"action": "skip" \| "rewrite" \| "allow", ...}` 以影响流程 |

---

### `pre_tool_call`

在每次工具执行**之前**触发——内置工具和插件工具都是如此。

**回调签名：**

```python
def my_callback(tool_name: str, args: dict, task_id: str, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `tool_name` | `str` | 即将执行的工具名称（例如 `"terminal"`、`"web_search"`、`"read_file"`） |
| `args` | `dict` | 模型传递给工具的参数 |
| `task_id` | `str` | 会话/任务标识符。如果未设置则为空字符串 |

**触发位置：** 在 `model_tools.py` 中，`handle_function_call()` 内部，工具处理器运行之前。每次工具调用触发一次——如果模型并行调用 3 个工具，这触发 3 次。

**返回值——否决调用：**

```python
return {"action": "block", "message": "Reason the tool call was blocked"}
```

代理用 `message` 作为返回给模型的错误短路工具。第一个匹配的阻止指令获胜（Python 插件先注册，然后是 shell 钩子）。任何其他返回值被忽略，因此现有的仅观察回调保持不变。

**用例：** 日志记录、审计跟踪、工具调用计数器、阻止危险操作、速率限制、每用户策略执行。

**示例——工具调用审计日志：**

```python
import json, logging
from datetime import datetime

logger = logging.getLogger(__name__)

def audit_tool_call(tool_name, args, task_id, **kwargs):
    logger.info("TOOL_CALL session=%s tool=%s args=%s",
                task_id, tool_name, json.dumps(args)[:200])

def register(ctx):
    ctx.register_hook("pre_tool_call", audit_tool_call)
```

**示例——危险工具警告：**

```python
DANGEROUS = {"terminal", "write_file", "patch"}

def warn_dangerous(tool_name, **kwargs):
    if tool_name in DANGEROUS:
        print(f"⚠ Executing potentially dangerous tool: {tool_name}")

def register(ctx):
    ctx.register_hook("pre_tool_call", warn_dangerous)
```

---

### `post_tool_call`

在每次工具执行返回**之后**触发。

**回调签名：**

```python
def my_callback(tool_name: str, args: dict, result: str, task_id: str,
                duration_ms: int, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `tool_name` | `str` | 刚执行的工具名称 |
| `args` | `dict` | 模型传递给工具的参数 |
| `result` | `str` | 工具的返回值（始终是 JSON 字符串） |
| `task_id` | `str` | 会话/任务标识符。如果未设置则为空字符串 |
| `duration_ms` | `int` | 工具调度耗时，毫秒（用 `time.monotonic()` 在 `registry.dispatch()` 周围测量） |

**触发位置：** 在 `model_tools.py` 中，`handle_function_call()` 内部，工具处理器返回之后。每次工具调用触发一次。如果工具引发未处理异常则**不**触发（错误被捕获并作为错误 JSON 字符串返回，`post_tool_call` 以该错误字符串作为 `result` 触发）。

**返回值：** 忽略。

**用例：** 记录工具结果、指标收集、跟踪工具成功/失败率、延迟仪表板、每工具预算警报、特定工具完成时发送通知。

**示例——跟踪工具使用指标：**

```python
from collections import Counter, defaultdict
import json

_tool_counts = Counter()
_error_counts = Counter()
_latency_ms = defaultdict(list)

def track_metrics(tool_name, result, duration_ms=0, **kwargs):
    _tool_counts[tool_name] += 1
    _latency_ms[tool_name].append(duration_ms)
    try:
        parsed = json.loads(result)
        if "error" in parsed:
            _error_counts[tool_name] += 1
    except (json.JSONDecodeError, TypeError):
        pass

def register(ctx):
    ctx.register_hook("post_tool_call", track_metrics)
```

---

### `pre_llm_call`

**每轮一次**，工具调用循环开始前触发。这是**唯一使用返回值的钩子**——它可以向当前轮次的用户消息注入上下文。

**回调签名：**

```python
def my_callback(session_id: str, user_message: str, conversation_history: list,
                is_first_turn: bool, model: str, platform: str, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `session_id` | `str` | 当前会话的唯一标识符 |
| `user_message` | `str` | 用户此轮的原始消息（任何技能注入之前） |
| `conversation_history` | `list` | 完整消息列表的副本（OpenAI 格式：`[{"role": "user", "content": "..."}]`） |
| `is_first_turn` | `bool` | 如果是新会话的第一轮则为 `True`，后续轮次为 `False` |
| `model` | `str` | 模型标识符（例如 `"anthropic/claude-sonnet-4.6"`） |
| `platform` | `str` | 会话运行位置：`"cli"`、`"telegram"`、`"discord"` 等 |

**触发位置：** 在 `run_agent.py` 中，`run_conversation()` 内部，上下文压缩之后但主 `while` 循环之前。每次 `run_conversation()` 调用触发一次（即每用户轮次一次），不是工具循环内每次 API 调用一次。

**返回值：** 如果回调返回带有 `"context"` 键的字典，或纯非空字符串，文本被追加到当前轮次的用户消息。返回 `None` 表示不注入。

```python
# 注入上下文
return {"context": "Recalled memories:\n- User likes Python\n- Working on hermes-agent"}

# 纯字符串（等效）
return "Recalled memories:\n- User likes Python"

# 不注入
return None
```

**上下文注入位置：** 始终是**用户消息**，永远不是系统提示。这保留了提示缓存——系统提示在轮次间保持相同，因此缓存令牌被复用。系统提示是 Hermes 的领域（模型引导、工具执行、人格、技能）。插件在用户输入旁边贡献上下文。

所有注入的上下文是**临时的**——仅在 API 调用时添加。对话历史中的原始用户消息永远不会被修改，也不会持久化到会话数据库。

当**多个插件**返回上下文时，它们的输出在插件发现顺序（按目录名字母顺序）中用双换行符连接。

**用例：** 记忆召回、RAG 上下文注入、护栏、每轮分析。

**示例——记忆召回：**

```python
import httpx

MEMORY_API = "https://your-memory-api.example.com"

def recall(session_id, user_message, is_first_turn, **kwargs):
    try:
        resp = httpx.post(f"{MEMORY_API}/recall", json={
            "session_id": session_id,
            "query": user_message,
        }, timeout=3)
        memories = resp.json().get("results", [])
        if not memories:
            return None
        text = "Recalled context:\n" + "\n".join(f"- {m['text']}" for m in memories)
        return {"context": text}
    except Exception:
        return None

def register(ctx):
    ctx.register_hook("pre_llm_call", recall)
```

**示例——护栏：**

```python
POLICY = "Never execute commands that delete files without explicit user confirmation."

def guardrails(**kwargs):
    return {"context": POLICY}

def register(ctx):
    ctx.register_hook("pre_llm_call", guardrails)
```

---

### `post_llm_call`

**每轮一次**，工具调用循环完成且代理产生最终响应后触发。仅在**成功**轮次触发——如果轮次被中断则不触发。

**回调签名：**

```python
def my_callback(session_id: str, user_message: str, assistant_response: str,
                conversation_history: list, model: str, platform: str, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `session_id` | `str` | 当前会话的唯一标识符 |
| `user_message` | `str` | 用户此轮的原始消息 |
| `assistant_response` | `str` | 代理此轮的最终文本响应 |
| `conversation_history` | `list` | 轮次完成后的完整消息列表副本 |
| `model` | `str` | 模型标识符 |
| `platform` | `str` | 会话运行位置 |

**触发位置：** 在 `run_agent.py` 中，`run_conversation()` 内部，工具循环以最终响应退出后。受 `if final_response and not interrupted` 保护——因此当用户在轮次中中断或代理达到迭代限制而未产生响应时**不**触发。

**返回值：** 忽略。

**用例：** 将对话数据同步到外部记忆系统、计算响应质量指标、记录轮次摘要、触发后续操作。

**示例——同步到外部记忆：**

```python
import httpx

MEMORY_API = "https://your-memory-api.example.com"

def sync_memory(session_id, user_message, assistant_response, **kwargs):
    try:
        httpx.post(f"{MEMORY_API}/store", json={
            "session_id": session_id,
            "user": user_message,
            "assistant": assistant_response,
        }, timeout=5)
    except Exception:
        pass  # 尽力而为

def register(ctx):
    ctx.register_hook("post_llm_call", sync_memory)
```

**示例——跟踪响应长度：**

```python
import logging
logger = logging.getLogger(__name__)

def log_response_length(session_id, assistant_response, model, **kwargs):
    logger.info("RESPONSE session=%s model=%s chars=%d",
                session_id, model, len(assistant_response or ""))

def register(ctx):
    ctx.register_hook("post_llm_call", log_response_length)
```

---

### `on_session_start`

全新会话创建时触发**一次**。在会话继续时（用户在现有会话中发送第二条消息时）**不**触发。

**回调签名：**

```python
def my_callback(session_id: str, model: str, platform: str, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `session_id` | `str` | 新会话的唯一标识符 |
| `model` | `str` | 模型标识符 |
| `platform` | `str` | 会话运行位置 |

**触发位置：** 在 `run_agent.py` 中，`run_conversation()` 内部，新会话的第一轮——具体在系统提示构建后但工具循环开始前。检查是 `if not conversation_history`（无先前消息 = 新会话）。

**返回值：** 忽略。

**用例：** 初始化会话作用域状态、预热缓存、向外部服务注册会话、记录会话开始。

**示例——初始化会话缓存：**

```python
_session_caches = {}

def init_session(session_id, model, platform, **kwargs):
    _session_caches[session_id] = {
        "model": model,
        "platform": platform,
        "tool_calls": 0,
        "started": __import__("datetime").datetime.now().isoformat(),
    }

def register(ctx):
    ctx.register_hook("on_session_start", init_session)
```

---

### `on_session_end`

在每次 `run_conversation()` 调用的**最末尾**触发，无论结果如何。如果代理在用户退出时正在处理中，也会从 CLI 的退出处理器触发。

**回调签名：**

```python
def my_callback(session_id: str, completed: bool, interrupted: bool,
                model: str, platform: str, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `session_id` | `str` | 会话的唯一标识符 |
| `completed` | `bool` | 如果代理产生了最终响应则为 `True`，否则为 `False` |
| `interrupted` | `bool` | 如果轮次被中断（用户发送新消息、`/stop` 或退出）则为 `True` |
| `model` | `str` | 模型标识符 |
| `platform` | `str` | 会话运行位置 |

**触发位置：** 两个地方：
1. **`run_agent.py`** — 每次 `run_conversation()` 调用结束时，所有清理之后。即使轮次出错也始终触发。
2. **`cli.py`** — CLI 的 atexit 处理器中，但**仅当**代理在退出发生时正在处理中（`_agent_running=True`）。这捕获处理期间的 Ctrl+C 和 `/exit`。在这种情况下，`completed=False` 且 `interrupted=True`。

**返回值：** 忽略。

**用例：** 刷新缓冲区、关闭连接、持久化会话状态、记录会话持续时间、清理在 `on_session_start` 中初始化的资源。

**示例——刷新和清理：**

```python
_session_caches = {}

def cleanup_session(session_id, completed, interrupted, **kwargs):
    cache = _session_caches.pop(session_id, None)
    if cache:
        # 将累积数据刷新到磁盘或外部服务
        status = "completed" if completed else ("interrupted" if interrupted else "failed")
        print(f"Session {session_id} ended: {status}, {cache['tool_calls']} tool calls")

def register(ctx):
    ctx.register_hook("on_session_end", cleanup_session)
```

**示例——会话持续时间跟踪：**

```python
import time, logging
logger = logging.getLogger(__name__)

_start_times = {}

def on_start(session_id, **kwargs):
    _start_times[session_id] = time.time()

def on_end(session_id, completed, interrupted, **kwargs):
    start = _start_times.pop(session_id, None)
    if start:
        duration = time.time() - start
        logger.info("SESSION_DURATION session=%s seconds=%.1f completed=%s interrupted=%s",
                     session_id, duration, completed, interrupted)

def register(ctx):
    ctx.register_hook("on_session_start", on_start)
    ctx.register_hook("on_session_end", on_end)
```

---

### `on_session_finalize`

当 CLI 或网关**拆卸**活跃会话时触发——例如用户运行 `/new`、网关 GC 了空闲会话、或 CLI 在活跃代理时退出。这是在会话身份消失前刷新与即将离开的会话绑定的状态的最后机会。

**回调签名：**

```python
def my_callback(session_id: str | None, platform: str, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `session_id` | `str` 或 `None` | 即将离开的会话 ID。如果不存在活跃会话可能为 `None`。 |
| `platform` | `str` | `"cli"` 或消息平台名称（`"telegram"`、`"discord"` 等）。 |

**触发位置：** 在 `cli.py`（`/new` / CLI 退出时）和 `gateway/run.py`（会话重置或 GC 时）。在网关端始终与 `on_session_reset` 配对。

**返回值：** 忽略。

**用例：** 在会话 ID 被丢弃前持久化最终会话指标、关闭每会话资源、发出最终遥测事件、排空排队的写入。

---

### `on_session_reset`

当网关为活跃聊天**交换新会话键**时触发——用户调用了 `/new`、`/reset`、`/clear`，或适配器在空闲窗口后选择了新会话。这让插件可以对对话状态已被清除这一事实做出反应，而无需等待下一次 `on_session_start`。

**回调签名：**

```python
def my_callback(session_id: str, platform: str, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `session_id` | `str` | 新会话的 ID（已轮换到新值）。 |
| `platform` | `str` | 消息平台名称。 |

**触发位置：** 在 `gateway/run.py` 中，新会话键分配后但处理下一条入站消息前。在网关端，顺序是：`on_session_finalize(old_id)` → 交换 → `on_session_reset(new_id)` → 第一个入站轮次时 `on_session_start(new_id)`。

**返回值：** 忽略。

**用例：** 重置按 `session_id` 键控的每会话缓存、发出"会话轮换"分析、准备新的状态桶。

---

参见 **[构建插件指南](/docs/guides/build-a-hermes-plugin)** 获取完整演练，包括工具模式、处理器和高级钩子模式。

---

### `subagent_stop`

每个子代理在 `delegate_task` 完成后触发**一次**。无论你委托了单个任务还是三个一批，此钩子为每个子级触发一次，在父线程上序列化。

**回调签名：**

```python
def my_callback(parent_session_id: str, child_role: str | None,
                child_summary: str | None, child_status: str,
                duration_ms: int, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `parent_session_id` | `str` | 委托父代理的会话 ID |
| `child_role` | `str \| None` | 设置在子级上的编排者角色标签（如果功能未启用则为 `None`） |
| `child_summary` | `str \| None` | 子级返回给父级的最终响应 |
| `child_status` | `str` | `"completed"`、`"failed"`、`"interrupted"` 或 `"error"` |
| `duration_ms` | `int` | 运行子级的挂钟时间，毫秒 |

**触发位置：** 在 `tools/delegate_tool.py` 中，`ThreadPoolExecutor.as_completed()` 排空所有子级 future 后。触发被调度到父线程，因此钩子作者不必考虑并发回调执行。

**返回值：** 忽略。

**用例：** 记录编排活动、累计子级持续时间用于计费、写入委托后审计记录。

**示例——记录编排者活动：**

```python
import logging
logger = logging.getLogger(__name__)

def log_subagent(parent_session_id, child_role, child_status, duration_ms, **kwargs):
    logger.info(
        "SUBAGENT parent=%s role=%s status=%s duration_ms=%d",
        parent_session_id, child_role, child_status, duration_ms,
    )

def register(ctx):
    ctx.register_hook("subagent_stop", log_subagent)
```

:::info
在重度委托（例如编排者角色 × 5 叶子 × 嵌套深度）下，`subagent_stop` 每轮触发多次。保持你的回调快速；将耗时工作推到后台队列。
:::

---

### `pre_gateway_dispatch`

在网关中每个传入 `MessageEvent` 触发**一次**，在内部事件守卫之后但认证/配对和代理调度**之前**。这是网关级消息流策略（仅监听窗口、人工接管、每聊天路由等）的拦截点，这些策略不适合干净地放入任何单个平台适配器中。

**回调签名：**

```python
def my_callback(event, gateway, session_store, **kwargs):
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `event` | `MessageEvent` | 规范化的入站消息（有 `.text`、`.source`、`.message_id`、`.internal` 等）。 |
| `gateway` | `GatewayRunner` | 活跃的网关运行器，以便插件可以调用 `gateway.adapters[platform].send(...)` 进行侧信道回复（所有者通知等）。 |
| `session_store` | `SessionStore` | 通过 `session_store.append_to_transcript(...)` 进行静默转录摄入。 |

**触发位置：** 在 `gateway/run.py` 中，`GatewayRunner._handle_message()` 内部，`is_internal` 计算后立即触发。**内部事件完全跳过钩子**（它们是系统生成的——后台进程完成等——不应被面向用户的策略门控）。

**返回值：** `None` 或字典。第一个被识别的操作字典获胜；其余插件结果被忽略。插件回调中的异常被捕获并记录；网关在错误时始终回退到正常调度。

| 返回值 | 效果 |
|--------|------|
| `{"action": "skip", "reason": "..."}` | 丢弃消息——无代理回复、无配对流程、无认证。假定插件已处理（例如静默摄入转录）。 |
| `{"action": "rewrite", "text": "new text"}` | 替换 `event.text`，然后用修改后的事件继续正常调度。适用于将缓冲的环境消息折叠为单个提示。 |
| `{"action": "allow"}` / `None` | 正常调度——运行完整的认证/配对/代理循环链。 |

**用例：** 仅监听群聊（仅在被提及时回复；将环境消息缓冲到上下文中）；人工接管（在所有者手动处理聊天时静默摄入客户消息）；每配置文件速率限制；策略驱动的路由。

**示例——静默拒绝未授权的 DM 而不触发配对代码：**

```python
def deny_unauthorized_dms(event, **kwargs):
    src = event.source
    if src.chat_type == "dm" and not _is_approved_user(src.user_id):
        return {"action": "skip", "reason": "unauthorized-dm"}
    return None

def register(ctx):
    ctx.register_hook("pre_gateway_dispatch", deny_unauthorized_dms)
```

**示例——在提及时将环境消息缓冲重写为单个提示：**

```python
_buffers = {}

def buffer_or_rewrite(event, **kwargs):
    key = (event.source.platform, event.source.chat_id)
    buf = _buffers.setdefault(key, [])
    if _bot_mentioned(event.text):
        combined = "\n".join(buf + [event.text])
        buf.clear()
        return {"action": "rewrite", "text": combined}
    buf.append(event.text)
    return {"action": "skip", "reason": "ambient-buffered"}

def register(ctx):
    ctx.register_hook("pre_gateway_dispatch", buffer_or_rewrite)
```

---

## Shell 钩子

在你的 `cli-config.yaml` 中声明 shell 脚本钩子，Hermes 会在相应的插件钩子事件触发时将它们作为子进程运行——在 CLI 和网关会话中都是如此。无需 Python 插件编写。

当你想要一个即用的单文件脚本（Bash、Python、任何带 shebang 的）来做以下事情时，使用 shell 钩子：

- **阻止工具调用** — 拒绝危险的 `terminal` 命令、强制执行每目录策略、要求审批破坏性的 `write_file` / `patch` 操作。
- **工具调用后运行** — 自动格式化代理刚写的 Python 或 TypeScript 文件、记录 API 调用、触发 CI 工作流。
- **向下一轮 LLM 注入上下文** — 向用户消息前置 `git status` 输出、当前星期几或检索的文档（参见 [`pre_llm_call`](#pre_llm_call)）。
- **观察生命周期事件** — 子代理完成时（`subagent_stop`）或会话开始时（`on_session_start`）写入日志行。

Shell 钩子通过在 CLI 启动（`hermes_cli/main.py`）和网关启动（`gateway/run.py`）时调用 `agent.shell_hooks.register_from_config(cfg)` 注册。它们与 Python 插件钩子自然组合——两者都通过同一个调度器流动。

### 对比一览

| 维度 | Shell 钩子 | [插件钩子](#插件钩子) | [网关钩子](#网关事件钩子) |
|------|-----------|---------------------|------------------------|
| 声明位置 | `~/.hermes/config.yaml` 中的 `hooks:` 块 | `plugin.yaml` 插件中的 `register()` | `HOOK.yaml` + `handler.py` 目录 |
| 位于 | `~/.hermes/agent-hooks/`（按约定） | `~/.hermes/plugins/<name>/` | `~/.hermes/hooks/<name>/` |
| 语言 | 任何（Bash、Python、Go 二进制、...） | 仅 Python | 仅 Python |
| 运行环境 | CLI + 网关 | CLI + 网关 | 仅网关 |
| 事件 | `VALID_HOOKS`（包括 `subagent_stop`） | `VALID_HOOKS` | 网关生命周期（`gateway:startup`、`agent:*`、`command:*`） |
| 可以阻止工具调用 | 是（`pre_tool_call`） | 是（`pre_tool_call`） | 否 |
| 可以注入 LLM 上下文 | 是（`pre_llm_call`） | 是（`pre_llm_call`） | 否 |
| 同意 | 每 `(event, command)` 对首次使用提示 | 隐式（Python 插件信任） | 隐式（目录信任） |
| 进程间隔离 | 是（子进程） | 否（进程内） | 否（进程内） |

### 配置模式

```yaml
hooks:
  <event_name>:                  # 必须在 VALID_HOOKS 中
    - matcher: "<regex>"         # 可选；仅用于 pre/post_tool_call
      command: "<shell command>" # 必需；通过 shlex.split 运行，shell=False
      timeout: <seconds>         # 可选；默认 60，上限 300

hooks_auto_accept: false         # 见下面的"同意模型"
```

事件名称必须是[插件钩子事件](#插件钩子)之一；拼写错误会产生"Did you mean X?"警告并被跳过。单个条目内的未知键被忽略；缺少 `command` 是跳过带警告。`timeout > 300` 被限制并显示警告。

### JSON 线协议

每次事件触发时，Hermes 为每个匹配的钩子（matcher 允许）生成子进程，通过 **stdin** 管道 JSON 载荷，并从 **stdout** 读回 JSON。

**stdin — 脚本接收的载荷：**

```json
{
  "hook_event_name": "pre_tool_call",
  "tool_name":       "terminal",
  "tool_input":      {"command": "rm -rf /"},
  "session_id":      "sess_abc123",
  "cwd":             "/home/user/project",
  "extra":           {"task_id": "...", "tool_call_id": "..."}
}
```

`tool_name` 和 `tool_input` 对非工具事件（`pre_llm_call`、`subagent_stop`、会话生命周期）为 `null`。`extra` 字典携带所有事件特定的 kwargs（`user_message`、`conversation_history`、`child_role`、`duration_ms`、...）。不可序列化的值被字符串化而非省略。

**stdout — 可选响应：**

```jsonc
// 阻止 pre_tool_call（两种形状都接受；内部规范化）：
{"decision": "block", "reason":  "Forbidden: rm -rf"}   // Claude-Code 风格
{"action":   "block", "message": "Forbidden: rm -rf"}   // Hermes 规范

// 为 pre_llm_call 注入上下文：
{"context": "Today is Friday, 2026-04-17"}

// 静默空操作——任何空/不匹配的输出都可以：
```

格式错误的 JSON、非零退出码和超时记录警告但永远不会中止代理循环。

### 实际示例

#### 1. 每次写入后自动格式化 Python 文件

```yaml
# ~/.hermes/config.yaml
hooks:
  post_tool_call:
    - matcher: "write_file|patch"
      command: "~/.hermes/agent-hooks/auto-format.sh"
```

```bash
#!/usr/bin/env bash
# ~/.hermes/agent-hooks/auto-format.sh
payload="$(cat -)"
path=$(echo "$payload" | jq -r '.tool_input.path // empty')
[[ "$path" == *.py ]] && command -v black >/dev/null && black "$path" 2>/dev/null
printf '{}\n'
```

代理上下文中文件的视图**不会**自动重新读取——重新格式化仅影响磁盘上的文件。后续 `read_file` 调用获取格式化后的版本。

#### 2. 阻止破坏性 `terminal` 命令

```yaml
hooks:
  pre_tool_call:
    - matcher: "terminal"
      command: "~/.hermes/agent-hooks/block-rm-rf.sh"
      timeout: 5
```

```bash
#!/usr/bin/env bash
# ~/.hermes/agent-hooks/block-rm-rf.sh
payload="$(cat -)"
cmd=$(echo "$payload" | jq -r '.tool_input.command // empty')
if echo "$cmd" | grep -qE 'rm[[:space:]]+-rf?[[:space:]]+/'; then
  printf '{"decision": "block", "reason": "blocked: rm -rf / is not permitted"}\n'
else
  printf '{}\n'
fi
```

#### 3. 每轮注入 `git status`（Claude-Code `UserPromptSubmit` 等效）

```yaml
hooks:
  pre_llm_call:
    - command: "~/.hermes/agent-hooks/inject-cwd-context.sh"
```

```bash
#!/usr/bin/env bash
# ~/.hermes/agent-hooks/inject-cwd-context.sh
cat - >/dev/null   # 丢弃 stdin 载荷
if status=$(git status --porcelain 2>/dev/null) && [[ -n "$status" ]]; then
  jq --null-input --arg s "$status" \
     '{context: ("Uncommitted changes in cwd:\n" + $s)}'
else
  printf '{}\n'
fi
```

Claude Code 的 `UserPromptSubmit` 事件有意不是单独的 Hermes 事件——`pre_llm_call` 在同一位置触发且已支持上下文注入。在此使用它。

#### 4. 记录每次子代理完成

```yaml
hooks:
  subagent_stop:
    - command: "~/.hermes/agent-hooks/log-orchestration.sh"
```

```bash
#!/usr/bin/env bash
# ~/.hermes/agent-hooks/log-orchestration.sh
log=~/.hermes/logs/orchestration.log
jq -c '{ts: now, parent: .session_id, extra: .extra}' < /dev/stdin >> "$log"
printf '{}\n'
```

### 同意模型

每个唯一的 `(event, command)` 对在 Hermes 首次看到时提示用户批准，然后将决定持久化到 `~/.hermes/shell-hooks-allowlist.json`。后续运行（CLI 或网关）跳过提示。

三个逃生舱绕过交互式提示——任何一个都足够：

1. CLI 上的 `--accept-hooks` 标志（例如 `hermes --accept-hooks chat`）
2. `HERMES_ACCEPT_HOOKS=1` 环境变量
3. `cli-config.yaml` 中的 `hooks_auto_accept: true`

非 TTY 运行（网关、cron、CI）需要这三个之一——否则任何新添加的钩子静默保持未注册并记录警告。

**脚本编辑被静默信任。** 允许列表以完全命令字符串为键，而非脚本的哈希，因此编辑磁盘上的脚本不会使同意失效。`hermes hooks doctor` 标记 mtime 漂移以便你可以发现编辑并决定是否重新批准。

### `hermes hooks` CLI

| 命令 | 功能 |
|------|------|
| `hermes hooks list` | 转储配置的钩子，包括 matcher、超时和同意状态 |
| `hermes hooks test <event> [--for-tool X] [--payload-file F]` | 对合成载荷触发每个匹配的钩子并打印解析后的响应 |
| `hermes hooks revoke <command>` | 移除匹配 `<command>` 的每个允许列表条目（下次重启生效） |
| `hermes hooks doctor` | 对每个配置的钩子：检查执行位、允许列表状态、mtime 漂移、JSON 输出有效性和大致执行时间 |

### 安全

Shell 钩子以**你的完整用户凭据**运行——与 cron 条目或 shell 别名的信任边界相同。将 `config.yaml` 中的 `hooks:` 块视为特权配置：

- 仅引用你编写或完全审查过的脚本。
- 将脚本保持在 `~/.hermes/agent-hooks/` 内以便路径易于审计。
- 拉取共享配置后重新运行 `hermes hooks doctor` 以在注册前发现新添加的钩子。
- 如果你的 config.yaml 在团队间版本控制，审查更改 `hooks:` 部分的 PR 与审查 CI 配置的方式相同。

### 顺序和优先级

Python 插件钩子和 shell 钩子都通过同一个 `invoke_hook()` 调度器流动。Python 插件先注册（`discover_and_load()`），shell 钩子后注册（`register_from_config()`），因此 Python `pre_tool_call` 阻止决定在平局情况下优先。第一个有效的阻止获胜——聚合器在任何回调产生 `{"action": "block", "message": str}` 且消息非空时立即返回。
