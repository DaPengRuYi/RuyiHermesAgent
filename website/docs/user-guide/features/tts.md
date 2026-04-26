---
sidebar_position: 9
title: "语音与 TTS"
description: "跨所有平台的文本转语音和语音消息转录"
---

# 语音与 TTS

Hermes Agent 支持跨所有消息平台的文本转语音输出和语音消息转录。

## 文本转语音

使用九个提供商将文本转换为语音：

| 提供商 | 质量 | 成本 | API 密钥 |
|--------|------|------|---------|
| **Edge TTS**（默认） | 良好 | 免费 | 无需 |
| **ElevenLabs** | 优秀 | 付费 | `ELEVENLABS_API_KEY` |
| **OpenAI TTS** | 良好 | 付费 | `VOICE_TOOLS_OPENAI_KEY` |
| **MiniMax TTS** | 优秀 | 付费 | `MINIMAX_API_KEY` |
| **Mistral (Voxtral TTS)** | 优秀 | 付费 | `MISTRAL_API_KEY` |
| **Google Gemini TTS** | 优秀 | 免费层 | `GEMINI_API_KEY` |
| **xAI TTS** | 优秀 | 付费 | `XAI_API_KEY` |
| **NeuTTS** | 良好 | 免费（本地） | 无需 |
| **KittenTTS** | 良好 | 免费（本地） | 无需 |

### 平台投递

| 平台 | 投递方式 | 格式 |
|------|---------|------|
| Telegram | 语音气泡（内联播放） | Opus `.ogg` |
| Discord | 语音气泡（Opus/OGG），回退到文件附件 | Opus/MP3 |
| WhatsApp | 音频文件附件 | MP3 |
| CLI | 保存到 `~/.hermes/audio_cache/` | MP3 |

### 配置

```yaml
# 在 ~/.hermes/config.yaml 中
tts:
  provider: "edge"              # "edge" | "elevenlabs" | "openai" | "minimax" | "mistral" | "gemini" | "xai" | "neutts" | "kittentts"
  speed: 1.0                    # 全局速度倍增器（提供商特定设置覆盖此值）
  edge:
    voice: "en-US-AriaNeural"   # 322 种声音，74 种语言
    speed: 1.0                  # 转换为速率百分比（+/-%）
  elevenlabs:
    voice_id: "pNInz6obpgDQGcFmaJgB"  # Adam
    model_id: "eleven_multilingual_v2"
  openai:
    model: "gpt-4o-mini-tts"
    voice: "alloy"              # alloy, echo, fable, onyx, nova, shimmer
    base_url: "https://api.openai.com/v1"  # 覆盖 OpenAI 兼容 TTS 端点
    speed: 1.0                  # 0.25 - 4.0
  minimax:
    model: "speech-2.8-hd"     # speech-2.8-hd（默认），speech-2.8-turbo
    voice_id: "English_Graceful_Lady"  # 参见 https://platform.minimax.io/faq/system-voice-id
    speed: 1                    # 0.5 - 2.0
    vol: 1                      # 0 - 10
    pitch: 0                    # -12 - 12
  mistral:
    model: "voxtral-mini-tts-2603"
    voice_id: "c69964a6-ab8b-4f8a-9465-ec0925096ec8"  # Paul - Neutral（默认）
  gemini:
    model: "gemini-2.5-flash-preview-tts"  # 或 gemini-2.5-pro-preview-tts
    voice: "Kore"               # 30 种预设声音：Zephyr, Puck, Kore, Enceladus, Gacrux 等
  xai:
    voice_id: "eve"             # xAI TTS 声音（参见 https://docs.x.ai/docs/api-reference#tts）
    language: "en"              # ISO 639-1 代码
    sample_rate: 24000          # 22050 / 24000（默认）/ 44100 / 48000
    bit_rate: 128000            # MP3 比特率；仅在 codec=mp3 时适用
    # base_url: "https://api.x.ai/v1"   # 通过 XAI_BASE_URL 环境变量覆盖
  neutts:
    ref_audio: ''
    ref_text: ''
    model: neuphonic/neutts-air-q4-gguf
    device: cpu
  kittentts:
    model: KittenML/kitten-tts-nano-0.8-int8   # 25MB int8；另有：kitten-tts-micro-0.8 (41MB), kitten-tts-mini-0.8 (80MB)
    voice: Jasper                               # Jasper, Bella, Luna, Bruno, Rosie, Hugo, Kiki, Leo
    speed: 1.0                                  # 0.5 - 2.0
    clean_text: true                            # 展开数字、货币、单位
```

**速度控制**：全局 `tts.speed` 值默认适用于所有提供商。每个提供商可以用自己的 `speed` 设置覆盖它（例如 `tts.openai.speed: 1.5`）。提供商特定速度优先于全局值。默认为 `1.0`（正常速度）。

### Telegram 语音气泡和 ffmpeg

Telegram 语音气泡需要 Opus/OGG 音频格式：

- **OpenAI、ElevenLabs 和 Mistral** 原生产生 Opus —— 无需额外设置
- **Edge TTS**（默认）输出 MP3 并需要 **ffmpeg** 转换
- **MiniMax TTS** 输出 MP3 并需要 **ffmpeg** 转换以用于 Telegram 语音气泡
- **Google Gemini TTS** 输出原始 PCM 并使用 **ffmpeg** 直接编码 Opus 以用于 Telegram 语音气泡
- **xAI TTS** 输出 MP3 并需要 **ffmpeg** 转换以用于 Telegram 语音气泡
- **NeuTTS** 输出 WAV 也需要 **ffmpeg** 转换以用于 Telegram 语音气泡
- **KittenTTS** 输出 WAV 也需要 **ffmpeg** 转换以用于 Telegram 语音气泡

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Fedora
sudo dnf install ffmpeg
```

没有 ffmpeg 时，Edge TTS、MiniMax TTS、NeuTTS 和 KittenTTS 音频作为常规音频文件发送（可播放，但显示为矩形播放器而非语音气泡）。

:::tip
如果你想要语音气泡但不想安装 ffmpeg，请切换到 OpenAI、ElevenLabs 或 Mistral 提供商。
:::

## 语音消息转录（STT）

在 Telegram、Discord、WhatsApp、Slack 或 Signal 上发送的语音消息会自动转录并作为文本注入对话中。代理将转录视为普通文本。

| 提供商 | 质量 | 成本 | API 密钥 |
|--------|------|------|---------|
| **本地 Whisper**（默认） | 良好 | 免费 | 无需 |
| **Groq Whisper API** | 良好–最佳 | 免费层 | `GROQ_API_KEY` |
| **OpenAI Whisper API** | 良好–最佳 | 付费 | `VOICE_TOOLS_OPENAI_KEY` 或 `OPENAI_API_KEY` |

:::info 零配置
当 `faster-whisper` 已安装时，本地转录开箱即用。如果不可用，Hermes 也可以使用常见安装位置（如 `/opt/homebrew/bin`）中的本地 `whisper` CLI 或通过 `HERMES_LOCAL_STT_COMMAND` 使用自定义命令。
:::

### 配置

```yaml
# 在 ~/.hermes/config.yaml 中
stt:
  provider: "local"           # "local" | "groq" | "openai" | "mistral"
  local:
    model: "base"             # tiny, base, small, medium, large-v3
  openai:
    model: "whisper-1"        # whisper-1, gpt-4o-mini-transcribe, gpt-4o-transcribe
  mistral:
    model: "voxtral-mini-latest"  # voxtral-mini-latest, voxtral-mini-2602
```

### 提供商详情

**本地 (faster-whisper)** — 通过 [faster-whisper](https://github.com/SYSTRAN/faster-whisper) 在本地运行 Whisper。默认使用 CPU，如果可用则使用 GPU。模型大小：

| 模型 | 大小 | 速度 | 质量 |
|------|------|------|------|
| `tiny` | ~75 MB | 最快 | 基础 |
| `base` | ~150 MB | 快速 | 良好（默认） |
| `small` | ~500 MB | 中等 | 更好 |
| `medium` | ~1.5 GB | 较慢 | 很好 |
| `large-v3` | ~3 GB | 最慢 | 最佳 |

**Groq API** — 需要 `GROQ_API_KEY`。当你想要免费的托管 STT 选项时，是很好的云回退。

**OpenAI API** — 首先接受 `VOICE_TOOLS_OPENAI_KEY`，回退到 `OPENAI_API_KEY`。支持 `whisper-1`、`gpt-4o-mini-transcribe` 和 `gpt-4o-transcribe`。

**Mistral API (Voxtral Transcribe)** — 需要 `MISTRAL_API_KEY`。使用 Mistral 的 [Voxtral Transcribe](https://docs.mistral.ai/capabilities/audio/speech_to_text/) 模型。支持 13 种语言、说话人分离和词级时间戳。使用 `pip install hermes-agent[mistral]` 安装。

**自定义本地 CLI 回退** — 如果你想让 Hermes 直接调用本地转录命令，设置 `HERMES_LOCAL_STT_COMMAND`。命令模板支持 `{input_path}`、`{output_dir}`、`language` 和 `{model}` 占位符。

### 回退行为

如果你配置的提供商不可用，Hermes 自动回退：
- **本地 faster-whisper 不可用** → 在云提供商之前尝试本地 `whisper` CLI 或 `HERMES_LOCAL_STT_COMMAND`
- **Groq 密钥未设置** → 回退到本地转录，然后 OpenAI
- **OpenAI 密钥未设置** → 回退到本地转录，然后 Groq
- **Mistral 密钥/SDK 未设置** → 在自动检测中跳过；流向下一个可用提供商
- **什么都不可用** → 语音消息传递时附带准确的说明
