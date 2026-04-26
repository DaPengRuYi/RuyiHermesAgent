---
sidebar_position: 8
title: "在 Hermes 中使用语音模式"
description: "在 CLI、Telegram、Discord 和 Discord 语音频道中设置和使用 Hermes 语音模式的实用指南"
---

# 在 Hermes 中使用语音模式

本指南是[语音模式功能参考](/docs/user-guide/features/voice-mode)的实用伴侣。

如果功能页面解释了语音模式能做什么，本指南展示如何实际很好地使用它。

## 语音模式适合什么

语音模式在以下情况特别有用：
- 你想要免提 CLI 工作流
- 你想要 Telegram 或 Discord 中的语音回复
- 你想要 Hermes 坐在 Discord 语音频道中进行实时对话
- 你想要快速的想法捕捉、调试或在走动时来回交流而不是打字

## 选择你的语音模式设置

Hermes 中实际上有三种不同的语音体验。

| 模式 | 最适合 | 平台 |
|---|---|---|
| 交互式麦克风循环 | 编码或研究时的个人免提使用 | CLI |
| 聊天中的语音回复 | 在正常消息旁的语音回复 | Telegram、Discord |
| 实时语音频道机器人 | VC 中的群组或个人实时对话 | Discord 语音频道 |

一个好的路径是：
1. 先让文本工作
2. 其次启用语音回复
3. 如果你想要完整体验，最后转到 Discord 语音频道

## 步骤 1：确保正常的 Hermes 先工作

在接触语音模式之前，验证：
- Hermes 启动
- 你的提供者已配置
- 代理可以正常回答文本提示

```bash
hermes
```

问一些简单的事情：

```text
你有什么可用的工具？
```

如果这还不稳固，先修复文本模式。

## 步骤 2：安装正确的额外依赖

### CLI 麦克风 + 播放

```bash
pip install "hermes-agent[voice]"
```

### 消息平台

```bash
pip install "hermes-agent[messaging]"
```

### 高级 ElevenLabs TTS

```bash
pip install "hermes-agent[tts-premium]"
```

### 本地 NeuTTS（可选）

```bash
python -m pip install -U neutts[all]
```

### 全部

```bash
pip install "hermes-agent[all]"
```

## 步骤 3：安装系统依赖

### macOS

```bash
brew install portaudio ffmpeg opus
brew install espeak-ng
```

### Ubuntu / Debian

```bash
sudo apt install portaudio19-dev ffmpeg libopus0
sudo apt install espeak-ng
```

为什么这些重要：
- `portaudio` → CLI 语音模式的麦克风输入/播放
- `ffmpeg` → TTS 和消息投递的音频转换
- `opus` → Discord 语音编解码器支持
- `espeak-ng` → NeuTTS 的音素化后端

## 步骤 4：选择 STT 和 TTS 提供者

Hermes 支持本地和云端语音栈。

### 最简单/最便宜的设置

使用本地 STT 和免费的 Edge TTS：
- STT 提供者：`local`
- TTS 提供者：`edge`

这通常是最佳起点。

### 环境文件示例

添加到 `~/.hermes/.env`：

```bash
# 云 STT 选项（本地不需要密钥）
GROQ_API_KEY=***
VOICE_TOOLS_OPENAI_KEY=***

# 高级 TTS（可选）
ELEVENLABS_API_KEY=***
```

### 提供者推荐

#### 语音转文本

- `local` → 隐私和零成本使用的最佳默认
- `groq` → 非常快的云转录
- `openai` → 好的付费回退

#### 文本转语音

- `edge` → 免费且对大多数用户足够好
- `neutts` → 免费本地/设备端 TTS
- `elevenlabs` → 最佳质量
- `openai` → 好的中间选择
- `mistral` → 多语言，原生 Opus

### 如果你使用 `hermes setup`

如果你在设置向导中选择 NeuTTS，Hermes 会检查 `neutts` 是否已安装。如果缺失，向导告诉你 NeuTTS 需要 Python 包 `neutts` 和系统包 `espeak-ng`，主动为你安装它们，使用你的平台包管理器安装 `espeak-ng`，然后运行：

```bash
python -m pip install -U neutts[all]
```

如果你跳过该安装或失败，向导回退到 Edge TTS。

## 步骤 5：推荐配置

```yaml
voice:
  record_key: "ctrl+b"
  max_recording_seconds: 120
  auto_tts: false
  beep_enabled: true
  silence_threshold: 200
  silence_duration: 3.0

stt:
  provider: "local"
  local:
    model: "base"

tts:
  provider: "edge"
  edge:
    voice: "en-US-AriaNeural"
```

这对大多数人来说是一个好的保守默认值。

如果你想要本地 TTS，将 `tts` 块切换为：

```yaml
tts:
  provider: "neutts"
  neutts:
    ref_audio: ''
    ref_text: ''
    model: neuphonic/neutts-air-q4-gguf
    device: cpu
```

## 用例 1：CLI 语音模式

## 开启

启动 Hermes：

```bash
hermes
```

在 CLI 中：

```text
/voice on
```

### 录制流程

默认键：
- `Ctrl+B`

工作流：
1. 按 `Ctrl+B`
2. 说话
3. 等待静音检测自动停止录制
4. Hermes 转录并回复
5. 如果 TTS 开启，它说出答案
6. 循环可以自动重新开始以持续使用

### 有用的命令

```text
/voice
/voice on
/voice off
/voice tts
/voice status
```

### 好的 CLI 工作流

#### 走上来调试

说：

```text
我一直遇到 docker 权限错误。帮我调试。
```

然后免提继续：
- "再读一遍最后一个错误"
- "用更简单的术语解释根本原因"
- "现在给我确切的修复方法"

#### 研究/头脑风暴

非常适合：
- 走动时思考
- 口述半成形的想法
- 让 Hermes 实时结构化你的想法

#### 无障碍/少打字会话

如果打字不方便，语音模式是保持在完整 Hermes 循环中的最快方式之一。

## 调整 CLI 行为

### 静音阈值

如果 Hermes 开始/停止太激进，调整：

```yaml
voice:
  silence_threshold: 250
```

更高的阈值 = 更不敏感。

### 静音持续时间

如果你在句子之间停顿很多，增加：

```yaml
voice:
  silence_duration: 4.0
```

### 录制键

如果 `Ctrl+B` 与你的终端或 tmux 习惯冲突：

```yaml
voice:
  record_key: "ctrl+space"
```

## 用例 2：Telegram 或 Discord 中的语音回复

此模式比完整的语音频道更简单。

Hermes 保持为普通聊天机器人，但可以说出回复。

### 启动网关

```bash
hermes gateway
```

### 开启语音回复

在 Telegram 或 Discord 中：

```text
/voice on
```

或

```text
/voice tts
```

### 模式

| 模式 | 含义 |
|---|---|
| `off` | 仅文本 |
| `voice_only` | 仅当用户发送语音时说话 |
| `all` | 说出每个回复 |

### 何时使用哪种模式

- `/voice on` 如果你只想要语音来源消息的语音回复
- `/voice tts` 如果你想要始终完整的语音助手

### 好的消息工作流

#### 手机上的 Telegram 助手

在以下情况使用：
- 你离开了机器
- 你想要发送语音笔记并获得快速语音回复
- 你想要 Hermes 像一个便携式研究或运维助手一样运作

#### Discord DM 带语音输出

当你想要私密交互而没有服务器频道提及行为时有用。

## 用例 3：Discord 语音频道

这是最高级的模式。

Hermes 加入 Discord VC，监听用户语音，转录它，运行正常的代理管道，并将回复说回频道。

## 所需的 Discord 权限

除了正常的文本机器人设置，确保机器人有：
- Connect
- Speak
- 最好 Use Voice Activity

同时在开发者门户中启用特权意图：
- Presence Intent
- Server Members Intent
- Message Content Intent

## 加入和离开

在机器人所在的 Discord 文本频道中：

```text
/voice join
/voice leave
/voice status
```

### 加入后发生什么

- 用户在 VC 中说话
- Hermes 检测语音边界
- 转录发布在关联的文本频道中
- Hermes 以文本和音频回复
- 文本频道是发出 `/voice join` 的那个

### Discord VC 使用的最佳实践

- 保持 `DISCORD_ALLOWED_USERS` 严格
- 先使用专用的机器人/测试频道
- 在尝试 VC 模式之前，在普通文本聊天语音模式下验证 STT 和 TTS 工作

## 语音质量推荐

### 最佳质量设置

- STT：本地 `large-v3` 或 Groq `whisper-large-v3`
- TTS：ElevenLabs

### 最佳速度/便利设置

- STT：本地 `base` 或 Groq
- TTS：Edge

### 最佳零成本设置

- STT：本地
- TTS：Edge

## 常见失败模式

### "No audio device found"

安装 `portaudio`。

### "Bot joins but hears nothing"

检查：
- 你的 Discord 用户 ID 在 `DISCORD_ALLOWED_USERS` 中
- 你没有被静音
- 特权意图已启用
- 机器人有 Connect/Speak 权限

### "It transcribes but does not speak"

检查：
- TTS 提供者配置
- ElevenLabs 或 OpenAI 的 API 密钥/配额
- Edge 转换路径的 `ffmpeg` 安装

### "Whisper outputs garbage"

尝试：
- 更安静的环境
- 更高的 `silence_threshold`
- 不同的 STT 提供者/模型
- 更短、更清晰的语句

### "It works in DMs but not in server channels"

这通常是提及策略。

默认情况下，机器人在 Discord 服务器文本频道中需要 `@mention`，除非另有配置。

## 建议的第一周设置

如果你想要最短的成功路径：

1. 让文本 Hermes 工作
2. 安装 `hermes-agent[voice]`
3. 使用本地 STT + Edge TTS 的 CLI 语音模式
4. 然后在 Telegram 或 Discord 中启用 `/voice on`
5. 之后才尝试 Discord VC 模式

这个进度保持调试面小。

## 接下来阅读

- [语音模式功能参考](/docs/user-guide/features/voice-mode)
- [消息网关](/docs/user-guide/messaging)
- [Discord 设置](/docs/user-guide/messaging/discord)
- [Telegram 设置](/docs/user-guide/messaging/telegram)
- [配置](/docs/user-guide/configuration)
