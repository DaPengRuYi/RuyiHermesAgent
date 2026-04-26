---
slug: /
sidebar_position: 0
title: "Hermes Agent 文档"
description: "自改进 AI Agent 框架。内置闭环学习系统，从经验中创建技能，在使用中改进，跨会话记忆。"
hide_table_of_contents: true
displayed_sidebar: docs
---

# Hermes Agent

自改进 AI Agent 框架，由 [Nous Research](https://nousresearch.com) 原创开发，[大鹏 AI 教育](https://github.com/DaPengRuYi)团队二次开发。唯一内置闭环学习系统的 Agent——从经验中创建技能，在使用中改进，主动持久化记忆，跨会话构建越来越深入的用户画像。

<div style={{display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap'}}>
  <a href="/docs/getting-started/installation" style={{display: 'inline-block', padding: '0.6rem 1.2rem', backgroundColor: '#FFD700', color: '#07070d', borderRadius: '8px', fontWeight: 600, textDecoration: 'none'}}>快速开始 →</a>
  <a href="https://github.com/DaPengRuYi/HermesAgent" style={{display: 'inline-block', padding: '0.6rem 1.2rem', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '8px', textDecoration: 'none'}}>查看 GitHub</a>
</div>

## 什么是 Hermes Agent？

它不是绑定在 IDE 上的编码副驾驶，也不是围绕单个 API 的聊天机器人包装器。它是一个**自主 Agent**，运行时间越长越强大。它驻留在你放置的任何地方——$5 的 VPS、GPU 集群或 serverless 基础设施（Daytona、Modal），空闲时成本几乎为零。在云端 VM 上运行它，同时通过 Telegram/飞书/钉钉与它对话——不必绑定在你的笔记本上。

## 快速链接

| | |
|---|---|
| 🚀 **[安装](/docs/getting-started/installation)** | 在 Linux、macOS 或 WSL2 上 60 秒安装 |
| 📖 **[快速入门教程](/docs/getting-started/quickstart)** | 你的第一次对话和要尝试的关键功能 |
| 🗺️ **[学习路径](/docs/getting-started/learning-path)** | 根据你的经验水平找到合适的文档 |
| ⚙️ **[配置](/docs/user-guide/configuration)** | 配置文件、提供商、模型和选项 |
| 💬 **[消息网关](/docs/user-guide/messaging)** | 设置 Telegram、Discord、Slack 或 WhatsApp |
| 🔧 **[工具与工具集](/docs/user-guide/features/tools)** | 47 个内置工具及配置方法 |
| 🧠 **[记忆系统](/docs/user-guide/features/memory)** | 跨会话持续增长的持久化记忆 |
| 📚 **[技能系统](/docs/user-guide/features/skills)** | Agent 创建和复用的程序记忆 |
| 🔌 **[MCP 集成](/docs/user-guide/features/mcp)** | 连接 MCP 服务器，过滤工具，安全扩展 Hermes |
| 🎙️ **[语音模式](/docs/user-guide/features/voice-mode)** | CLI、Telegram、Discord 中的实时语音交互 |
| 🎭 **[人格与 SOUL.md](/docs/user-guide/features/personality)** | 用全局 SOUL.md 定义 Hermes 的默认声音 |
| 📄 **[上下文文件](/docs/user-guide/features/context-files)** | 塑造每次对话的项目上下文文件 |
| 🔒 **[安全](/docs/user-guide/security)** | 命令审批、授权、容器隔离 |
| 💡 **[技巧与最佳实践](/docs/guides/tips)** | 充分利用 Hermes 的快速技巧 |
| 🏗️ **[架构](/docs/developer-guide/architecture)** | 底层工作原理 |
| ❓ **[FAQ 与故障排除](/docs/reference/faq)** | 常见问题和解决方案 |

## 核心特性

- **闭环学习**——Agent 自主管理记忆，定期持久化知识，自主创建技能，技能在使用中自我改进，FTS5 跨会话搜索 + LLM 摘要，Honcho 辩证用户建模
- **随处运行**——6 种终端后端：本地、Docker、SSH、Daytona、Singularity、Modal。Daytona 和 Modal 提供 serverless 持久化——环境空闲时休眠，几乎零成本
- **无处不在**——CLI、Telegram、Discord、Slack、WhatsApp、Signal、Matrix、飞书、钉钉、企业微信——单个 Gateway 支持 15+ 平台
- **定时自动化**——内置 Cron，支持投递到任意平台
- **委派与并行**——生成隔离的子 Agent 处理并行工作流。通过 `execute_code` 的编程工具调用将多步管道折叠为单次推理
- **开放标准技能**——兼容 agentskills.io。技能可移植、可共享、可社区贡献
- **完整 Web 控制**——搜索、提取、浏览、视觉、图像生成、TTS
- **MCP 支持**——连接任意 MCP 服务器扩展工具能力
- **研究就绪**——批处理、轨迹导出、Atropos RL 训练
