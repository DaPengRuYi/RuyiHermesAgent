---
sidebar_position: 7
title: "子代理委托"
description: "通过 delegate_task 生成隔离的子代理用于并行工作流"
---

# 子代理委托

`delegate_task` 工具生成具有隔离上下文、受限工具集和独立终端会话的子 AIAgent 实例。每个子代理获得全新对话并独立工作——只有其最终摘要进入父级的上下文。

## 单个任务

```python
delegate_task(
    goal="Debug why tests fail",
    context="Error: assertion in test_foo.py line 42",
    toolsets=["terminal", "file"]
)
```

## 并行批次

默认最多 3 个并发子代理（可配置，无硬上限）：

```python
delegate_task(tasks=[
    {"goal": "Research topic A", "toolsets": ["web"]},
    {"goal": "Research topic B", "toolsets": ["web"]},
    {"goal": "Fix the build", "toolsets": ["terminal", "file"]}
])
```

## 子代理上下文如何工作

:::warning 关键：子代理一无所知
子代理以**完全全新的对话**开始。它们对父级的对话历史、先前的工具调用或委托前讨论的任何内容零了解。子代理的唯一上下文来自父代理调用 `delegate_task` 时填充的 `goal` 和 `context` 字段。
:::

这意味着父代理必须在调用中传递子代理需要的**所有内容**：

```python
# 不好 - 子代理不知道 "the error" 是什么
delegate_task(goal="Fix the error")

# 好 - 子代理拥有所有需要的上下文
delegate_task(
    goal="Fix the TypeError in api/handlers.py",
    context="""The file api/handlers.py has a TypeError on line 47:
    'NoneType' object has no attribute 'get'.
    The function process_request() receives a dict from parse_body(),
    but parse_body() returns None when Content-Type is missing.
    The project is at /home/user/myproject and uses Python 3.11."""
)
```

子代理接收从你的目标和上下文构建的专注系统提示，指示其完成任务并提供结构化摘要，包括它做了什么、发现了什么、修改了哪些文件以及遇到的任何问题。

## 实际示例

### 并行研究

同时研究多个主题并收集摘要：

```python
delegate_task(tasks=[
    {
        "goal": "Research the current state of WebAssembly in 2025",
        "context": "Focus on: browser support, non-browser runtimes, language support",
        "toolsets": ["web"]
    },
    {
        "goal": "Research the current state of RISC-V adoption in 2025",
        "context": "Focus on: server chips, embedded systems, software ecosystem",
        "toolsets": ["web"]
    },
    {
        "goal": "Research quantum computing progress in 2025",
        "context": "Focus on: error correction breakthroughs, practical applications, key players",
        "toolsets": ["web"]
    }
])
```

### 代码审查 + 修复

将审查并修复工作流委托给新上下文：

```python
delegate_task(
    goal="Review the authentication module for security issues and fix any found",
    context="""Project at /home/user/webapp.
    Auth module files: src/auth/login.py, src/auth/jwt.py, src/auth/middleware.py.
    The project uses Flask, PyJWT, and bcrypt.
    Focus on: SQL injection, JWT validation, password handling, session management.
    Fix any issues found and run the test suite (pytest tests/auth/).""",
    toolsets=["terminal", "file"]
)
```

### 多文件重构

委托会淹没父级上下文的大型重构任务：

```python
delegate_task(
    goal="Refactor all Python files in src/ to replace print() with proper logging",
    context="""Project at /home/user/myproject.
    Use the 'logging' module with logger = logging.getLogger(__name__).
    Replace print() calls with appropriate log levels:
    - print(f"Error: ...") -> logger.error(...)
    - print(f"Warning: ...") -> logger.warning(...)
    - print(f"Debug: ...") -> logger.debug(...)
    - Other prints -> logger.info(...)
    Don't change print() in test files or CLI output.
    Run pytest after to verify nothing broke.""",
    toolsets=["terminal", "file"]
)
```

## 批量模式详情

当你提供 `tasks` 数组时，子代理使用线程池**并行**运行：

- **最大并发：** 默认 3 个任务（通过 `delegation.max_concurrent_children` 或 `DELEGATION_MAX_CONCURRENT_CHILDREN` 环境变量配置；下限为 1，无硬上限）。超过限制的批次返回工具错误而非静默截断。
- **线程池：** 使用 `ThreadPoolExecutor`，配置的并发限制作为最大工作线程数
- **进度显示：** 在 CLI 模式下，树视图实时显示每个子代理的工具调用，带有每任务完成行。在网关模式下，进度被批量中继到父级的进度回调
- **结果排序：** 按任务索引排序以匹配输入顺序，无论完成顺序如何
- **中断传播：** 中断父级（例如发送新消息）会中断所有活跃子级

单任务委托直接运行，无线程池开销。

## 模型覆盖

你可以通过 `config.yaml` 为子代理配置不同的模型——适用于将简单任务委托给更便宜/更快的模型：

```yaml
# 在 ~/.hermes/config.yaml 中
delegation:
  model: "google/gemini-flash-2.0"    # 子代理使用更便宜的模型
  provider: "openrouter"              # 可选：将子代理路由到不同提供商
```

如果省略，子代理使用与父级相同的模型。

## 工具集选择提示

`toolsets` 参数控制子代理可以访问哪些工具。根据任务选择：

| 工具集模式 | 用例 |
|-----------|------|
| `["terminal", "file"]` | 代码工作、调试、文件编辑、构建 |
| `["web"]` | 研究、事实核查、文档查找 |
| `["terminal", "file", "web"]` | 全栈任务（默认） |
| `["file"]` | 只读分析、代码审查不执行 |
| `["terminal"]` | 系统管理、进程管理 |

某些工具集无论你指定什么都会被阻止：
- `delegation` — 叶子子代理被阻止（默认）。对 `role="orchestrator"` 子级保留，受 `max_spawn_depth` 限制——参见下面的[深度限制和嵌套编排](#深度限制和嵌套编排)。
- `clarify` — 子代理不能与用户交互
- `memory` — 不写入共享持久内存
- `code_execution` — 子级应该逐步推理
- `send_message` — 无跨平台副作用（例如发送 Telegram 消息）

## 最大迭代次数

每个子代理有迭代限制（默认：50），控制它可以进行多少轮工具调用：

```python
delegate_task(
    goal="Quick file check",
    context="Check if /etc/nginx/nginx.conf exists and print its first 10 lines",
    max_iterations=10  # 简单任务，不需要很多轮
)
```

## 深度限制和嵌套编排

默认情况下，委托是**扁平的**：父级（深度 0）生成子级（深度 1），这些子级不能再委托。这防止了失控的递归委托。

对于多阶段工作流（研究 → 综合，或子问题的并行编排），父级可以生成**编排者**子级，它们*可以*委托自己的工作者：

```python
delegate_task(
    goal="Survey three code review approaches and recommend one",
    role="orchestrator",  # 允许此子级生成自己的工作者
    context="...",
)
```

- `role="leaf"`（默认）：子级不能再委托——与扁平委托行为相同。
- `role="orchestrator"`：子级保留 `delegation` 工具集。受 `delegation.max_spawn_depth`（默认 **1** = 托平，因此 `role="orchestrator"` 在默认值下无效）限制。将 `max_spawn_depth` 提升到 2 允许编排者子级生成叶子孙级；3 表示三级（上限）。
- `delegation.orchestrator_enabled: false`：全局开关，强制每个子级为 `leaf`，无论 `role` 参数如何。

**成本警告：** 当 `max_spawn_depth: 3` 且 `max_concurrent_children: 3` 时，树可以达到 3×3×3 = 27 个并发叶子代理。每增加一级都会倍增开销——请有意地提升 `max_spawn_depth`。

## 关键属性

- 每个子代理获得自己的**终端会话**（与父级分离）
- **嵌套委托是选择启用的** — 只有 `role="orchestrator"` 子级可以进一步委托，且仅当 `max_spawn_depth` 从默认值 1（扁平）提升时。通过 `orchestrator_enabled: false` 全局禁用。
- 叶子子代理**不能**调用：`delegate_task`、`clarify`、`memory`、`send_message`、`execute_code`。编排者子代理保留 `delegate_task` 但仍然不能使用其他四个。
- **中断传播** — 中断父级会中断所有活跃子级（包括编排者下的孙级）
- 只有最终摘要进入父级的上下文，保持令牌使用高效
- 子代理继承父级的 **API 密钥、提供商配置和凭据池**（支持在速率限制时轮换密钥）

## 委托 vs execute_code

| 因素 | delegate_task | execute_code |
|------|--------------|-------------|
| **推理** | 完整的 LLM 推理循环 | 仅 Python 代码执行 |
| **上下文** | 全新隔离对话 | 无对话，仅脚本 |
| **工具访问** | 所有非阻止工具带推理 | 7 个工具通过 RPC，无推理 |
| **并行性** | 默认 3 个并发子代理（可配置） | 单个脚本 |
| **最适合** | 需要判断的复杂任务 | 机械式多步骤管道 |
| **令牌成本** | 较高（完整 LLM 循环） | 较低（仅返回 stdout） |
| **用户交互** | 无（子代理不能澄清） | 无 |

**经验法则：** 当子任务需要推理、判断或多步问题解决时使用 `delegate_task`。当你需要机械式数据处理或脚本化工作流时使用 `execute_code`。

## 配置

```yaml
# 在 ~/.hermes/config.yaml 中
delegation:
  max_iterations: 50                        # 每个子级最大轮次（默认：50）
  # max_concurrent_children: 3              # 每批并行子级数（默认：3）
  # max_spawn_depth: 1                      # 树深度（1-3，默认 1 = 扁平）。提升到 2 允许编排者子级生成叶子；3 表示三级。
  # orchestrator_enabled: true              # 禁用以强制所有子级为叶子角色。
  model: "google/gemini-3-flash-preview"             # 可选提供商/模型覆盖
  provider: "openrouter"                             # 可选内置提供商

# 或使用直接自定义端点代替提供商：
delegation:
  model: "qwen2.5-coder"
  base_url: "http://localhost:1234/v1"
  api_key: "local-key"
```

:::tip
代理会根据任务复杂度自动处理委托。你不需要明确要求它委托——它会在合适的时候这样做。
:::
