# Hermes Agent 的流式 LLM 响应支持

## 概述

在所有平台添加 LLM 响应的逐 token 流式传输。启用后，用户可以实时看到响应逐字打出，而不是等待完整生成。流式通过配置可选启用，默认关闭，所有现有的非流式代码路径保持不变。

## 设计原则

1. **功能标志**：config.yaml 中 `streaming.enabled: true`。默认关闭。关闭时所有现有代码路径不变——对当前行为零风险。
2. **基于回调**：注入 AIAgent 的简单 `stream_callback(text_delta: str)` 函数。Agent 不知道也不关心消费者如何处理 token。
3. **优雅降级**：如果提供商不支持流式，或流式因任何原因失败，静默回退到非流式路径。
4. **平台无关核心**：AIAgent 中的流式机制无论消费者是 CLI、Telegram、Discord 还是 API 服务器都工作方式相同。

---

## 架构

```
                              stream_callback(delta)
                                    │
  ┌─────────────┐    ┌─────────────▼──────────────┐
  │  LLM API    │    │      queue.Queue()          │
  │  (stream)   │───►│  线程安全的 Agent 线程与     │
  │             │    │  消费者之间的桥接             │
  └─────────────┘    └─────────────┬──────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
              │    CLI     │ │  Gateway  │ │ API Server│
              │ 打印到     │ │ 编辑消息  │ │ SSE 事件  │
              │ 终端       │ │ Tg/Dc     │ │ 发送给客户端│
              └───────────┘ └───────────┘ └───────────┘
```

Agent 在线程中运行。回调将 token 放入线程安全的队列。每个消费者在自己的上下文（异步任务、主线程等）中读取队列。

---

## 配置

### config.yaml

```yaml
streaming:
  enabled: false          # 主开关。默认关闭。
  # 每平台覆盖（可选）：
  # cli: true             # 仅 CLI 覆盖
  # telegram: true        # 仅 Telegram 覆盖
  # discord: false        # 保持 Discord 非流式
  # api_server: true      # API 服务器覆盖
```

### 环境变量

```
HERMES_STREAMING_ENABLED=true    # 通过 env 的主开关
```

### 标志读取方式

- **CLI**：`load_cli_config()` 读取 `streaming.enabled`，设置 env var。AIAgent 在初始化时检查。
- **Gateway**：`_run_agent()` 读取配置，决定是否将 `stream_callback` 传递给 AIAgent 构造函数。
- **API 服务器**：对于 Chat Completions `stream=true` 请求，无论配置如何始终使用流式（客户端明确请求）。对于非流式请求，使用配置。

### 优先级

1. API 服务器：客户端的 `stream` 字段覆盖一切
2. 每平台配置覆盖（如 `streaming.telegram: true`）
3. 主 `streaming.enabled` 标志
4. 默认：关闭

---

## 实施计划

### Phase 1：AIAgent 核心流式基础设施

**文件：run_agent.py**

#### 1a. 为 __init__ 添加 stream_callback 参数（~5 行）

```python
def __init__(self, ..., stream_callback: callable = None, ...):
    self.stream_callback = stream_callback
```

无其他 init 更改。回调是可选的——为 None 时一切照旧。

#### 1b. 添加 _run_streaming_chat_completion() 方法（~65 行）

Chat Completions API 流式的新方法：

```python
def _run_streaming_chat_completion(self, api_kwargs: dict):
    """流式 chat completion，通过 stream_callback 发出文本 token。
    
    返回与非流式代码路径兼容的假响应对象。
    任何错误时回退到非流式。
    """
    stream_kwargs = dict(api_kwargs)
    stream_kwargs["stream"] = True
    stream_kwargs["stream_options"] = {"include_usage": True}
    
    accumulated_content = []
    accumulated_tool_calls = {}  # index -> {id, name, arguments}
    final_usage = None
    
    try:
        stream = self.client.chat.completions.create(**stream_kwargs)
        
        for chunk in stream:
            if not chunk.choices:
                # 仅 usage 的块（最终）
                if chunk.usage:
                    final_usage = chunk.usage
                continue
            
            delta = chunk.choices[0].delta
            
            # 文本内容——通过回调发出
            if delta.content:
                accumulated_content.append(delta.content)
                if self.stream_callback:
                    try:
                        self.stream_callback(delta.content)
                    except Exception:
                        pass
            
            # 工具调用增量——静默累积
            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    idx = tc_delta.index
                    if idx not in accumulated_tool_calls:
                        accumulated_tool_calls[idx] = {
                            "id": tc_delta.id or "",
                            "name": "", "arguments": ""
                        }
                    if tc_delta.function:
                        if tc_delta.function.name:
                            accumulated_tool_calls[idx]["name"] = tc_delta.function.name
                        if tc_delta.function.arguments:
                            accumulated_tool_calls[idx]["arguments"] += tc_delta.function.arguments
        
        # 构建与现有代码兼容的假响应
        tool_calls = []
        for idx in sorted(accumulated_tool_calls):
            tc = accumulated_tool_calls[idx]
            if tc["name"]:
                tool_calls.append(SimpleNamespace(
                    id=tc["id"], type="function",
                    function=SimpleNamespace(name=tc["name"], arguments=tc["arguments"]),
                ))
        
        return SimpleNamespace(
            choices=[SimpleNamespace(
                message=SimpleNamespace(
                    content="".join(accumulated_content) or "",
                    tool_calls=tool_calls or None,
                    role="assistant",
                ),
                finish_reason="tool_calls" if tool_calls else "stop",
            )],
            usage=final_usage,
            model=self.model,
        )
    
    except Exception as e:
        logger.debug("流式失败，回退到非流式: %s", e)
        return self.client.chat.completions.create(**api_kwargs)
```

#### 1c. 修改 _run_codex_stream() 用于 Responses API（~10 行）

该方法已迭代流。添加回调发出：

```python
def _run_codex_stream(self, api_kwargs: dict):
    with self.client.responses.stream(**api_kwargs) as stream:
        for event in stream:
            # 如果流式回调已设置，发出文本增量
            if self.stream_callback and hasattr(event, 'type'):
                if event.type == 'response.output_text.delta':
                    try:
                        self.stream_callback(event.delta)
                    except Exception:
                        pass
        return stream.get_final_response()
```

#### 1d. 修改 _interruptible_api_call()（~5 行）

添加流式分支：

```python
def _call():
    try:
        if self.api_mode == "codex_responses":
            result["response"] = self._run_codex_stream(api_kwargs)
        elif self.stream_callback is not None:
            result["response"] = self._run_streaming_chat_completion(api_kwargs)
        else:
            result["response"] = self.client.chat.completions.create(**api_kwargs)
    except Exception as e:
        result["error"] = e
```

#### 1e. 向消费者发送流结束信号（~5 行）

API 调用返回后，通知回调流已结束，以便消费者可以完成（移除光标、关闭 SSE 等）：

```python
# 在 run_conversation() 中，_interruptible_api_call 返回后：
if self.stream_callback:
    try:
        self.stream_callback(None)  # None = 流结束信号
    except Exception:
        pass
```

消费者检查：`if delta is None: finalize()`

**Phase 1 测试：**（~150 行）
- 测试带模拟流的 _run_streaming_chat_completion
- 测试错误时回退到非流式
- 测试流式期间的 tool_call 累积
- 测试 stream_callback 接收正确的增量
- 测试流结束时的 None 信号
- 测试回调为 None 时流式禁用

---

### Phase 2：Gateway 消费者（Telegram、Discord 等）

**文件：gateway/run.py**

#### 2a. 读取流式配置（~15 行）

在 `_run_agent()` 中，创建 AIAgent 之前：

```python
# 读取流式配置
_streaming_enabled = False
try:
    # 先检查每平台覆盖
    platform_key = source.platform.value if source.platform else ""
    _stream_cfg = {}  # 从 config.yaml streaming 部分加载
    if _stream_cfg.get(platform_key) is not None:
        _streaming_enabled = bool(_stream_cfg[platform_key])
    else:
        _streaming_enabled = bool(_stream_cfg.get("enabled", False))
except Exception:
    pass
# Env var 覆盖
if os.getenv("HERMES_STREAMING_ENABLED", "").lower() in ("true", "1", "yes"):
    _streaming_enabled = True
```

#### 2b. 设置队列 + 回调（~15 行）

```python
_stream_q = None
_stream_done = None
_stream_msg_id = [None]  # 异步任务的可变引用

if _streaming_enabled:
    import queue as _q
    _stream_q = _q.Queue()
    _stream_done = threading.Event()
    
    def _on_token(delta):
        if delta is None:
            _stream_done.set()
        else:
            _stream_q.put(delta)
```

将 `stream_callback=_on_token` 传递给 AIAgent 构造函数。

#### 2c. Telegram/Discord 流式预览任务（~50 行）

```python
async def stream_preview():
    """通过流式 token 逐步编辑消息。"""
    if not _stream_q:
        return
    adapter = self.adapters.get(source.platform)
    if not adapter:
        return
    
    accumulated = []
    token_count = 0
    last_edit = 0.0
    MIN_TOKENS = 20          # 足够上下文前不显示
    EDIT_INTERVAL = 1.5      # 遵守 Telegram 速率限制
    
    try:
        while not _stream_done.is_set():
            try:
                chunk = _stream_q.get(timeout=0.1)
                accumulated.append(chunk)
                token_count += 1
            except queue.Empty:
                continue
            
            now = time.monotonic()
            if token_count >= MIN_TOKENS and (now - last_edit) >= EDIT_INTERVAL:
                preview = "".join(accumulated) + " ▌"
                if _stream_msg_id[0] is None:
                    r = await adapter.send(
                        chat_id=source.chat_id,
                        content=preview,
                        metadata=_thread_metadata,
                    )
                    if r.success and r.message_id:
                        _stream_msg_id[0] = r.message_id
                else:
                    await adapter.edit_message(
                        chat_id=source.chat_id,
                        message_id=_stream_msg_id[0],
                        content=preview,
                    )
                last_edit = now
        
        # 排空剩余 token
        while not _stream_q.empty():
            accumulated.append(_stream_q.get_nowait())
        
        # 最终编辑——移除光标，显示完整文本
        if _stream_msg_id[0] and accumulated:
            await adapter.edit_message(
                chat_id=source.chat_id,
                message_id=_stream_msg_id[0],
                content="".join(accumulated),
            )
    
    except asyncio.CancelledError:
        # 取消时清理
        if _stream_msg_id[0] and accumulated:
            try:
                await adapter.edit_message(
                    chat_id=source.chat_id,
                    message_id=_stream_msg_id[0],
                    content="".join(accumulated),
                )
            except Exception:
                pass
    except Exception as e:
        logger.debug("stream_preview 错误: %s", e)
```

#### 2d. 如果已流式传输则跳过最终发送（~10 行）

在 `_process_message_background()`（base.py）中，获取响应后，如果流式处于活动状态且 `_stream_msg_id[0]` 已设置，则最终响应已通过逐步编辑送达。跳过正常的 `self.send()` 调用以避免消息重复。

这是最微妙的集成点——我们需要从 Gateway 的 `_run_agent` 回传到 base adapter 的响应发送器，告知响应已送达。选项：

- **选项 A**：在结果字典中返回特殊标记：`result["_streamed_msg_id"] = _stream_msg_id[0]`。Base adapter 检查此标记并跳过 `send()`。
- **选项 B**：用最终响应编辑已发送的消息（可能因 think-block 剥离等与累积 token 略有不同），不发送新消息。
- **选项 C**：流式预览任务处理完整最终响应（包括任何后处理），处理程序返回 None 以跳过正常发送路径。

推荐：**选项 A**——最干净的分离。结果字典已携带元数据；再添加一个字段风险很低。

**平台特定考虑：**

| 平台 | 编辑支持 | 速率限制 | 流式方式 |
|------|---------|---------|---------|
| Telegram | ✅ edit_message_text | ~20 次编辑/分钟 | 每 1.5s 编辑一次 |
| Discord | ✅ message.edit | 5 次编辑/5s 每消息 | 每 1.2s 编辑一次 |
| Slack | ✅ chat.update | Tier 3（~50/分钟） | 每 1.5s 编辑一次 |
| WhatsApp | ❌ 不支持编辑 | N/A | 跳过流式，使用正常路径 |
| HomeAssistant | ❌ 不支持编辑 | N/A | 跳过流式 |
| API Server | ✅ SSE 原生 | 无限制 | 真实 SSE 事件 |

WhatsApp 和 HomeAssistant 自动回退到非流式，因为它们不支持消息编辑。

**Phase 2 测试：**（~100 行）
- 测试 stream_preview 正确发送/编辑
- 测试流式已送达时跳过最终发送
- 测试 WhatsApp/HA 优雅回退
- 测试每平台配置禁用流式
- 测试流式消息中转发的 thread_id 元数据

---

### Phase 3：CLI 流式

**文件：cli.py**

#### 3a. 在 CLI 聊天循环中设置回调（~20 行）

在 `_chat_once()` 或调用 Agent 的位置：

```python
if streaming_enabled:
    _stream_q = queue.Queue()
    _stream_done = threading.Event()
    
    def _cli_stream_callback(delta):
        if delta is None:
            _stream_done.set()
        else:
            _stream_q.put(delta)
    
    agent.stream_callback = _cli_stream_callback
```

#### 3b. Token 显示线程/任务（~30 行）

启动读取队列并打印 token 的线程：

```python
def _stream_display():
    """token 到达时打印到终端。"""
    first_token = True
    while not _stream_done.is_set():
        try:
            delta = _stream_q.get(timeout=0.1)
        except queue.Empty:
            continue
        if first_token:
            # 打印响应框顶部边框
            _cprint(f"\n{top}")
            first_token = False
        sys.stdout.write(delta)
        sys.stdout.flush()
    # 排空剩余
    while not _stream_q.empty():
        sys.stdout.write(_stream_q.get_nowait())
    sys.stdout.flush()
    # 打印底部边框
    _cprint(f"\n\n{bot}")
```

**集成挑战：prompt_toolkit**

CLI 使用 prompt_toolkit 控制终端。在 prompt_toolkit 活跃时直接写入 stdout 可能导致显示损坏。现有的 KawaiiSpinner 已通过使用 prompt_toolkit 的 `patch_stdout` 上下文解决了这个问题。流式显示需要做同样的事。

替代方案：对每个 token 块使用 `_cprint()`（通过 prompt_toolkit 的渲染器路由）。但这对单个 token 可能很慢。

推荐方案：以小批次（如每 50ms）累积 token，然后 `_cprint()` 该批次。这平衡了显示响应性和 prompt_toolkit 兼容性。

**Phase 3 测试：**（~50 行）
- 测试 CLI 流式回调设置
- 测试带流式的响应框边框
- 测试流式禁用时的回退

---

### Phase 4：API 服务器真实流式

**文件：gateway/platforms/api_server.py**

用真实的逐 token SSE 替换伪流式 `_write_sse_chat_completion()`。

#### 4a. 为 stream=true 请求接入流式回调（~20 行）

```python
if stream:
    _stream_q = queue.Queue()
    
    def _api_stream_callback(delta):
        _stream_q.put(delta)  # None = 完成
    
    # 将回调传递给 _run_agent
    result, usage = await self._run_agent(
        ..., stream_callback=_api_stream_callback,
    )
```

#### 4b. 真实 SSE 写入器（~40 行）

```python
async def _write_real_sse(self, request, completion_id, model, stream_q):
    response = web.StreamResponse(
        headers={"Content-Type": "text/event-stream", "Cache-Control": "no-cache"},
    )
    await response.prepare(request)
    
    # Role 块
    await response.write(...)
    
    # token 到达时流式传输内容块
    while True:
        try:
            delta = await asyncio.get_event_loop().run_in_executor(
                None, lambda: stream_q.get(timeout=0.1)
            )
        except queue.Empty:
            continue
        
        if delta is None:  # 流结束
            break
        
        chunk = {"id": completion_id, "object": "chat.completion.chunk", ...
                 "choices": [{"delta": {"content": delta}, ...}]}
        await response.write(f"data: {json.dumps(chunk)}\n\n".encode())
    
    # 完成 + [DONE]
    await response.write(...)
    await response.write(b"data: [DONE]\n\n")
    return response
```

**挑战：并发执行**

Agent 在线程执行器中运行。SSE 写入在异步事件循环中。队列桥接它们。但 `_run_agent()` 目前在返回前等待完整结果。对于真实流式，我们需要在后台启动 Agent 并在运行时流式传输 token：

```python
# 在后台启动 Agent
agent_task = asyncio.create_task(self._run_agent_async(...))

# Agent 运行时流式传输 token
await self._write_real_sse(request, ..., stream_q)

# Agent 此时已完成（stream_q 收到 None）
result, usage = await agent_task
```

这需要将 `_run_agent` 拆分为不阻塞等待结果的异步版本，或在单独的任务中运行。

**Responses API SSE 格式：**

对于带 `stream=true` 的 `/v1/responses`，SSE 事件不同：

```
event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"你好"}

event: response.completed  
data: {"type":"response.completed","response":{...}}
```

这需要一个单独的 SSE 写入器来发出 Responses API 格式的事件。

**Phase 4 测试：**（~80 行）
- 测试带模拟 Agent 的真实 SSE 流式
- 测试 SSE 事件格式（Chat Completions vs Responses）
- 测试流式期间的客户端断开
- 测试回调不可用时回退到伪流式

---

## 集成问题和边界情况

### 1. 流式期间的工具调用

当模型返回工具调用而非文本时，不会发出文本 token。stream_callback 根本不会被调用。工具执行后，下一个 API 调用可能产生最终文本响应——流式再次开始。

流式预览任务需要处理：如果工具调用回合期间没有 token 到达，不发送/编辑任何消息。工具进度消息继续照常工作。

### 2. 重复消息

最大风险：Agent 正常发送最终响应（通过现有发送路径）且流式预览已显示。用户看到响应两次。

预防：当流式处于活动状态且 token 已送达时，必须抑制最终响应发送。`result["_streamed_msg_id"]` 标记告诉 base adapter 跳过其正常发送。

### 3. 响应后处理

最终响应可能与累积的流式 token 不同：
- Think block 剥离（`<think>...</think>` 被移除）
- 尾部空白清理
- 工具结果媒体标签追加

流式预览显示原始 token。最终编辑应使用后处理版本。这意味着最终编辑（移除光标）应使用后处理的 `final_response`，而非仅累积的流式文本。

### 4. 流式期间的上下文压缩

如果 Agent 在对话中途触发上下文压缩，压缩前的流式 token 来自与压缩后不同的上下文。这在实践中不是问题——压缩发生在 API 调用之间，而非流式期间。

### 5. 流式期间的中断

用户在流式期间发送新消息 → 中断。流被终止（HTTP 连接关闭），累积 token 按原样显示（无光标），中断消息正常处理。这已由 `_interruptible_api_call` 关闭客户端来处理。

### 6. 多模型/回退

如果主模型失败且 Agent 回退到不同模型，流式状态重置。回退调用可能支持也可能不支持流式。`_run_streaming_chat_completion` 中的优雅回退处理了这一点。

### 7. 编辑速率限制

Telegram：~20 次编辑/分钟（安全起见约每 3 秒 1 次）
Discord：每消息每 5 秒 5 次编辑
Slack：~50 次 API 调用/分钟

1.5s 的编辑间隔对所有平台都足够保守。如果我们收到 429 速率限制错误，只需跳过该编辑周期并下次再试。

---

## 修改文件汇总

| 文件 | 阶段 | 更改 |
|------|------|------|
| `run_agent.py` | 1 | +stream_callback 参数、+_run_streaming_chat_completion()、修改 _run_codex_stream()、修改 _interruptible_api_call() |
| `gateway/run.py` | 2 | +流式配置读取器、+队列/回调设置、+stream_preview 任务、+跳过最终发送逻辑 |
| `gateway/platforms/base.py` | 2 | +响应处理器中检查 _streamed_msg_id |
| `cli.py` | 3 | +流式设置、+token 显示、+响应框集成 |
| `gateway/platforms/api_server.py` | 4 | +真实 SSE 写入器、+流式回调接入 |
| `hermes_cli/config.py` | 1 | +流式配置默认值 |
| `cli-config.yaml.example` | 1 | +streaming 部分 |
| `tests/test_streaming.py` | 1-4 | 新建——~380 行测试 |

**总新代码**：所有阶段约 500 行
**总测试代码**：约 380 行

---

## 发布计划

1. **Phase 1**（核心）：合并到 main。流式默认禁用。对现有行为零影响。可通过 env var 测试。

2. **Phase 2**（Gateway）：合并到 main。在 Telegram 上手动测试。按平台启用：config 中 `streaming.telegram: true`。

3. **Phase 3**（CLI）：合并到 main。在终端中测试。启用：`streaming.cli: true` 或 `streaming.enabled: true`。

4. **Phase 4**（API 服务器）：合并到 main。用 Open WebUI 测试。客户端发送 `stream: true` 时自动启用。

每个阶段可独立合并和测试。流式在整个过程中默认关闭。所有阶段稳定后，考虑将默认值更改为启用。

---

## 配置参考（最终状态）

```yaml
# config.yaml
streaming:
  enabled: false          # 主开关（默认：关闭）
  cli: true               # 每平台覆盖
  telegram: true
  discord: true
  slack: true
  api_server: true        # API 服务器在客户端请求时始终流式
  edit_interval: 1.5      # 消息编辑间隔秒数（默认：1.5）
  min_tokens: 20          # 首次显示前的 token 数（默认：20）
```

```bash
# 环境变量覆盖
HERMES_STREAMING_ENABLED=true
```
