---
sidebar_position: 14
title: "API 服务器"
description: "将 hermes-agent 暴露为 OpenAI 兼容的 API，供任何前端使用"
---

# API 服务器

API 服务器将 hermes-agent 暴露为 OpenAI 兼容的 HTTP 端点。任何使用 OpenAI 格式的前端——Open WebUI、LobeChat、LibreChat、NextChat、ChatBox 等数百个——都可以连接到 hermes-agent 并将其用作后端。

你的代理使用其完整工具集（终端、文件操作、网页搜索、记忆、技能）处理请求并返回最终响应。流式传输时，工具进度指示器会内联显示，以便前端可以显示代理正在做什么。

## 快速开始

### 1. 启用 API 服务器

添加到 `~/.hermes/.env`：

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
# 可选：仅当浏览器必须直接调用 Hermes 时
# API_SERVER_CORS_ORIGINS=http://localhost:3000
```

### 2. 启动网关

```bash
hermes gateway
```

你会看到：

```
[API Server] API server listening on http://127.0.0.1:8642
```

### 3. 连接前端

将任何 OpenAI 兼容客户端指向 `http://localhost:8642/v1`：

```bash
# 使用 curl 测试
curl http://localhost:8642/v1/chat/completions \
  -H "Authorization: Bearer change-me-local-dev" \
  -H "Content-Type: application/json" \
  -d '{"model": "hermes-agent", "messages": [{"role": "user", "content": "你好！"}]}'
```

或连接 Open WebUI、LobeChat 或任何其他前端——参见 [Open WebUI 集成指南](/docs/user-guide/messaging/open-webui)获取分步说明。

## 端点

### POST /v1/chat/completions

标准 OpenAI Chat Completions 格式。无状态——完整对话通过 `messages` 数组包含在每个请求中。

**请求：**
```json
{
  "model": "hermes-agent",
  "messages": [
    {"role": "system", "content": "你是 Python 专家。"},
    {"role": "user", "content": "编写一个斐波那契函数"}
  ],
  "stream": false
}
```

**响应：**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "hermes-agent",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "这是一个斐波那契函数..."},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 50, "completion_tokens": 200, "total_tokens": 250}
}
```

**内联图片输入：** 用户消息可以将 `content` 发送为 `text` 和 `image_url` 部分的数组。支持远程 `http(s)` URL 和 `data:image/...` URL：

```json
{
  "model": "hermes-agent",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "这张图片中有什么？"},
        {"type": "image_url", "image_url": {"url": "https://example.com/cat.png", "detail": "high"}}
      ]
    }
  ]
}
```

上传的文件（`file` / `input_file` / `file_id`）和非图片 `data:` URL 返回 `400 unsupported_content_type`。

**流式传输**（`"stream": true`）：返回服务器发送事件（SSE），逐令牌响应块。对于 **Chat Completions**，流使用标准 `chat.completion.chunk` 事件加上 Hermes 的自定义 `hermes.tool.progress` 事件用于工具启动 UX。对于 **Responses**，流使用 OpenAI Responses 事件类型，如 `response.created`、`response.output_text.delta`、`response.output_item.added`、`response.output_item.done` 和 `response.completed`。

**流中的工具进度**：
- **Chat Completions**：Hermes 发出 `event: hermes.tool.progress` 以获得工具启动可见性，而不污染持久化的助手文本。
- **Responses**：Hermes 在 SSE 流中发出规范原生的 `function_call` 和 `function_call_output` 输出项，因此客户端可以实时渲染结构化工具 UI。

### POST /v1/responses

OpenAI Responses API 格式。通过 `previous_response_id` 支持服务器端对话状态——服务器存储完整对话历史（包括工具调用和结果），因此多轮上下文无需客户端管理即可保留。

**请求：**
```json
{
  "model": "hermes-agent",
  "input": "我的项目中有哪些文件？",
  "instructions": "你是一个乐于助人的编码助手。",
  "store": true
}
```

**响应：**
```json
{
  "id": "resp_abc123",
  "object": "response",
  "status": "completed",
  "model": "hermes-agent",
  "output": [
    {"type": "function_call", "name": "terminal", "arguments": "{\"command\": \"ls\"}", "call_id": "call_1"},
    {"type": "function_call_output", "call_id": "call_1", "output": "README.md src/ tests/"},
    {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "你的项目有..."}]}
  ],
  "usage": {"input_tokens": 50, "output_tokens": 200, "total_tokens": 250}
}
```

**内联图片输入：** `input[].content` 可以包含 `input_text` 和 `input_image` 部分。支持远程 URL 和 `data:image/...` URL：

```json
{
  "model": "hermes-agent",
  "input": [
    {
      "role": "user",
      "content": [
        {"type": "input_text", "text": "描述这个截图。"},
        {"type": "input_image", "image_url": "data:image/png;base64,iVBORw0K..."}
      ]
    }
  ]
}
```

上传的文件（`input_file` / `file_id`）和非图片 `data:` URL 返回 `400 unsupported_content_type`。

#### 使用 previous_response_id 的多轮对话

链接响应以在轮次之间维护完整上下文（包括工具调用）：

```json
{
  "input": "现在给我看 README",
  "previous_response_id": "resp_abc123"
}
```

服务器从存储的响应链重建完整对话——所有之前的工具调用和结果都被保留。链接的请求也共享同一会话，因此多轮对话在仪表板和会话历史中显示为单个条目。

#### 命名对话

使用 `conversation` 参数代替跟踪响应 ID：

```json
{"input": "你好", "conversation": "my-project"}
{"input": "src/ 中有什么？", "conversation": "my-project"}
{"input": "运行测试", "conversation": "my-project"}
```

服务器自动链接到该对话中的最新响应。类似网关会话的 `/title` 命令。

### GET /v1/responses/\{id\}

按 ID 检索之前存储的响应。

### DELETE /v1/responses/\{id\}

删除存储的响应。

### GET /v1/models

将代理列为可用模型。宣告的模型名称默认为[配置文件](/docs/user-guide/profiles)名称（默认配置文件为 `hermes-agent`）。大多数前端的模型发现需要此端点。

### GET /health

健康检查。返回 `{"status": "ok"}`。也在 **GET /v1/health** 上可用，供期望 `/v1/` 前缀的 OpenAI 兼容客户端使用。

### GET /health/detailed

扩展健康检查，还报告活动会话、运行中的代理和资源使用情况。适用于监控/可观测性工具。

## Runs API（流式友好的替代方案）

除了 `/v1/chat/completions` 和 `/v1/responses` 之外，服务器还暴露一个 **runs** API，适用于客户端希望订阅进度事件而不是自己管理流式传输的长形式会话。

### POST /v1/runs

创建新的代理运行。返回一个 `run_id`，可用于订阅进度事件。

### GET /v1/runs/\{run_id\}/events

运行的工具调用进度、令牌增量和生命周期事件的服务器发送事件流。专为希望附加/分离而不丢失状态的仪表板和富客户端设计。

## Jobs API（后台定时工作）

服务器暴露一个轻量级的作业 CRUD 接口，用于从远程客户端管理定时/后台代理运行。所有端点都通过相同的 bearer 身份验证进行门控。

### GET /api/jobs

列出所有定时作业。

### POST /api/jobs

创建新的定时作业。请求体接受与 `hermes cron` 相同的格式——提示、调度、技能、提供商覆盖、传递目标。

### GET /api/jobs/\{job_id\}

获取单个作业的定义和上次运行状态。

### PATCH /api/jobs/\{job_id\}

更新现有作业的字段（提示、调度等）。部分更新会被合并。

### DELETE /api/jobs/\{job_id\}

删除作业。同时取消任何正在进行的运行。

### POST /api/jobs/\{job_id\}/pause

暂停作业而不删除。下次计划运行的时间戳暂停直到恢复。

### POST /api/jobs/\{job_id\}/resume

恢复之前暂停的作业。

### POST /api/jobs/\{job_id\}/run

立即触动作业运行，不在计划之内。

## 系统提示处理

当前端发送 `system` 消息（Chat Completions）或 `instructions` 字段（Responses API）时，hermes-agent **将其层叠在核心系统提示之上**。你的代理保留所有工具、记忆和技能——前端的系统提示添加额外指令。

这意味着你可以按前端自定义行为而不丢失能力：
- Open WebUI 系统提示："你是 Python 专家。始终包含类型提示。"
- 代理仍然拥有终端、文件工具、网页搜索、记忆等。

## 身份验证

通过 `Authorization` 头进行 Bearer 令牌身份验证：

```
Authorization: Bearer ***
```

通过 `API_SERVER_KEY` 环境变量配置密钥。如果你需要浏览器直接调用 Hermes，还需要设置 `API_SERVER_CORS_ORIGINS` 为明确的允许列表。

:::warning 安全
API 服务器提供对 hermes-agent 工具集的完全访问权限，**包括终端命令**。当绑定到非环回地址如 `0.0.0.0` 时，`API_SERVER_KEY` 是**必需的**。同时保持 `API_SERVER_CORS_ORIGINS` 窄范围以控制浏览器访问。

默认绑定地址（`127.0.0.1`）仅用于本地使用。浏览器访问默认禁用；仅对明确的受信任来源启用。
:::

## 配置

### 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `API_SERVER_ENABLED` | `false` | 启用 API 服务器 |
| `API_SERVER_PORT` | `8642` | HTTP 服务器端口 |
| `API_SERVER_HOST` | `127.0.0.1` | 绑定地址（默认仅本地） |
| `API_SERVER_KEY` | _（无）_ | 身份验证的 Bearer 令牌 |
| `API_SERVER_CORS_ORIGINS` | _（无）_ | 逗号分隔的允许浏览器来源 |
| `API_SERVER_MODEL_NAME` | _（配置文件名称）_ | `/v1/models` 上的模型名称。默认为配置文件名称，默认配置文件为 `hermes-agent`。 |

### config.yaml

```yaml
# 尚不支持——请使用环境变量。
# config.yaml 支持将在未来版本中推出。
```

## 安全头

所有响应包含安全头：
- `X-Content-Type-Options: nosniff` —— 防止 MIME 类型嗅探
- `Referrer-Policy: no-referrer` —— 防止引用者泄露

## CORS

API 服务器**默认不**启用浏览器 CORS。

对于直接浏览器访问，设置明确的允许列表：

```bash
API_SERVER_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

启用 CORS 时：
- **预检响应**包含 `Access-Control-Max-Age: 600`（10 分钟缓存）
- **SSE 流式响应**包含 CORS 头，以便浏览器 EventSource 客户端正常工作
- **`Idempotency-Key`** 是允许的请求头——客户端可以发送它用于去重（响应按键缓存 5 分钟）

大多数已记录的前端（如 Open WebUI）通过服务器到服务器连接，根本不需要 CORS。

## 兼容前端

任何支持 OpenAI API 格式的前端都可以工作。已测试/记录的集成：

| 前端 | Stars | 连接 |
|------|-------|------|
| [Open WebUI](/docs/user-guide/messaging/open-webui) | 126k | 完整指南可用 |
| LobeChat | 73k | 自定义提供商端点 |
| LibreChat | 34k | librechat.yaml 中的自定义端点 |
| AnythingLLM | 56k | 通用 OpenAI 提供商 |
| NextChat | 87k | BASE_URL 环境变量 |
| ChatBox | 39k | API Host 设置 |
| Jan | 26k | 远程模型配置 |
| HF Chat-UI | 8k | OPENAI_BASE_URL |
| big-AGI | 7k | 自定义端点 |
| OpenAI Python SDK | — | `OpenAI(base_url="http://localhost:8642/v1")` |
| curl | — | 直接 HTTP 请求 |

## 使用配置文件的多用户设置

要为多个用户提供各自隔离的 Hermes 实例（独立配置、记忆、技能），使用[配置文件](/docs/user-guide/profiles)：

```bash
# 为每个用户创建配置文件
hermes profile create alice
hermes profile create bob

# 在不同端口上配置每个配置文件的 API 服务器
hermes -p alice config set API_SERVER_ENABLED true
hermes -p alice config set API_SERVER_PORT 8643
hermes -p alice config set API_SERVER_KEY alice-secret

hermes -p bob config set API_SERVER_ENABLED true
hermes -p bob config set API_SERVER_PORT 8644
hermes -p bob config set API_SERVER_KEY bob-secret

# 启动每个配置文件的网关
hermes -p alice gateway &
hermes -p bob gateway &
```

每个配置文件的 API 服务器自动将配置文件名称宣告为模型 ID：

- `http://localhost:8643/v1/models` → 模型 `alice`
- `http://localhost:8644/v1/models` → 模型 `bob`

在 Open WebUI 中，将每个添加为单独的连接。模型下拉菜单显示 `alice` 和 `bob` 作为不同的模型，每个由完全隔离的 Hermes 实例支持。详见 [Open WebUI 指南](/docs/user-guide/messaging/open-webui#multi-user-setup-with-profiles)。

## 限制

- **响应存储** —— 存储的响应（用于 `previous_response_id`）持久化在 SQLite 中，可在网关重启后保留。最多 100 个存储的响应（LRU 驱逐）。
- **无文件上传** —— `/v1/chat/completions` 和 `/v1/responses` 都支持内联图片，但上传的文件（`file`、`input_file`、`file_id`）和非图片文档输入不通过 API 支持。
- **模型字段是装饰性的** —— 请求中的 `model` 字段被接受，但实际使用的 LLM 模型在服务器端 config.yaml 中配置。

## 代理模式

API 服务器还作为**网关代理模式**的后端。当另一个 Hermes 网关实例配置了指向此 API 服务器的 `GATEWAY_PROXY_URL` 时，它将所有消息转发到这里而不是运行自己的代理。这支持分割部署——例如，处理 Matrix E2EE 的 Docker 容器中继到主机端代理。

有关完整设置指南，请参见 [Matrix 代理模式](/docs/user-guide/messaging/matrix#proxy-mode-e2ee-on-macos)。
