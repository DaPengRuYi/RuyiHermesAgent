---
title: 视觉与图像粘贴
description: 从剪贴板粘贴图像到 Hermes CLI 进行多模态视觉分析。
sidebar_label: 视觉与图像粘贴
sidebar_position: 7
---

# 视觉与图像粘贴

Hermes Agent 支持**多模态视觉** —— 你可以直接从剪贴板粘贴图像到 CLI 中，并要求代理分析、描述或处理它们。图像作为 base64 编码的内容块发送给模型，因此任何具有视觉能力的模型都可以处理它们。

## 工作原理

1. 复制图像到剪贴板（截图、浏览器图像等）
2. 使用以下方法之一附加它
3. 输入你的问题并按 Enter
4. 图像显示为输入上方的 `[📎 Image #1]` 徽章
5. 提交时，图像作为视觉内容块发送给模型

你可以在发送前附加多个图像 —— 每个都有自己的徽章。按 `Ctrl+C` 清除所有附加的图像。

图像以带时间戳文件名的 PNG 文件保存到 `~/.hermes/images/`。

## 粘贴方法

如何附加图像取决于你的终端环境。并非所有方法在任何地方都有效 —— 以下是完整说明：

### `/paste` 命令

**最可靠的显式图像附加回退。**

```
/paste
```

输入 `/paste` 并按 Enter。Hermes 检查你的剪贴板是否有图像并附加它。当你的终端重写 `Cmd+V`/`Ctrl+V`，或当你仅复制了图像且没有括号粘贴文本有效载荷可检查时，这是最安全的选项。

### Ctrl+V / Cmd+V

Hermes 现在将粘贴视为分层流程：
- 首先正常文本粘贴
- 如果终端未干净地传递文本，则回退到原生剪贴板 / OSC52 文本
- 当剪贴板或粘贴的有效载荷解析为图像或图像路径时进行图像附加

这意味着粘贴的 macOS 截图临时路径和 `file://...` 图像 URI 可以立即附加，而不是作为原始文本留在编辑器中。

:::warning
如果你的剪贴板**只有图像**（没有文本），终端仍然无法直接发送二进制图像字节。使用 `/paste` 作为显式图像附加回退。
:::

### `/terminal-setup` 用于 VS Code / Cursor / Windsurf

如果你在 macOS 上的本地 VS Code 系列集成终端内运行 TUI，Hermes 可以安装推荐的 `workbench.action.terminal.sendSequence` 绑定以获得更好的多行和撤销/重做一致性：

```text
/terminal-setup
```

当 `Cmd+Enter`、`Cmd+Z` 或 `Shift+Cmd+Z` 被 IDE 拦截时，这特别有用。仅在本地机器上运行 —— 不要在 SSH 会话内运行。

## 平台兼容性

| 环境 | `/paste` | Cmd/Ctrl+V | `/terminal-setup` | 说明 |
|------|:---:|:---:|:---:|------|
| **macOS Terminal / iTerm2** | ✅ | ✅ | 不适用 | 最佳体验 —— 原生剪贴板 + 截图路径恢复 |
| **Apple Terminal** | ✅ | ✅ | 不适用 | 如果 Cmd+←/→/⌫ 被重写，使用 Ctrl+A / Ctrl+E / Ctrl+U 回退 |
| **Linux X11 桌面** | ✅ | ✅ | 不适用 | 需要 `xclip`（`apt install xclip`） |
| **Linux Wayland 桌面** | ✅ | ✅ | 不适用 | 需要 `wl-paste`（`apt install wl-clipboard`） |
| **WSL2 (Windows Terminal)** | ✅ | ✅ | 不适用 | 使用 `powershell.exe` —— 无需额外安装 |
| **VS Code / Cursor / Windsurf（本地）** | ✅ | ✅ | ✅ | 推荐以获得更好的 Cmd+Enter / 撤销 / 重做一致性 |
| **VS Code / Cursor / Windsurf（SSH）** | ❌² | ❌² | ❌³ | 改在本地机器上运行 `/terminal-setup` |
| **SSH 终端（任何）** | ❌² | ❌² | 不适用 | 远程剪贴板不可访问 |

² 参见下方 [SSH 和远程会话](#ssh-与远程会话)
³ 该命令写入本地 IDE 键绑定，不应从远程主机运行

## 平台特定设置

### macOS

**无需设置。** Hermes 使用 `osascript`（macOS 内置）读取剪贴板。为获得更快性能，可选安装 `pngpaste`：

```bash
brew install pngpaste
```

### Linux (X11)

安装 `xclip`：

```bash
# Ubuntu/Debian
sudo apt install xclip

# Fedora
sudo dnf install xclip

# Arch
sudo pacman -S xclip
```

### Linux (Wayland)

现代 Linux 桌面（Ubuntu 22.04+、Fedora 34+）通常默认使用 Wayland。安装 `wl-clipboard`：

```bash
# Ubuntu/Debian
sudo apt install wl-clipboard

# Fedora
sudo dnf install wl-clipboard

# Arch
sudo pacman -S wl-clipboard
```

:::tip 如何检查是否在 Wayland 上
```bash
echo $XDG_SESSION_TYPE
# "wayland" = Wayland, "x11" = X11, "tty" = 无显示服务器
```
:::

### WSL2

**无需额外设置。** Hermes 自动检测 WSL2（通过 `/proc/version`）并使用 `powershell.exe` 通过 .NET 的 `System.Windows.Forms.Clipboard` 访问 Windows 剪贴板。这内置于 WSL2 的 Windows 互操作中 —— `powershell.exe` 默认可用。

剪贴板数据通过 base64 编码的 PNG 在 stdout 上传输，因此无需文件路径转换或临时文件。

:::info WSLg 说明
如果你运行 WSLg（带 GUI 支持的 WSL2），Hermes 先尝试 PowerShell 路径，然后回退到 `wl-paste`。WSLg 的剪贴板桥仅支持 BMP 格式的图像 —— Hermes 使用 Pillow（如果已安装）或 ImageMagick 的 `convert` 命令自动将 BMP 转换为 PNG。
:::

#### 验证 WSL2 剪贴板访问

```bash
# 1. 检查 WSL 检测
grep -i microsoft /proc/version

# 2. 检查 PowerShell 是否可访问
which powershell.exe

# 3. 复制图像，然后检查
powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::ContainsImage()"
# 应输出 "True"
```

## SSH 和远程会话

**剪贴板图像粘贴在 SSH 上不能完全工作。** 当你 SSH 到远程机器时，Hermes CLI 在远程主机上运行。剪贴板工具（`xclip`、`wl-paste`、`powershell.exe`、`osascript`）读取运行它们的机器的剪贴板 —— 即远程服务器，而非你的本地机器。因此你的本地剪贴板图像从远程端不可访问。

文本有时仍可通过终端粘贴或 OSC52 桥接，但图像剪贴板访问和本地截图临时路径仍绑定到运行 Hermes 的机器。

### SSH 的解决方法

1. **上传图像文件** —— 在本地保存图像，通过 `scp`、VSCode 的文件资源管理器（拖放）或任何文件传输方法上传到远程服务器。然后通过路径引用它。*（计划在未来版本中添加 `/attach <filepath>` 命令。）*

2. **使用 URL** —— 如果图像在线可访问，直接在消息中粘贴 URL。代理可以使用 `vision_analyze` 直接查看任何图像 URL。

3. **X11 转发** —— 使用 `ssh -X` 连接以转发 X11。这让远程机器上的 `xclip` 访问你的本地 X11 剪贴板。需要本地运行 X 服务器（macOS 上的 XQuartz，Linux X11 桌面内置）。大图像时较慢。

4. **使用消息平台** —— 通过 Telegram、Discord、Slack 或 WhatsApp 发送图像给 Hermes。这些平台原生处理图像上传，不受剪贴板/终端限制影响。

## 为什么终端不能粘贴图像

这是一个常见的困惑来源，以下是技术解释：

终端是**基于文本的**界面。当你按 Ctrl+V（或 Cmd+V）时，终端模拟器：

1. 读取剪贴板中的**文本内容**
2. 用[括号粘贴](https://en.wikipedia.org/wiki/Bracketed-paste)转义序列包装它
3. 通过终端的文本流将其发送给应用程序

如果剪贴板仅包含图像（没有文本），终端没有内容可发送。没有用于二进制图像数据的标准终端转义序列。终端什么都不做。

这就是为什么 Hermes 使用单独的剪贴板检查 —— 它不是通过终端粘贴事件接收图像数据，而是通过子进程直接调用操作系统级工具（`osascript`、`powershell.exe`、`xclip`、`wl-paste`）独立读取剪贴板。

## 支持的模型

图像粘贴适用于任何具有视觉能力的模型。图像以 base64 编码的数据 URL 在 OpenAI 视觉内容格式中发送：

```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/png;base64,..."
  }
}
```

大多数现代模型支持此格式，包括 GPT-4 Vision、Claude（带视觉）、Gemini 和通过 OpenRouter 提供的开源多模态模型。
