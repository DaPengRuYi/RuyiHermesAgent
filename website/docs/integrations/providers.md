---
title: "AI 提供者"
sidebar_label: "AI 提供者"
sidebar_position: 1
---

# AI 提供者

本页涵盖为 Hermes Agent 设置推理提供者 — 从 OpenRouter 和 Anthropic 等云 API，到 Ollama 和 vLLM 等自托管端点，再到高级路由和回退配置。你需要至少配置一个提供者才能使用 Hermes。

## 推理提供者

你需要至少一种连接到 LLM 的方式。使用 `hermes model` 交互式切换提供者和模型，或直接配置：

| 提供者 | 设置 |
|----------|-------|
| **Nous Portal** | `hermes model`（OAuth，基于订阅） |
| **OpenAI Codex** | `hermes model`（ChatGPT OAuth，使用 Codex 模型） |
| **GitHub Copilot** | `hermes model`（OAuth 设备代码流程、`COPILOT_GITHUB_TOKEN`、`GH_TOKEN` 或 `gh auth token`） |
| **GitHub Copilot ACP** | `hermes model`（生成本地 `copilot --acp --stdio`） |
| **Anthropic** | `hermes model`（通过 Claude Code 认证的 Claude Pro/Max、Anthropic API 密钥或手动设置令牌） |
| **OpenRouter** | 在 `~/.hermes/.env` 中设置 `OPENROUTER_API_KEY` |
| **AI Gateway** | 在 `~/.hermes/.env` 中设置 `AI_GATEWAY_API_KEY`（提供者：`ai-gateway`） |
| **z.ai / GLM** | 在 `~/.hermes/.env` 中设置 `GLM_API_KEY`（提供者：`zai`） |
| **Kimi / Moonshot** | 在 `~/.hermes/.env` 中设置 `KIMI_API_KEY`（提供者：`kimi-coding`） |
| **Kimi / Moonshot（中国）** | 在 `~/.hermes/.env` 中设置 `KIMI_CN_API_KEY`（提供者：`kimi-coding-cn`；别名：`kimi-cn`、`moonshot-cn`） |
| **Arcee AI** | 在 `~/.hermes/.env` 中设置 `ARCEEAI_API_KEY`（提供者：`arcee`；别名：`arcee-ai`、`arceeai`） |
| **MiniMax** | 在 `~/.hermes/.env` 中设置 `MINIMAX_API_KEY`（提供者：`minimax`） |
| **MiniMax 中国** | 在 `~/.hermes/.env` 中设置 `MINIMAX_CN_API_KEY`（提供者：`minimax-cn`） |
| **阿里云** | 在 `~/.hermes/.env` 中设置 `DASHSCOPE_API_KEY`（提供者：`alibaba`，别名：`dashscope`、`qwen`） |
| **Kilo Code** | 在 `~/.hermes/.env` 中设置 `KILOCODE_API_KEY`（提供者：`kilocode`） |
| **Xiaomi MiMo** | 在 `~/.hermes/.env` 中设置 `XIAOMI_API_KEY`（提供者：`xiaomi`，别名：`mimo`、`xiaomi-mimo`） |
| **OpenCode Zen** | 在 `~/.hermes/.env` 中设置 `OPENCODE_ZEN_API_KEY`（提供者：`opencode-zen`） |
| **OpenCode Go** | 在 `~/.hermes/.env` 中设置 `OPENCODE_GO_API_KEY`（提供者：`opencode-go`） |
| **DeepSeek** | 在 `~/.hermes/.env` 中设置 `DEEPSEEK_API_KEY`（提供者：`deepseek`） |
| **Hugging Face** | 在 `~/.hermes/.env` 中设置 `HF_TOKEN`（提供者：`huggingface`，别名：`hf`） |
| **Google / Gemini** | 在 `~/.hermes/.env` 中设置 `GOOGLE_API_KEY`（或 `GEMINI_API_KEY`）（提供者：`gemini`） |
| **Google Gemini（OAuth）** | `hermes model` → "Google Gemini (OAuth)"（提供者：`google-gemini-cli`，支持免费层，浏览器 PKCE 登录） |
| **自定义端点** | `hermes model` → 选择 "Custom endpoint"（保存在 `config.yaml` 中） |

:::tip 模型键别名
在 `model:` 配置部分中，你可以使用 `default:` 或 `model:` 作为模型 ID 的键名。`model: { default: my-model }` 和 `model: { model: my-model }` 都同样有效。
:::


### 通过 OAuth 的 Google Gemini（`google-gemini-cli`）

`google-gemini-cli` 提供者使用 Google 的 Cloud Code Assist 后端 — 与 Google 自己的 `gemini-cli` 工具使用的 API 相同。这支持**免费层**（个人帐户的慷慨每日配额）和**付费层**（通过 GCP 项目的 Standard/Enterprise）。

**快速开始：**

```bash
hermes model
# → 选择 "Google Gemini (OAuth)"
# → 看到策略警告，确认
# → 浏览器打开到 accounts.google.com，登录
# → 完成 — Hermes 在首次请求时自动配置你的免费层
```

Hermes 默认附带 Google 的**公共** `gemini-cli` 桌面 OAuth 客户端 — 与 Google 在其开源 `gemini-cli` 中包含的凭据相同。桌面 OAuth 客户端不是机密的（PKCE 提供安全性）。你不需要安装 `gemini-cli` 或注册自己的 GCP OAuth 客户端。

**认证工作方式：**
- 对 `accounts.google.com` 的 PKCE 授权码流程
- 在 `http://127.0.0.1:8085/oauth2callback` 的浏览器回调（如果端口繁忙则回退到临时端口）
- 令牌存储在 `~/.hermes/auth/google_oauth.json`（chmod 0600，原子写入，跨进程 `fcntl` 锁）
- 到期前 60 秒自动刷新
- 无头环境（SSH、`HERMES_HEADLESS=1`）→ 粘贴模式回退
- 进行中的刷新去重 — 两个并发请求不会双重刷新
- `invalid_grant`（已撤销的刷新）→ 凭据文件被清除，提示用户重新登录

**推理工作方式：**
- 流量发送到 `https://cloudcode-pa.googleapis.com/v1internal:generateContent`（或流式的 `:streamGenerateContent?alt=sse`），而不是付费的 `v1beta/openai` 端点
- 请求体包装为 `{project, model, user_prompt_id, request}`
- OpenAI 形状的 `messages[]`、`tools[]`、`tool_choice` 被翻译为 Gemini 的原生 `contents[]`、`tools[].functionDeclarations`、`toolConfig` 形状
- 响应被翻译回 OpenAI 形状，以便 Hermes 的其余部分不受影响

**层级和项目 ID：**

| 你的状况 | 做什么 |
|---|---|
| 个人 Google 帐户，想要免费层 | 无需操作 — 登录，开始聊天 |
| Workspace / Standard / Enterprise 帐户 | 设置 `HERMES_GEMINI_PROJECT_ID` 或 `GOOGLE_CLOUD_PROJECT` 为你的 GCP 项目 ID |
| VPC-SC 保护的组织 | Hermes 检测到 `SECURITY_POLICY_VIOLATED` 并自动强制 `standard-tier` |

免费层在首次使用时自动配置 Google 管理的项目。无需 GCP 设置。

**配额监控：**

```
/gquota
```

显示每个模型的剩余 Code Assist 配额，带进度条：

```
Gemini Code Assist quota  (project: 123-abc)

  gemini-2.5-pro                      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░   85%
  gemini-2.5-flash [input]            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░   92%
```

:::warning 策略风险
Google 认为将 Gemini CLI OAuth 客户端与第三方软件一起使用违反策略。一些用户报告了帐户限制。要获得最低风险的体验，请改用 `gemini` 提供者通过你自己的 API 密钥。Hermes 在 OAuth 开始前显示预先警告并需要明确确认。
:::

**自定义 OAuth 客户端（可选）：**

如果你更愿意注册自己的 Google OAuth 客户端 — 例如，将配额和同意范围限定在你自己的 GCP 项目中 — 设置：

```bash
HERMES_GEMINI_CLIENT_ID=your-client.apps.googleusercontent.com
HERMES_GEMINI_CLIENT_SECRET=...   # 桌面客户端可选
```

在 [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) 注册一个**桌面应用** OAuth 客户端，启用 Generative Language API。

:::info Codex 注意
OpenAI Codex 提供者通过设备代码认证（打开 URL，输入代码）。Hermes 将生成的凭据存储在自己的认证存储 `~/.hermes/auth.json` 中，并且如果存在 `~/.codex/auth.json`，可以导入现有的 Codex CLI 凭据。无需安装 Codex CLI。
:::

:::warning
即使使用 Nous Portal、Codex 或自定义端点，某些工具（视觉、网络摘要、MoA）使用单独的"辅助"模型 — 默认是通过 OpenRouter 的 Gemini Flash。`OPENROUTER_API_KEY` 会自动启用这些工具。你也可以配置这些工具使用的模型和提供者 — 参见[辅助模型](/docs/user-guide/configuration#auxiliary-models)。
:::

:::tip Nous 工具网关
付费 Nous Portal 订阅者还可以访问**[工具网关](/docs/user-guide/features/tool-gateway)** — 通过你的订阅路由的网络搜索、图像生成、TTS 和浏览器自动化。无需额外的 API 密钥。在 `hermes model` 设置期间自动提供，或稍后使用 `hermes tools` 启用。
:::

### 两个模型管理命令

Hermes 有**两个**模型命令，用途不同：

| 命令 | 在哪里运行 | 功能 |
|---------|-------------|--------------|
| **`hermes model`** | 你的终端（在任何会话之外） | 完整设置向导 — 添加提供者、运行 OAuth、输入 API 密钥、配置端点 |
| **`/model`** | 在 Hermes 聊天会话内 | 在**已配置的**提供者和模型之间快速切换 |

如果你试图切换到尚未设置的提供者（例如你只配置了 OpenRouter 想使用 Anthropic），你需要 `hermes model`，而不是 `/model`。先退出会话（`Ctrl+C` 或 `/quit`），运行 `hermes model`，完成提供者设置，然后启动新会话。

### Anthropic（原生）

直接通过 Anthropic API 使用 Claude 模型 — 无需 OpenRouter 代理。支持三种认证方法：

```bash
# 使用 API 密钥（按令牌付费）
export ANTHROPIC_API_KEY=***
hermes chat --provider anthropic --model claude-sonnet-4-6

# 首选：通过 `hermes model` 认证
# Hermes 在可用时直接使用 Claude Code 的凭据存储
hermes model

# 使用设置令牌手动覆盖（回退/旧版）
export ANTHROPIC_TOKEN=***  # 设置令牌或手动 OAuth 令牌
hermes chat --provider anthropic

# 自动检测 Claude Code 凭据（如果你已使用 Claude Code）
hermes chat --provider anthropic  # 自动读取 Claude Code 凭据文件
```

当你通过 `hermes model` 选择 Anthropic OAuth 时，Hermes 优先使用 Claude Code 自己的凭据存储，而不是将令牌复制到 `~/.hermes/.env`。这保持了可刷新的 Claude 凭据可刷新。

或永久设置：
```yaml
model:
  provider: "anthropic"
  default: "claude-sonnet-4-6"
```

:::tip 别名
`--provider claude` 和 `--provider claude-code` 也作为 `--provider anthropic` 的简写有效。
:::

### GitHub Copilot

Hermes 支持 GitHub Copilot 作为一等提供者，有两种模式：

**`copilot` — 直接 Copilot API**（推荐）。使用你的 GitHub Copilot 订阅通过 Copilot API 访问 GPT-5.x、Claude、Gemini 和其他模型。

```bash
hermes chat --provider copilot --model gpt-5.4
```

**认证选项**（按此顺序检查）：

1. `COPILOT_GITHUB_TOKEN` 环境变量
2. `GH_TOKEN` 环境变量
3. `GITHUB_TOKEN` 环境变量
4. `gh auth token` CLI 回退

如果未找到令牌，`hermes model` 提供 **OAuth 设备代码登录** — 与 Copilot CLI 和 opencode 使用的流程相同。

:::warning 令牌类型
Copilot API **不**支持经典个人访问令牌（`ghp_*`）。支持的令牌类型：

| 类型 | 前缀 | 如何获取 |
|------|--------|------------|
| OAuth 令牌 | `gho_` | `hermes model` → GitHub Copilot → 使用 GitHub 登录 |
| 细粒度 PAT | `github_pat_` | GitHub 设置 → 开发者设置 → 细粒度令牌（需要 **Copilot Requests** 权限） |
| GitHub App 令牌 | `ghu_` | 通过 GitHub App 安装 |

如果你的 `gh auth token` 返回 `ghp_*` 令牌，请改用 `hermes model` 通过 OAuth 认证。
:::

:::info Hermes 中的 Copilot 认证行为
Hermes 将支持的 GitHub 令牌（`gho_*`、`github_pat_*` 或 `ghu_*`）直接发送到 `api.githubcopilot.com`，并包含 Copilot 特定的头部（`Editor-Version`、`Copilot-Integration-Id`、`Openai-Intent`、`x-initiator`）。

在 HTTP 401 时，Hermes 现在在回退前执行一次凭据恢复：

1. 通过正常优先级链重新解析令牌（`COPILOT_GITHUB_TOKEN` → `GH_TOKEN` → `GITHUB_TOKEN` → `gh auth token`）
2. 使用刷新的头部重建共享 OpenAI 客户端
3. 重试请求一次

一些较旧的社区代理使用 `api.github.com/copilot_internal/v2/token` 交换流程。该端点对某些帐户类型可能不可用（返回 404）。因此 Hermes 保持直接令牌认证作为主要路径，并依赖运行时凭据刷新 + 重试来实现鲁棒性。
:::

**API 路由**：GPT-5+ 模型（除 `gpt-5-mini` 外）自动使用 Responses API。所有其他模型（GPT-4o、Claude、Gemini 等）使用 Chat Completions。模型从实时 Copilot 目录自动检测。

**`copilot-acp` — Copilot ACP 代理后端**。将本地 Copilot CLI 作为子进程生成：

```bash
hermes chat --provider copilot-acp --model copilot-acp
# 需要 PATH 中的 GitHub Copilot CLI 和现有的 `copilot login` 会话
```

**永久配置：**
```yaml
model:
  provider: "copilot"
  default: "gpt-5.4"
```

| 环境变量 | 描述 |
|---------------------|-------------|
| `COPILOT_GITHUB_TOKEN` | Copilot API 的 GitHub 令牌（第一优先级） |
| `HERMES_COPILOT_ACP_COMMAND` | 覆盖 Copilot CLI 二进制路径（默认：`copilot`） |
| `HERMES_COPILOT_ACP_ARGS` | 覆盖 ACP 参数（默认：`--acp --stdio`） |

### 一等中国 AI 提供者

这些提供者有内置支持和专用提供者 ID。设置 API 密钥并使用 `--provider` 选择：

```bash
# z.ai / ZhipuAI GLM
hermes chat --provider zai --model glm-5
# 需要：~/.hermes/.env 中的 GLM_API_KEY

# Kimi / Moonshot AI（国际：api.moonshot.ai）
hermes chat --provider kimi-coding --model kimi-for-coding
# 需要：~/.hermes/.env 中的 KIMI_API_KEY

# Kimi / Moonshot AI（中国：api.moonshot.cn）
hermes chat --provider kimi-coding-cn --model kimi-k2.5
# 需要：~/.hermes/.env 中的 KIMI_CN_API_KEY

# MiniMax（全球端点）
hermes chat --provider minimax --model MiniMax-M2.7
# 需要：~/.hermes/.env 中的 MINIMAX_API_KEY

# MiniMax（中国端点）
hermes chat --provider minimax-cn --model MiniMax-M2.7
# 需要：~/.hermes/.env 中的 MINIMAX_CN_API_KEY

# 阿里云 / DashScope（Qwen 模型）
hermes chat --provider alibaba --model qwen3.5-plus
# 需要：~/.hermes/.env 中的 DASHSCOPE_API_KEY

# Xiaomi MiMo
hermes chat --provider xiaomi --model mimo-v2-pro
# 需要：~/.hermes/.env 中的 XIAOMI_API_KEY

# Arcee AI（Trinity 模型）
hermes chat --provider arcee --model trinity-large-thinking
# 需要：~/.hermes/.env 中的 ARCEEAI_API_KEY
```

或在 `config.yaml` 中永久设置提供者：
```yaml
model:
  provider: "zai"       # 或：kimi-coding、kimi-coding-cn、minimax、minimax-cn、alibaba、xiaomi、arcee
  default: "glm-5"
```

基础 URL 可以通过 `GLM_BASE_URL`、`KIMI_BASE_URL`、`MINIMAX_BASE_URL`、`MINIMAX_CN_BASE_URL`、`DASHSCOPE_BASE_URL` 或 `XIAOMI_BASE_URL` 环境变量覆盖。

:::note Z.AI 端点自动检测
使用 Z.AI / GLM 提供者时，Hermes 自动探测多个端点（全球、中国、编码变体）以找到接受你的 API 密钥的端点。你不需要手动设置 `GLM_BASE_URL` — 工作端点会被自动检测和缓存。
:::

### xAI (Grok) — Responses API + 提示缓存

xAI 通过 Responses API（`codex_responses` 传输）连接，为 Grok 4 模型提供自动推理支持 — 无需 `reasoning_effort` 参数，服务器默认推理。在 `~/.hermes/.env` 中设置 `XAI_API_KEY` 并在 `hermes model` 中选择 xAI，或在 `/model grok-4-1-fast-reasoning` 中使用 `grok` 作为快捷方式。

当使用 xAI 作为提供者（任何包含 `x.ai` 的基础 URL）时，Hermes 通过在每个 API 请求中发送 `x-grok-conv-id` 头部自动启用提示缓存。这将请求路由到对话会话中的同一服务器，允许 xAI 的基础设施重用缓存的系统提示和对话历史。

无需配置 — 当检测到 xAI 端点且会话 ID 可用时，缓存自动激活。这减少了多轮对话的延迟和成本。

xAI 还附带专用的 TTS 端点（`/v1/tts`）。在 `hermes tools` → 语音和 TTS 中选择 **xAI TTS**，或参见[语音和 TTS](../user-guide/features/tts.md#text-to-speech) 页面了解配置。

### Ollama Cloud — 托管 Ollama 模型，OAuth + API 密钥

[Ollama Cloud](https://ollama.com/cloud) 托管与本地 Ollama 相同的开放权重目录，但无需 GPU。在 `hermes model` 中选择 **Ollama Cloud**，粘贴你的 API 密钥（来自 [ollama.com/settings/keys](https://ollama.com/settings/keys)），Hermes 会自动发现可用模型。

```bash
hermes model
# → 选择 "Ollama Cloud"
# → 粘贴你的 OLLAMA_API_KEY
# → 从发现的模型中选择（gpt-oss:120b、glm-4.6:cloud、qwen3-coder:480b-cloud 等）
```

或直接在 `config.yaml` 中：
```yaml
model:
  provider: "ollama-cloud"
  default: "gpt-oss:120b"
```

模型目录从 `ollama.com/v1/models` 动态获取并缓存一小时。`model:tag` 表示法（例如 `qwen3-coder:480b-cloud`）在规范化过程中保留 — 不要使用破折号。

:::tip Ollama Cloud 与本地 Ollama
两者使用相同的 OpenAI 兼容 API。Cloud 是一等提供者（`--provider ollama-cloud`、`OLLAMA_API_KEY`）；本地 Ollama 通过自定义端点流程访问（基础 URL `http://localhost:11434/v1`，无密钥）。对无法在本地运行的大模型使用云；对隐私或离线工作使用本地。
:::

### AWS Bedrock

通过 AWS Bedrock 使用 Anthropic Claude、Amazon Nova、DeepSeek v3.2、Meta Llama 4 和其他模型。使用 AWS SDK（`boto3`）凭据链 — 无需 API 密钥，只需标准 AWS 认证。

```bash
# 最简单 — ~/.aws/credentials 中的命名配置文件
hermes chat --provider bedrock --model us.anthropic.claude-sonnet-4-6

# 或使用显式环境变量
AWS_PROFILE=myprofile AWS_REGION=us-east-1 hermes chat --provider bedrock --model us.anthropic.claude-sonnet-4-6
```

或在 `config.yaml` 中永久设置：
```yaml
model:
  provider: "bedrock"
  default: "us.anthropic.claude-sonnet-4-6"
bedrock:
  region: "us-east-1"          # 或设置 AWS_REGION
  # profile: "myprofile"       # 或设置 AWS_PROFILE
  # discovery: true            # 从 IAM 自动发现区域
  # guardrail:                 # 可选的 Bedrock Guardrails
  #   id: "your-guardrail-id"
  #   version: "DRAFT"
```

认证使用标准 boto3 链：显式 `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`、来自 `~/.aws/credentials` 的 `AWS_PROFILE`、EC2/ECS/Lambda 上的 IAM 角色、IMDS 或 SSO。如果你已经通过 AWS CLI 认证，则无需环境变量。

Bedrock 在底层使用 **Converse API** — 请求被翻译为 Bedrock 的模型无关形状，因此相同的配置适用于 Claude、Nova、DeepSeek 和 Llama 模型。仅在调用非默认区域端点时设置 `BEDROCK_BASE_URL`。

参见 [AWS Bedrock 指南](/docs/guides/aws-bedrock)了解 IAM 设置、区域选择和跨区域推理的演练。

### Qwen Portal（OAuth）

阿里巴巴的 Qwen Portal，使用基于浏览器的 OAuth 登录。在 `hermes model` 中选择 **Qwen OAuth (Portal)**，通过浏览器登录，Hermes 会持久化刷新令牌。

```bash
hermes model
# → 选择 "Qwen OAuth (Portal)"
# → 浏览器打开；使用你的阿里巴巴帐户登录
# → 确认 — 凭据保存到 ~/.hermes/auth.json

hermes chat   # 使用 portal.qwen.ai/v1 端点
```

或配置 `config.yaml`：
```yaml
model:
  provider: "qwen-oauth"
  default: "qwen3-coder-plus"
```

仅在门户端点迁移时设置 `HERMES_QWEN_BASE_URL`（默认：`https://portal.qwen.ai/v1`）。

:::tip Qwen OAuth 与 DashScope（阿里云）
`qwen-oauth` 使用面向消费者的 Qwen Portal 和 OAuth 登录 — 适合个人用户。`alibaba` 提供者使用 DashScope 的企业 API 和 `DASHSCOPE_API_KEY` — 适合编程/生产工作负载。两者都路由到 Qwen 系列模型，但位于不同的端点。
:::

### NVIDIA NIM

通过 [build.nvidia.com](https://build.nvidia.com)（免费 API 密钥）或本地 NIM 端点使用 Nemotron 和其他开源模型。

```bash
# 云端（build.nvidia.com）
hermes chat --provider nvidia --model nvidia/nemotron-3-super-120b-a12b
# 需要：~/.hermes/.env 中的 NVIDIA_API_KEY

# 本地 NIM 端点 — 覆盖基础 URL
NVIDIA_BASE_URL=http://localhost:8000/v1 hermes chat --provider nvidia --model nvidia/nemotron-3-super-120b-a12b
```

或在 `config.yaml` 中永久设置：
```yaml
model:
  provider: "nvidia"
  default: "nvidia/nemotron-3-super-120b-a12b"
```

:::tip 本地 NIM
对于本地部署（DGX Spark、本地 GPU），设置 `NVIDIA_BASE_URL=http://localhost:8000/v1`。NIM 暴露与 build.nvidia.com 相同的 OpenAI 兼容聊天完成 API，因此在云端和本地之间切换只需更改一行环境变量。
:::

### Hugging Face 推理提供者

[Hugging Face 推理提供者](https://huggingface.co/docs/inference-providers)通过统一的 OpenAI 兼容端点（`router.huggingface.co/v1`）路由到 20+ 开放模型。请求自动路由到最快的可用后端（Groq、Together、SambaNova 等），并具有自动故障转移。

```bash
# 使用任何可用模型
hermes chat --provider huggingface --model Qwen/Qwen3-235B-A22B-Thinking-2507
# 需要：~/.hermes/.env 中的 HF_TOKEN

# 短别名
hermes chat --provider hf --model deepseek-ai/DeepSeek-V3.2
```

或在 `config.yaml` 中永久设置：
```yaml
model:
  provider: "huggingface"
  default: "Qwen/Qwen3-235B-A22B-Thinking-2507"
```

在 [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) 获取你的令牌 — 确保启用"Make calls to Inference Providers"权限。包含免费层（$0.10/月信用额度，提供者费率无加价）。

你可以在模型名称后附加路由后缀：`:fastest`（默认）、`:cheapest` 或 `:provider_name` 以强制使用特定后端。

基础 URL 可以通过 `HF_BASE_URL` 覆盖。

## 自定义和自托管 LLM 提供者

Hermes Agent 与**任何 OpenAI 兼容的 API 端点**兼容。如果服务器实现了 `/v1/chat/completions`，你可以将 Hermes 指向它。这意味着你可以使用本地模型、GPU 推理服务器、多提供者路由器或任何第三方 API。

### 一般设置

三种配置自定义端点的方式：

**交互式设置（推荐）：**
```bash
hermes model
# 选择 "Custom endpoint (self-hosted / VLLM / etc.)"
# 输入：API base URL、API key、Model name
```

**手动配置（`config.yaml`）：**
```yaml
# 在 ~/.hermes/config.yaml 中
model:
  default: your-model-name
  provider: custom
  base_url: http://localhost:8000/v1
  api_key: your-key-or-leave-empty-for-local
```

:::warning 旧版环境变量
`.env` 中的 `OPENAI_BASE_URL` 和 `LLM_MODEL` 已被**移除**。Hermes 的任何部分都不再读取它们 — `config.yaml` 是模型和端点配置的唯一真实来源。如果你的 `.env` 中有过时的条目，它们会在下次 `hermes setup` 或配置迁移时自动清除。使用 `hermes model` 或直接编辑 `config.yaml`。
:::

两种方法都持久化到 `config.yaml`，它是模型、提供者和基础 URL 的真实来源。

### 使用 `/model` 切换模型

:::warning hermes model 与 /model
**`hermes model`**（从终端运行，在任何聊天会话之外）是**完整的提供者设置向导**。使用它添加新提供者、运行 OAuth 流程、输入 API 密钥和配置自定义端点。

**`/model`**（在活跃的 Hermes 聊天会话中输入）只能**在你已经设置好的提供者和模型之间切换**。它不能添加新提供者、运行 OAuth 或提示输入 API 密钥。如果你只配置了一个提供者（例如 OpenRouter），`/model` 将只显示该提供者的模型。

**要添加新提供者：** 退出会话（`Ctrl+C` 或 `/quit`），运行 `hermes model`，设置新提供者，然后启动新会话。
:::

一旦你配置了至少一个自定义端点，你可以在会话中切换模型：

```
/model custom:qwen-2.5          # 切换到自定义端点上的模型
/model custom                    # 从端点自动检测模型
/model openrouter:claude-sonnet-4 # 切换回云提供者
```

如果你配置了**命名自定义提供者**（见下文），使用三重语法：

```
/model custom:local:qwen-2.5    # 使用 "local" 自定义提供者和 qwen-2.5 模型
/model custom:work:llama3       # 使用 "work" 自定义提供者和 llama3
```

切换提供者时，Hermes 将基础 URL 和提供者持久化到配置中，以便更改在重启后仍然有效。当从自定义端点切换到内置提供者时，过时的基础 URL 会被自动清除。

:::tip
`/model custom`（裸，无模型名称）查询你端点的 `/models` API，如果只加载了一个模型则自动选择。适用于运行单个模型的本地服务器。
:::

以下所有内容都遵循相同的模式 — 只需更改 URL、密钥和模型名称。

---

### Ollama — 本地模型，零配置

[Ollama](https://ollama.com/) 用一个命令在本地运行开放权重模型。最适合：快速本地实验、隐私敏感工作、离线使用。通过 OpenAI 兼容 API 支持工具调用。

```bash
# 安装并运行模型
ollama pull qwen2.5-coder:32b
ollama serve   # 在端口 11434 上启动
```

然后配置 Hermes：

```bash
hermes model
# 选择 "Custom endpoint (self-hosted / VLLM / etc.)"
# 输入 URL: http://localhost:11434/v1
# 跳过 API 密钥（Ollama 不需要）
# 输入模型名称（例如 qwen2.5-coder:32b）
```

或直接配置 `config.yaml`：

```yaml
model:
  default: qwen2.5-coder:32b
  provider: custom
  base_url: http://localhost:11434/v1
  context_length: 32768   # 见下方警告
```

:::caution Ollama 默认上下文长度非常低
Ollama **不**默认使用模型的完整上下文窗口。根据你的 VRAM，默认值为：

| 可用 VRAM | 默认上下文 |
|----------------|----------------|
| 少于 24 GB | **4,096 tokens** |
| 24-48 GB | 32,768 tokens |
| 48+ GB | 256,000 tokens |

对于使用工具的代理，**你至少需要 16k-32k 上下文**。在 4k 时，仅系统提示 + 工具架构就可以填满窗口，没有空间进行对话。

**如何增加**（选择一个）：

```bash
# 选项 1：通过环境变量服务器范围设置（推荐）
OLLAMA_CONTEXT_LENGTH=32768 ollama serve

# 选项 2：对于 systemd 管理的 Ollama
sudo systemctl edit ollama.service
# 添加：Environment="OLLAMA_CONTEXT_LENGTH=32768"
# 然后：sudo systemctl daemon-reload && sudo systemctl restart ollama

# 选项 3：将其烘焙到自定义模型中（每个模型持久化）
echo -e "FROM qwen2.5-coder:32b\nPARAMETER num_ctx 32768" > Modelfile
ollama create qwen2.5-coder-32k -f Modelfile
```

**你不能通过 OpenAI 兼容 API 设置上下文长度**（`/v1/chat/completions`）。它必须在服务器端或通过 Modelfile 配置。这是将 Ollama 与 Hermes 等工具集成时的第一大困惑来源。
:::

**验证你的上下文设置正确：**

```bash
ollama ps
# 查看 CONTEXT 列 — 它应该显示你配置的值
```

:::tip
使用 `ollama list` 列出可用模型。使用 `ollama pull <model>` 从 [Ollama 库](https://ollama.com/library) 拉取任何模型。Ollama 自动处理 GPU 卸载 — 大多数设置无需配置。
:::

---

### vLLM — 高性能 GPU 推理

[vLLM](https://docs.vllm.ai/) 是生产 LLM 服务的标准。最适合：GPU 硬件上的最大吞吐量、提供大模型服务、连续批处理。

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
  --port 8000 \
  --max-model-len 65536 \
  --tensor-parallel-size 2 \
  --enable-auto-tool-choice \
  --tool-call-parser hermes
```

然后配置 Hermes：

```bash
hermes model
# 选择 "Custom endpoint (self-hosted / VLLM / etc.)"
# 输入 URL: http://localhost:8000/v1
# 跳过 API 密钥（或如果配置了 --api-key 则输入）
# 输入模型名称: meta-llama/Llama-3.1-70B-Instruct
```

**上下文长度：** vLLM 默认读取模型的 `max_position_embeddings`。如果超过你的 GPU 内存，它会报错并要求你设置更低的 `--max-model-len`。你也可以使用 `--max-model-len auto` 自动找到适合的最大值。设置 `--gpu-memory-utilization 0.95`（默认 0.9）以在 VRAM 中挤出更多上下文。

**工具调用需要显式标志：**

| 标志 | 用途 |
|------|---------|
| `--enable-auto-tool-choice` | `tool_choice: "auto"`（Hermes 中的默认值）必需 |
| `--tool-call-parser <名称>` | 模型工具调用格式的解析器 |

支持的解析器：`hermes`（Qwen 2.5、Hermes 2/3）、`llama3_json`（Llama 3.x）、`mistral`、`deepseek_v3`、`deepseek_v31`、`xlam`、`pythonic`。没有这些标志，工具调用将无法工作 — 模型会将工具调用作为文本输出。

:::tip
vLLM 支持人类可读的大小：`--max-model-len 64k`（小写 k = 1000，大写 K = 1024）。
:::

---

### SGLang — 使用 RadixAttention 的快速服务

[SGLang](https://github.com/sgl-project/sglang) 是 vLLM 的替代方案，具有 RadixAttention 用于 KV 缓存重用。最适合：多轮对话（前缀缓存）、约束解码、结构化输出。

```bash
pip install "sglang[all]"
python -m sglang.launch_server \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --port 30000 \
  --context-length 65536 \
  --tp 2 \
  --tool-call-parser qwen
```

然后配置 Hermes：

```bash
hermes model
# 选择 "Custom endpoint (self-hosted / VLLM / etc.)"
# 输入 URL: http://localhost:30000/v1
# 输入模型名称: meta-llama/Llama-3.1-70B-Instruct
```

**上下文长度：** SGLang 默认从模型的配置读取。使用 `--context-length` 覆盖。如果需要超过模型声明的最大值，设置 `SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1`。

**工具调用：** 使用 `--tool-call-parser` 和适合你模型系列的解析器：`qwen`（Qwen 2.5）、`llama3`、`llama4`、`deepseekv3`、`mistral`、`glm`。没有此标志，工具调用会作为纯文本返回。

:::caution SGLang 默认最大输出 128 个令牌
如果响应看起来被截断，在请求中添加 `max_tokens` 或在服务器上设置 `--default-max-tokens`。如果未在请求中指定，SGLang 的默认值仅为每个响应 128 个令牌。
:::

---

### llama.cpp / llama-server — CPU 和 Metal 推理

[llama.cpp](https://github.com/ggml-org/llama.cpp) 在 CPU、Apple Silicon（Metal）和消费级 GPU 上运行量化模型。最适合：在没有数据中心 GPU 的情况下运行模型、Mac 用户、边缘部署。

```bash
# 构建并启动 llama-server
cmake -B build && cmake --build build --config Release
./build/bin/llama-server \
  --jinja -fa \
  -c 32768 \
  -ngl 99 \
  -m models/qwen2.5-coder-32b-instruct-Q4_K_M.gguf \
  --port 8080 --host 0.0.0.0
```

**上下文长度（`-c`）：** 最近的构建默认为 `0`，从 GGUF 元数据读取模型的训练上下文。对于 128k+ 训练上下文的模型，尝试分配完整 KV 缓存可能会 OOM。将 `-c` 显式设置为你需要的值（32k-64k 是代理使用的良好范围）。如果使用并行槽（`-np`），总上下文在槽之间分配 — 使用 `-c 32768 -np 4`，每个槽只得到 8k。

然后配置 Hermes 指向它：

```bash
hermes model
# 选择 "Custom endpoint (self-hosted / VLLM / etc.)"
# 输入 URL: http://localhost:8080/v1
# 跳过 API 密钥（本地服务器不需要）
# 输入模型名称 — 或留空以自动检测（如果只加载了一个模型）
```

这会将端点保存到 `config.yaml`，以便跨会话持久化。

:::caution 工具调用需要 `--jinja`
没有 `--jinja`，llama-server 会完全忽略 `tools` 参数。模型会尝试通过在响应文本中编写 JSON 来调用工具，但 Hermes 不会将其识别为工具调用 — 你会看到原始 JSON 如 `{"name": "web_search", ...}` 作为消息打印出来，而不是实际的搜索。

原生工具调用支持（最佳性能）：Llama 3.x、Qwen 2.5（包括 Coder）、Hermes 2/3、Mistral、DeepSeek、Functionary。所有其他模型使用通用处理器，可以工作但可能效率较低。参见 [llama.cpp 函数调用文档](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md) 了解完整列表。

你可以通过检查 `http://localhost:8080/props` 验证工具支持是否激活 — `chat_template` 字段应该存在。
:::

:::tip
从 [Hugging Face](https://huggingface.co/models?library=gguf) 下载 GGUF 模型。Q4_K_M 量化提供质量和内存使用的最佳平衡。
:::

---

### LM Studio — 带本地模型的桌面应用

[LM Studio](https://lmstudio.ai/) 是一个用于使用 GUI 运行本地模型的桌面应用。最适合：喜欢可视界面的用户、快速模型测试、macOS/Windows/Linux 上的开发者。

从 LM Studio 应用启动服务器（Developer 标签 → Start Server），或使用 CLI：

```bash
lms server start                        # 在端口 1234 上启动
lms load qwen2.5-coder --context-length 32768
```

然后配置 Hermes：

```bash
hermes model
# 选择 "Custom endpoint (self-hosted / VLLM / etc.)"
# 输入 URL: http://localhost:1234/v1
# 跳过 API 密钥（LM Studio 不需要）
# 输入模型名称
```

:::caution 上下文长度通常默认为 2048
LM Studio 从模型的元数据读取上下文长度，但许多 GGUF 模型报告低默认值（2048 或 4096）。**始终在 LM Studio 模型设置中显式设置上下文长度**：

1. 点击模型选择器旁边的齿轮图标
2. 将"Context Length"设置为至少 16384（最好 32768）
3. 重新加载模型使更改生效

或者，使用 CLI：`lms load model-name --context-length 32768`

要设置持久的每模型默认值：My Models 标签 → 模型上的齿轮图标 → 设置上下文大小。
:::

**工具调用：** 自 LM Studio 0.3.6 起支持。具有原生工具调用训练的模型（Qwen 2.5、Llama 3.x、Mistral、Hermes）会被自动检测并显示工具徽章。其他模型使用通用回退，可能不太可靠。

---

### WSL2 网络（Windows 用户）

由于 Hermes Agent 需要 Unix 环境，Windows 用户在 WSL2 中运行它。如果你的模型服务器（Ollama、LM Studio 等）在 **Windows 主机** 上运行，你需要桥接网络差距 — WSL2 使用具有自己子网的虚拟网络适配器，因此 WSL2 内的 `localhost` 指的是 Linux VM，**不是** Windows 主机。

:::tip 都在 WSL2 中？没问题。
如果你的模型服务器也在 WSL2 中运行（vLLM、SGLang 和 llama-server 常见），`localhost` 按预期工作 — 它们共享相同的网络命名空间。跳过此部分。
:::

#### 选项 1：镜像网络模式（推荐）

在 **Windows 11 22H2+** 上可用，镜像模式使 `localhost` 在 Windows 和 WSL2 之间双向工作 — 最简单的修复。

1. 创建或编辑 `%USERPROFILE%\.wslconfig`（例如 `C:\Users\YourName\.wslconfig`）：
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```

2. 从 PowerShell 重启 WSL：
   ```powershell
   wsl --shutdown
   ```

3. 重新打开 WSL2 终端。`localhost` 现在可以到达 Windows 服务：
   ```bash
   curl http://localhost:11434/v1/models   # Windows 上的 Ollama — 有效
   ```

:::note Hyper-V 防火墙
在某些 Windows 11 版本上，Hyper-V 防火墙默认阻止镜像连接。如果启用镜像模式后 `localhost` 仍然不起作用，在**管理员 PowerShell** 中运行：
```powershell
Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
```
:::

#### 选项 2：使用 Windows 主机 IP（Windows 10 / 旧版本）

如果无法使用镜像模式，从 WSL2 内部找到 Windows 主机 IP 并使用它代替 `localhost`：

```bash
# 获取 Windows 主机 IP（WSL2 虚拟网络的默认网关）
ip route show | grep -i default | awk '{ print $3 }'
# 示例输出：172.29.192.1
```

在 Hermes 配置中使用该 IP：

```yaml
model:
  default: qwen2.5-coder:32b
  provider: custom
  base_url: http://172.29.192.1:11434/v1   # Windows 主机 IP，不是 localhost
```

:::tip 动态助手
主机 IP 可能在 WSL2 重启时改变。你可以在 shell 中动态获取它：
```bash
export WSL_HOST=$(ip route show | grep -i default | awk '{ print $3 }')
echo "Windows host at: $WSL_HOST"
curl http://$WSL_HOST:11434/v1/models   # 测试 Ollama
```

或使用你的机器的 mDNS 名称（需要 WSL2 中的 `libnss-mdns`）：
```bash
sudo apt install libnss-mdns
curl http://$(hostname).local:11434/v1/models
```
:::

#### 服务器绑定地址（NAT 模式必需）

如果你使用**选项 2**（NAT 模式和主机 IP），Windows 上的模型服务器必须接受来自 `127.0.0.1` 以外的连接。默认情况下，大多数服务器只监听 localhost — NAT 模式下的 WSL2 连接来自不同的虚拟子网，会被拒绝。在镜像模式下，`localhost` 直接映射，因此默认的 `127.0.0.1` 绑定工作正常。

| 服务器 | 默认绑定 | 如何修复 |
|--------|-------------|------------|
| **Ollama** | `127.0.0.1` | 在启动 Ollama 前设置 `OLLAMA_HOST=0.0.0.0` 环境变量（Windows 上的系统设置 → 环境变量，或编辑 Ollama 服务） |
| **LM Studio** | `127.0.0.1` | 在 Developer 标签 → Server 设置中启用 **"Serve on Network"** |
| **llama-server** | `127.0.0.1` | 在启动命令中添加 `--host 0.0.0.0` |
| **vLLM** | `0.0.0.0` | 默认已绑定到所有接口 |
| **SGLang** | `127.0.0.1` | 在启动命令中添加 `--host 0.0.0.0` |

**Windows 上的 Ollama（详细）：** Ollama 作为 Windows 服务运行。要设置 `OLLAMA_HOST`：
1. 打开**系统属性** → **环境变量**
2. 添加新的**系统变量**：`OLLAMA_HOST` = `0.0.0.0`
3. 重启 Ollama 服务（或重启）

#### Windows 防火墙

Windows 防火墙将 WSL2 视为单独的网络（在 NAT 和镜像模式下）。如果在上述步骤后连接仍然失败，为你的模型服务器端口添加防火墙规则：

```powershell
# 在管理员 PowerShell 中运行 — 将 PORT 替换为你的服务器端口
New-NetFirewallRule -DisplayName "Allow WSL2 to Model Server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 11434
```

常见端口：Ollama `11434`、vLLM `8000`、SGLang `30000`、llama-server `8080`、LM Studio `1234`。

#### 快速验证

从 WSL2 内部测试你是否可以到达模型服务器：

```bash
# 将 URL 替换为你的服务器地址和端口
curl http://localhost:11434/v1/models          # 镜像模式
curl http://172.29.192.1:11434/v1/models       # NAT 模式（使用你的实际主机 IP）
```

如果你得到列出模型的 JSON 响应，就可以了。使用相同的 URL 作为 Hermes 配置中的 `base_url`。

---

### 本地模型故障排除

这些问题影响与 Hermes 一起使用的**所有**本地推理服务器。

#### 从 WSL2 到 Windows 托管模型服务器的"Connection refused"

如果你在 WSL2 中运行 Hermes，模型服务器在 Windows 主机上，`http://localhost:<port>` 在 WSL2 的默认 NAT 网络模式下不起作用。参见上面的 [WSL2 网络](#wsl2-网络windows-用户) 了解修复方法。

#### 工具调用作为文本而不是执行

模型输出类似 `{"name": "web_search", "arguments": {...}}` 作为消息，而不是实际调用工具。

**原因：** 你的服务器没有启用工具调用，或者模型不支持服务器的工具调用实现。

| 服务器 | 修复 |
|--------|-----|
| **llama.cpp** | 在启动命令中添加 `--jinja` |
| **vLLM** | 添加 `--enable-auto-tool-choice --tool-call-parser hermes` |
| **SGLang** | 添加 `--tool-call-parser qwen`（或适当的解析器） |
| **Ollama** | 工具调用默认启用 — 确保你的模型支持它（使用 `ollama show model-name` 检查） |
| **LM Studio** | 更新到 0.3.6+ 并使用具有原生工具支持的模型 |

#### 模型似乎忘记上下文或给出不连贯的响应

**原因：** 上下文窗口太小。当对话超过上下文限制时，大多数服务器静默丢弃旧消息。Hermes 的系统提示 + 工具架构本身就可能使用 4k-8k 个令牌。

**诊断：**

```bash
# 检查 Hermes 认为上下文是多少
# 查看启动行："Context limit: X tokens"

# 检查服务器的实际上下文
# Ollama: ollama ps（CONTEXT 列）
# llama.cpp: curl http://localhost:8080/props | jq '.default_generation_settings.n_ctx'
# vLLM: 检查启动参数中的 --max-model-len
```

**修复：** 为代理使用将上下文设置为至少 **32,768 个令牌**。参见上面各服务器的部分了解具体标志。

#### 启动时"Context limit: 2048 tokens"

Hermes 从服务器的 `/v1/models` 端点自动检测上下文长度。如果服务器报告低值（或根本不报告），Hermes 使用模型声明的限制，可能是错误的。

**修复：** 在 `config.yaml` 中显式设置：

```yaml
model:
  default: your-model
  provider: custom
  base_url: http://localhost:11434/v1
  context_length: 32768
```

#### 响应在句子中间被截断

**可能原因：**
1. **服务器上的低输出上限（`max_tokens`）** — SGLang 默认每个响应 128 个令牌。在服务器上设置 `--default-max-tokens` 或在 config.yaml 中配置 Hermes 的 `model.max_tokens`。注意：`max_tokens` 仅控制响应长度 — 它与你的对话历史可以多长无关（那是 `context_length`）。
2. **上下文耗尽** — 模型填满了上下文窗口。增加 `model.context_length` 或在 Hermes 中启用[上下文压缩](/docs/user-guide/configuration#context-compression)。

---

### LiteLLM 代理 — 多提供者网关

[LiteLLM](https://docs.litellm.ai/) 是一个 OpenAI 兼容代理，将 100+ LLM 提供者统一在一个 API 后面。最适合：无需配置更改即可在提供者之间切换、负载均衡、回退链、预算控制。

```bash
# 安装并启动
pip install "litellm[proxy]"
litellm --model anthropic/claude-sonnet-4 --port 4000

# 或使用配置文件配置多个模型：
litellm --config litellm_config.yaml --port 4000
```

然后使用 `hermes model` → 自定义端点 → `http://localhost:4000/v1` 配置 Hermes。

带回退的示例 `litellm_config.yaml`：
```yaml
model_list:
  - model_name: "best"
    litellm_params:
      model: anthropic/claude-sonnet-4
      api_key: sk-ant-...
  - model_name: "best"
    litellm_params:
      model: openai/gpt-4o
      api_key: sk-...
router_settings:
  routing_strategy: "latency-based-routing"
```

---

### ClawRouter — 成本优化路由

[ClawRouter](https://github.com/BlockRunAI/ClawRouter) 由 BlockRunAI 开发，是一个本地路由代理，根据查询复杂度自动选择模型。它跨 14 个维度对请求进行分类，并路由到可以处理任务的最便宜模型。通过 USDC 加密货币支付（无 API 密钥）。

```bash
# 安装并启动
npx @blockrun/clawrouter    # 在端口 8402 上启动
```

然后使用 `hermes model` → 自定义端点 → `http://localhost:8402/v1` → 模型名称 `blockrun/auto` 配置 Hermes。

路由配置：
| 配置 | 策略 | 节省 |
|---------|----------|---------|
| `blockrun/auto` | 平衡质量/成本 | 74-100% |
| `blockrun/eco` | 最便宜 | 95-100% |
| `blockrun/premium` | 最佳质量模型 | 0% |
| `blockrun/free` | 仅免费模型 | 100% |
| `blockrun/agentic` | 针对工具使用优化 | 视情况而定 |

:::note
ClawRouter 需要在 Base 或 Solana 上有 USDC 资金的钱包进行支付。所有请求通过 BlockRun 的后端 API 路由。运行 `npx @blockrun/clawrouter doctor` 检查钱包状态。
:::

---

### 其他兼容提供者

任何具有 OpenAI 兼容 API 的服务都可以工作。一些流行的选择：

| 提供者 | 基础 URL | 说明 |
|----------|----------|-------|
| [Together AI](https://together.ai) | `https://api.together.xyz/v1` | 云托管的开放模型 |
| [Groq](https://groq.com) | `https://api.groq.com/openai/v1` | 超快推理 |
| [DeepSeek](https://deepseek.com) | `https://api.deepseek.com/v1` | DeepSeek 模型 |
| [Fireworks AI](https://fireworks.ai) | `https://api.fireworks.ai/inference/v1` | 快速开放模型托管 |
| [GMI Cloud](https://www.gmicloud.ai/) | `https://api.gmi-serving.com/v1` | 托管 OpenAI 兼容推理 |
| [Cerebras](https://cerebras.ai) | `https://api.cerebras.ai/v1` | 晶圆级芯片推理 |
| [Mistral AI](https://mistral.ai) | `https://api.mistral.ai/v1` | Mistral 模型 |
| [OpenAI](https://openai.com) | `https://api.openai.com/v1` | 直接 OpenAI 访问 |
| [Azure OpenAI](https://azure.microsoft.com) | `https://YOUR.openai.azure.com/` | 企业 OpenAI |
| [LocalAI](https://localai.io) | `http://localhost:8080/v1` | 自托管，多模型 |
| [Jan](https://jan.ai) | `http://localhost:1337/v1` | 带本地模型的桌面应用 |

使用 `hermes model` → 自定义端点配置其中任何一个，或在 `config.yaml` 中：

```yaml
model:
  default: meta-llama/Llama-3.1-70B-Instruct-Turbo
  provider: custom
  base_url: https://api.together.xyz/v1
  api_key: your-together-key
```

---

### 上下文长度检测

:::note 两个设置，容易混淆
**`context_length`** 是**总上下文窗口** — 输入*和*输出令牌的组合预算（例如 Claude Opus 4.6 的 200,000）。Hermes 使用它来决定何时压缩历史和验证 API 请求。

**`model.max_tokens`** 是**输出上限** — 模型在*单次响应*中可以生成的最大令牌数。它与你的对话历史可以多长无关。行业标准名称 `max_tokens` 是常见的困惑来源；Anthropic 的原生 API 为了清晰起见已将其重命名为 `max_output_tokens`。

当自动检测得到错误的窗口大小时设置 `context_length`。
仅在需要限制单个响应长度时设置 `model.max_tokens`。
:::

Hermes 使用多源解析链来检测你的模型和提供者的正确上下文窗口：

1. **配置覆盖** — config.yaml 中的 `model.context_length`（最高优先级）
2. **自定义提供者每模型** — `custom_providers[].models.<id>.context_length`
3. **持久缓存** — 之前发现的值（重启后仍然有效）
4. **端点 `/models`** — 查询你服务器的 API（本地/自定义端点）
5. **Anthropic `/v1/models`** — 查询 Anthropic API 的 `max_input_tokens`（仅 API 密钥用户）
6. **OpenRouter API** — 来自 OpenRouter 的实时模型元数据
7. **Nous Portal** — 将 Nous 模型 ID 与 OpenRouter 元数据进行后缀匹配
8. **[models.dev](https://models.dev)** — 社区维护的注册表，包含 100+ 提供者的 3800+ 模型的提供者特定上下文长度
9. **回退默认值** — 广泛的模型系列模式（128K 默认）

对于大多数设置，这开箱即用。系统是提供者感知的 — 同一模型根据谁提供服务可以有不同的上下文限制（例如，`claude-opus-4.6` 在 Anthropic 直接是 1M，但在 GitHub Copilot 是 128K）。

要显式设置上下文长度，在模型配置中添加 `context_length`：

```yaml
model:
  default: "qwen3.5:9b"
  base_url: "http://localhost:8080/v1"
  context_length: 131072  # tokens
```

对于自定义端点，你也可以按模型设置上下文长度：

```yaml
custom_providers:
  - name: "My Local LLM"
    base_url: "http://localhost:11434/v1"
    models:
      qwen3.5:27b:
        context_length: 32768
      deepseek-r1:70b:
        context_length: 65536
```

`hermes model` 在配置自定义端点时会提示上下文长度。留空以自动检测。

:::tip 何时手动设置
- 你使用 Ollama 并设置了低于模型最大值的自定义 `num_ctx`
- 你想将上下文限制在模型最大值以下（例如在 128k 模型上使用 8k 以节省 VRAM）
- 你在不暴露 `/v1/models` 的代理后面运行
:::

---

### 命名自定义提供者

如果你使用多个自定义端点（例如本地开发服务器和远程 GPU 服务器），你可以在 `config.yaml` 中将它们定义为命名自定义提供者：

```yaml
custom_providers:
  - name: local
    base_url: http://localhost:8080/v1
    # 省略 api_key — Hermes 对无密钥本地服务器使用 "no-key-required"
  - name: work
    base_url: https://gpu-server.internal.corp/v1
    key_env: CORP_API_KEY
    api_mode: chat_completions   # 可选，从 URL 自动检测
  - name: anthropic-proxy
    base_url: https://proxy.example.com/anthropic
    key_env: ANTHROPIC_PROXY_KEY
    api_mode: anthropic_messages  # 用于 Anthropic 兼容代理
```

在会话中使用三重语法在它们之间切换：

```
/model custom:local:qwen-2.5       # 使用 "local" 端点和 qwen-2.5
/model custom:work:llama3-70b      # 使用 "work" 端点和 llama3-70b
/model custom:anthropic-proxy:claude-sonnet-4  # 使用代理
```

你也可以从交互式 `hermes model` 菜单中选择命名自定义提供者。

---

### 选择正确的设置

| 用例 | 推荐 |
|----------|-------------|
| **只想要它工作** | OpenRouter（默认）或 Nous Portal |
| **本地模型，简单设置** | Ollama |
| **生产 GPU 服务** | vLLM 或 SGLang |
| **Mac / 无 GPU** | Ollama 或 llama.cpp |
| **多提供者路由** | LiteLLM 代理或 OpenRouter |
| **成本优化** | ClawRouter 或带 `sort: "price"` 的 OpenRouter |
| **最大隐私** | Ollama、vLLM 或 llama.cpp（完全本地） |
| **企业 / Azure** | 带自定义端点的 Azure OpenAI |
| **中国 AI 模型** | z.ai (GLM)、Kimi/Moonshot（`kimi-coding` 或 `kimi-coding-cn`）、MiniMax 或 Xiaomi MiMo（一等提供者） |

:::tip
你可以随时使用 `hermes model` 在提供者之间切换 — 无需重启。无论你使用哪个提供者，你的对话历史、记忆和技能都会延续。
:::

## 可选 API 密钥

| 功能 | 提供者 | 环境变量 |
|---------|----------|--------------|
| 网络抓取 | [Firecrawl](https://firecrawl.dev/) | `FIRECRAWL_API_KEY`、`FIRECRAWL_API_URL` |
| 浏览器自动化 | [Browserbase](https://browserbase.com/) | `BROWSERBASE_API_KEY`、`BROWSERBASE_PROJECT_ID` |
| 图像生成 | [FAL](https://fal.ai/) | `FAL_KEY` |
| 高级 TTS 语音 | [ElevenLabs](https://elevenlabs.io/) | `ELEVENLABS_API_KEY` |
| OpenAI TTS + 语音转录 | [OpenAI](https://platform.openai.com/api-keys) | `VOICE_TOOLS_OPENAI_KEY` |
| Mistral TTS + 语音转录 | [Mistral](https://console.mistral.ai/) | `MISTRAL_API_KEY` |
| RL 训练 | [Tinker](https://tinker-console.thinkingmachines.ai/) + [WandB](https://wandb.ai/) | `TINKER_API_KEY`、`WANDB_API_KEY` |
| 跨会话用户建模 | [Honcho](https://honcho.dev/) | `HONCHO_API_KEY` |
| 语义长期记忆 | [Supermemory](https://supermemory.ai) | `SUPERMEMORY_API_KEY` |

### 自托管 Firecrawl

默认情况下，Hermes 使用 [Firecrawl 云 API](https://firecrawl.dev/) 进行网络搜索和抓取。如果你更喜欢在本地运行 Firecrawl，可以将 Hermes 指向自托管实例。参见 Firecrawl 的 [SELF_HOST.md](https://github.com/firecrawl/firecrawl/blob/main/SELF_HOST.md) 了解完整的设置说明。

**你获得什么：** 无需 API 密钥、无速率限制、无按页成本、完全数据主权。

**你失去什么：** 云版本使用 Firecrawl 专有的"Fire-engine"进行高级反机器人绕过（Cloudflare、CAPTCHA、IP 轮换）。自托管使用基本的 fetch + Playwright，因此某些受保护的站点可能会失败。搜索使用 DuckDuckGo 而不是 Google。

**设置：**

1. 克隆并启动 Firecrawl Docker 堆栈（5 个容器：API、Playwright、Redis、RabbitMQ、PostgreSQL — 需要约 4-8 GB RAM）：
   ```bash
   git clone https://github.com/firecrawl/firecrawl
   cd firecrawl
   # 在 .env 中设置：USE_DB_AUTHENTICATION=false、HOST=0.0.0.0、PORT=3002
   docker compose up -d
   ```

2. 将 Hermes 指向你的实例（无需 API 密钥）：
   ```bash
   hermes config set FIRECRAWL_API_URL http://localhost:3002
   ```

如果你的自托管实例启用了认证，你也可以同时设置 `FIRECRAWL_API_KEY` 和 `FIRECRAWL_API_URL`。

## OpenRouter 提供者路由

使用 OpenRouter 时，你可以控制请求如何在提供者之间路由。在 `~/.hermes/config.yaml` 中添加 `provider_routing` 部分：

```yaml
provider_routing:
  sort: "throughput"          # "price"（默认）、"throughput" 或 "latency"
  # only: ["anthropic"]      # 仅使用这些提供者
  # ignore: ["deepinfra"]    # 跳过这些提供者
  # order: ["anthropic", "google"]  # 按此顺序尝试提供者
  # require_parameters: true  # 仅使用支持所有请求参数的提供者
  # data_collection: "deny"   # 排除可能存储/训练数据的提供者
```

**快捷方式：** 在任何模型名称后附加 `:nitro` 进行吞吐量排序（例如 `anthropic/claude-sonnet-4:nitro`），或 `:floor` 进行价格排序。

## 回退模型

配置一个备用 provider:model，当主模型失败（速率限制、服务器错误、认证失败）时 Hermes 自动切换到：

```yaml
fallback_model:
  provider: openrouter                    # 必需
  model: anthropic/claude-sonnet-4        # 必需
  # base_url: http://localhost:8000/v1    # 可选，用于自定义端点
  # key_env: MY_CUSTOM_KEY               # 可选，自定义端点 API 密钥的环境变量名
```

激活时，回退在会话中切换模型和提供者而不丢失对话。每个会话**最多触发一次**。

支持的提供者：`openrouter`、`nous`、`openai-codex`、`copilot`、`copilot-acp`、`anthropic`、`gemini`、`google-gemini-cli`、`qwen-oauth`、`huggingface`、`zai`、`kimi-coding`、`kimi-coding-cn`、`minimax`、`minimax-cn`、`deepseek`、`nvidia`、`xai`、`ollama-cloud`、`bedrock`、`ai-gateway`、`opencode-zen`、`opencode-go`、`kilocode`、`xiaomi`、`arcee`、`alibaba`、`custom`。

:::tip
回退完全通过 `config.yaml` 配置 — 没有环境变量。有关何时触发、支持的提供者以及它如何与辅助任务和委派交互的完整详情，请参阅[回退提供者](/docs/user-guide/features/fallback-providers)。
:::

---

## 另请参阅

- [配置](/docs/user-guide/configuration) — 一般配置（目录结构、配置优先级、终端后端、记忆、压缩等）
- [环境变量](/docs/reference/environment-variables) — 所有环境变量的完整参考
