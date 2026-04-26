---
sidebar_position: 6
title: "在 Hermes 中使用 MCP"
description: "将 MCP 服务器连接到 Hermes Agent、过滤其工具并在真实工作流中安全使用的实用指南"
---

# 在 Hermes 中使用 MCP

本指南展示如何在日常工作中实际使用 MCP 与 Hermes Agent。

如果功能页面解释了 MCP 是什么，本指南是关于如何快速安全地从中获得价值。

## 何时应该使用 MCP？

在以下情况下使用 MCP：
- 工具已经以 MCP 形式存在，你不想构建原生 Hermes 工具
- 你想要 Hermes 通过干净的 RPC 层操作本地或远程系统
- 你想要细粒度的每服务器暴露控制
- 你想要将 Hermes 连接到内部 API、数据库或公司系统而不修改 Hermes 核心

在以下情况下不要使用 MCP：
- 内置的 Hermes 工具已经很好地解决了工作
- 服务器暴露了巨大的危险工具面，而你没有准备好过滤它
- 你只需要一个非常窄的集成，原生工具会更简单更安全

## 心智模型

将 MCP 视为适配器层：

- Hermes 仍然是代理
- MCP 服务器贡献工具
- Hermes 在启动或重载时发现这些工具
- 模型可以像普通工具一样使用它们
- 你控制每个服务器的可见程度

最后一点很重要。好的 MCP 使用不仅仅是 "连接一切"。它是 "连接正确的东西，以最小的有用面"。

## 步骤 1：安装 MCP 支持

如果你使用标准安装脚本安装了 Hermes，MCP 支持已经包含（安装器运行 `uv pip install -e ".[all]"`）。

如果你没有安装额外依赖并需要单独添加 MCP：

```bash
cd ~/.hermes/hermes-agent
uv pip install -e ".[mcp]"
```

对于基于 npm 的服务器，确保 Node.js 和 `npx` 可用。

对于许多 Python MCP 服务器，`uvx` 是一个好的默认。

## 步骤 2：先添加一个服务器

从一个单一、安全的服务器开始。

示例：仅对一个项目目录的文件系统访问。

```yaml
mcp_servers:
  project_fs:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/my-project"]
```

然后启动 Hermes：

```bash
hermes chat
```

现在问一些具体的事情：

```text
检查这个项目并总结仓库布局。
```

## 步骤 3：验证 MCP 已加载

你可以通过几种方式验证 MCP：

- 配置后 Hermes 横幅/状态应显示 MCP 集成
- 问 Hermes 它有什么可用的工具
- 配置更改后使用 `/reload-mcp`
- 如果服务器连接失败，检查日志

实用的测试提示：

```text
告诉我现在有哪些 MCP 支持的工具可用。
```

## 步骤 4：立即开始过滤

如果服务器暴露了很多工具，不要等到以后。

### 示例：只白名单你想要的

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [list_issues, create_issue, search_code]
```

这通常是敏感系统的最佳默认。

### 示例：黑名单危险操作

```yaml
mcp_servers:
  stripe:
    url: "https://mcp.stripe.com"
    headers:
      Authorization: "Bearer ***"
    tools:
      exclude: [delete_customer, refund_payment]
```

### 示例：也禁用实用工具包装器

```yaml
mcp_servers:
  docs:
    url: "https://mcp.docs.example.com"
    tools:
      prompts: false
      resources: false
```

## 过滤实际影响什么？

Hermes 中有两类 MCP 暴露的功能：

1. 服务器原生 MCP 工具
- 通过以下过滤：
  - `tools.include`
  - `tools.exclude`

2. Hermes 添加的实用工具包装器
- 通过以下过滤：
  - `tools.resources`
  - `tools.prompts`

### 你可能看到的实用工具包装器

资源：
- `list_resources`
- `read_resource`

提示：
- `list_prompts`
- `get_prompt`

这些包装器仅在以下情况下出现：
- 你的配置允许它们，并且
- MCP 服务器会话实际支持这些能力

所以 Hermes 不会假装服务器有资源/提示如果它没有的话。

## 常见模式

### 模式 1：本地项目助手

当你想要 Hermes 在有界工作区上推理时，使用 MCP 进行仓库本地文件系统或 git 服务器。

```yaml
mcp_servers:
  fs:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/project"]

  git:
    command: "uvx"
    args: ["mcp-server-git", "--repository", "/home/user/project"]
```

好的提示：

```text
审查项目结构并识别配置在哪里。
```

```text
检查本地 git 状态并总结最近的变化。
```

### 模式 2：GitHub 分类助手

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [list_issues, create_issue, update_issue, search_code]
      prompts: false
      resources: false
```

好的提示：

```text
列出关于 MCP 的打开 issue，按主题分组，并为最常见的 bug 起草一个高质量的 issue。
```

```text
在仓库中搜索 _discover_and_register_server 的使用并解释 MCP 工具是如何注册的。
```

### 模式 3：内部 API 助手

```yaml
mcp_servers:
  internal_api:
    url: "https://mcp.internal.example.com"
    headers:
      Authorization: "Bearer ***"
    tools:
      include: [list_customers, get_customer, list_invoices]
      resources: false
      prompts: false
```

好的提示：

```text
查找客户 ACME Corp 并总结最近的发票活动。
```

这是严格白名单比排除列表好得多的地方。

### 模式 4：文档/知识服务器

一些 MCP 服务器暴露的提示或资源更像是共享知识资产而非直接操作。

```yaml
mcp_servers:
  docs:
    url: "https://mcp.docs.example.com"
    tools:
      prompts: true
      resources: true
```

好的提示：

```text
列出文档服务器的可用 MCP 资源，然后阅读入门指南并总结它。
```

```text
列出文档服务器暴露的提示并告诉我哪些有助于事件响应。
```

## 教程：带过滤的端到端设置

这是一个实用的渐进过程。

### 阶段 1：添加 GitHub MCP 带严格白名单

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [list_issues, create_issue, search_code]
      prompts: false
      resources: false
```

启动 Hermes 并问：

```text
在代码库中搜索 MCP 的引用并总结主要的集成点。
```

### 阶段 2：仅在需要时扩展

如果你后来也需要 issue 更新：

```yaml
tools:
  include: [list_issues, create_issue, update_issue, search_code]
```

然后重载：

```text
/reload-mcp
```

### 阶段 3：添加具有不同策略的第二个服务器

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [list_issues, create_issue, update_issue, search_code]
      prompts: false
      resources: false

  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/project"]
```

现在 Hermes 可以组合它们：

```text
检查本地项目文件，然后创建一个 GitHub issue 总结你发现的 bug。
```

这就是 MCP 变得强大的地方：多系统工作流而不改变 Hermes 核心。

## 安全使用建议

### 对危险系统偏好允许列表

对于任何金融、面向客户或破坏性的：
- 使用 `tools.include`
- 从最小的可能集合开始

### 禁用未使用的实用工具

如果你不想要模型浏览服务器提供的资源/提示，关闭它们：

```yaml
tools:
  resources: false
  prompts: false
```

### 保持服务器范围窄

示例：
- 文件系统服务器根目录到一个项目目录，而不是你的整个主目录
- git 服务器指向一个仓库
- 内部 API 服务器默认暴露读重工具

### 配置更改后重载

```text
/reload-mcp
```

在更改以下内容后执行：
- include/exclude 列表
- enabled 标志
- resources/prompts 开关
- 认证头/环境变量

## 按症状故障排除

### "服务器连接但我期望的工具缺失"

可能原因：
- 被 `tools.include` 过滤
- 被 `tools.exclude` 排除
- 通过 `resources: false` 或 `prompts: false` 禁用了实用工具包装器
- 服务器实际上不支持资源/提示

### "服务器已配置但什么都不加载"

检查：
- `enabled: false` 没有留在配置中
- 命令/运行时存在（`npx`、`uvx` 等）
- HTTP 端点可达
- 认证环境变量或头正确

### "为什么我看到的工具比 MCP 服务器广告的少？"

因为 Hermes 现在尊重你的每服务器策略和能力感知注册。这是预期的，通常也是可取的。

### "如何在不删除配置的情况下移除 MCP 服务器？"

使用：

```yaml
enabled: false
```

这保留配置但防止连接和注册。

## 推荐的首次 MCP 设置

对大多数用户好的首个服务器：
- 文件系统
- git
- GitHub
- fetch / 文档 MCP 服务器
- 一个窄的内部 API

不好的首个服务器：
- 有很多破坏性操作且没有过滤的大型业务系统
- 任何你不够了解无法约束的东西

## 相关文档

- [MCP（模型上下文协议）](/docs/user-guide/features/mcp)
- [FAQ](/docs/reference/faq)
- [斜杠命令](/docs/reference/slash-commands)
