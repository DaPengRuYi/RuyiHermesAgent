---
title: 提供商路由
description: 配置 OpenRouter 提供商偏好以优化成本、速度或质量。
sidebar_label: 提供商路由
sidebar_position: 7
---

# 提供商路由

使用 [OpenRouter](https://openrouter.ai) 作为 LLM 提供商时，Hermes Agent 支持**提供商路由**——精细控制哪些底层 AI 提供商处理你的请求以及它们的优先级。

OpenRouter 将请求路由到许多提供商（例如 Anthropic、Google、AWS Bedrock、Together AI）。提供商路由让你优化成本、速度、质量，或强制执行特定提供商要求。

## 配置

在 `~/.hermes/config.yaml` 中添加 `provider_routing` 部分：

```yaml
provider_routing:
  sort: "price"           # 如何对提供商排名
  only: []                # 白名单：仅使用这些提供商
  ignore: []              # 黑名单：永不使用这些提供商
  order: []               # 显式提供商优先顺序
  require_parameters: false  # 仅使用支持所有参数的提供商
  data_collection: null   # 控制数据收集（"allow" 或 "deny"）
```

:::info
提供商路由仅在使用 OpenRouter 时适用。对直接提供商连接（例如直接连接 Anthropic API）无效。
:::

## 选项

### `sort`

控制 OpenRouter 如何为你的请求对可用提供商排名。

| 值 | 描述 |
|----|------|
| `"price"` | 最便宜的提供商优先 |
| `"throughput"` | 最快的令牌/秒优先 |
| `"latency"` | 最低的首令牌时间优先 |

```yaml
provider_routing:
  sort: "price"
```

### `only`

提供商名称白名单。设置时，**仅**使用这些提供商。所有其他被排除。

```yaml
provider_routing:
  only:
    - "Anthropic"
    - "Google"
```

### `ignore`

提供商名称黑名单。这些提供商**永不**被使用，即使它们提供最便宜或最快的选项。

```yaml
provider_routing:
  ignore:
    - "Together"
    - "DeepInfra"
```

### `order`

显式优先顺序。列出的提供商优先。未列出的提供商作为回退使用。

```yaml
provider_routing:
  order:
    - "Anthropic"
    - "Google"
    - "AWS Bedrock"
```

### `require_parameters`

为 `true` 时，OpenRouter 仅路由到支持你请求中**所有**参数的提供商（如 `temperature`、`top_p`、`tools` 等）。这避免静默参数丢弃。

```yaml
provider_routing:
  require_parameters: true
```

### `data_collection`

控制提供商是否可以将你的提示用于训练。选项为 `"allow"` 或 `"deny"`。

```yaml
provider_routing:
  data_collection: "deny"
```

## 实际示例

### 优化成本

路由到最便宜的可用提供商。适合大量使用和开发：

```yaml
provider_routing:
  sort: "price"
```

### 优化速度

优先低延迟提供商用于交互式使用：

```yaml
provider_routing:
  sort: "latency"
```

### 优化吞吐量

最适合令牌/秒重要的长文本生成：

```yaml
provider_routing:
  sort: "throughput"
```

### 锁定到特定提供商

确保所有请求通过特定提供商以保持一致性：

```yaml
provider_routing:
  only:
    - "Anthropic"
```

### 避免特定提供商

排除你不想使用的提供商（例如出于数据隐私）：

```yaml
provider_routing:
  ignore:
    - "Together"
    - "Lepton"
  data_collection: "deny"
```

### 首选顺序带回退

首先尝试首选提供商，不可用时回退到其他：

```yaml
provider_routing:
  order:
    - "Anthropic"
    - "Google"
  require_parameters: true
```

## 工作原理

提供商路由偏好通过每次 API 调用的 `extra_body.provider` 字段传递给 OpenRouter API。这适用于：

- **CLI 模式** — 在 `~/.hermes/config.yaml` 中配置，启动时加载
- **网关模式** — 相同配置文件，网关启动时加载

路由配置从 `config.yaml` 读取，创建 `AIAgent` 时作为参数传递：

```
providers_allowed  ← 来自 provider_routing.only
providers_ignored  ← 来自 provider_routing.ignore
providers_order    ← 来自 provider_routing.order
provider_sort      ← 来自 provider_routing.sort
provider_require_parameters ← 来自 provider_routing.require_parameters
provider_data_collection    ← 来自 provider_routing.data_collection
```

:::tip
你可以组合多个选项。例如，按价格排序但排除某些提供商并要求参数支持：

```yaml
provider_routing:
  sort: "price"
  ignore: ["Together"]
  require_parameters: true
  data_collection: "deny"
```
:::

## 默认行为

未配置 `provider_routing` 部分时（默认），OpenRouter 使用自己的默认路由逻辑，通常自动平衡成本和可用性。

:::tip 提供商路由 vs 故障转移模型
提供商路由控制 **OpenRouter 内的哪些子提供商**处理你的请求。要自动故障转移到完全不同的提供商当你的主模型失败时，请参见[故障转移提供商](/docs/user-guide/features/fallback-providers)。
:::
