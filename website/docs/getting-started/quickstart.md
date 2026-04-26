---
sidebar_position: 1
title: "快速入门"
description: "你与 Hermes Agent 的第一次对话——从安装到聊天只需不到 5 分钟"
---

# 快速入门

本指南将带你从零开始搭建一个可以稳定运行的 Hermes 环境。安装、选择提供商、验证聊天功能，并在出现问题时知道如何处理。

## 适用人群

- 新手用户，想要最快路径搭建可用环境
- 正在切换提供商，不想在配置错误上浪费时间
- 为团队、机器人或常驻工作流设置 Hermes
- 受够了"装好了但啥也干不了"的情况

## 最快路径

根据你的目标选择对应行：

| 目标 | 首先执行 | 然后执行 |
|---|---|---|
| 我只想让 Hermes 在我的机器上跑起来 | `hermes setup` | 运行一次真实聊天并验证响应 |
| 我已经知道我的提供商 | `hermes model` | 保存配置，然后开始聊天 |
| 我需要一个机器人或常驻服务 | CLI 正常工作后运行 `hermes gateway setup` | 连接 Telegram、Discord、Slack 或其他平台 |
| 我需要本地或自托管模型 | `hermes model` → 自定义端点 | 验证端点、模型名称和上下文长度 |
| 我需要多提供商回退 | 先运行 `hermes model` | 等基础聊天正常工作后再添加路由和回退 |

**经验法则：** 如果 Hermes 还无法完成正常聊天，就不要添加更多功能。先让一个干净的对话跑起来，然后再逐步添加网关、定时任务、技能、语音或路由。

---

## 1. 安装 Hermes Agent

运行一键安装脚本：

```bash
# Linux / macOS / WSL2 / Android (Termux)
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

:::tip Android / Termux
如果你在手机上安装，请参阅专门的 [Termux 指南](./termux.md)，了解经过测试的手动安装路径、支持的扩展以及当前的 Android 特有限制。
:::

:::tip Windows 用户
请先安装 [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install)，然后在 WSL2 终端中运行上述命令。
:::

安装完成后，重新加载你的 shell：

```bash
source ~/.bashrc   # 或 source ~/.zshrc
```

如需了解详细的安装选项、前置条件和故障排除，请参阅[安装指南](./installation.md)。

## 2. 选择提供商

这是最重要的设置步骤。使用 `hermes model` 交互式地完成选择：

```bash
hermes model
```

推荐方案：

| 场景 | 推荐路径 |
|---|---|
| 最低摩擦 | Nous Portal 或 OpenRouter |
| 已有 Claude 或 Codex 认证 | Anthropic 或 OpenAI Codex |
| 需要本地/私有推理 | Ollama 或任何自定义 OpenAI 兼容端点 |
| 需要多提供商路由 | OpenRouter |
| 有自定义 GPU 服务器 | vLLM、SGLang、LiteLLM 或任何 OpenAI 兼容端点 |

对于大多数首次用户：选择一个提供商，接受默认值（除非你明确知道为什么要修改）。完整的提供商目录（包含环境变量和设置步骤）请参阅[提供商](../integrations/providers.md)页面。

:::caution 最小上下文：64K tokens
Hermes Agent 要求模型至少支持 **64,000 tokens** 的上下文窗口。较小窗口的模型无法为多步骤工具调用工作流维护足够的工作内存，启动时将被拒绝。大多数托管模型（Claude、GPT、Gemini、Qwen、DeepSeek）都能轻松满足此要求。如果你运行本地模型，请将上下文大小设置为至少 64K（例如 llama.cpp 使用 `--ctx-size 65536`，Ollama 使用 `-c 65536`）。
:::

:::tip
你可以随时通过 `hermes model` 切换提供商——没有锁定。如需查看所有支持的提供商完整列表和设置详情，请参阅 [AI 提供商](../integrations/providers.md)。
:::

### 设置如何存储

Hermes 将密钥与普通配置分开存储：

- **密钥和令牌** → `~/.hermes/.env`
- **非密钥设置** → `~/.hermes/config.yaml`

通过 CLI 设置值是最简单的方式：

```bash
hermes config set model anthropic/claude-opus-4.6
hermes config set terminal.backend docker
hermes config set OPENROUTER_API_KEY sk-or-...
```

正确的值会自动存入正确的文件。

## 3. 运行你的第一次聊天

```bash
hermes            # 经典 CLI
hermes --tui      # 现代 TUI（推荐）
```

你会看到一个欢迎横幅，显示你的模型、可用工具和技能。使用具体且易于验证的提示：

:::tip 选择你的界面
Hermes 提供两种终端界面：经典的 `prompt_toolkit` CLI 和更新的 [TUI](../user-guide/tui.md)（支持模态覆盖、鼠标选择和非阻塞输入）。两者共享相同的会话、斜杠命令和配置——可以分别用 `hermes` 和 `hermes --tui` 试试。
:::

```
用 5 个要点总结这个仓库，并告诉我主入口点是什么。
```

```
检查当前目录，告诉我哪个看起来像主项目文件。
```

```
帮我为这个代码库搭建一个干净的 GitHub PR 工作流。
```

**成功的标志：**

- 横幅显示你选择的模型/提供商
- Hermes 回复无错误
- 需要时可以使用工具（终端、文件读取、网络搜索）
- 对话可以正常进行多个轮次

如果以上都正常，你已经过了最困难的部分。

## 4. 验证会话功能

在继续之前，确保会话恢复功能正常：

```bash
hermes --continue    # 恢复最近的会话
hermes -c            # 简写形式
```

这应该能带你回到刚才的会话。如果不行，请检查你是否在同一个配置文件中，以及会话是否确实保存了。当你需要管理多个环境或机器时，这一点很重要。

## 5. 尝试核心功能

### 使用终端

```
❯ 磁盘使用情况如何？显示前 5 个最大的目录。
```

代理会代替你运行终端命令并显示结果。

### 斜杠命令

输入 `/` 查看所有命令的自动补全下拉列表：

| 命令 | 功能 |
|---------|-------------|
| `/help` | 显示所有可用命令 |
| `/tools` | 列出可用工具 |
| `/model` | 交互式切换模型 |
| `/personality pirate` | 试试有趣的个性化风格 |
| `/save` | 保存对话 |

### 多行输入

按 `Alt+Enter` 或 `Ctrl+J` 添加新行。非常适合粘贴代码或编写详细提示。

### 中断代理

如果代理执行时间过长，输入新消息并按 Enter——它会中断当前任务并切换到你的新指令。`Ctrl+C` 也可以。

## 6. 添加下一层功能

仅在基础聊天正常工作后进行。根据需要选择：

### 机器人或共享助手

```bash
hermes gateway setup    # 交互式平台配置
```

连接 [Telegram](/docs/user-guide/messaging/telegram)、[Discord](/docs/user-guide/messaging/discord)、[Slack](/docs/user-guide/messaging/slack)、[WhatsApp](/docs/user-guide/messaging/whatsapp)、[Signal](/docs/user-guide/messaging/signal)、[Email](/docs/user-guide/messaging/email) 或 [Home Assistant](/docs/user-guide/messaging/homeassistant)。

### 自动化和工具

- `hermes tools` — 按平台调整工具访问权限
- `hermes skills` — 浏览和安装可复用的工作流
- 定时任务 — 仅在你的机器人或 CLI 设置稳定后使用

### 沙箱终端

为了安全起见，在 Docker 容器或远程服务器上运行代理：

```bash
hermes config set terminal.backend docker    # Docker 隔离
hermes config set terminal.backend ssh       # 远程服务器
```

### 语音模式

```bash
pip install "hermes-agent[voice]"
# 包含 faster-whisper，支持免费的本地语音转文字
```

然后在 CLI 中：`/voice on`。按 `Ctrl+B` 录音。参见[语音模式](../user-guide/features/voice-mode.md)。

### 技能

```bash
hermes skills search kubernetes
hermes skills install openai/skills/k8s
```

或在聊天会话中使用 `/skills`。

### MCP 服务器

```yaml
# 添加到 ~/.hermes/config.yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxx"
```

### 编辑器集成（ACP）

```bash
pip install -e '.[acp]'
hermes acp
```

参见 [ACP 编辑器集成](../user-guide/features/acp.md)。

---

## 常见故障模式

这些是最浪费时间的问题：

| 症状 | 可能原因 | 修复方法 |
|---|---|---|
| Hermes 打开了但回复为空或异常 | 提供商认证或模型选择错误 | 重新运行 `hermes model` 并确认提供商、模型和认证信息 |
| 自定义端点"可以连接"但返回垃圾数据 | 基础 URL、模型名称错误，或实际并非 OpenAI 兼容 | 先在单独的客户端中验证端点 |
| 网关启动了但没人能发消息 | Bot 令牌、白名单或平台设置不完整 | 重新运行 `hermes gateway setup` 并检查 `hermes gateway status` |
| `hermes --continue` 找不到旧会话 | 切换了配置文件或会话未保存 | 检查 `hermes sessions list` 并确认你在正确的配置文件中 |
| 模型不可用或回退行为异常 | 提供商路由或回退设置过于激进 | 在基础提供商稳定之前保持关闭路由 |
| `hermes doctor` 报告配置问题 | 配置值缺失或过时 | 修复配置，在添加功能之前重新测试纯聊天 |

## 恢复工具箱

当感觉不对劲时，按此顺序操作：

1. `hermes doctor`
2. `hermes model`
3. `hermes setup`
4. `hermes sessions list`
5. `hermes --continue`
6. `hermes gateway status`

这个序列能让你快速从"感觉有问题"回到已知正常状态。

---

## 快速参考

| 命令 | 说明 |
|---------|-------------|
| `hermes` | 开始聊天 |
| `hermes model` | 选择你的 LLM 提供商和模型 |
| `hermes tools` | 按平台配置启用哪些工具 |
| `hermes setup` | 完整设置向导（一次性配置所有内容） |
| `hermes doctor` | 诊断问题 |
| `hermes update` | 更新到最新版本 |
| `hermes gateway` | 启动消息网关 |
| `hermes --continue` | 恢复上次会话 |

## 下一步

- **[CLI 指南](../user-guide/cli.md)** — 掌握终端界面
- **[配置](../user-guide/configuration.md)** — 自定义你的设置
- **[消息网关](../user-guide/messaging/index.md)** — 连接 Telegram、Discord、Slack、WhatsApp、Signal、Email 或 Home Assistant
- **[工具与工具集](../user-guide/features/tools.md)** — 探索可用功能
- **[AI 提供商](../integrations/providers.md)** — 完整提供商列表和设置详情
- **[技能系统](../user-guide/features/skills.md)** — 可复用的工作流和知识
- **[技巧与最佳实践](../guides/tips.md)** — 高级用户技巧
