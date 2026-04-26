# 浏览器 CDP 监督器 — 设计

**状态：** 已发布（PR 14540）
**最后更新：** 2026-04-23
**作者：** @teknium1

## 问题

原生 JS 对话框（`alert`/`confirm`/`prompt`/`beforeunload`）和 iframe 是我们浏览器工具的两个最大缺口：

1. **对话框阻塞 JS 线程。** 页面上的任何操作都会停滞，直到对话框被处理。在这项工作之前，代理无法知道对话框是否打开 — 后续的工具调用会挂起或抛出不透明的错误。
2. **iframe 不可见。** 代理可以在 DOM 快照中看到 iframe 节点，但无法在其中点击、输入或 eval — 特别是跨源（OOPIF）iframe，它们位于独立的 Chromium 进程中。

PR #12550 提出了一个无状态的 `browser_dialog` 包装器。这不能解决检测问题 — 它是一个更清晰的 CDP 调用，用于代理已经通过症状知道对话框已打开的情况。已关闭并被取代。

## 后端能力矩阵（2026-04-23 实时验证）

使用一次性探测脚本针对一个 data-URL 页面测试，该页面在主框架和同源 srcdoc iframe 中触发 alert，以及一个跨源 `https://example.com` iframe：

| 后端 | 对话框检测 | 对话框响应 | 框架树 | OOPIF `Runtime.evaluate` 通过 `browser_cdp(frame_id=...)` |
|---|---|---|---|---|
| 本地 Chrome（`--remote-debugging-port`）/ `/browser connect` | ✓ | ✓ 完整工作流 | ✓ | ✓ |
| Browserbase | ✓（通过桥接） | ✓ 完整工作流（通过桥接） | ✓ | ✓（在真实跨源 iframe 上验证了 `document.title = "Example Domain"`） |
| Camofox | ✗ 无 CDP（仅 REST） | ✗ | 通过 DOM 快照部分支持 | ✗ |

**Browserbase 响应工作原理。** Browserbase 的 CDP 代理内部使用 Playwright，并在约 10ms 内自动关闭原生对话框，因此 `Page.handleJavaScriptDialog` 无法跟上。为了解决这个问题，监督器通过 `Page.addScriptToEvaluateOnNewDocument` 注入桥接脚本，将 `window.alert`/`confirm`/`prompt` 覆盖为到魔术主机（`hermes-dialog-bridge.invalid`）的同步 XHR。`Fetch.enable` 在这些 XHR 接触网络之前拦截它们 — 对话框变为监督器捕获的 `Fetch.requestPaused` 事件，`respond_to_dialog` 通过 `Fetch.fulfillRequest` 用注入脚本解码的 JSON 主体来满足。

最终结果：从页面的角度来看，`prompt()` 仍然返回代理提供的字符串。从代理的角度来看，无论哪种方式都是相同的 `browser_dialog(action=...)` API。针对真实 Browserbase 会话进行了端到端测试 — 4/4（alert/prompt/confirm-accept/confirm-dismiss）全部通过，包括值往返回到页面 JS。

Camofox 在此 PR 中保持不支持；计划在 `jo-inc/camofox-browser` 提交后续上游 issue，请求对话框轮询端点。

## 架构

### CDPSupervisor

每个 Hermes `task_id` 在后台守护线程中运行一个 `asyncio.Task`。持有到后端 CDP 端点的持久 WebSocket。维护：

- **对话框队列** — `List[PendingDialog]`，包含 `{id, type, message, default_prompt, session_id, opened_at}`
- **框架树** — `Dict[frame_id, FrameInfo]`，包含父子关系、URL、origin、是否为跨源子会话
- **会话映射** — `Dict[session_id, SessionInfo]`，使交互工具可以路由到正确的附加会话进行 OOPIF 操作
- **最近控制台错误** — 最近 50 条的环形缓冲区（用于 PR 2 诊断）

附加时订阅：
- `Page.enable` — `javascriptDialogOpening`、`frameAttached`、`frameNavigated`、`frameDetached`
- `Runtime.enable` — `executionContextCreated`、`consoleAPICalled`、`exceptionThrown`
- `Target.setAutoAttach {autoAttach: true, flatten: true}` — 显示子 OOPIF 目标；监督器在每个上启用 `Page`+`Runtime`

通过快照锁实现线程安全的状态访问；工具处理器（同步）读取冻结的快照而无需等待。

### 生命周期

- **启动：** `SupervisorRegistry.get_or_start(task_id, cdp_url)` — 由 `browser_navigate`、Browserbase 会话创建、`/browser connect` 调用。幂等。
- **停止：** 会话拆除或 `/browser disconnect`。取消 asyncio 任务，关闭 WebSocket，丢弃状态。
- **重绑定：** 如果 CDP URL 改变（用户重新连接到新的 Chrome），停止旧的监督器并重新开始 — 永远不要跨端点复用状态。

### 对话框策略

通过 `config.yaml` 中的 `browser.dialog_policy` 配置：

- **`must_respond`**（默认）— 捕获，在 `browser_snapshot` 中显示，等待显式的 `browser_dialog(action=...)` 调用。300 秒安全超时后无响应，自动关闭并记录日志。防止有 bug 的代理永远停滞。
- `auto_dismiss` — 记录并立即关闭；代理稍后通过 `browser_snapshot` 中的 `browser_state` 看到它。
- `auto_accept` — 记录并接受（适用于用户想要干净导航离开的 `beforeunload`）。

策略是每任务的；v1 中没有每对话框的覆盖。

## 代理表面（PR 1）

### 一个新工具

```
browser_dialog(action, prompt_text=None, dialog_id=None)
```

- `action="accept"` / `"dismiss"` → 响应指定的或唯一的待处理对话框（必需）
- `prompt_text=...` → 提供给 `prompt()` 对话框的文本
- `dialog_id=...` → 当多个对话框排队时消歧（罕见）

工具仅用于响应。代理在调用前从 `browser_snapshot` 输出中读取待处理对话框。

### `browser_snapshot` 扩展

当监督器附加时，向现有快照输出添加三个可选字段：

```json
{
  "pending_dialogs": [
    {"id": "d-1", "type": "alert", "message": "Hello", "opened_at": 1650000000.0}
  ],
  "recent_dialogs": [
    {"id": "d-1", "type": "alert", "message": "...", "opened_at": 1650000000.0,
     "closed_at": 1650000000.1, "closed_by": "remote"}
  ],
  "frame_tree": {
    "top": {"frame_id": "FRAME_A", "url": "https://example.com/", "origin": "https://example.com"},
    "children": [
      {"frame_id": "FRAME_B", "url": "about:srcdoc", "is_oopif": false},
      {"frame_id": "FRAME_C", "url": "https://ads.example.net/", "is_oopif": true, "session_id": "SID_C"}
    ],
    "truncated": false
  }
}
```

- **`pending_dialogs`**：当前阻塞页面 JS 线程的对话框。代理必须调用 `browser_dialog(action=...)` 来响应。在 Browserbase 上为空，因为它们的 CDP 代理在约 10ms 内自动关闭。

- **`recent_dialogs`**：最多 20 个最近关闭的对话框的环形缓冲区，带有 `closed_by` 标签 — `"agent"`（我们响应了）、`"auto_policy"`（本地 auto_dismiss/auto_accept）、`"watchdog"`（must_respond 超时命中）或 `"remote"`（浏览器/后端关闭了它，例如 Browserbase）。这是 Browserbase 上的代理仍然能看到发生了什么的方式。

- **`frame_tree`**：框架结构，包括跨源（OOPIF）子框架。限制为 30 个条目 + OOPIF 深度 2，以在广告密集页面上限制快照大小。`truncated: true` 在达到限制时显示；需要完整树的代理可以使用 `browser_cdp` 配合 `Page.getFrameTree`。

这些都没有新的工具 schema 表面 — 代理读取它已经请求的快照。

### 可用性门控

两个表面都通过 `_browser_cdp_check` 门控（监督器只能在 CDP 端点可达时运行）。在 Camofox / 无后端会话上，对话框工具被隐藏，快照省略新字段 — 无 schema 膨胀。

## 跨源 iframe 交互

扩展对话框检测工作，`browser_cdp(frame_id=...)` 使用 OOPIF 的子 `sessionId` 通过监督器已连接的 WebSocket 路由 CDP 调用（特别是 `Runtime.evaluate`）。代理从 `browser_snapshot.frame_tree.children[]` 中选取 `is_oopif=true` 的 frame_id 并传递给 `browser_cdp`。对于同源 iframe（无专用 CDP 会话），代理改为从顶层 `Runtime.evaluate` 使用 `contentWindow`/`contentDocument` — 当 `frame_id` 属于非 OOPIF 时，监督器显示指向该回退的错误。

在 Browserbase 上，这是 iframe 交互的唯一可靠路径 — 无状态 CDP 连接（每次 `browser_cdp` 调用打开）会遇到签名 URL 过期，而监督器的长连接保持有效会话。

## Camofox（后续）

计划在 `jo-inc/camofox-browser` 提交 issue，添加：
- 每会话的 Playwright `page.on('dialog', handler)`
- `GET /tabs/:tabId/dialogs` 轮询端点
- `POST /tabs/:tabId/dialogs/:id` 用于接受/关闭
- 框架树自省端点

## 涉及的文件（PR 1）

### 新增

- `tools/browser_supervisor.py` — `CDPSupervisor`、`SupervisorRegistry`、`PendingDialog`、`FrameInfo`
- `tools/browser_dialog_tool.py` — `browser_dialog` 工具处理器
- `tests/tools/test_browser_supervisor.py` — 模拟 CDP WebSocket 服务器 + 生命周期/状态测试
- `website/docs/developer-guide/browser-supervisor.md` — 本文件

### 修改

- `toolsets.py` — 在 `browser`、`hermes-acp`、`hermes-api-server`、核心工具集中注册 `browser_dialog`（通过 CDP 可达性门控）
- `tools/browser_tool.py`
  - `browser_navigate` 启动钩子：如果 CDP URL 可解析，`SupervisorRegistry.get_or_start(task_id, cdp_url)`
  - `browser_snapshot`（约第 1536 行）：将监督器状态合并到返回负载
  - `/browser connect` 处理器：用新端点重启监督器
  - `_cleanup_browser_session` 中的会话拆除钩子
- `hermes_cli/config.py` — 将 `browser.dialog_policy` 和 `browser.dialog_timeout_s` 添加到 `DEFAULT_CONFIG`
- 文档：`website/docs/user-guide/features/browser.md`、`website/docs/reference/tools-reference.md`、`website/docs/reference/toolsets-reference.md`

## 非目标

- Camofox 的检测/交互（上游缺口；单独跟踪）
- 将对话框/框架事件实时流式传输给用户（需要网关钩子）
- 跨会话持久化对话框历史（仅内存）
- 每 iframe 对话框策略（代理可以通过 `dialog_id` 表达）
- 替换 `browser_cdp` — 它作为长尾（cookie、视口、网络节流）的逃生舱口保留

## 测试

单元测试使用 asyncio 模拟 CDP 服务器，它实现了足够的协议来执行所有状态转换：附加、启用、导航、对话框触发、对话框关闭、框架附加/分离、子目标附加、会话拆除。真实后端 E2E（Browserbase + 本地 Chrome）是手动的；2026-04-23 调查的探测脚本保存在仓库中的 `scripts/browser_supervisor_e2e.py`，任何人都可以在新后端版本上重新验证。
