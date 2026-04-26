---
sidebar_position: 99
title: "Honcho 记忆"
description: "通过 Honcho 实现 AI 原生持久记忆——辩证推理、多代理用户建模和深度个性化"
---

# Honcho 记忆

[Honcho](https://github.com/plastic-labs/honcho) 是一个 AI 原生记忆后端，在 Hermes 内置记忆系统之上添加辩证推理和深度用户建模。Honcho 不是简单的键值存储，而是通过在对话发生后进行推理，维护一个关于用户是谁的运行模型——他们的偏好、沟通风格、目标和模式。

:::info Honcho 是记忆提供商插件
Honcho 集成到[记忆提供商](./memory-providers.md)系统中。以下所有功能通过统一的记忆提供商接口可用。
:::

## Honcho 添加了什么

| 能力 | 内置记忆 | Honcho |
|------|---------|--------|
| 跨会话持久化 | ✔ 基于文件的 MEMORY.md/USER.md | ✔ 服务器端带 API |
| 用户档案 | ✔ 手动代理策划 | ✔ 自动辩证推理 |
| 会话摘要 | — | ✔ 会话作用域上下文注入 |
| 多代理隔离 | — | ✔ 每对等体档案分离 |
| 观察模式 | — | ✔ 统一或定向观察 |
| 结论（派生洞察） | — | ✔ 服务器端关于模式的推理 |
| 跨历史搜索 | ✔ FTS5 会话搜索 | ✔ 跨结论的语义搜索 |

**辩证推理**：在每个对话轮次后（由 `dialecticCadence` 控制），Honcho 分析交流并推导关于用户偏好、习惯和目标的洞察。这些随时间积累，给代理一种超越用户明确陈述的深化理解。辩证支持多遍深度（1-3 遍），带有自动冷/热提示选择——冷启动查询关注一般用户事实，而热查询优先会话作用域上下文。

**会话作用域上下文**：基础上下文现在包含会话摘要以及用户表示和对等体卡片。这让代理意识到当前会话中已经讨论过的内容，减少重复并实现连续性。

**多代理档案**：当多个 Hermes 实例与同一用户对话时（例如编程助手和个人助手），Honcho 维护独立的"对等体"档案。每个对等体只看到自己的观察和结论，防止上下文交叉污染。

## 设置

```bash
hermes memory setup    # 从提供商列表中选择 "honcho"
```

或手动配置：

```yaml
# ~/.hermes/config.yaml
memory:
  provider: honcho
```

```bash
echo "HONCHO_API_KEY=*** >> ~/.hermes/.env
```

在 [honcho.dev](https://honcho.dev) 获取 API 密钥。

## 架构

### 两层上下文注入

每个轮次（在 `hybrid` 或 `context` 模式下），Honcho 组装两层注入系统提示的上下文：

1. **基础上下文** — 会话摘要、用户表示、用户对等体卡片、AI 自表示和 AI 身份卡片。在 `contextCadence` 时刷新。这是"这个用户是谁"层。
2. **辩证补充** — LLM 合成的关于用户当前状态和需求的推理。在 `dialecticCadence` 时刷新。这是"现在什么最重要"层。

两层被连接并截断到 `contextTokens` 预算（如果设置）。

### 冷/热提示选择

辩证自动在两种提示策略间选择：

- **冷启动**（尚无基础上下文）：通用查询 — "这个人是谁？他们的偏好、目标和工作风格是什么？"
- **热会话**（基础上下文存在）：会话作用域查询 — "鉴于本次会话到目前为止讨论的内容，关于此用户的哪些上下文最相关？"

这根据基础上下文是否已填充自动发生。

### 三个正交配置旋钮

成本和深度由三个独立旋钮控制：

| 旋钮 | 控制 | 默认值 |
|------|------|--------|
| `contextCadence` | `context()` API 调用之间的轮次（基础层刷新） | `1` |
| `dialecticCadence` | `peer.chat()` LLM 调用之间的轮次（辩证层刷新） | `2`（推荐 1-5） |
| `dialecticDepth` | 每次辩证调用的 `.chat()` 遍数（1-3） | `1` |

这些是正交的——你可以频繁刷新基础上下文但不频繁辩证，或低频率深度多遍辩证。示例：`contextCadence: 1, dialecticCadence: 5, dialecticDepth: 2` 每轮刷新基础上下文，每 5 轮运行辩证，每次辩证运行做 2 遍。

### 辩证深度（多遍）

当 `dialecticDepth` > 1 时，每次辩证调用运行多个 `.chat()` 遍：

- **第 0 遍**：冷或热提示（见上）
- **第 1 遍**：自审——识别初始评估中的差距并从最近会话合成证据
- **第 2 遍**：调和——检查先前遍之间的矛盾并产生最终综合

每遍使用比例推理级别（早期遍较轻，主遍为基础级别）。用 `dialecticDepthLevels` 覆盖每遍级别——例如 `["minimal", "medium", "high"]` 用于深度 3 运行。

如果前一遍返回强信号（长、结构化输出），遍会提前退出，因此深度 3 并不总是意味着 3 次 LLM 调用。

### 会话启动预热

在会话初始化时，Honcho 在后台以完整配置的 `dialecticDepth` 触发辩证调用，并将结果直接交给第 1 轮的上下文组装。冷对等体上的单遍预热通常返回薄输出——多遍深度在用户发言前运行审阅/调和循环。如果预热在第 1 轮前未完成，第 1 轮回退到带有限定超时的同步调用。

### 查询自适应推理级别

自动注入的辩证按查询长度缩放 `dialecticReasoningLevel`：≥120 字符时 +1 级，≥400 时 +2 级，限制在 `reasoningLevelCap`（默认 `"high"`）。用 `reasoningHeuristic: false` 禁用以将每次自动调用固定到 `dialecticReasoningLevel`。可用级别：`minimal`、`low`、`medium`、`high`、`max`。

## 配置选项

Honcho 在 `~/.honcho/config.json`（全局）或 `$HERMES_HOME/honcho.json`（配置文件本地）中配置。设置向导为你处理。

### 完整配置参考

| 键 | 默认值 | 描述 |
|----|--------|------|
| `contextTokens` | `null`（无上限） | 每轮自动注入上下文的令牌预算。设为整数（例如 1200）以限制。在单词边界截断 |
| `contextCadence` | `1` | `context()` API 调用之间的最小轮次（基础层刷新） |
| `dialecticCadence` | `2` | `peer.chat()` LLM 调用之间的最小轮次（辩证层）。推荐 1-5。在 `tools` 模式下无关——模型显式调用 |
| `dialecticDepth` | `1` | 每次辩证调用的 `.chat()` 遍数。限制在 1-3 |
| `dialecticDepthLevels` | `null` | 可选的每遍推理级别数组，例如 `["minimal", "low", "medium"]`。覆盖比例默认值 |
| `dialecticReasoningLevel` | `'low'` | 基础推理级别：`minimal`、`low`、`medium`、`high`、`max` |
| `dialecticDynamic` | `true` | 为 `true` 时，模型可以通过工具参数覆盖每次调用的推理级别 |
| `dialecticMaxChars` | `600` | 注入系统提示的辩证结果最大字符数 |
| `recallMode` | `'hybrid'` | `hybrid`（自动注入 + 工具）、`context`（仅注入）、`tools`（仅工具） |
| `writeFrequency` | `'async'` | 何时刷新消息：`async`（后台线程）、`turn`（同步）、`session`（结束时批量）或整数 N |
| `saveMessages` | `true` | 是否将消息持久化到 Honcho API |
| `observationMode` | `'directional'` | `directional`（全部开启）或 `unified`（共享池）。用 `observation` 对象覆盖以精细控制 |
| `messageMaxChars` | `25000` | 通过 `add_messages()` 发送的每条消息最大字符数。超出则分块 |
| `dialecticMaxInputChars` | `10000` | `peer.chat()` 的辩证查询输入最大字符数 |
| `sessionStrategy` | `'per-directory'` | `per-directory`、`per-repo`、`per-session` 或 `global` |

**会话策略**控制 Honcho 会话如何映射到你的工作：
- `per-session` — 每次 `hermes` 运行获得新会话。干净开始，通过工具记忆。推荐新用户使用。
- `per-directory` — 每个工作目录一个 Honcho 会话。上下文跨运行积累。
- `per-repo` — 每个 git 仓库一个会话。
- `global` — 跨所有目录的单一会话。

**召回模式**控制记忆如何流入对话：
- `hybrid` — 上下文自动注入系统提示且工具可用（模型决定何时查询）。
- `context` — 仅自动注入，工具隐藏。
- `tools` — 仅工具，无自动注入。代理必须显式调用 `honcho_reasoning`、`honcho_search` 等。

**每种召回模式的设置：**

| 设置 | `hybrid` | `context` | `tools` |
|------|----------|-----------|---------|
| `writeFrequency` | 刷新消息 | 刷新消息 | 刷新消息 |
| `contextCadence` | 控制基础上下文刷新 | 控制基础上下文刷新 | 无关——无注入 |
| `dialecticCadence` | 控制自动 LLM 调用 | 控制自动 LLM 调用 | 无关——模型显式调用 |
| `dialecticDepth` | 每次调用多遍 | 每次调用多遍 | 无关——模型显式调用 |
| `contextTokens` | 限制注入 | 限制注入 | 无关——无注入 |
| `dialecticDynamic` | 控制模型覆盖 | N/A（无工具） | 控制模型覆盖 |

在 `tools` 模式下，模型完全控制——它在想要时调用 `honcho_reasoning`，使用它选择的任何 `reasoning_level`。节奏和预算设置仅适用于自动注入的模式（`hybrid` 和 `context`）。

## 观察（定向 vs 统一）

Honcho 将对话建模为对等体交换消息。每个对等体有两个观察开关，1:1 映射到 Honcho 的 `SessionPeerConfig`：

| 开关 | 效果 |
|------|------|
| `observeMe` | Honcho 从此对等体自己的消息构建其表示 |
| `observeOthers` | 此对等体观察另一个对等体的消息（馈送跨对等体推理） |

两个对等体 × 两个开关 = 四个标志。`observationMode` 是简写预设：

| 预设 | 用户标志 | AI 标志 | 语义 |
|------|---------|---------|------|
| `"directional"`（默认） | me: on, others: on | me: on, others: on | 完全相互观察。启用跨对等体辩证——"AI 基于用户所说和 AI 回复对用户了解什么"。 |
| `"unified"` | me: on, others: off | me: off, others: on | 共享池语义——AI 仅观察用户的消息，用户对等体仅自建模。单观察者池。 |

用显式 `observation` 块覆盖预设以每对等体控制：

```json
"observation": {
  "user": { "observeMe": true,  "observeOthers": true },
  "ai":   { "observeMe": true,  "observeOthers": false }
}
```

常见模式：

| 意图 | 配置 |
|------|------|
| 完全观察（大多数用户） | `"observationMode": "directional"` |
| AI 不应从自己的回复重新建模用户 | `"ai": {"observeMe": true, "observeOthers": false}` |
| AI 对等体不应从自观察更新的强人格 | `"ai": {"observeMe": false, "observeOthers": true}` |

通过 [Honcho 仪表板](https://app.honcho.dev) 设置的服务器端开关胜过本地默认值——Hermes 在会话初始化时同步它们回来。

## 工具

当 Honcho 作为记忆提供商活跃时，五个工具可用：

| 工具 | 用途 |
|------|------|
| `honcho_profile` | 读取或更新对等体卡片——传递 `card`（事实列表）更新，省略读取 |
| `honcho_search` | 跨上下文的语义搜索——原始摘录，无 LLM 综合 |
| `honcho_context` | 完整会话上下文——摘要、表示、卡片、最近消息 |
| `honcho_reasoning` | 来自 Honcho LLM 的综合答案——传递 `reasoning_level`（minimal/low/medium/high/max）控制深度 |
| `honcho_conclude` | 创建或删除结论——传递 `conclusion` 创建，`delete_id` 删除（仅 PII） |

## CLI 命令

```bash
hermes honcho status          # 连接状态、配置和关键设置
hermes honcho setup           # 交互式设置向导
hermes honcho strategy        # 显示或设置会话策略
hermes honcho peer            # 更新多代理设置的对等体名称
hermes honcho mode            # 显示或设置召回模式
hermes honcho tokens          # 显示或设置上下文令牌预算
hermes honcho identity        # 显示 Honcho 对等体身份
hermes honcho sync            # 同步所有配置文件的主机块
hermes honcho enable          # 启用 Honcho
hermes honcho disable         # 禁用 Honcho
```

## 从 `hermes honcho` 迁移

如果你之前使用过独立的 `hermes honcho setup`：

1. 你现有的配置（`honcho.json` 或 `~/.honcho/config.json`）被保留
2. 你的服务器端数据（记忆、结论、用户档案）完好无损
3. 在 config.yaml 中设置 `memory.provider: honcho` 重新激活

无需重新登录或重新设置。运行 `hermes memory setup` 并选择 "honcho"——向导会检测你的现有配置。

## 完整文档

参见[记忆提供商 — Honcho](./memory-providers.md#honcho) 获取完整参考。
