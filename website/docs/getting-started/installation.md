---
sidebar_position: 2
title: "安装指南"
description: "在 Linux、macOS、WSL2 或通过 Termux 在 Android 上安装 Hermes Agent"
---

# 安装指南

使用一键安装脚本，在两分钟内完成 Hermes Agent 的安装和运行。

## 快速安装

### Linux / macOS / WSL2

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

### Android / Termux

Hermes 现在也提供了 Termux 适配的安装路径：

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

安装程序会自动检测 Termux 环境并切换到经过测试的 Android 安装流程：
- 使用 Termux 的 `pkg` 安装系统依赖（`git`、`python`、`nodejs`、`ripgrep`、`ffmpeg`、构建工具）
- 使用 `python -m venv` 创建虚拟环境
- 自动导出 `ANDROID_API_LEVEL` 以支持 Android 轮子构建
- 使用 `pip` 安装精选的 `.[termux]` 扩展
- 默认跳过未经测试的浏览器 / WhatsApp 引导程序

如果你需要完整的详细步骤，请参阅专门的 [Termux 指南](./termux.md)。

:::warning Windows 系统
**不支持**原生 Windows 系统。请安装 [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install)，然后在其中运行 Hermes Agent。上述安装命令在 WSL2 内部可以正常工作。
:::

### 安装程序的功能

安装程序会自动处理所有事项——包括所有依赖项（Python、Node.js、ripgrep、ffmpeg）、仓库克隆、虚拟环境创建、全局 `hermes` 命令设置以及 LLM 提供商配置。安装完成后即可开始聊天。

### 安装后操作

重新加载你的 shell 并开始聊天：

```bash
source ~/.bashrc   # 或者：source ~/.zshrc
hermes             # 开始聊天！
```

如需后续修改各项设置，请使用专用命令：

```bash
hermes model          # 选择你的 LLM 提供商和模型
hermes tools          # 配置启用哪些工具
hermes gateway setup  # 设置消息平台
hermes config set     # 设置单个配置值
hermes setup          # 或运行完整的设置向导，一次性配置所有内容
```

---

## 前置条件

唯一的前置条件是 **Git**。安装程序会自动处理其他所有内容：

- **uv**（快速 Python 包管理器）
- **Python 3.11**（通过 uv 安装，无需 sudo）
- **Node.js v22**（用于浏览器自动化和 WhatsApp 桥接）
- **ripgrep**（快速文件搜索）
- **ffmpeg**（TTS 音频格式转换）

:::info
你**不需要**手动安装 Python、Node.js、ripgrep 或 ffmpeg。安装程序会检测缺失的组件并自动安装。只需确保 `git` 可用即可（`git --version`）。
:::

:::tip Nix 用户
如果你使用 Nix（在 NixOS、macOS 或 Linux 上），有一套专用的设置路径，包含 Nix flake、声明式 NixOS 模块和可选的容器模式。请参阅 **[Nix & NixOS 设置](./nix-setup.md)** 指南。
:::

---

## 手动 / 开发者安装

如果你想克隆仓库并从源码安装——用于贡献代码、运行特定分支或完全控制虚拟环境——请参阅贡献指南中的[开发环境搭建](../developer-guide/contributing.md#development-setup)章节。

---

## 故障排除

| 问题 | 解决方案 |
|---------|----------|
| `hermes: command not found` | 重新加载你的 shell（`source ~/.bashrc`）或检查 PATH |
| `API key not set` | 运行 `hermes model` 配置你的提供商，或运行 `hermes config set OPENROUTER_API_KEY your_key` |
| 更新后配置缺失 | 运行 `hermes config check` 然后运行 `hermes config migrate` |

如需更多诊断信息，请运行 `hermes doctor`——它会准确告诉你缺少什么以及如何修复。
