---
sidebar_position: 4
title: "MCP（模型上下文协议）"
description: "通过 MCP 将 Hermes Agent 连接到外部工具服务器——并精确控制 Hermes 加载哪些 MCP 工具"
---

# MCP（模型上下文协议）

MCP 让 Hermes Agent 连接到外部工具服务器，以便代理可以使用 Hermes 本身之外的工具——GitHub、数据库、文件系统、浏览器栈、内部 API 等。

如果你曾想让 Hermes 使用已存在于其他地方的工具，MCP 通常是最干净的方式。

## MCP 给你什么

- 无需先编写原生 Hermes 工具即可访问外部工具生态系统
- 同一配置中的本地 stdio 服务器和远程 HTTP MCP 服务器
- 启动时自动工具发现和注册
- 服务器支持时的 MCP 资源和提示的实用包装器
- 每服务器过滤，以便你可以仅暴露你实际想让 Hermes 看到的 MCP 工具

## 快速开始

1. 安装 MCP 支持（如果使用标准安装脚本已包含）：

```bash
cd ~/.hermes/hermes-agent
uv pip install -e ".[mcp]"
```

2. 在 `~/.hermes/config.yaml` 中添加 MCP 服务器：

```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
```

3. 启动 Hermes：

```bash
hermes chat
```

4. 让 Hermes 使用 MCP 支持的能力。

例如：

```text
List the files in /home/user/projects and summarize the repo structure.
```

Hermes 将发现 MCP 服务器的工具并像使用其他工具一样使用它们。

## 两种 MCP 服务器

### Stdio 服务器

Stdio 服务器作为本地子进程运行，通过 stdin/stdout 通信。

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
```

在以下情况使用 stdio 服务器：
- 服务器安装在本地
- 你想要低延迟访问本地资源
- 你遵循的 MCP 服务器文档显示 `command`、`args` 和 `env`

### HTTP 服务器

HTTP MCP 服务器是 Hermes 直接连接的远程端点。

```yaml
mcp_servers:
  remote_api:
    url: "https://mcp.example.com/mcp"
    headers:
      Authorization: "Bearer ***"
```

在以下情况使用 HTTP 服务器：
- MCP 服务器托管在其他地方
- 你的组织暴露内部 MCP 端点
- 你不希望 Hermes 为该集成生成本地子进程

## 基本配置参考

Hermes 从 `~/.hermes/config.yaml` 的 `mcp_servers` 下读取 MCP 配置。

### 通用键

| 键 | 类型 | 含义 |
|----|------|------|
| `command` | 字符串 | stdio MCP 服务器的可执行文件 |
| `args` | 列表 | stdio 服务器的参数 |
| `env` | 映射 | 传递给 stdio 服务器的环境变量 |
| `url` | 字符串 | HTTP MCP 端点 |
| `headers` | 映射 | 远程服务器的 HTTP 头 |
| `timeout` | 数字 | 工具调用超时 |
| `connect_timeout` | 数字 | 初始连接超时 |
| `enabled` | 布尔 | 如果为 `false`，Hermes 完全跳过该服务器 |
| `tools` | 映射 | 每服务器工具过滤和实用策略 |

### 最小 stdio 示例

```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
```

### 最小 HTTP 示例

```yaml
mcp_servers:
  company_api:
    url: "https://mcp.internal.example.com"
    headers:
      Authorization: "Bearer ***"
```

## Hermes 如何注册 MCP 工具

Hermes 为 MCP 工具添加前缀以避免与内置名称冲突：

```text
mcp_<server_name>_<tool_name>
```

示例：

| 服务器 | MCP 工具 | 注册名称 |
|--------|---------|---------|
| `filesystem` | `read_file` | `mcp_filesystem_read_file` |
| `github` | `create-issue` | `mcp_github_create_issue` |
| `my-api` | `query.data` | `mcp_my_api_query_data` |

实际上，你通常不需要手动调用带前缀的名称——Hermes 看到工具并在正常推理中选择它。

## MCP 实用工具

支持时，Hermes 还围绕 MCP 资源和提示注册实用工具：

- `list_resources`
- `read_resource`
- `list_prompts`
- `get_prompt`

这些按服务器注册，使用相同的前缀模式，例如：

- `mcp_github_list_resources`
- `mcp_github_get_prompt`

### 重要

这些实用工具现在是能力感知的：
- 仅当 MCP 会话实际支持资源操作时，Hermes 才注册资源实用工具
- 仅当 MCP 会话实际支持提示操作时，Hermes 才注册提示实用工具

因此暴露可调用工具但没有资源/提示的服务器不会获得那些额外包装器。

## 每服务器过滤

你可以控制每个 MCP 服务器向 Hermes 贡献哪些工具，实现工具命名空间的精细管理。

### 完全禁用服务器

```yaml
mcp_servers:
  legacy:
    url: "https://mcp.legacy.internal"
    enabled: false
```

如果 `enabled: false`，Hermes 完全跳过该服务器，甚至不尝试连接。

### 白名单服务器工具

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [create_issue, list_issues]
```

仅注册那些 MCP 服务器工具。

### 黑名单服务器工具

```yaml
mcp_servers:
  stripe:
    url: "https://mcp.stripe.com"
    tools:
      exclude: [delete_customer]
```

注册所有服务器工具，除被排除的外。

### 优先规则

如果两者都存在：

```yaml
tools:
  include: [create_issue]
  exclude: [create_issue, delete_issue]
```

`include` 获胜。

### 也过滤实用工具

你也可以单独禁用 Hermes 添加的实用包装器：

```yaml
mcp_servers:
  docs:
    url: "https://mcp.docs.example.com"
    tools:
      prompts: false
      resources: false
```

这意味着：
- `tools.resources: false` 禁用 `list_resources` 和 `read_resource`
- `tools.prompts: false` 禁用 `list_prompts` 和 `get_prompt`

### 完整示例

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [create_issue, list_issues, search_code]
      prompts: false

  stripe:
    url: "https://mcp.stripe.com"
    headers:
      Authorization: "Bearer ***"
    tools:
      exclude: [delete_customer]
      resources: false

  legacy:
    url: "https://mcp.legacy.internal"
    enabled: false
```

## 如果所有工具都被过滤掉会怎样？

如果你的配置过滤掉所有可调用工具并禁用或省略所有支持的实用工具，Hermes 不会为该服务器创建空的运行时 MCP 工具集。

这保持工具列表干净。

## 运行时行为

### 发现时间

Hermes 在启动时发现 MCP 服务器并将其工具注册到正常工具注册表中。

### 动态工具发现

MCP 服务器可以通过发送 `notifications/tools/list_changed` 通知在运行时通知 Hermes 其可用工具何时变化。当 Hermes 收到此通知时，它自动重新获取服务器的工具列表并更新注册表——无需手动 `/reload-mcp`。

这对于能力动态变化的 MCP 服务器很有用（例如加载新数据库模式时添加工具，或服务离线时移除工具）。

刷新受锁保护，因此同一服务器的快速连续通知不会导致重叠刷新。提示和资源更改通知（`prompts/list_changed`、`resources/list_changed`）被接收但尚未处理。

### 重新加载

如果你更改了 MCP 配置，使用：

```text
/reload-mcp
```

这从配置重新加载 MCP 服务器并刷新可用工具列表。对于服务器自身推送的运行时工具更改，请参见上面的[动态工具发现](#动态工具发现)。

### 工具集

每个配置的 MCP 服务器在贡献至少一个注册工具时也会创建运行时工具集：

```text
mcp-<server>
```

这使 MCP 服务器在工具集层面更易于理解。

## 安全模型

### Stdio 环境过滤

对于 stdio 服务器，Hermes 不会盲目传递你的完整 shell 环境。

仅传递显式配置的 `env` 加安全基线。这减少意外密钥泄露。

### 配置级暴露控制

新的过滤支持也是安全控制：
- 禁用你不希望模型看到的危险工具
- 对敏感服务器仅暴露最小白名单
- 当你不希望该表面暴露时禁用资源/提示包装器

## 示例用例

### GitHub 服务器带最小 issue 管理表面

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [list_issues, create_issue, update_issue]
      prompts: false
      resources: false
```

使用方式：

```text
Show me open issues labeled bug, then draft a new issue for the flaky MCP reconnection behavior.
```

### Stripe 服务器移除危险操作

```yaml
mcp_servers:
  stripe:
    url: "https://mcp.stripe.com"
    headers:
      Authorization: "Bearer ***"
    tools:
      exclude: [delete_customer, refund_payment]
```

使用方式：

```text
Look up the last 10 failed payments and summarize common failure reasons.
```

### 单项目根目录的文件系统服务器

```yaml
mcp_servers:
  project_fs:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/my-project"]
```

使用方式：

```text
Inspect the project root and explain the directory layout.
```

## 故障排除

### MCP 服务器未连接

检查：

```bash
# 验证 MCP 依赖已安装（标准安装已包含）
cd ~/.hermes/hermes-agent && uv pip install -e ".[mcp]"

node --version
npx --version
```

然后验证你的配置并重启 Hermes。

### 工具未出现

可能原因：
- 服务器连接失败
- 发现失败
- 你的过滤配置排除了工具
- 该服务器上不存在实用能力
- 服务器被 `enabled: false` 禁用

如果你有意过滤，这是预期的。

### 为什么资源或提示实用工具未出现？

因为 Hermes 现在仅当两者都为真时才注册那些包装器：
1. 你的配置允许它们
2. 服务器会话实际支持该能力

这是有意的，保持工具列表诚实。

## MCP 采样支持

MCP 服务器可以通过 `sampling/createMessage` 协议请求 Hermes 的 LLM 推理。这允许 MCP 服务器让 Hermes 代其生成文本——适用于需要 LLM 能力但没有自己模型访问的服务器。

采样对所有 MCP 服务器**默认启用**（当 MCP SDK 支持时）。在 `sampling` 键下按服务器配置：

```yaml
mcp_servers:
  my_server:
    command: "my-mcp-server"
    sampling:
      enabled: true            # 启用采样（默认：true）
      model: "openai/gpt-4o"  # 覆盖采样请求的模型（可选）
      max_tokens_cap: 4096     # 每次采样响应的最大令牌数（默认：4096）
      timeout: 30              # 每次请求的超时秒数（默认：30）
      max_rpm: 10              # 速率限制：每分钟最大请求数（默认：10）
      max_tool_rounds: 5       # 采样循环中的最大工具使用轮数（默认：5）
      allowed_models: []       # 服务器可请求的模型名称白名单（空 = 任何）
      log_level: "info"        # 审计日志级别：debug、info 或 warning（默认：info）
```

采样处理器包括滑动窗口速率限制器、每请求超时和工具循环深度限制以防止失控使用。指标（请求数、错误、使用令牌）按服务器实例跟踪。

要禁用特定服务器的采样：

```yaml
mcp_servers:
  untrusted_server:
    url: "https://mcp.example.com"
    sampling:
      enabled: false
```

## 将 Hermes 作为 MCP 服务器运行

除了连接**到** MCP 服务器外，Hermes 也可以**成为** MCP 服务器。这允许其他 MCP 兼容代理（Claude Code、Cursor、Codex 或任何 MCP 客户端）使用 Hermes 的消息功能——列出对话、读取消息历史和跨所有连接平台发送消息。

### 何时使用

- 你想让 Claude Code、Cursor 或其他编码代理通过 Hermes 发送和读取 Telegram/Discord/Slack 消息
- 你想要一个同时桥接到所有 Hermes 连接消息平台的单个 MCP 服务器
- 你已有运行中的带连接平台的 Hermes 网关

### 快速开始

```bash
hermes mcp serve
```

这启动 stdio MCP 服务器。MCP 客户端（不是你）管理进程生命周期。

### MCP 客户端配置

将 Hermes 添加到你的 MCP 客户端配置。例如，在 Claude Code 的 `~/.claude/claude_desktop_config.json` 中：

```json
{
  "mcpServers": {
    "hermes": {
      "command": "hermes",
      "args": ["mcp", "serve"]
    }
  }
}
```

或如果你在特定位置安装了 Hermes：

```json
{
  "mcpServers": {
    "hermes": {
      "command": "/home/user/.hermes/hermes-agent/venv/bin/hermes",
      "args": ["mcp", "serve"]
    }
  }
}
```

### 可用工具

MCP 服务器暴露 10 个工具，匹配 OpenClaw 的频道桥接表面加 Hermes 特定的频道浏览器：

| 工具 | 描述 |
|------|------|
| `conversations_list` | 列出活跃消息对话。按平台过滤或按名称搜索。 |
| `conversation_get` | 按会话键获取一个对话的详细信息。 |
| `messages_read` | 读取对话的最近消息历史。 |
| `attachments_fetch` | 从特定消息提取非文本附件（图像、媒体）。 |
| `events_poll` | 轮询自光标位置以来的新对话事件。 |
| `events_wait` | 长轮询/阻塞直到下一个事件到达（近实时）。 |
| `messages_send` | 通过平台发送消息（例如 `telegram:123456`、`discord:#general`）。 |
| `channels_list` | 列出所有平台的可用消息目标。 |
| `permissions_list_open` | 列出此桥接会话期间观察到的待审批请求。 |
| `permissions_respond` | 允许或拒绝待审批请求。 |

### 事件系统

MCP 服务器包含实时事件桥接，轮询 Hermes 的会话数据库以获取新消息。这给 MCP 客户端近实时感知传入对话：

```
# 轮询新事件（非阻塞）
events_poll(after_cursor=0)

# 等待下一个事件（阻塞到超时）
events_wait(after_cursor=42, timeout_ms=30000)
```

事件类型：`message`、`approval_requested`、`approval_resolved`

事件队列在内存中，桥接连接时启动。较旧的消息可通过 `messages_read` 获取。

### 选项

```bash
hermes mcp serve              # 正常模式
hermes mcp serve --verbose    # stderr 上的调试日志
```

### 工作原理

MCP 服务器直接从 Hermes 的会话存储（`~/.hermes/sessions/sessions.json` 和 SQLite 数据库）读取对话数据。后台线程轮询数据库以获取新消息并维护内存事件队列。对于发送消息，它使用与 Hermes 代理本身相同的 `send_message` 基础设施。

读操作（列出对话、读取历史、轮询事件）不需要网关运行。发送操作需要网关运行，因为平台适配器需要活跃连接。

### 当前限制

- 仅 Stdio 传输（尚无 HTTP MCP 传输）
- 事件轮询约 200ms 间隔，通过 mtime 优化的 DB 轮询（文件未变时跳过工作）
- 尚无 `claude/channel` 推送通知协议
- 仅文本发送（不通过 `messages_send` 发送媒体/附件）

## 相关文档

- [在 Hermes 中使用 MCP](/docs/guides/use-mcp-with-hermes)
- [CLI 命令](/docs/reference/cli-commands)
- [斜杠命令](/docs/reference/slash-commands)
- [FAQ](/docs/reference/faq)
