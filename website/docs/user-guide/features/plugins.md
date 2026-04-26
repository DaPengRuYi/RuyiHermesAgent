---
sidebar_position: 11
sidebar_label: "插件"
title: "插件"
description: "通过插件系统使用自定义工具、钩子和集成扩展 Hermes"
---

# 插件

Hermes 有插件系统，用于添加自定义工具、钩子和集成而无需修改核心代码。

**→ [构建 Hermes 插件](/docs/guides/build-a-hermes-plugin)** — 带完整工作示例的分步指南。

## 快速概览

将目录放入 `~/.hermes/plugins/`，包含 `plugin.yaml` 和 Python 代码：

```
~/.hermes/plugins/my-plugin/
├── plugin.yaml      # 清单
├── __init__.py      # register() — 将模式连接到处理器
├── schemas.py       # 工具模式（LLM 看到的）
└── tools.py         # 工具处理器（调用时运行的）
```

启动 Hermes——你的工具出现在内置工具旁边。模型可以立即调用它们。

### 最小工作示例

这是一个完整的插件，添加 `hello_world` 工具并通过钩子记录每次工具调用。

**`~/.hermes/plugins/hello-world/plugin.yaml`**

```yaml
name: hello-world
version: "1.0"
description: A minimal example plugin
```

**`~/.hermes/plugins/hello-world/__init__.py`**

```python
"""Minimal Hermes plugin — registers a tool and a hook."""


def register(ctx):
    # --- Tool: hello_world ---
    schema = {
        "name": "hello_world",
        "description": "Returns a friendly greeting for the given name.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name to greet",
                }
            },
            "required": ["name"],
        },
    }

    def handle_hello(params):
        name = params.get("name", "World")
        return f"Hello, {name}! 👋  (from the hello-world plugin)"

    ctx.register_tool("hello_world", schema, handle_hello)

    # --- Hook: log every tool call ---
    def on_tool_call(tool_name, params, result):
        print(f"[hello-world] tool called: {tool_name}")

    ctx.register_hook("post_tool_call", on_tool_call)
```

将两个文件放入 `~/.hermes/plugins/hello-world/`，重启 Hermes，模型就可以立即调用 `hello_world`。钩子在每次工具调用后打印日志行。

项目本地插件在 `./.hermes/plugins/` 下默认禁用。仅对受信任的仓库通过在启动 Hermes 前设置 `HERMES_ENABLE_PROJECT_PLUGINS=true` 启用。

## 插件能做什么

| 能力 | 方式 |
|------|------|
| 添加工具 | `ctx.register_tool(name, schema, handler)` |
| 添加钩子 | `ctx.register_hook("post_tool_call", callback)` |
| 添加斜杠命令 | `ctx.register_command(name, handler, description)` — 在 CLI 和网关会话中添加 `/name` |
| 添加 CLI 命令 | `ctx.register_cli_command(name, help, setup_fn, handler_fn)` — 添加 `hermes <plugin> <subcommand>` |
| 注入消息 | `ctx.inject_message(content, role="user")` — 参见[注入消息](#注入消息) |
| 附带数据文件 | `Path(__file__).parent / "data" / "file.yaml"` |
| 捆绑技能 | `ctx.register_skill(name, path)` — 命名空间为 `plugin:skill`，通过 `skill_view("plugin:skill")` 加载 |
| 环境变量门控 | `plugin.yaml` 中的 `requires_env: [API_KEY]` — `hermes plugins install` 期间提示 |
| 通过 pip 分发 | `[project.entry-points."hermes_agent.plugins"]` |

## 插件发现

| 来源 | 路径 | 用例 |
|------|------|------|
| 捆绑 | `<repo>/plugins/` | 随 Hermes 附带——参见[内置插件](/docs/user-guide/features/built-in-plugins) |
| 用户 | `~/.hermes/plugins/` | 个人插件 |
| 项目 | `.hermes/plugins/` | 项目特定插件（需要 `HERMES_ENABLE_PROJECT_PLUGINS=true`） |
| pip | `hermes_agent.plugins` entry_points | 分发包 |

名称冲突时后面的来源覆盖前面的，因此与捆绑插件同名的用户插件会替换它。

## 插件是选择启用的

**每个插件——用户安装、捆绑或 pip——默认禁用。** 发现会找到它们（因此它们出现在 `hermes plugins` 和 `/plugins` 中），但在你将插件名称添加到 `~/.hermes/config.yaml` 的 `plugins.enabled` 之前不会加载。这阻止任何带钩子或工具的内容未经你明确同意运行。

```yaml
plugins:
  enabled:
    - my-tool-plugin
    - disk-cleanup
  disabled:       # 可选拒绝列表——如果名称同时出现在两者中始终获胜
    - noisy-plugin
```

三种切换状态的方式：

```bash
hermes plugins                    # 交互式切换（空格选中/取消选中）
hermes plugins enable <name>      # 添加到允许列表
hermes plugins disable <name>     # 从允许列表移除 + 添加到禁用
```

`hermes plugins install owner/repo` 后，你会被问 `Enable 'name' now? [y/N]` — 默认为否。用 `--enable` 或 `--no-enable` 跳过脚本化安装的提示。

### 现有用户的迁移

当你升级到具有选择启用插件的 Hermes 版本（配置模式 v21+）时，已安装在 `~/.hermes/plugins/` 下且未在 `plugins.disabled` 中的任何用户插件被**自动继承**到 `plugins.enabled` 中。你的现有设置继续工作。捆绑插件不会被继承——即使是现有用户也必须明确选择启用。

## 可用钩子

插件可以为这些生命周期事件注册回调。参见 **[事件钩子页面](/docs/user-guide/features/hooks#plugin-hooks)** 获取完整详情、回调签名和示例。

| 钩子 | 触发时机 |
|------|---------|
| [`pre_tool_call`](/docs/user-guide/features/hooks#pre_tool_call) | 任何工具执行前 |
| [`post_tool_call`](/docs/user-guide/features/hooks#post_tool_call) | 任何工具返回后 |
| [`pre_llm_call`](/docs/user-guide/features/hooks#pre_llm_call) | 每轮一次，LLM 循环前——可返回 `{"context": "..."}` 以[向用户消息注入上下文](/docs/user-guide/features/hooks#pre_llm_call) |
| [`post_llm_call`](/docs/user-guide/features/hooks#post_llm_call) | 每轮一次，LLM 循环后（仅成功轮次） |
| [`on_session_start`](/docs/user-guide/features/hooks#on_session_start) | 新会话创建（仅第一轮） |
| [`on_session_end`](/docs/user-guide/features/hooks#on_session_end) | 每次 `run_conversation` 调用结束 + CLI 退出处理器 |
| [`pre_gateway_dispatch`](/docs/user-guide/features/hooks#pre_gateway_dispatch) | 网关收到用户消息，认证 + 调度前。返回 `{"action": "skip" \| "rewrite" \| "allow", ...}` 以影响流程。 |

## 插件类型

Hermes 有三种插件：

| 类型 | 功能 | 选择方式 | 位置 |
|------|------|---------|------|
| **通用插件** | 添加工具、钩子、斜杠命令、CLI 命令 | 多选（启用/禁用） | `~/.hermes/plugins/` |
| **记忆提供商** | 替换或增强内置记忆 | 单选（一个活跃） | `plugins/memory/` |
| **上下文引擎** | 替换内置上下文压缩器 | 单选（一个活跃） | `plugins/context_engine/` |

记忆提供商和上下文引擎是**提供商插件**——每种类型一次只能有一个活跃。通用插件可以任意组合启用。

## 管理插件

```bash
hermes plugins                               # 统一交互式 UI
hermes plugins list                          # 表格：启用 / 禁用 / 未启用
hermes plugins install user/repo             # 从 Git 安装，然后提示 Enable? [y/N]
hermes plugins install user/repo --enable    # 安装并启用（无提示）
hermes plugins install user/repo --no-enable # 安装但保持禁用（无提示）
hermes plugins update my-plugin              # 拉取最新
hermes plugins remove my-plugin              # 卸载
hermes plugins enable my-plugin              # 添加到允许列表
hermes plugins disable my-plugin             # 从允许列表移除 + 添加到禁用
```

### 交互式 UI

运行不带参数的 `hermes plugins` 打开组合交互屏幕：

```
Plugins
  ↑↓ navigate  SPACE toggle  ENTER configure/confirm  ESC done

  General Plugins
 → [✓] my-tool-plugin — Custom search tool
   [ ] webhook-notifier — Event hooks
   [ ] disk-cleanup — Auto-cleanup of ephemeral files [bundled]

  Provider Plugins
     Memory Provider          ▸ honcho
     Context Engine           ▸ compressor
```

- **通用插件部分** — 复选框，用空格切换。选中 = 在 `plugins.enabled`，未选中 = 在 `plugins.disabled`（明确关闭）。
- **提供商插件部分** — 显示当前选择。按 Enter 进入单选选择器，选择一个活跃提供商。
- 捆绑插件在同一列表中出现，带有 `[bundled]` 标签。

提供商插件选择保存到 `config.yaml`：

```yaml
memory:
  provider: "honcho"      # 空字符串 = 仅内置

context:
  engine: "compressor"    # 默认内置压缩器
```

### 启用 vs 禁用 vs 都不是

插件占据三种状态之一：

| 状态 | 含义 | 在 `plugins.enabled` 中？ | 在 `plugins.disabled` 中？ |
|------|------|-------------------------|--------------------------|
| `enabled` | 下次会话加载 | 是 | 否 |
| `disabled` | 明确关闭——即使也在 `enabled` 中也不会加载 | （无关） | 是 |
| `not enabled` | 已发现但从未选择启用 | 否 | 否 |

新安装或捆绑插件的默认状态是 `not enabled`。`hermes plugins list` 显示所有三种不同状态，以便你可以区分什么是被明确关闭的 vs 什么是仅等待启用的。

在运行中的会话中，`/plugins` 显示当前加载了哪些插件。

## 注入消息

插件可以使用 `ctx.inject_message()` 向活跃对话注入消息：

```python
ctx.inject_message("New data arrived from the webhook", role="user")
```

**签名：** `ctx.inject_message(content: str, role: str = "user") -> bool`

工作原理：

- 如果代理**空闲**（等待用户输入），消息排队为下一个输入并开始新轮次。
- 如果代理**在轮次中**（活跃运行），消息中断当前操作——与用户输入新消息并按 Enter 相同。
- 对于非 `"user"` 角色，内容以 `[role]` 为前缀（例如 `[system] ...`）。
- 如果消息成功排队返回 `True`，如果没有可用的 CLI 引用（例如在网关模式下）返回 `False`。

这使得远程控制查看器、消息桥接或 webhook 接收器等插件可以从外部来源向对话提取消息。

:::note
`inject_message` 仅在 CLI 模式下可用。在网关模式下，没有 CLI 引用，方法返回 `False`。
:::

参见 **[完整指南](/docs/guides/build-a-hermes-plugin)** 获取处理器契约、模式格式、钩子行为、错误处理和常见错误。
