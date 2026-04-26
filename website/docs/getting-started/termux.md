---
sidebar_position: 3
title: "Android / Termux"
description: "在 Android 手机上通过 Termux 直接运行 Hermes Agent"
---

# 在 Android 上使用 Termux 运行 Hermes

这是在 Android 手机上通过 [Termux](https://termux.dev/) 直接运行 Hermes Agent 的经过测试的路径。

它为你提供了手机上可用的本地 CLI，以及目前已知可以在 Android 上正常安装的核心扩展。

## 经过测试的路径支持哪些功能？

经过测试的 Termux 包安装了：
- Hermes CLI
- 定时任务支持
- PTY/后台终端支持
- Telegram 网关支持（手动/尽力后台运行）
- MCP 支持
- Honcho 记忆支持
- ACP 支持

具体来说，它对应于：

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

## 哪些功能尚未包含在经过测试的路径中？

一些功能仍然需要桌面/服务器风格的依赖项，这些依赖项尚未为 Android 发布，或尚未在手机上验证：

- `.[all]` 目前不支持 Android
- `voice` 扩展被 `faster-whisper -> ctranslate2` 阻塞，而 `ctranslate2` 不发布 Android 轮子
- Termux 安装程序中跳过了自动浏览器 / Playwright 引导
- Termux 内部不可用基于 Docker 的终端隔离
- Android 可能仍会挂起 Termux 后台任务，因此网关持久性是尽力而为的，而非正常的托管服务

这并不妨碍 Hermes 作为手机原生 CLI 代理良好运行——只是推荐的移动安装范围有意比桌面/服务器安装更窄。

---

## 方案 1：一键安装

Hermes 现在提供了 Termux 适配的安装路径：

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

在 Termux 上，安装程序自动：
- 使用 `pkg` 安装系统包
- 使用 `python -m venv` 创建虚拟环境
- 使用 `pip` 安装 `.[termux]`
- 将 `hermes` 链接到 `$PREFIX/bin`，使其保留在你的 Termux PATH 上
- 默认跳过未经测试的浏览器 / WhatsApp 引导

如果你需要明确的命令或需要调试失败的安装，请使用下面的手动路径。

---

## 方案 2：手动安装（完全明确的步骤）

### 1. 更新 Termux 并安装系统包

```bash
pkg update
pkg install -y git python clang rust make pkg-config libffi openssl nodejs ripgrep ffmpeg
```

为什么需要这些包？
- `python` — 运行时 + venv 支持
- `git` — 克隆/更新仓库
- `clang`、`rust`、`make`、`pkg-config`、`libffi`、`openssl` — 在 Android 上构建某些 Python 依赖所需
- `nodejs` — 可选的 Node 运行时，用于超出测试核心路径的实验
- `ripgrep` — 快速文件搜索
- `ffmpeg` — 媒体 / TTS 转换

### 2. 克隆 Hermes

```bash
git clone --recurse-submodules https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
```

如果你之前克隆时没有包含子模块：

```bash
git submodule update --init --recursive
```

### 3. 创建虚拟环境

```bash
python -m venv venv
source venv/bin/activate
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
python -m pip install --upgrade pip setuptools wheel
```

`ANDROID_API_LEVEL` 对于基于 Rust / maturin 的包（如 `jiter`）很重要。

### 4. 安装经过测试的 Termux 包

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

如果你只需要最小核心代理，也可以：

```bash
python -m pip install -e '.' -c constraints-termux.txt
```

### 5. 将 `hermes` 放入你的 Termux PATH

```bash
ln -sf "$PWD/venv/bin/hermes" "$PREFIX/bin/hermes"
```

`$PREFIX/bin` 已经在 Termux 的 PATH 中，因此这使得 `hermes` 命令在新 shell 中持久可用，无需每次重新激活 venv。

### 6. 验证安装

```bash
hermes version
hermes doctor
```

### 7. 启动 Hermes

```bash
hermes
```

---

## 推荐的后续设置

### 配置模型

```bash
hermes model
```

或直接在 `~/.hermes/.env` 中设置密钥。

### 稍后重新运行完整的交互式设置向导

```bash
hermes setup
```

### 手动安装可选的 Node 依赖

经过测试的 Termux 路径有意跳过了 Node/浏览器引导。如果你之后想尝试浏览器工具：

```bash
pkg install nodejs-lts
npm install
```

浏览器工具会自动将 Termux 目录（`/data/data/com.termux/files/usr/bin`）包含在其 PATH 搜索中，因此 `agent-browser` 和 `npx` 无需额外 PATH 配置即可被发现。

在有其他文档说明之前，请将 Android 上的浏览器 / WhatsApp 工具视为实验性的。

---

## 故障排除

### 安装 `.[all]` 时出现 `No solution found`

请改用经过测试的 Termux 包：

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

目前的阻塞点是 `voice` 扩展：
- `voice` 引入 `faster-whisper`
- `faster-whisper` 依赖 `ctranslate2`
- `ctranslate2` 不发布 Android 轮子

### `uv pip install` 在 Android 上失败

请改用 Termux 路径，使用标准库 venv + `pip`：

```bash
python -m venv venv
source venv/bin/activate
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

### `jiter` / `maturin` 报告 `ANDROID_API_LEVEL` 错误

在安装前显式设置 API 级别：

```bash
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

### `hermes doctor` 报告 ripgrep 或 Node 缺失

使用 Termux 包安装它们：

```bash
pkg install ripgrep nodejs
```

### 安装 Python 包时构建失败

确保已安装构建工具链：

```bash
pkg install clang rust make pkg-config libffi openssl
```

然后重试：

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

---

## 手机上的已知限制

- Docker 后端不可用
- 经过测试的路径中不可用 `faster-whisper` 本地语音转录
- 安装程序有意跳过了浏览器自动化设置
- 一些可选扩展可能可以工作，但目前只有 `.[termux]` 被记录为经过测试的 Android 包

如果你遇到新的 Android 特有问题，请在 GitHub 上提交 issue，包含：
- 你的 Android 版本
- `termux-info`
- `python --version`
- `hermes doctor`
- 完整的安装命令和完整错误输出
