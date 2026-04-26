---
sidebar_position: 15
title: "Azure AI Foundry"
description: "在 Hermes Agent 中使用 Azure AI Foundry — OpenAI 风格和 Anthropic 风格端点，自动检测传输和部署模型"
---

# Azure AI Foundry

Hermes Agent 支持 Azure AI Foundry（和 Azure OpenAI）作为一等提供者。单个 Azure 资源可以托管具有两种不同线路格式的模型：

- **OpenAI 风格** — `POST /v1/chat/completions`，端点如 `https://<resource>.openai.azure.com/openai/v1`。用于 GPT-4.x、GPT-5.x、Llama、Mistral 和大多数开放权重模型。
- **Anthropic 风格** — `POST /v1/messages`，端点如 `https://<resource>.services.ai.azure.com/anthropic`。当 Azure Foundry 通过 Anthropic Messages API 格式提供 Claude 模型时使用。

设置向导会探测你的端点并自动检测使用的传输方式、可用的部署以及每个模型的上下文长度。

## 前提条件

- 一个至少有一个部署的 Azure AI Foundry 或 Azure OpenAI 资源
- 该资源的 API 密钥（在 Azure Portal 的 "Keys and Endpoint" 下可用）
- 部署的端点 URL

## 快速开始

```bash
hermes model
# → 选择 "Azure Foundry"
# → 输入你的端点 URL
# → 输入你的 API 密钥
# Hermes 探测端点并自动检测传输方式 + 模型
# → 从列表中选择模型（或手动输入部署名称）
```

向导会：

1. **嗅探 URL 路径** — 以 `/anthropic` 结尾的 URL 被识别为 Azure Foundry Claude 路由。
2. **探测 `GET <base>/models`** — 如果端点返回 OpenAI 形状的模型列表，Hermes 切换到 `chat_completions` 并用返回的部署 ID 预填充选择器。
3. **探测 Anthropic Messages 形状** — 对于不暴露 `/models` 但接受 Anthropic Messages 格式的端点的回退。
4. **回退到手动输入** — 拒绝每个探测的私有/防火墙端点仍然可以工作；你手动选择 API 模式并输入部署名称。

所选模型的上下文长度通过 Hermes 的标准元数据链（`models.dev`、提供者元数据和硬编码的系列回退）解析，并存储在 `config.yaml` 中，以便模型可以正确调整其上下文窗口大小。

## 配置（写入 `config.yaml`）

运行向导后你会看到类似这样：

```yaml
model:
  provider: azure-foundry
  base_url: https://my-resource.openai.azure.com/openai/v1
  api_mode: chat_completions         # 或 "anthropic_messages"
  default: gpt-5.4-mini              # 你的部署/模型名称
  context_length: 400000             # 自动检测
```

以及在 `~/.hermes/.env` 中：

```
AZURE_FOUNDRY_API_KEY=<your-azure-key>
```

## OpenAI 风格端点（GPT、Llama 等）

Azure OpenAI 的 v1 GA 端点接受标准的 `openai` Python 客户端，只需少量更改：

```yaml
model:
  provider: azure-foundry
  base_url: https://my-resource.openai.azure.com/openai/v1
  api_mode: chat_completions
  default: gpt-5.4
```

重要行为：

- **gpt-5.x 保持在 `/chat/completions`。** 与 `api.openai.com` 不同，Azure OpenAI 不支持 Responses API — Hermes 检测 Azure 端点并将 gpt-5.x 保持在 Azure 实际提供服务的 `chat_completions` 上。
- **自动使用 `max_completion_tokens`。** Azure OpenAI（与直接 OpenAI 一样）对 gpt-4o、o 系列和 gpt-5.x 模型要求 `max_completion_tokens`。Hermes 根据端点发送正确的参数。
- **需要 `api-version` 的 v1 之前的端点。** 如果你有一个旧版基础 URL 如 `https://<resource>.openai.azure.com/openai?api-version=2025-04-01-preview`，Hermes 提取查询字符串并通过每个请求的 `default_query` 转发它（否则 OpenAI SDK 在连接路径时会丢弃它）。

## Anthropic 风格端点（通过 Azure Foundry 的 Claude）

对于 Claude 部署，使用 Anthropic 风格路由：

```yaml
model:
  provider: azure-foundry
  base_url: https://my-resource.services.ai.azure.com/anthropic
  api_mode: anthropic_messages
  default: claude-sonnet-4-6
```

重要行为：

- **`/v1` 从基础 URL 中剥离。** Anthropic SDK 在每个请求 URL 后附加 `/v1/messages` — Hermes 在将 URL 交给 SDK 之前移除任何尾部的 `/v1`，以避免双重 `/v1` 路径。
- **`api-version` 通过 `default_query` 发送，而不是附加到 URL。** Azure Anthropic 需要 `api-version` 查询字符串。将其烘焙到基础 URL 中会产生畸形路径如 `/anthropic?api-version=.../v1/messages` 并返回 404。Hermes 通过 Anthropic SDK 的 `default_query` 传递 `api-version=2025-04-15`。
- **OAuth 令牌刷新被禁用。** Azure 部署使用静态 API 密钥。适用于 Anthropic Console 的 `~/.claude/.credentials.json` OAuth 令牌刷新循环对 Azure 端点被显式跳过，以防止 Claude Code OAuth 令牌在会话中覆盖你的 Azure 密钥。

## 替代方案：`provider: anthropic` + Azure 基础 URL

如果你已经配置了 `provider: anthropic` 并且只想将其指向 Azure AI Foundry 来使用 Claude，你可以完全跳过 `azure-foundry` 提供者：

```yaml
model:
  provider: anthropic
  base_url: https://my-resource.services.ai.azure.com/anthropic
  api_key_env: AZURE_ANTHROPIC_KEY
  default: claude-sonnet-4-6
```

在 `~/.hermes/.env` 中设置 `AZURE_ANTHROPIC_KEY`。Hermes 检测基础 URL 中的 `azure.com` 并短路 Claude Code OAuth 令牌链，以便 Azure 密钥直接与 `x-api-key` 认证一起使用。

## 模型发现

Azure **不**暴露纯 API 密钥端点来列出你的*已部署*模型部署。部署枚举需要 Azure Resource Manager 认证（`az cognitiveservices account deployment list`），使用 Azure AD 主体，而不是推理 API 密钥。

Hermes 能做的：

- Azure OpenAI v1 端点（`<resource>.openai.azure.com/openai/v1`）暴露 `GET /models`，包含资源的**可用**模型目录。Hermes 使用此列表预填充模型选择器。
- Azure Foundry `/anthropic` 路由：通过 URL 路径检测，模型名称手动输入。
- 私有/防火墙端点：手动输入，带有友好的 "无法探测" 消息。

你始终可以直接输入部署名称 — Hermes 不会根据返回的列表进行验证。

## 环境变量

| 变量 | 用途 |
|----------|---------|
| `AZURE_FOUNDRY_API_KEY` | Azure AI Foundry / Azure OpenAI 的主 API 密钥 |
| `AZURE_FOUNDRY_BASE_URL` | 端点 URL（通过 `hermes model` 设置；环境变量作为回退） |
| `AZURE_ANTHROPIC_KEY` | 由 `provider: anthropic` + Azure 基础 URL 使用（`ANTHROPIC_API_KEY` 的替代） |

## 故障排除

**gpt-5.x 部署上的 401 Unauthorized。**
Azure 在 `/chat/completions` 上提供 gpt-5.x，而不是 `/responses`。当 URL 包含 `openai.azure.com` 时，Hermes 会自动处理，但如果你看到带有 `Invalid API key` 正文的 401，请检查 `config.yaml` 中的 `api_mode` 是否为 `chat_completions`。

**`/v1/messages?api-version=.../v1/messages` 上的 404。**
这是修复前 Azure Anthropic 设置中的畸形 URL 问题。升级 Hermes — `api-version` 参数现在通过 `default_query` 传递而不是烘焙到基础 URL 中，因此 SDK 在 URL 连接期间无法损坏它。

**向导显示 "Auto-detection incomplete."。**
端点拒绝了 `/models` 探测和 Anthropic Messages 探测。这对防火墙后面或具有 IP 允许列表的私有端点来说是正常的。回退到手动 API 模式选择并输入你的部署名称 — 一切仍然正常工作，Hermes 只是无法预填充选择器。

**选择了错误的传输方式。**
再次运行 `hermes model`，向导会重新探测。如果探测仍然选择了错误的模式，你可以直接编辑 `config.yaml`：

```yaml
model:
  provider: azure-foundry
  api_mode: anthropic_messages   # 或 chat_completions
```

## 相关

- [环境变量](/docs/reference/environment-variables)
- [配置](/docs/user-guide/configuration)
- [AWS Bedrock](/docs/guides/aws-bedrock) — 另一个主要的云提供者集成
