---
sidebar_position: 9
title: "个性与 SOUL.md"
description: "使用全局 SOUL.md、内置个性和自定义人格定义自定义 Hermes Agent 的个性"
---

# 个性与 SOUL.md

Hermes Agent 的个性完全可自定义。`SOUL.md` 是**主要身份**——它是系统提示中的第一个内容，定义代理是谁。

- `SOUL.md` — 位于 `HERMES_HOME` 的持久人格文件，作为代理的身份（系统提示中的槽位 #1）
- 内置或自定义 `/personality` 预设——会话级系统提示覆盖

如果你想改变 Hermes 是谁——或用完全不同的代理人格替换它——编辑 `SOUL.md`。

## SOUL.md 现在如何工作

Hermes 现在自动在以下位置创建默认 `SOUL.md`：

```text
~/.hermes/SOUL.md
```

更准确地说，它使用当前实例的 `HERMES_HOME`，因此如果你使用自定义主目录运行 Hermes，它将使用：

```text
$HERMES_HOME/SOUL.md
```

### 重要行为

- **SOUL.md 是代理的主要身份。** 它占据系统提示中的槽位 #1，替换硬编码的默认身份。
- 如果 `SOUL.md` 尚不存在，Hermes 自动创建一个入门版
- 现有用户 `SOUL.md` 文件永远不会被覆盖
- Hermes 仅从 `HERMES_HOME` 加载 `SOUL.md`
- Hermes 不会在当前工作目录中查找 `SOUL.md`
- 如果 `SOUL.md` 存在但为空，或无法加载，Hermes 回退到内置默认身份
- 如果 `SOUL.md` 有内容，该内容在安全扫描和截断后逐字注入
- SOUL.md **不会**在上下文文件部分重复——它仅出现一次，作为身份

这使得 `SOUL.md` 成为真正的每用户或每实例身份，而不仅仅是附加层。

## 为什么这样设计

这保持个性可预测。

如果 Hermes 从你启动它的任何目录加载 `SOUL.md`，你的个性可能在项目间意外改变。仅从 `HERMES_HOME` 加载，个性属于 Hermes 实例本身。

这也更容易教导用户：
- "编辑 `~/.hermes/SOUL.md` 更改 Hermes 的默认个性。"

## 在哪里编辑

对于大多数用户：

```bash
~/.hermes/SOUL.md
```

如果你使用自定义主目录：

```bash
$HERMES_HOME/SOUL.md
```

## SOUL.md 中应该放什么？

用它来持久的声音和个性指导，例如：
- 语调
- 沟通风格
- 直接程度
- 默认交互风格
- 风格上要避免什么
- Hermes 应如何处理不确定性、分歧或歧义

较少用于：
- 一次性项目指令
- 文件路径
- 仓库惯例
- 临时工作流细节

那些属于 `AGENTS.md`，不属于 `SOUL.md`。

## 好的 SOUL.md 内容

好的 SOUL 文件是：
- 跨上下文稳定
- 足够广泛以适用于许多对话
- 足够具体以实质性地塑造声音
- 专注于沟通和身份，而非任务特定指令

### 示例

```markdown
# Personality

You are a pragmatic senior engineer with strong taste.
You optimize for truth, clarity, and usefulness over politeness theater.

## Style
- Be direct without being cold
- Prefer substance over filler
- Push back when something is a bad idea
- Admit uncertainty plainly
- Keep explanations compact unless depth is useful

## What to avoid
- Sycophancy
- Hype language
- Repeating the user's framing if it's wrong
- Overexplaining obvious things

## Technical posture
- Prefer simple systems over clever systems
- Care about operational reality, not idealized architecture
- Treat edge cases as part of the design, not cleanup
```

## Hermes 注入提示的内容

`SOUL.md` 内容直接进入系统提示的槽位 #1——代理身份位置。周围不添加包装语言。

内容经过：
- 提示注入扫描
- 如果太大则截断

如果文件为空、仅空白或无法读取，Hermes 回退到内置默认身份（"You are Hermes Agent, an intelligent AI assistant created by Nous Research（原创开发）..."）。此回退也适用于设置 `skip_context_files` 时（例如在子代理/委托上下文中）。

## 安全扫描

`SOUL.md` 像其他承载上下文的文件一样在包含前扫描提示注入模式。

这意味着你仍应保持其专注于人格/声音，而非试图塞入奇怪的元指令。

## SOUL.md vs AGENTS.md

这是最重要的区别。

### SOUL.md
用于：
- 身份
- 语调
- 风格
- 沟通默认
- 人格级行为

### AGENTS.md
用于：
- 项目架构
- 编码惯例
- 工具偏好
- 仓库特定工作流
- 命令、端口、路径、部署说明

有用的规则：
- 如果它应该到处跟随你，它属于 `SOUL.md`
- 如果它属于项目，它属于 `AGENTS.md`

## SOUL.md vs `/personality`

`SOUL.md` 是你的持久默认个性。

`/personality` 是会话级覆盖，改变或补充当前系统提示。

所以：
- `SOUL.md` = 基线声音
- `/personality` = 临时模式切换

示例：
- 保持务实的默认 SOUL，然后使用 `/personality teacher` 进行辅导对话
- 保持简洁的 SOUL，然后使用 `/personality creative` 进行头脑风暴

## 内置个性

Hermes 附带内置个性，你可以用 `/personality` 切换。

| 名称 | 描述 |
|------|------|
| **helpful** | 友好的通用助手 |
| **concise** | 简洁、切中要点的响应 |
| **technical** | 详细、准确的技术专家 |
| **creative** | 创新、跳出框框的思维 |
| **teacher** | 带清晰示例的耐心教育者 |
| **kawaii** | 可爱表达、闪闪发光和热情 ★ |
| **catgirl** | 带猫样表达的 Neko-chan，nya~ |
| **pirate** | Hermes 船长，精通技术的海盗 |
| **shakespeare** | 带戏剧天赋的吟游散文 |
| **surfer** | 完全酷的兄弟氛围 |
| **noir** | 硬汉侦探叙述 |
| **uwu** | 用 uwu 说话的极致可爱 |
| **philosopher** | 对每个查询的深度沉思 |
| **hype** | 最大能量和热情！！！ |

## 用命令切换个性

### CLI

```text
/personality
/personality concise
/personality technical
```

### 消息平台

```text
/personality teacher
```

这些是方便的覆盖，但你的全局 `SOUL.md` 仍给 Hermes 其持久默认个性，除非覆盖实质性地改变了它。

## 配置中的自定义个性

你也可以在 `~/.hermes/config.yaml` 的 `agent.personalities` 下定义命名的自定义个性。

```yaml
agent:
  personalities:
    codereviewer: >
      You are a meticulous code reviewer. Identify bugs, security issues,
      performance concerns, and unclear design choices. Be precise and constructive.
```

然后切换到它：

```text
/personality codereviewer
```

## 推荐工作流

强大的默认设置是：

1. 在 `~/.hermes/SOUL.md` 中保持深思熟虑的全局 `SOUL.md`
2. 将项目指令放在 `AGENTS.md` 中
3. 仅在想要临时模式切换时使用 `/personality`

这给你：
- 稳定的声音
- 项目特定行为在它该在的地方
- 需要时的临时控制

## 个性如何与完整提示交互

在高层，提示栈包括：
1. **SOUL.md**（代理身份——或 SOUL.md 不可用时的内置回退）
2. 工具感知行为指导
3. 记忆/用户上下文
4. 技能指导
5. 上下文文件（`AGENTS.md`、`.cursorrules`）
6. 时间戳
7. 平台特定格式提示
8. 可选系统提示覆盖如 `/personality`

`SOUL.md` 是基础——其他一切都在其上构建。

## 相关文档

- [上下文文件](/docs/user-guide/features/context-files)
- [配置](/docs/user-guide/configuration)
- [提示与最佳实践](/docs/guides/tips)
- [SOUL.md 指南](/docs/guides/use-soul-with-hermes)

## CLI 外观 vs 对话个性

对话个性和 CLI 外观是分开的：

- `SOUL.md`、`agent.system_prompt` 和 `/personality` 影响 Hermes 如何说话
- `display.skin` 和 `/skin` 影响 Hermes 在终端中的外观

终端外观请参见[皮肤与主题](./skins.md)。
