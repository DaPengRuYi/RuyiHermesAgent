---
sidebar_position: 3
title: "代理循环内部机制"
description: "AIAgent 执行、API 模式、工具、回调和回退行为的详细演练"
---

# 代理循环内部机制

核心编排引擎是 `run_agent.py` 中的 `AIAgent` 类 — 大约 10,700 行代码，处理从提示词组装到工具调度再到提供商故障转移的所有内容。

## 核心职责

`AIAgent` 负责：

- 通过 `prompt_builder.py` 组装有效的系统提示词和工具 schema
- 选择正确的提供商/API 模式（chat_completions、codex_responses、anthropic_messages）
- 进行可中断的模型调用，支持取消
- 执行工具调用（顺序或通过线程池并发）
- 以 OpenAI 消息格式维护对话历史
- 处理压缩、重试和回退模型切换
- 跨父代理和子代理跟踪迭代预算
- 在上下文丢失前刷新持久记忆

## 两个入口点

```python
# Simple interface — returns final response string
response = agent.chat("Fix the bug in main.py")

# Full interface — returns dict with messages, metadata, usage stats
result = agent.run_conversation(
    user_message="Fix the bug in main.py",
    system_message=None,           # auto-built if omitted
    conversation_history=None,      # auto-loaded from session if omitted
    task_id="task_abc123"
)
```

`chat()` 是 `run_conversation()` 的薄包装，从结果字典中提取 `final_response` 字段。

## API 模式

Hermes 支持三种 API 执行模式，从提供商选择、显式参数和基础 URL 启发式解析：

| API 模式 | 用途 | 客户端类型 |
|----------|------|------------|
| `chat_completions` | OpenAI 兼容端点（OpenRouter、自定义、大多数提供商） | `openai.OpenAI` |
| `codex_responses` | OpenAI Codex / Responses API | `openai.OpenAI`（Responses 格式） |
| `anthropic_messages` | 原生 Anthropic Messages API | `anthropic.Anthropic`（通过适配器） |

模式决定了消息如何格式化、工具调用如何结构化、响应如何解析以及缓存/流式传输如何工作。三种模式在 API 调用前后都收敛到相同的消息格式（OpenAI 风格的 `role`/`content`/`tool_calls` 字典）。

**模式解析顺序：**
1. 显式 `api_mode` 构造函数参数（最高优先级）
2. 提供商特定检测（例如，`anthropic` 提供商 → `anthropic_messages`）
3. 基础 URL 启发式（例如，`api.anthropic.com` → `anthropic_messages`）
4. 默认值：`chat_completions`

## 轮次生命周期

代理循环的每次迭代遵循以下序列：

```text
run_conversation()
  1. Generate task_id if not provided
  2. Append user message to conversation history
  3. Build or reuse cached system prompt (prompt_builder.py)
  4. Check if preflight compression is needed (>50% context)
  5. Build API messages from conversation history
     - chat_completions: OpenAI format as-is
     - codex_responses: convert to Responses API input items
     - anthropic_messages: convert via anthropic_adapter.py
  6. Inject ephemeral prompt layers (budget warnings, context pressure)
  7. Apply prompt caching markers if on Anthropic
  8. Make interruptible API call (_interruptible_api_call)
  9. Parse response:
     - If tool_calls: execute them, append results, loop back to step 5
     - If text response: persist session, flush memory if needed, return
```

### 消息格式

所有消息在内部使用 OpenAI 兼容格式：

```python
{"role": "system", "content": "..."}
{"role": "user", "content": "..."}
{"role": "assistant", "content": "...", "tool_calls": [...]}
{"role": "tool", "tool_call_id": "...", "content": "..."}
```

推理内容（来自支持扩展思考的模型）存储在 `assistant_msg["reasoning"]` 中，可通过 `reasoning_callback` 可选显示。

### 消息交替规则

代理循环强制执行严格的消息角色交替：

- 系统消息之后：`User → Assistant → User → Assistant → ...`
- 工具调用期间：`Assistant (with tool_calls) → Tool → Tool → ... → Assistant`
- **永远不要**两个连续的 assistant 消息
- **永远不要**两个连续的 user 消息
- **只有** `tool` 角色可以有连续条目（并行工具结果）

提供商会验证这些序列，会拒绝格式错误的历史。

## 可中断 API 调用

API 请求被包装在 `_interruptible_api_call()` 中，它在后台线程中运行实际的 HTTP 调用，同时监控中断事件：

```text
┌────────────────────────────────────────────────────┐
│  Main thread                  API thread           │
│                                                    │
│   wait on:                     HTTP POST           │
│    - response ready     ───▶   to provider         │
│    - interrupt event                               │
│    - timeout                                       │
└────────────────────────────────────────────────────┘
```

当中断时（用户发送新消息、`/stop` 命令或信号）：
- API 线程被放弃（响应被丢弃）
- 代理可以处理新输入或干净地关闭
- 没有部分响应被注入对话历史

## 工具执行

### 顺序 vs 并发

当模型返回工具调用时：

- **单个工具调用** → 在主线程中直接执行
- **多个工具调用** → 通过 `ThreadPoolExecutor` 并发执行
  - 例外：标记为交互式的工具（例如 `clarify`）强制顺序执行
  - 结果按原始工具调用顺序重新插入，无论完成顺序如何

### 执行流程

```text
for each tool_call in response.tool_calls:
    1. Resolve handler from tools/registry.py
    2. Fire pre_tool_call plugin hook
    3. Check if dangerous command (tools/approval.py)
       - If dangerous: invoke approval_callback, wait for user
    4. Execute handler with args + task_id
    5. Fire post_tool_call plugin hook
    6. Append {"role": "tool", "content": result} to history
```

### 代理级工具

一些工具在到达 `handle_function_call()` 之前被 `run_agent.py` 拦截：

| 工具 | 拦截原因 |
|------|----------|
| `todo` | 读写代理本地任务状态 |
| `memory` | 写入有字符限制的持久记忆文件 |
| `session_search` | 通过代理的会话数据库查询会话历史 |
| `delegate_task` | 生成具有隔离上下文的子代理 |

这些工具直接修改代理状态并返回合成工具结果，不经过注册表。

## 回调表面

`AIAgent` 支持平台特定的回调，使 CLI、网关和 ACP 集成中能够实时显示进度：

| 回调 | 触发时机 | 使用者 |
|------|----------|--------|
| `tool_progress_callback` | 每次工具执行前后 | CLI 加载动画、网关进度消息 |
| `thinking_callback` | 模型开始/停止思考时 | CLI "思考中..." 指示器 |
| `reasoning_callback` | 模型返回推理内容时 | CLI 推理显示、网关推理块 |
| `clarify_callback` | 调用 `clarify` 工具时 | CLI 输入提示、网关交互消息 |
| `step_callback` | 每次完整代理轮次后 | 网关步骤跟踪、ACP 进度 |
| `stream_delta_callback` | 每个流式令牌（启用时） | CLI 流式显示 |
| `tool_gen_callback` | 从流中解析出工具调用时 | CLI 加载动画中的工具预览 |
| `status_callback` | 状态变化（思考、执行等） | ACP 状态更新 |

## 预算和回退行为

### 迭代预算

代理通过 `IterationBudget` 跟踪迭代：

- 默认：90 次迭代（可通过 `agent.max_turns` 配置）
- 每个代理有自己的预算。子代理获得独立的预算，上限为 `delegation.max_iterations`（默认 50）— 父代理 + 子代理的总迭代次数可以超过父代理的上限
- 达到 100% 时，代理停止并返回已完成工作的摘要

### 回退模型

当主模型失败时（429 速率限制、5xx 服务器错误、401/403 认证错误）：

1. 检查配置中的 `fallback_providers` 列表
2. 按顺序尝试每个回退
3. 成功时，使用新提供商继续对话
4. 遇到 401/403 时，在故障转移前尝试刷新凭据

回退系统还独立覆盖辅助任务 — 视觉、压缩、网页提取和会话搜索各自有自己的回退链，可通过 `auxiliary.*` 配置部分配置。

## 压缩和持久化

### 压缩触发时机

- **预检**（API 调用前）：如果对话超过模型上下文窗口的 50%
- **网关自动压缩**：如果对话超过 85%（更激进，在轮次之间运行）

### 压缩期间发生什么

1. 首先将记忆刷新到磁盘（防止数据丢失）
2. 中间的对话轮次被总结为紧凑的摘要
3. 最后 N 条消息被完整保留（`compression.protect_last_n`，默认：20）
4. 工具调用/结果消息对保持在一起（永不拆分）
5. 生成新的会话谱系 ID（压缩创建"子"会话）

### 会话持久化

每轮之后：
- 消息保存到会话存储（通过 `hermes_state.py` 的 SQLite）
- 记忆更改刷新到 `MEMORY.md` / `USER.md`
- 会话可以通过 `/resume` 或 `hermes chat --resume` 稍后恢复

## 关键源文件

| 文件 | 用途 |
|------|------|
| `run_agent.py` | AIAgent 类 — 完整的代理循环（约 10,700 行） |
| `agent/prompt_builder.py` | 从记忆、技能、上下文文件、个性组装系统提示词 |
| `agent/context_engine.py` | ContextEngine ABC — 可插拔的上下文管理 |
| `agent/context_compressor.py` | 默认引擎 — 有损摘要算法 |
| `agent/prompt_caching.py` | Anthropic 提示词缓存标记和缓存指标 |
| `agent/auxiliary_client.py` | 辅助 LLM 客户端，用于辅助任务（视觉、摘要） |
| `model_tools.py` | 工具 schema 收集、`handle_function_call()` 调度 |

## 相关文档

- [提供商运行时解析](./provider-runtime.md)
- [提示词组装](./prompt-assembly.md)
- [上下文压缩与提示词缓存](./context-compression-and-caching.md)
- [工具运行时](./tools-runtime.md)
- [架构概述](./architecture.md)
