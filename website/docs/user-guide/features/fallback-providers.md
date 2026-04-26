---
title: 故障转移提供商
description: 配置自动故障转移到备用 LLM 提供商，当你的主模型不可用时。
sidebar_label: 故障转移提供商
sidebar_position: 8
---

# 故障转移提供商

Hermes Agent 有三层弹性机制，在提供商遇到问题时保持你的会话运行：

1. **[凭据池](./credential-pools.md)** — 在*同一*提供商的多个 API 密钥之间轮换（首先尝试）
2. **主模型故障转移** — 当你的主模型失败时自动切换到*不同的* provider:model
3. **辅助任务故障转移** — 视觉、压缩和网页提取等辅助任务的独立提供商解析

凭据池处理同提供商轮换（例如多个 OpenRouter 密钥）。本页涵盖跨提供商故障转移。两者都是可选的，独立工作。

## 主模型故障转移

当你的主 LLM 提供商遇到错误——速率限制、服务器过载、认证失败、连接中断——Hermes 可以在会话中自动切换到备用 provider:model 对，不会丢失你的对话。

### 配置

在 `~/.hermes/config.yaml` 中添加 `fallback_model` 部分：

```yaml
fallback_model:
  provider: openrouter
  model: anthropic/claude-sonnet-4
```

`provider` 和 `model` 都是**必需的**。如果缺少任一，故障转移被禁用。

### 支持的提供商

| 提供商 | 值 | 要求 |
|--------|---|------|
| AI Gateway | `ai-gateway` | `AI_GATEWAY_API_KEY` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` |
| Nous Portal | `nous` | `hermes auth`（OAuth） |
| OpenAI Codex | `openai-codex` | `hermes model`（ChatGPT OAuth） |
| GitHub Copilot | `copilot` | `COPILOT_GITHUB_TOKEN`、`GH_TOKEN` 或 `GITHUB_TOKEN` |
| GitHub Copilot ACP | `copilot-acp` | 外部进程（编辑器集成） |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` 或 Claude Code 凭据 |
| z.ai / GLM | `zai` | `GLM_API_KEY` |
| Kimi / Moonshot | `kimi-coding` | `KIMI_API_KEY` |
| MiniMax | `minimax` | `MINIMAX_API_KEY` |
| MiniMax（中国） | `minimax-cn` | `MINIMAX_CN_API_KEY` |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `nvidia` | `NVIDIA_API_KEY`（可选：`NVIDIA_BASE_URL`） |
| Ollama Cloud | `ollama-cloud` | `OLLAMA_API_KEY` |
| Google Gemini（OAuth） | `google-gemini-cli` | `hermes model`（Google OAuth；可选：`HERMES_GEMINI_PROJECT_ID`） |
| Google AI Studio | `gemini` | `GOOGLE_API_KEY`（别名：`GEMINI_API_KEY`） |
| xAI（Grok） | `xai`（别名 `grok`） | `XAI_API_KEY`（可选：`XAI_BASE_URL`） |
| AWS Bedrock | `bedrock` | 标准 boto3 认证（`AWS_REGION` + `AWS_PROFILE` 或 `AWS_ACCESS_KEY_ID`） |
| Qwen Portal（OAuth） | `qwen-oauth` | `hermes model`（Qwen Portal OAuth；可选：`HERMES_QWEN_BASE_URL`） |
| OpenCode Zen | `opencode-zen` | `OPENCODE_ZEN_API_KEY` |
| OpenCode Go | `opencode-go` | `OPENCODE_GO_API_KEY` |
| Kilo Code | `kilocode` | `KILOCODE_API_KEY` |
| Xiaomi MiMo | `xiaomi` | `XIAOMI_API_KEY` |
| Arcee AI | `arcee` | `ARCEEAI_API_KEY` |
| Alibaba / DashScope | `alibaba` | `DASHSCOPE_API_KEY` |
| Hugging Face | `huggingface` | `HF_TOKEN` |
| 自定义端点 | `custom` | `base_url` + `key_env`（见下文） |

### 自定义端点故障转移

对于自定义 OpenAI 兼容端点，添加 `base_url` 和可选的 `key_env`：

```yaml
fallback_model:
  provider: custom
  model: my-local-model
  base_url: http://localhost:8000/v1
  key_env: MY_LOCAL_KEY              # 包含 API 密钥的环境变量名
```

### 故障转移何时触发

当主模型以下列方式失败时，故障转移自动激活：

- **速率限制**（HTTP 429） — 耗尽重试尝试后
- **服务器错误**（HTTP 500、502、503） — 耗尽重试尝试后
- **认证失败**（HTTP 401、403） — 立即（重试无意义）
- **未找到**（HTTP 404） — 立即
- **无效响应** — 当 API 反复返回格式错误或空响应时

触发时，Hermes：

1. 解析故障转移提供商的凭据
2. 构建新的 API 客户端
3. 就地替换模型、提供商和客户端
4. 重置重试计数器并继续对话

切换是无缝的——你的对话历史、工具调用和上下文被保留。代理从完全相同的位置继续，只是使用不同的模型。

:::info 每轮而非每会话
故障转移是**轮次作用域的**：每条新用户消息从恢复的主模型开始。如果主模型在轮次中失败，故障转移仅对该轮激活。在下一条消息中，Hermes 再次尝试主模型。在单轮内，故障转移最多激活一次——如果故障转移也失败，正常错误处理接管（重试，然后错误消息）。这防止轮次内的级联故障转移循环，同时给主模型每轮新的机会。
:::

### 示例

**OpenRouter 作为 Anthropic 原生的故障转移：**
```yaml
model:
  provider: anthropic
  default: claude-sonnet-4-6

fallback_model:
  provider: openrouter
  model: anthropic/claude-sonnet-4
```

**Nous Portal 作为 OpenRouter 的故障转移：**
```yaml
model:
  provider: openrouter
  default: anthropic/claude-opus-4

fallback_model:
  provider: nous
  model: nous-hermes-3
```

**本地模型作为云的故障转移：**
```yaml
fallback_model:
  provider: custom
  model: llama-3.1-70b
  base_url: http://localhost:8000/v1
  key_env: LOCAL_API_KEY
```

**Codex OAuth 作为故障转移：**
```yaml
fallback_model:
  provider: openai-codex
  model: gpt-5.3-codex
```

### 故障转移适用范围

| 上下文 | 支持故障转移 |
|--------|------------|
| CLI 会话 | ✔ |
| 消息网关（Telegram、Discord 等） | ✔ |
| 子代理委托 | ✘（子代理不继承故障转移配置） |
| Cron 任务 | ✘（使用固定提供商运行） |
| 辅助任务（视觉、压缩） | ✘（使用自己的提供商链——见下文） |

:::tip
`fallback_model` 没有环境变量——它完全通过 `config.yaml` 配置。这是有意的：故障转移配置是刻意的选择，不应被过时的 shell 导出覆盖。
:::

---

## 辅助任务故障转移

Hermes 为辅助任务使用单独的轻量级模型。每个任务有自己的提供商解析链，作为内置故障转移系统。

### 具有独立提供商解析的任务

| 任务 | 功能 | 配置键 |
|------|------|--------|
| 视觉 | 图像分析、浏览器截图 | `auxiliary.vision` |
| 网页提取 | 网页摘要 | `auxiliary.web_extract` |
| 压缩 | 上下文压缩摘要 | `auxiliary.compression` |
| 会话搜索 | 历史会话摘要 | `auxiliary.session_search` |
| 技能中心 | 技能搜索和发现 | `auxiliary.skills_hub` |
| MCP | MCP 辅助操作 | `auxiliary.mcp` |
| 审批 | 智能命令审批分类 | `auxiliary.approval` |
| 标题生成 | 会话标题摘要 | `auxiliary.title_generation` |

### 自动检测链

当任务的提供商设为 `"auto"`（默认）时，Hermes 按顺序尝试提供商直到一个工作：

**对于文本任务（压缩、网页提取等）：**

```text
OpenRouter → Nous Portal → 自定义端点 → Codex OAuth →
API 密钥提供商（z.ai、Kimi、MiniMax、Xiaomi MiMo、Hugging Face、Anthropic）→ 放弃
```

**对于视觉任务：**

```text
主提供商（如果支持视觉）→ OpenRouter → Nous Portal →
Codex OAuth → Anthropic → 自定义端点 → 放弃
```

如果解析的提供商在调用时失败，Hermes 也有内部重试：如果提供商不是 OpenRouter 且没有设置显式 `base_url`，它尝试 OpenRouter 作为最后手段的故障转移。

### 配置辅助提供商

每个任务可以在 `config.yaml` 中独立配置：

```yaml
auxiliary:
  vision:
    provider: "auto"              # auto | openrouter | nous | codex | main | anthropic
    model: ""                     # 例如 "openai/gpt-4o"
    base_url: ""                  # 直接端点（优先于 provider）
    api_key: ""                   # base_url 的 API 密钥

  web_extract:
    provider: "auto"
    model: ""

  compression:
    provider: "auto"
    model: ""

  session_search:
    provider: "auto"
    model: ""
    timeout: 30
    max_concurrency: 3
    extra_body: {}

  skills_hub:
    provider: "auto"
    model: ""

  mcp:
    provider: "auto"
    model: ""
```

以上每个任务都遵循相同的 **provider / model / base_url** 模式。上下文压缩在 `auxiliary.compression` 下配置：

```yaml
auxiliary:
  compression:
    provider: main                                    # 与其他辅助任务相同的提供商选项
    model: google/gemini-3-flash-preview
    base_url: null                                    # 自定义 OpenAI 兼容端点
```

故障转移模型使用：

```yaml
fallback_model:
  provider: openrouter
  model: anthropic/claude-sonnet-4
  # base_url: http://localhost:8000/v1               # 可选自定义端点
```

对于 `auxiliary.session_search`，Hermes 还支持：

- `max_concurrency` 限制同时运行的会话摘要数量
- `extra_body` 在摘要调用中传递提供商特定的 OpenAI 兼容请求字段

示例：

```yaml
auxiliary:
  session_search:
    provider: main
    model: glm-4.5-air
    max_concurrency: 2
    extra_body:
      enable_thinking: false
```

如果你的提供商不支持原生 OpenAI 兼容的推理控制字段，`extra_body` 对该部分没有帮助；在这种情况下 `max_concurrency` 仍然有助于减少请求突发的 429。

三者——辅助、压缩、故障转移——工作方式相同：设置 `provider` 选择谁处理请求，`model` 选择哪个模型，`base_url` 指向自定义端点（覆盖 provider）。

### 辅助任务的提供商选项

这些选项仅适用于 `auxiliary:`、`compression:` 和 `fallback_model:` 配置——`"main"` **不是**顶层 `model.provider` 的有效值。对于自定义端点，在 `model:` 部分使用 `provider: custom`（参见 [AI 提供商](/docs/integrations/providers)）。

| 提供商 | 描述 | 要求 |
|--------|------|------|
| `"auto"` | 按顺序尝试提供商直到一个工作（默认） | 至少配置一个提供商 |
| `"openrouter"` | 强制 OpenRouter | `OPENROUTER_API_KEY` |
| `"nous"` | 强制 Nous Portal | `hermes auth` |
| `"codex"` | 强制 Codex OAuth | `hermes model` → Codex |
| `"main"` | 使用主代理使用的任何提供商（仅辅助任务） | 活跃的主提供商已配置 |
| `"anthropic"` | 强制 Anthropic 原生 | `ANTHROPIC_API_KEY` 或 Claude Code 凭据 |

### 直接端点覆盖

对于任何辅助任务，设置 `base_url` 完全绕过提供商解析，直接向该端点发送请求：

```yaml
auxiliary:
  vision:
    base_url: "http://localhost:1234/v1"
    api_key: "local-key"
    model: "qwen2.5-vl"
```

`base_url` 优先于 `provider`。Hermes 使用配置的 `api_key` 进行认证，如果未设置则回退到 `OPENAI_API_KEY`。它**不会**为自定义端点复用 `OPENROUTER_API_KEY`。

---

## 上下文压缩故障转移

上下文压缩使用 `auxiliary.compression` 配置块控制哪个模型和提供商处理摘要：

```yaml
auxiliary:
  compression:
    provider: "auto"                              # auto | openrouter | nous | main
    model: "google/gemini-3-flash-preview"
```

:::info 旧版迁移
旧配置中的 `compression.summary_model` / `compression.summary_provider` / `compression.summary_base_url` 在首次加载时自动迁移到 `auxiliary.compression.*`（配置版本 17）。
:::

如果没有可用的压缩提供商，Hermes 会丢弃中间对话轮次而不生成摘要，而非使会话失败。

---

## 委托提供商覆盖

由 `delegate_task` 生成的子代理**不**使用主故障转移模型。但是，它们可以被路由到不同的 provider:model 对以优化成本：

```yaml
delegation:
  provider: "openrouter"                      # 覆盖所有子代理的提供商
  model: "google/gemini-3-flash-preview"      # 覆盖模型
  # base_url: "http://localhost:1234/v1"      # 或使用直接端点
  # api_key: "local-key"
```

参见[子代理委托](/docs/user-guide/features/delegation)获取完整配置详情。

---

## Cron 任务提供商

Cron 任务使用执行时配置的任何提供商运行。它们不支持故障转移模型。要为 cron 任务使用不同的提供商，在 cron 任务本身上配置 `provider` 和 `model` 覆盖：

```python
cronjob(
    action="create",
    schedule="every 2h",
    prompt="Check server status",
    provider="openrouter",
    model="google/gemini-3-flash-preview"
)
```

参见[定时任务（Cron）](/docs/user-guide/features/cron)获取完整配置详情。

---

## 总结

| 功能 | 故障转移机制 | 配置位置 |
|------|------------|---------|
| 主代理模型 | config.yaml 中的 `fallback_model` — 每轮错误时故障转移（每轮恢复主模型） | `fallback_model:`（顶层） |
| 视觉 | 自动检测链 + 内部 OpenRouter 重试 | `auxiliary.vision` |
| 网页提取 | 自动检测链 + 内部 OpenRouter 重试 | `auxiliary.web_extract` |
| 上下文压缩 | 自动检测链，不可用时降级为无摘要 | `auxiliary.compression` |
| 会话搜索 | 自动检测链 | `auxiliary.session_search` |
| 技能中心 | 自动检测链 | `auxiliary.skills_hub` |
| MCP 辅助 | 自动检测链 | `auxiliary.mcp` |
| 审批分类 | 自动检测链 | `auxiliary.approval` |
| 标题生成 | 自动检测链 | `auxiliary.title_generation` |
| 委托 | 仅提供商覆盖（无自动故障转移） | `delegation.provider` / `delegation.model` |
| Cron 任务 | 仅每任务提供商覆盖（无自动故障转移） | 每任务 `provider` / `model` |
