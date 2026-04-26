---
sidebar_position: 9
sidebar_label: "构建插件"
title: "构建 Hermes 插件"
description: "构建完整 Hermes 插件的分步指南，包含工具、钩子、数据文件和技能"
---

# 构建 Hermes 插件

本指南引导从头构建完整的 Hermes 插件。最终你将拥有一个包含多个工具、生命周期钩子、发布数据文件和捆绑技能的工作插件 — 插件系统支持的一切。

## 你在构建什么

一个**计算器**插件，包含两个工具：
- `calculate` — 评估数学表达式（`2**16`、`sqrt(144)`、`pi * 5**2`）
- `unit_convert` — 单位转换（`100 F → 37.78 C`、`5 km → 3.11 mi`）

加上一个记录每个工具调用的钩子和一个捆绑的技能文件。

## 步骤 1：创建插件目录

```bash
mkdir -p ~/.hermes/plugins/calculator
cd ~/.hermes/plugins/calculator
```

## 步骤 2：编写清单

创建 `plugin.yaml`：

```yaml
name: calculator
version: 1.0.0
description: 数学计算器 — 评估表达式和转换单位
provides_tools:
  - calculate
  - unit_convert
provides_hooks:
  - post_tool_call
```

这告诉 Hermes："我是一个叫 calculator 的插件，我提供工具和钩子。" `provides_tools` 和 `provides_hooks` 字段是插件注册的列表。

你可以添加的可选字段：
```yaml
author: Your Name
requires_env:          # 基于环境变量的门控加载；安装时提示
  - SOME_API_KEY       # 简单格式 — 如果缺失则插件禁用
  - name: OTHER_KEY    # 丰富格式 — 安装时显示描述/url
    description: "Key for the Other service"
    url: "https://other.com/keys"
    secret: true
```

## 步骤 3：编写工具 schema

创建 `schemas.py` — 这是 LLM 读取以决定何时调用你的工具的内容：

```python
"""工具 schema — LLM 看到的内容。"""

CALCULATE = {
    "name": "calculate",
    "description": (
        "评估数学表达式并返回结果。"
        "支持算术（+、-、*、/、**）、函数（sqrt、sin、cos、"
        "log、abs、round、floor、ceil）和常量（pi、e）。"
        "用于用户询问的任何数学。"
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "要评估的数学表达式（例如 '2**10'、'sqrt(144)'）",
            },
        },
        "required": ["expression"],
    },
}

UNIT_CONVERT = {
    "name": "unit_convert",
    "description": (
        "在单位之间转换值。支持长度（m、km、mi、ft、in）、"
        "重量（kg、lb、oz、g）、温度（C、F、K）、数据（B、KB、MB、GB、TB）"
        "和时间（s、min、hr、day）。"
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "value": {
                "type": "number",
                "description": "要转换的数值",
            },
            "from_unit": {
                "type": "string",
                "description": "源单位（例如 'km'、'lb'、'F'、'GB'）",
            },
            "to_unit": {
                "type": "string",
                "description": "目标单位（例如 'mi'、'kg'、'C'、'MB'）",
            },
        },
        "required": ["value", "from_unit", "to_unit"],
    },
}
```

**为什么 schema 重要：** `description` 字段是 LLM 决定何时使用你的工具的方式。对它做什么和何时使用要具体。`parameters` 定义 LLM 传递什么参数。

## 步骤 4：编写工具处理器

创建 `tools.py` — 这是 LLM 调用你的工具时实际执行的代码：

```python
"""工具处理器 — LLM 调用每个工具时运行的代码。"""

import json
import math

# 表达式评估的安全全局变量 — 无文件/网络访问
_SAFE_MATH = {
    "abs": abs, "round": round, "min": min, "max": max,
    "pow": pow, "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos,
    "tan": math.tan, "log": math.log, "log2": math.log2, "log10": math.log10,
    "floor": math.floor, "ceil": math.ceil,
    "pi": math.pi, "e": math.e,
    "factorial": math.factorial,
}


def calculate(args: dict, **kwargs) -> str:
    """安全地评估数学表达式。

    处理器规则：
    1. 接收 args（dict）— LLM 传递的参数
    2. 做工作
    3. 返回 JSON 字符串 — 始终如此，即使出错
    4. 接受 **kwargs 以实现前向兼容
    """
    expression = args.get("expression", "").strip()
    if not expression:
        return json.dumps({"error": "No expression provided"})

    try:
        result = eval(expression, {"__builtins__": {}}, _SAFE_MATH)
        return json.dumps({"expression": expression, "result": result})
    except ZeroDivisionError:
        return json.dumps({"expression": expression, "error": "Division by zero"})
    except Exception as e:
        return json.dumps({"expression": expression, "error": f"Invalid: {e}"})


# 转换表 — 值以基本单位表示
_LENGTH = {"m": 1, "km": 1000, "mi": 1609.34, "ft": 0.3048, "in": 0.0254, "cm": 0.01}
_WEIGHT = {"kg": 1, "g": 0.001, "lb": 0.453592, "oz": 0.0283495}
_DATA = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}
_TIME = {"s": 1, "ms": 0.001, "min": 60, "hr": 3600, "day": 86400}


def _convert_temp(value, from_u, to_u):
    # 规范化到摄氏度
    c = {"F": (value - 32) * 5/9, "K": value - 273.15}.get(from_u, value)
    # 转换到目标
    return {"F": c * 9/5 + 32, "K": c + 273.15}.get(to_u, c)


def unit_convert(args: dict, **kwargs) -> str:
    """在单位之间转换。"""
    value = args.get("value")
    from_unit = args.get("from_unit", "").strip()
    to_unit = args.get("to_unit", "").strip()

    if value is None or not from_unit or not to_unit:
        return json.dumps({"error": "Need value, from_unit, and to_unit"})

    try:
        # 温度
        if from_unit.upper() in {"C","F","K"} and to_unit.upper() in {"C","F","K"}:
            result = _convert_temp(float(value), from_unit.upper(), to_unit.upper())
            return json.dumps({"input": f"{value} {from_unit}", "result": round(result, 4),
                             "output": f"{round(result, 4)} {to_unit}"})

        # 基于比率的转换
        for table in (_LENGTH, _WEIGHT, _DATA, _TIME):
            lc = {k.lower(): v for k, v in table.items()}
            if from_unit.lower() in lc and to_unit.lower() in lc:
                result = float(value) * lc[from_unit.lower()] / lc[to_unit.lower()]
                return json.dumps({"input": f"{value} {from_unit}",
                                 "result": round(result, 6),
                                 "output": f"{round(result, 6)} {to_unit}"})

        return json.dumps({"error": f"Cannot convert {from_unit} → {to_unit}"})
    except Exception as e:
        return json.dumps({"error": f"Conversion failed: {e}"})
```

**处理器的关键规则：**
1. **签名：** `def my_handler(args: dict, **kwargs) -> str`
2. **返回：** 始终是 JSON 字符串。成功和错误都是。
3. **永远不要抛出：** 捕获所有异常，返回错误 JSON。
4. **接受 `**kwargs`：** Hermes 将来可能传递额外的上下文。

## 步骤 5：编写注册

创建 `__init__.py` — 这将 schema 连接到处理器：

```python
"""计算器插件 — 注册。"""

import logging

from . import schemas, tools

logger = logging.getLogger(__name__)

# 通过钩子跟踪工具使用
_call_log = []

def _on_post_tool_call(tool_name, args, result, task_id, **kwargs):
    """钩子：在每个工具调用后运行（不仅仅是我们的）。"""
    _call_log.append({"tool": tool_name, "session": task_id})
    if len(_call_log) > 100:
        _call_log.pop(0)
    logger.debug("Tool called: %s (session %s)", tool_name, task_id)


def register(ctx):
    """将 schema 连接到处理器并注册钩子。"""
    ctx.register_tool(name="calculate",    toolset="calculator",
                      schema=schemas.CALCULATE,    handler=tools.calculate)
    ctx.register_tool(name="unit_convert", toolset="calculator",
                      schema=schemas.UNIT_CONVERT, handler=tools.unit_convert)

    # 此钩子对所有工具调用触发，不仅仅是我们的
    ctx.register_hook("post_tool_call", _on_post_tool_call)
```

**`register()` 做什么：**
- 启动时恰好调用一次
- `ctx.register_tool()` 将你的工具放入注册表 — 模型立即看到它
- `ctx.register_hook()` 订阅生命周期事件
- `ctx.register_cli_command()` 注册 CLI 子命令（例如 `hermes my-plugin <subcommand>`）
- 如果此函数崩溃，插件被禁用但 Hermes 继续正常

## 步骤 6：测试

启动 Hermes：

```bash
hermes
```

你应该在横幅的工具列表中看到 `calculator: calculate, unit_convert`。

尝试这些提示：
```
2 的 16 次方是多少？
将 100 华氏度转换为摄氏度
2 乘以 pi 的平方根是多少？
1.5 TB 是多少 GB？
```

检查插件状态：
```
/plugins
```

输出：
```
Plugins (1):
  ✓ calculator v1.0.0 (2 tools, 1 hooks)
```

## 你的插件最终结构

```
~/.hermes/plugins/calculator/
├── plugin.yaml      # "我是 calculator，我提供工具和钩子"
├── __init__.py      # 连接：schema → 处理器，注册钩子
├── schemas.py       # LLM 读取的内容（描述 + 参数规范）
└── tools.py         # 运行的内容（calculate、unit_convert 函数）
```

四个文件，清晰分离：
- **清单**声明插件是什么
- **Schema**为 LLM 描述工具
- **处理器**实现实际逻辑
- **注册**连接一切

## 插件还能做什么？

### 发布数据文件

将任何文件放入插件目录并在导入时读取：

```python
# 在 tools.py 或 __init__.py 中
from pathlib import Path

_PLUGIN_DIR = Path(__file__).parent
_DATA_FILE = _PLUGIN_DIR / "data" / "languages.yaml"

with open(_DATA_FILE) as f:
    _DATA = yaml.safe_load(f)
```

### 捆绑技能

插件可以发布技能文件，代理通过 `skill_view("plugin:skill")` 加载。在你的 `__init__.py` 中注册它们：

```
~/.hermes/plugins/my-plugin/
├── __init__.py
├── plugin.yaml
└── skills/
    ├── my-workflow/
    │   └── SKILL.md
    └── my-checklist/
        └── SKILL.md
```

```python
from pathlib import Path

def register(ctx):
    skills_dir = Path(__file__).parent / "skills"
    for child in sorted(skills_dir.iterdir()):
        skill_md = child / "SKILL.md"
        if child.is_dir() and skill_md.exists():
            ctx.register_skill(child.name, skill_md)
```

代理现在可以用命名空间名称加载你的技能：

```python
skill_view("my-plugin:my-workflow")   # → 插件的版本
skill_view("my-workflow")              # → 内置版本（不变）
```

**关键属性：**
- 插件技能是**只读的** — 它们不进入 `~/.hermes/skills/`，不能通过 `skill_manage` 编辑。
- 插件技能**不**列在系统提示的 `<available_skills>` 索引中 — 它们是可选加入的显式加载。
- 裸技能名称不受影响 — 命名空间防止与内置技能冲突。
- 当代理加载插件技能时，会前置一个列出同一插件兄弟技能的捆绑上下文横幅。

:::tip 旧模式
旧的 `shutil.copy2` 模式（将技能复制到 `~/.hermes/skills/`）仍然有效但与内置技能创建名称冲突风险。新插件偏好 `ctx.register_skill()`。
:::

### 基于环境变量的门控

如果你的插件需要 API 密钥：

```yaml
# plugin.yaml — 简单格式（向后兼容）
requires_env:
  - WEATHER_API_KEY
```

如果 `WEATHER_API_KEY` 未设置，插件被禁用并有清晰的消息。不会崩溃，代理中没有错误 — 只是 "Plugin weather disabled (missing: WEATHER_API_KEY)"。

当用户运行 `hermes plugins install` 时，他们会被**交互式提示**输入任何缺失的 `requires_env` 变量。值自动保存到 `.env`。

要获得更好的安装体验，使用带描述和注册 URL 的丰富格式：

```yaml
# plugin.yaml — 丰富格式
requires_env:
  - name: WEATHER_API_KEY
    description: "API key for OpenWeather"
    url: "https://openweathermap.org/api"
    secret: true
```

| 字段 | 必需 | 描述 |
|-------|----------|-------------|
| `name` | 是 | 环境变量名称 |
| `description` | 否 | 安装提示时显示给用户 |
| `url` | 否 | 在哪里获取凭证 |
| `secret` | 否 | 如果 `true`，输入被隐藏（像密码字段） |

两种格式可以在同一列表中混合。已设置的变量被静默跳过。

### 条件工具可用性

对于依赖可选库的工具：

```python
ctx.register_tool(
    name="my_tool",
    schema={...},
    handler=my_handler,
    check_fn=lambda: _has_optional_lib(),  # False = 工具对模型隐藏
)
```

### 注册多个钩子

```python
def register(ctx):
    ctx.register_hook("pre_tool_call", before_any_tool)
    ctx.register_hook("post_tool_call", after_any_tool)
    ctx.register_hook("pre_llm_call", inject_memory)
    ctx.register_hook("on_session_start", on_new_session)
    ctx.register_hook("on_session_end", on_session_end)
```

### 钩子参考

每个钩子在 **[事件钩子参考](/docs/user-guide/features/hooks#plugin-hooks)** 上完整记录 — 回调签名、参数表、确切触发时间和示例。这里是摘要：

| 钩子 | 触发时 | 回调签名 | 返回 |
|------|-----------|-------------------|---------|
| [`pre_tool_call`](/docs/user-guide/features/hooks#pre_tool_call) | 任何工具执行前 | `tool_name: str, args: dict, task_id: str` | 忽略 |
| [`post_tool_call`](/docs/user-guide/features/hooks#post_tool_call) | 任何工具返回后 | `tool_name: str, args: dict, result: str, task_id: str, duration_ms: int` | 忽略 |
| [`pre_llm_call`](/docs/user-guide/features/hooks#pre_llm_call) | 每轮一次，工具调用循环前 | `session_id: str, user_message: str, conversation_history: list, is_first_turn: bool, model: str, platform: str` | [上下文注入](#pre_llm_call-上下文注入) |
| [`post_llm_call`](/docs/user-guide/features/hooks#post_llm_call) | 每轮一次，工具调用循环后（仅成功的轮次） | `session_id: str, user_message: str, assistant_response: str, conversation_history: list, model: str, platform: str` | 忽略 |
| [`on_session_start`](/docs/user-guide/features/hooks#on_session_start) | 新会话创建（仅第一轮） | `session_id: str, model: str, platform: str` | 忽略 |
| [`on_session_end`](/docs/user-guide/features/hooks#on_session_end) | 每次 `run_conversation` 调用结束 + CLI 退出 | `session_id: str, completed: bool, interrupted: bool, model: str, platform: str` | 忽略 |
| [`on_session_finalize`](/docs/user-guide/features/hooks#on_session_finalize) | CLI/网关拆除活动会话 | `session_id: str \| None, platform: str` | 忽略 |
| [`on_session_reset`](/docs/user-guide/features/hooks#on_session_reset) | 网关交换新会话键（`/new`、`/reset`） | `session_id: str, platform: str` | 忽略 |

大多数钩子是即发即忘的观察者 — 它们的返回值被忽略。例外是 `pre_llm_call`，它可以注入上下文到对话中。

所有回调应该接受 `**kwargs` 以实现前向兼容。如果钩子回调崩溃，它会被记录并跳过。其他钩子和代理继续正常。

### `pre_llm_call` 上下文注入

这是唯一返回值重要的钩子。当 `pre_llm_call` 回调返回带有 `"context"` 键的字典（或纯字符串）时，Hermes 将该文本注入到**当前轮的用户消息**中。这是记忆插件、RAG 集成、护栏和任何需要为模型提供额外上下文的插件的机制。

#### 返回格式

```python
# 带 context 键的字典
return {"context": "Recalled memories:\n- User prefers dark mode\n- Last project: hermes-agent"}

# 纯字符串（等同于上面的字典形式）
return "Recalled memories:\n- User prefers dark mode"

# 返回 None 或不返回 → 不注入（仅观察者）
return None
```

任何非 None、非空的带有 `"context"` 键的返回（或纯非空字符串）被收集并追加到当前轮的用户消息。

#### 注入如何工作

注入的上下文追加到**用户消息**，而不是系统提示。这是有意的设计选择：

- **提示缓存保持** — 系统提示在各轮之间保持相同。Anthropic 和 OpenRouter 缓存系统提示前缀，因此保持稳定在多轮对话中节省 75%+ 的输入 token。如果插件修改系统提示，每一轮都会是缓存未命中。
- **临时性** — 注入仅在 API 调用时发生。对话历史中的原始用户消息永远不会被修改，也不会持久化到会话数据库。
- **系统提示是 Hermes 的领域** — 它包含模型特定的指导、工具执行规则、个性指令和缓存的技能内容。插件在用户输入旁贡献上下文，而不是通过改变代理的核心指令。

#### 示例：记忆召回插件

```python
"""记忆插件 — 从向量存储召回相关上下文。"""

import httpx

MEMORY_API = "https://your-memory-api.example.com"

def recall_context(session_id, user_message, is_first_turn, **kwargs):
    """在每次 LLM 轮之前调用。返回召回的记忆。"""
    try:
        resp = httpx.post(f"{MEMORY_API}/recall", json={
            "session_id": session_id,
            "query": user_message,
        }, timeout=3)
        memories = resp.json().get("results", [])
        if not memories:
            return None  # 无内容注入

        text = "从之前会话召回的上下文：\n"
        text += "\n".join(f"- {m['text']}" for m in memories)
        return {"context": text}
    except Exception:
        return None  # 静默失败，不破坏代理

def register(ctx):
    ctx.register_hook("pre_llm_call", recall_context)
```

#### 示例：护栏插件

```python
"""护栏插件 — 执行内容策略。"""

POLICY = """本次会话你必须遵循这些内容策略：
- 永远不要生成访问工作目录外文件系统的代码
- 执行破坏性操作前始终警告
- 拒绝涉及个人数据提取的请求"""

def inject_guardrails(**kwargs):
    """每轮注入策略文本。"""
    return {"context": POLICY}

def register(ctx):
    ctx.register_hook("pre_llm_call", inject_guardrails)
```

#### 示例：仅观察者钩子（无注入）

```python
"""分析插件 — 跟踪轮次元数据而不注入上下文。"""

import logging
logger = logging.getLogger(__name__)

def log_turn(session_id, user_message, model, is_first_turn, **kwargs):
    """在每次 LLM 调用前触发。返回 None — 不注入上下文。"""
    logger.info("Turn: session=%s model=%s first=%s msg_len=%d",
                session_id, model, is_first_turn, len(user_message or ""))
    # 无返回 → 不注入

def register(ctx):
    ctx.register_hook("pre_llm_call", log_turn)
```

#### 多个插件返回上下文

当多个插件从 `pre_llm_call` 返回上下文时，它们的输出用双换行连接并一起追加到用户消息。顺序遵循插件发现顺序（按插件目录名字母排序）。

### 注册 CLI 命令

插件可以添加自己的 `hermes <plugin>` 子命令树：

```python
def _my_command(args):
    """hermes my-plugin <subcommand> 的处理器。"""
    sub = getattr(args, "my_command", None)
    if sub == "status":
        print("All good!")
    elif sub == "config":
        print("Current config: ...")
    else:
        print("Usage: hermes my-plugin <status|config>")

def _setup_argparse(subparser):
    """为 hermes my-plugin 构建 argparse 树。"""
    subs = subparser.add_subparsers(dest="my_command")
    subs.add_parser("status", help="Show plugin status")
    subs.add_parser("config", help="Show plugin config")
    subparser.set_defaults(func=_my_command)

def register(ctx):
    ctx.register_tool(...)
    ctx.register_cli_command(
        name="my-plugin",
        help="Manage my plugin",
        setup_fn=_setup_argparse,
        handler_fn=_my_command,
    )
```

注册后，用户可以运行 `hermes my-plugin status`、`hermes my-plugin config` 等。

**记忆提供者插件**使用基于约定的方法：在插件的 `cli.py` 文件中添加 `register_cli(subparser)` 函数。记忆插件发现系统自动找到它 — 不需要 `ctx.register_cli_command()` 调用。详情请参见[记忆提供者插件指南](/docs/developer-guide/memory-provider-plugin#adding-cli-commands)。

**活跃提供者门控：** 记忆插件 CLI 命令仅在其提供者是配置中的活跃 `memory.provider` 时出现。如果用户没有设置你的提供者，你的 CLI 命令不会弄乱帮助输出。

### 注册斜杠命令

插件可以注册会话内斜杠命令 — 用户在对话中输入的命令（如 `/lcm status` 或 `/ping`）。这些在 CLI 和网关（Telegram、Discord 等）中都工作。

```python
def _handle_status(raw_args: str) -> str:
    """/mystatus 的处理器 — 用命令名后的所有内容调用。"""
    if raw_args.strip() == "help":
        return "Usage: /mystatus [help|check]"
    return "Plugin status: all systems nominal"

def register(ctx):
    ctx.register_command(
        "mystatus",
        handler=_handle_status,
        description="Show plugin status",
    )
```

注册后，用户可以在任何会话中输入 `/mystatus`。命令出现在自动补全、`/help` 输出和 Telegram 机器人菜单中。

**签名：** `ctx.register_command(name: str, handler: Callable, description: str = "")`

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | `str` | 不带前导斜杠的命令名（例如 `"lcm"`、`"mystatus"`） |
| `handler` | `Callable[[str], str \| None]` | 用原始参数字符串调用。也可以是 `async`。 |
| `description` | `str` | 在 `/help`、自动补全和 Telegram 机器人菜单中显示 |

**与 `register_cli_command()` 的关键区别：**

| | `register_command()` | `register_cli_command()` |
|---|---|---|
| 调用方式 | 会话中的 `/name` | 终端中的 `hermes name` |
| 工作位置 | CLI 会话、Telegram、Discord 等 | 仅终端 |
| 处理器接收 | 原始参数字符串 | argparse `Namespace` |
| 用例 | 诊断、状态、快速操作 | 复杂子命令树、设置向导 |

**冲突保护：** 如果插件尝试注册与内置命令冲突的名称（`help`、`model`、`new` 等），注册被静默拒绝并有日志警告。内置命令始终优先。

**异步处理器：** 网关调度自动检测和等待异步处理器，因此你可以使用同步或异步函数：

```python
async def _handle_check(raw_args: str) -> str:
    result = await some_async_operation()
    return f"Check result: {result}"

def register(ctx):
    ctx.register_command("check", handler=_handle_check, description="Run async check")
```

:::tip
本指南涵盖**通用插件**（工具、钩子、斜杠命令、CLI 命令）。有关专门的插件类型，请参见：
- [记忆提供者插件](/docs/developer-guide/memory-provider-plugin) — 跨会话知识后端
- [上下文引擎插件](/docs/developer-guide/context-engine-plugin) — 替代上下文管理策略
:::

### 通过 pip 分发

要公开分享插件，在你的 Python 包中添加入口点：

```toml
# pyproject.toml
[project.entry-points."hermes_agent.plugins"]
my-plugin = "my_plugin_package"
```

```bash
pip install hermes-plugin-calculator
# 下次 hermes 启动时自动发现插件
```

## 常见错误

**处理器不返回 JSON 字符串：**
```python
# 错误 — 返回字典
def handler(args, **kwargs):
    return {"result": 42}

# 正确 — 返回 JSON 字符串
def handler(args, **kwargs):
    return json.dumps({"result": 42})
```

**处理器签名中缺少 `**kwargs`：**
```python
# 错误 — 如果 Hermes 传递额外上下文会中断
def handler(args):
    ...

# 正确
def handler(args, **kwargs):
    ...
```

**处理器抛出异常：**
```python
# 错误 — 异常传播，工具调用失败
def handler(args, **kwargs):
    result = 1 / int(args["value"])  # ZeroDivisionError!
    return json.dumps({"result": result})

# 正确 — 捕获并返回错误 JSON
def handler(args, **kwargs):
    try:
        result = 1 / int(args.get("value", 0))
        return json.dumps({"result": result})
    except Exception as e:
        return json.dumps({"error": str(e)})
```

**Schema 描述太模糊：**
```python
# 差 — 模型不知道何时使用
"description": "Does stuff"

# 好 — 模型确切知道何时和如何
"description": "Evaluate a mathematical expression. Use for arithmetic, trig, logarithms. Supports: +, -, *, /, **, sqrt, sin, cos, log, pi, e."
```
