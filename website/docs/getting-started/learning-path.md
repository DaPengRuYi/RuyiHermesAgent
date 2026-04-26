---
sidebar_position: 3
title: '学习路径'
description: '根据你的经验水平和目标，选择适合你的 Hermes Agent 文档学习路径。'
---

# 学习路径

Hermes Agent 功能丰富——CLI 助手、Telegram/Discord 机器人、任务自动化、RL 训练等等。本页帮助你根据经验水平和目标确定从哪里开始以及阅读什么内容。

:::tip 从这里开始
如果你还没有安装 Hermes Agent，请先阅读[安装指南](/docs/getting-started/installation)，然后运行[快速入门](/docs/getting-started/quickstart)。以下内容都假设你已完成安装。
:::

## 如何使用本页

- **知道自己的水平？** 跳转到[经验级别表](#按经验级别)，按照你的层级阅读顺序进行。
- **有特定目标？** 跳转到[按用例](#按用例)，找到匹配的场景。
- **只是随便看看？** 查看[核心功能一览](#核心功能一览)表，快速了解 Hermes Agent 的所有功能。

## 按经验级别

| 级别 | 目标 | 推荐阅读 | 预计时间 |
|---|---|---|---|
| **初学者** | 上手运行、进行基本对话、使用内置工具 | [安装](/docs/getting-started/installation) → [快速入门](/docs/getting-started/quickstart) → [CLI 使用](/docs/user-guide/cli) → [配置](/docs/user-guide/configuration) | ~1 小时 |
| **中级** | 设置消息机器人、使用记忆、定时任务和技能等高级功能 | [会话](/docs/user-guide/sessions) → [消息](/docs/user-guide/messaging) → [工具](/docs/user-guide/features/tools) → [技能](/docs/user-guide/features/skills) → [记忆](/docs/user-guide/features/memory) → [定时任务](/docs/user-guide/features/cron) | ~2-3 小时 |
| **高级** | 构建自定义工具、创建技能、使用 RL 训练模型、为项目贡献代码 | [架构](/docs/developer-guide/architecture) → [添加工具](/docs/developer-guide/adding-tools) → [创建技能](/docs/developer-guide/creating-skills) → [RL 训练](/docs/user-guide/features/rl-training) → [贡献代码](/docs/developer-guide/contributing) | ~4-6 小时 |

## 按用例

选择与你目标匹配的场景。每个场景按推荐阅读顺序链接到相关文档。

### "我需要一个 CLI 编码助手"

将 Hermes Agent 用作交互式终端助手，用于编写、审查和运行代码。

1. [安装](/docs/getting-started/installation)
2. [快速入门](/docs/getting-started/quickstart)
3. [CLI 使用](/docs/user-guide/cli)
4. [代码执行](/docs/user-guide/features/code-execution)
5. [上下文文件](/docs/user-guide/features/context-files)
6. [技巧与窍门](/docs/guides/tips)

:::tip
通过上下文文件将文件直接传入对话。Hermes Agent 可以在你的项目中读取、编辑和运行代码。
:::

### "我需要一个 Telegram/Discord 机器人"

将 Hermes Agent 部署为你喜欢的消息平台上的机器人。

1. [安装](/docs/getting-started/installation)
2. [配置](/docs/user-guide/configuration)
3. [消息概览](/docs/user-guide/messaging)
4. [Telegram 设置](/docs/user-guide/messaging/telegram)
5. [Discord 设置](/docs/user-guide/messaging/discord)
6. [语音模式](/docs/user-guide/features/voice-mode)
7. [在 Hermes 中使用语音模式](/docs/guides/use-voice-mode-with-hermes)
8. [安全](/docs/user-guide/security)

完整项目示例请参阅：
- [每日简报机器人](/docs/guides/daily-briefing-bot)
- [团队 Telegram 助手](/docs/guides/team-telegram-assistant)

### "我需要自动化任务"

调度定期任务、运行批量作业或将代理操作串联起来。

1. [快速入门](/docs/getting-started/quickstart)
2. [定时任务调度](/docs/user-guide/features/cron)
3. [批量处理](/docs/user-guide/features/batch-processing)
4. [委派](/docs/user-guide/features/delegation)
5. [钩子](/docs/user-guide/features/hooks)

:::tip
定时任务让 Hermes Agent 按计划运行任务——每日摘要、定期检查、自动生成报告——无需你在场。
:::

### "我需要构建自定义工具/技能"

用你自己的工具和可复用的技能包扩展 Hermes Agent。

1. [工具概览](/docs/user-guide/features/tools)
2. [技能概览](/docs/user-guide/features/skills)
3. [MCP（模型上下文协议）](/docs/user-guide/features/mcp)
4. [架构](/docs/developer-guide/architecture)
5. [添加工具](/docs/developer-guide/adding-tools)
6. [创建技能](/docs/developer-guide/creating-skills)

:::tip
工具是代理可以调用的单个函数。技能是将工具、提示和配置打包在一起的组合。从工具开始，逐步进阶到技能。
:::

### "我需要训练模型"

使用 Hermes Agent 内置的 RL 训练流水线，通过强化学习微调模型行为。

1. [快速入门](/docs/getting-started/quickstart)
2. [配置](/docs/user-guide/configuration)
3. [RL 训练](/docs/user-guide/features/rl-training)
4. [提供商路由](/docs/user-guide/features/provider-routing)
5. [架构](/docs/developer-guide/architecture)

:::tip
RL 训练在你已经了解 Hermes Agent 如何处理对话和工具调用的基础知识后效果最佳。如果你是新手，请先完成初学者路径。
:::

### "我需要将其用作 Python 库"

以编程方式将 Hermes Agent 集成到你自己的 Python 应用中。

1. [安装](/docs/getting-started/installation)
2. [快速入门](/docs/getting-started/quickstart)
3. [Python 库指南](/docs/guides/python-library)
4. [架构](/docs/developer-guide/architecture)
5. [工具](/docs/user-guide/features/tools)
6. [会话](/docs/user-guide/sessions)

## 核心功能一览

不确定有哪些可用功能？这里是主要功能的快速目录：

| 功能 | 说明 | 链接 |
|---|---|---|
| **工具** | 代理可调用的内置工具（文件 I/O、搜索、Shell 等） | [工具](/docs/user-guide/features/tools) |
| **技能** | 可安装的插件包，添加新功能 | [技能](/docs/user-guide/features/skills) |
| **记忆** | 跨会话的持久化记忆 | [记忆](/docs/user-guide/features/memory) |
| **上下文文件** | 将文件和目录引入对话 | [上下文文件](/docs/user-guide/features/context-files) |
| **MCP** | 通过模型上下文协议连接外部工具服务器 | [MCP](/docs/user-guide/features/mcp) |
| **定时任务** | 调度定期代理任务 | [定时任务](/docs/user-guide/features/cron) |
| **委派** | 生成子代理进行并行工作 | [委派](/docs/user-guide/features/delegation) |
| **代码执行** | 运行以编程方式调用 Hermes 工具的 Python 脚本 | [代码执行](/docs/user-guide/features/code-execution) |
| **浏览器** | 网页浏览和抓取 | [浏览器](/docs/user-guide/features/browser) |
| **钩子** | 事件驱动的回调和中间件 | [钩子](/docs/user-guide/features/hooks) |
| **批量处理** | 批量处理多个输入 | [批量处理](/docs/user-guide/features/batch-processing) |
| **RL 训练** | 使用强化学习微调模型 | [RL 训练](/docs/user-guide/features/rl-training) |
| **提供商路由** | 跨多个 LLM 提供商路由请求 | [提供商路由](/docs/user-guide/features/provider-routing) |

## 接下来读什么

根据你当前所处的阶段：

- **刚完成安装？** → 前往[快速入门](/docs/getting-started/quickstart)运行你的第一次对话。
- **完成了快速入门？** → 阅读 [CLI 使用](/docs/user-guide/cli)和[配置](/docs/user-guide/configuration)来自定义你的设置。
- **已经熟悉基础？** → 探索[工具](/docs/user-guide/features/tools)、[技能](/docs/user-guide/features/skills)和[记忆](/docs/user-guide/features/memory)来释放代理的全部能力。
- **为团队设置？** → 阅读[安全](/docs/user-guide/security)和[会话](/docs/user-guide/sessions)来了解访问控制和对话管理。
- **准备开始构建？** → 跳转到[开发者指南](/docs/developer-guide/architecture)来了解内部原理并开始贡献代码。
- **想要实际示例？** → 查看[指南](/docs/guides/tips)部分了解真实项目和技巧。

:::tip
你不需要阅读所有内容。选择与你目标匹配的路径，按顺序跟随链接，你很快就能上手。你可以随时回到本页找到下一步。
:::
