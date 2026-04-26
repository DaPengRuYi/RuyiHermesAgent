<p align="center">
  <img src="assets/banner.png" alt="Hermes Agent" width="100%">
</p>

# Hermes Agent ☤

<p align="center">
  <a href="https://github.com/DaPengRuYi/HermesAgent/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
  <a href="https://github.com/DaPengRuYi/HermesAgent"><img src="https://img.shields.io/badge/Fork-DaPengRuYi/HermesAgent-blue?style=for-the-badge" alt="Fork"></a>
</p>

**自改进 AI Agent 框架**，由 [Nous Research](https://nousresearch.com) 原创开发，[大鹏 AI 教育](https://github.com/DaPengRuYi) 团队二次开发。这是唯一一个内置闭环学习系统的 Agent——它从经验中创建技能、在使用中改进技能、主动持久化记忆、搜索自己的历史对话，并在跨会话中构建越来越深入的用户画像。

可以在 $5 的 VPS、GPU 集群或 serverless 基础设施上运行——空闲时成本几乎为零。不必绑定在你的笔记本上——在云端 VM 上运行它，同时通过 Telegram/飞书/钉钉与它对话。

支持任意模型——[OpenRouter](https://openrouter.ai)（200+ 模型）、OpenAI、Anthropic Claude、Google Gemini、[NVIDIA NIM](https://build.nvidia.com)、小米 MiMo、智谱 GLM、月之暗面 Kimi、MiniMax、[Hugging Face](https://huggingface.co) 等。通过 `hermes model` 一行命令切换——无需改代码，无锁定。

<table>
<tr><td><b>真实终端界面</b></td><td>完整 TUI，支持多行编辑、斜杠命令补全、对话历史、中断重定向和流式工具输出。</td></tr>
<tr><td><b>无处不在</b></td><td>Telegram、Discord、Slack、WhatsApp、Signal、飞书、钉钉、企业微信、CLI——全部从单个 Gateway 进程运行。语音备忘录转录，跨平台对话连续性。</td></tr>
<tr><td><b>闭环学习</b></td><td>Agent 自主管理记忆，定期持久化知识。复杂任务后自动创建技能，技能在使用中自我改进。FTS5 会话搜索 + LLM 摘要实现跨会话回忆。Honcho 辩证用户建模。兼容 agentskills.io 开放标准。</td></tr>
<tr><td><b>定时自动化</b></td><td>内置 Cron 调度器，支持投递到任意平台。日报、夜间备份、周审计——全部用自然语言定义，无人值守运行。</td></tr>
<tr><td><b>委派与并行</b></td><td>生成隔离的子 Agent 处理并行工作流。编写 Python 脚本通过 RPC 调用工具，将多步管道折叠为零上下文成本的单次转换。</td></tr>
<tr><td><b>随处运行</b></td><td>六种终端后端——本地、Docker、SSH、Daytona、Singularity、Modal。Daytona 和 Modal 提供 serverless 持久化——环境空闲时休眠，按需唤醒，几乎零成本。</td></tr>
<tr><td><b>研究就绪</b></td><td>批量轨迹生成、Atropos RL 环境、轨迹压缩，用于训练下一代工具调用模型。</td></tr>
</table>

---

## 快速安装

```bash
curl -fsSL https://raw.githubusercontent.com/DaPengRuYi/HermesAgent/main/scripts/install.sh | bash
```

支持 Linux、macOS、WSL2 和 Android (Termux)。安装脚本会自动处理平台相关的配置。

> **Android / Termux：** 手动安装路径请参考 Termux 指南。在 Termux 上，Hermes 安装精简的 `.[termux]` 依赖组，因为完整的 `.[all]` 包含 Android 不兼容的语音依赖。
>
> **Windows：** 不支持原生 Windows，请安装 [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) 后运行上述命令。

安装完成后：

```bash
source ~/.bashrc    # 重新加载 shell（或: source ~/.zshrc）
hermes              # 开始聊天！
```

---

## 快速上手

```bash
hermes              # 交互式 CLI——开始对话
hermes model        # 选择 LLM 提供商和模型
hermes tools        # 配置启用哪些工具
hermes config set   # 设置单个配置值
hermes gateway      # 启动消息网关（Telegram、Discord、飞书等）
hermes setup        # 运行完整设置向导（一次性配置所有内容）
hermes update       # 更新到最新版本
hermes doctor       # 诊断问题
```

## CLI 与消息平台速查

Hermes 有两个入口：通过 `hermes` 启动终端 UI，或运行 Gateway 从 Telegram、Discord、Slack、WhatsApp、Signal、飞书、钉钉等平台对话。进入对话后，许多斜杠命令在两个界面中共享。

| 操作 | CLI | 消息平台 |
|------|-----|---------|
| 开始聊天 | `hermes` | 运行 `hermes gateway setup` + `hermes gateway start`，然后给机器人发消息 |
| 开始新对话 | `/new` 或 `/reset` | `/new` 或 `/reset` |
| 切换模型 | `/model [provider:model]` | `/model [provider:model]` |
| 设置人格 | `/personality [name]` | `/personality [name]` |
| 重试或撤销 | `/retry`、`/undo` | `/retry`、`/undo` |
| 压缩上下文/查看用量 | `/compress`、`/usage`、`/insights` | `/compress`、`/usage`、`/insights` |
| 浏览技能 | `/skills` 或 `/<skill-name>` | `/<skill-name>` |
| 中断当前工作 | `Ctrl+C` 或发送新消息 | `/stop` 或发送新消息 |

---

## 文档

完整文档请参考项目源码中的 `website/docs/` 目录，或阅读 `AGENTS.md` 了解开发指南。

| 文档 | 内容 |
|------|------|
| [快速入门](website/docs/getting-started/quickstart.md) | 安装 → 配置 → 2 分钟开始第一次对话 |
| [CLI 使用](website/docs/user-guide/cli.md) | 命令、快捷键、人格、会话 |
| [配置](website/docs/user-guide/configuration.md) | 配置文件、提供商、模型、所有选项 |
| [消息网关](website/docs/user-guide/messaging.md) | Telegram、Discord、Slack、WhatsApp、Signal、飞书、钉钉 |
| [安全](website/docs/user-guide/security.md) | 命令审批、DM 配对、容器隔离 |
| [工具与工具集](website/docs/user-guide/features/tools.md) | 40+ 工具、工具集系统、终端后端 |
| [技能系统](website/docs/user-guide/features/skills.md) | 程序记忆、技能中心、创建技能 |
| [记忆](website/docs/user-guide/features/memory.md) | 持久化记忆、用户画像、最佳实践 |
| [MCP 集成](website/docs/user-guide/features/mcp.md) | 连接任意 MCP 服务器扩展能力 |
| [Cron 调度](website/docs/user-guide/features/cron.md) | 定时任务与平台投递 |
| [架构](website/docs/developer-guide/architecture.md) | 项目结构、Agent 循环、核心类 |
| [开发贡献](website/docs/developer-guide/contributing.md) | 开发环境、PR 流程、代码风格 |

---

## 贡献

欢迎贡献！请参考[贡献指南](website/docs/developer-guide/contributing.md)了解开发环境、代码风格和 PR 流程。

快速开始——克隆并运行 `setup-hermes.sh`：

```bash
git clone https://github.com/DaPengRuYi/HermesAgent.git
cd HermesAgent
./setup-hermes.sh     # 安装 uv、创建 venv、安装依赖、链接 hermes 命令
./hermes              # 自动检测 venv，无需手动 source
```

手动路径（等效于上述脚本）：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv venv --python 3.11
source venv/bin/activate
uv pip install -e ".[all,dev]"
scripts/run_tests.sh
```

---

## 许可证

MIT——详见 [LICENSE](LICENSE)。

原创开发：[Nous Research](https://nousresearch.com)。
二次开发：[大鹏 AI 教育团队](https://github.com/DaPengRuYi)。
