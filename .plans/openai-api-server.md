# Hermes Agent 的 OpenAI 兼容 API 服务器

## 动机

每个主要聊天前端（Open WebUI 126k★、LobeChat 73k★、LibreChat 34k★、AnythingLLM 56k★、NextChat 87k★、ChatBox 39k★、Jan 26k★、HF Chat-UI 8k★、big-AGI 7k★）都通过 OpenAI 兼容的 REST API + SSE 流式连接后端。通过暴露此端点，hermes-agent 可以立即作为所有这些前端的后端使用——无需自定义适配器。

## 功能示意

```
┌──────────────────┐
│  Open WebUI      │──┐
│  LobeChat        │  │    POST /v1/chat/completions
│  LibreChat       │  ├──► Authorization: Bearer <key>     ┌─────────────────┐
│  AnythingLLM     │  │    {"messages": [...]}             │  hermes-agent   │
│  NextChat        │  │                                    │  gateway        │
│  任意 OAI 客户端  │──┘    ◄── SSE 流式响应                │  (API 服务器)    │
└──────────────────┘                                        └─────────────────┘
```

用户操作步骤：
1. 在 `~/.hermes/.env` 中设置 `API_SERVER_ENABLED=true`
2. 运行 `hermes gateway`（API 服务器与 Telegram/Discord 等一起启动）
3. 将 Open WebUI（或任何前端）指向 `http://localhost:8642/v1`
4. 通过任何 OpenAI 兼容 UI 与 hermes-agent 对话

## 端点

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/v1/chat/completions` | 与 Agent 对话（流式 + 非流式） |
| GET | `/v1/models` | 列出可用"模型"（返回 hermes-agent 作为模型） |
| GET | `/health` | 健康检查 |

## 架构

### 方案 A：Gateway 平台适配器（推荐）

创建 `gateway/platforms/api_server.py` 作为扩展 `BasePlatformAdapter` 的新平台适配器。这是最干净的方案，因为：

- 复用所有 Gateway 基础设施（会话管理、认证、上下文构建）
- 与其他适配器在同一个异步循环中运行
- 免费获得消息处理、中断支持和会话持久化
- 遵循已建立的模式（如 Telegram、Discord 等）
- 使用 `aiohttp.web`（已是依赖项）作为 HTTP 服务器

适配器在 `connect()` 中启动 `aiohttp.web.Application` 服务器，将传入的 HTTP 请求路由到标准 `handle_message()` 管道。

### 方案 B：独立组件

在 `gateway/api_server.py` 中创建单独的 HTTP 服务器类，直接创建自己的 AIAgent 实例。更简单但会重复会话/认证逻辑。

**推荐：方案 A**——符合现有架构，更少的维护代码，免费获得所有 Gateway 功能。

## 请求/响应格式

### Chat Completions（非流式）

```
POST /v1/chat/completions
Authorization: Bearer hermes-api-key-here
Content-Type: application/json

{
  "model": "hermes-agent",
  "messages": [
    {"role": "system", "content": "你是一个有用的助手。"},
    {"role": "user", "content": "当前目录有哪些文件？"}
  ],
  "stream": false,
  "temperature": 0.7
}
```

响应：
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "hermes-agent",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "当前目录的文件如下：\n..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 200,
    "total_tokens": 250
  }
}
```

### Chat Completions（流式）

相同请求，`"stream": true`。响应为 SSE：

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"当前"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"目录"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### 模型列表

```
GET /v1/models
Authorization: Bearer hermes-api-key-here
```

响应：
```json
{
  "object": "list",
  "data": [{
    "id": "hermes-agent",
    "object": "model",
    "created": 1710000000,
    "owned_by": "hermes-agent"
  }]
}
```

## 关键设计决策

### 1. 会话管理

OpenAI API 是无状态的——每个请求包含完整对话。但 hermes-agent 会话有持久状态（记忆、技能、工具上下文）。

**方案：混合模式**
- 默认：无状态。每个请求独立。`messages` 数组就是对话。请求间无会话持久化。
- 通过 `X-Session-ID` header 可选启用持久会话。提供后，服务器在请求间维护会话状态（对话历史、记忆上下文、工具状态）。这使得更丰富的 Agent 行为成为可能。
- 会话 ID 还支持中断——在运行中的会话收到相同 ID 的后续请求会触发中断。

### 2. 流式

Agent 的 `run_conversation()` 是同步的，返回完整响应。要实现实时 SSE 流式，需要在生成时发出块。

**Phase 1（MVP）：** 在线程中运行 Agent，将完整响应作为单个 SSE 块 + `[DONE]` 返回。这对所有前端都有效——它们只看到一个快速的单块响应。不是真正的流式但功能可用。

**Phase 2：** 为 AIAgent 添加响应回调，在 LLM 生成文本块时发出。API 服务器通过队列捕获这些块并作为 SSE 事件流式传输。这实现了真正的逐 token 流式。

**Phase 3：** 也流式传输工具执行进度——在 Agent 工作时发出 tool_call/tool_result 事件，让前端看到 Agent 在做什么。

### 3. 工具透明度

两种模式：
- **不透明（默认）：** 前端只看到最终响应。工具调用在服务器端发生，不可见。最适合通用 UI。
- **透明（通过 header 可选启用）：** 工具调用以 OpenAI 格式的 tool_call/tool_result 消息在流中发出。适用于 Agent 感知的前端。

### 4. 认证

- 通过 `Authorization: Bearer <key>` header 的 Bearer token
- Token 通过 `API_SERVER_KEY` env var 配置
- 可选：允许未认证的仅本地访问（127.0.0.1 绑定）
- 遵循与其他平台适配器相同的模式

### 5. 模型映射

前端发送 `"model": "hermes-agent"`（或任意值）。实际使用的 LLM 模型在 config.yaml 中服务器端配置。API 服务器将任何请求的模型名映射到配置的 hermes-agent 模型。

可选允许模型透传：如果前端发送 `"model": "anthropic/claude-sonnet-4"`，Agent 使用该模型。通过配置标志控制。

## 配置

```yaml
# config.yaml 中
api_server:
  enabled: true
  port: 8642
  host: "127.0.0.1"        # 默认仅 localhost
  key: "your-secret-key"   # 或通过 API_SERVER_KEY env var
  allow_model_override: false  # 允许客户端选择模型
  max_concurrent: 5         # 最大并发请求数
```

环境变量：
```bash
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_HOST=127.0.0.1
API_SERVER_KEY=your-secret-key
```

## 实施计划

### Phase 1：MVP（非流式）

1. `gateway/platforms/api_server.py`——新适配器
   - aiohttp.web 服务器，端点：
     - `POST /v1/chat/completions`——Chat Completions API（通用兼容）
     - `POST /v1/responses`——Responses API（服务器端状态，工具保留）
     - `GET /v1/models`——列出可用模型
     - `GET /health`——健康检查
   - Bearer token 认证中间件
   - 非流式响应（运行 Agent，返回完整结果）
   - Chat Completions：无状态，messages 数组即对话
   - Responses API：通过 previous_response_id 的服务器端对话存储
     - 存储完整内部对话（包括工具调用），按 response ID 键控
     - 后续请求从存储链重建完整上下文
   - 前端系统提示词叠加在 hermes-agent 核心提示词之上

2. `gateway/config.py`——添加 `Platform.API_SERVER` 枚举 + 配置

3. `gateway/run.py`——在 `_create_adapter()` 中注册适配器

4. `tests/gateway/test_api_server.py` 中的测试

### Phase 2：SSE 流式

1. 为两个端点添加响应流式
   - Chat Completions：`choices[0].delta.content` SSE 格式
   - Responses API：语义事件（response.output_text.delta 等）
   - 在线程中运行 Agent，通过回调队列收集输出
   - 处理客户端断开连接（取消 Agent）

2. 为 `AIAgent.run_conversation()` 添加 `stream_callback` 参数

### Phase 3：增强功能

1. 工具调用透明模式（可选启用）
2. 模型透传/覆盖
3. 并发请求限制
4. 用量跟踪/速率限制
5. 浏览器前端的 CORS headers
6. GET /v1/responses/{id}——检索存储的响应
7. DELETE /v1/responses/{id}——删除存储的响应

## 修改文件

| 文件 | 更改 |
|------|------|
| `gateway/platforms/api_server.py` | 新建——主适配器（~300 行） |
| `gateway/config.py` | 添加 Platform.API_SERVER + 配置（~20 行） |
| `gateway/run.py` | 在 _create_adapter() 中注册适配器（~10 行） |
| `tests/gateway/test_api_server.py` | 新建——测试（~200 行） |
| `cli-config.yaml.example` | 添加 api_server 部分 |

## 兼容性矩阵

实施后，hermes-agent 可作为以下前端的即插即用后端：

| 前端 | Stars | 连接方式 |
|------|-------|---------|
| Open WebUI | 126k | 设置 → 连接 → 添加 OpenAI API，URL：`http://localhost:8642/v1` |
| NextChat | 87k | BASE_URL env var |
| LobeChat | 73k | 自定义提供商端点 |
| AnythingLLM | 56k | LLM Provider → Generic OpenAI |
| ChatBox | 39k | API Host 设置 |
| LibreChat | 34k | librechat.yaml 自定义端点 |
| Jan | 26k | 远程模型配置 |
| HF Chat-UI | 8k | OPENAI_BASE_URL env var |
| big-AGI | 7k | 自定义端点 |
