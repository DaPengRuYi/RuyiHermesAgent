---
title: 图像生成
description: 通过 FAL.ai 生成图像——9 个模型包括 FLUX 2、GPT Image（1.5 和 2）、Nano Banana Pro、Ideogram、Recraft V4 Pro 等，可通过 `hermes tools` 选择。
sidebar_label: 图像生成
sidebar_position: 6
---

# 图像生成

Hermes Agent 通过 FAL.ai 从文本提示生成图像。开箱即用支持九个模型，每个有不同的速度、质量和成本权衡。活跃模型可通过 `hermes tools` 用户配置，持久化在 `config.yaml` 中。

## 支持的模型

| 模型 | 速度 | 优势 | 价格 |
|------|------|------|------|
| `fal-ai/flux-2/klein/9b` *（默认）* | `<1s` | 快速、清晰文本 | $0.006/MP |
| `fal-ai/flux-2-pro` | ~6s | 工作室级照片写实 | $0.03/MP |
| `fal-ai/z-image/turbo` | ~2s | 双语英/中，6B 参数 | $0.005/MP |
| `fal-ai/nano-banana-pro` | ~8s | Gemini 3 Pro，推理深度，文本渲染 | $0.15/图（1K） |
| `fal-ai/gpt-image-1.5` | ~15s | 提示遵循 | $0.034/图 |
| `fal-ai/gpt-image-2` | ~20s | SOTA 文本渲染 + CJK，世界感知照片写实 | $0.04–0.06/图 |
| `fal-ai/ideogram/v3` | ~5s | 最佳排版 | $0.03–0.09/图 |
| `fal-ai/recraft/v4/pro/text-to-image` | ~8s | 设计、品牌系统、生产就绪 | $0.25/图 |
| `fal-ai/qwen-image` | ~12s | 基于 LLM，复杂文本 | $0.02/MP |

价格为撰写时 FAL 的定价；查看 [fal.ai](https://fal.ai/) 获取当前价格。

## 设置

:::tip Nous 订阅者
如果你有付费的 [Nous Portal](https://portal.nousresearch.com) 订阅，你可以通过**[工具网关](tool-gateway.md)**使用图像生成，无需 FAL API 密钥。你的模型选择在两条路径间持久化。

如果托管网关对特定模型返回 `HTTP 4xx`，该模型尚未在门户端代理——代理会告诉你，并提供补救步骤（设置 `FAL_KEY` 直接访问，或选择其他模型）。
:::

### 获取 FAL API 密钥

1. 在 [fal.ai](https://fal.ai/) 注册
2. 从仪表板生成 API 密钥

### 配置并选择模型

运行 tools 命令：

```bash
hermes tools
```

导航到 **🎨 Image Generation**，选择你的后端（Nous Subscription 或 FAL.ai），然后选择器在列对齐表格中显示所有支持的模型——方向键导航，Enter 选择：

```
  Model                          Speed    Strengths                    Price
  fal-ai/flux-2/klein/9b         <1s      Fast, crisp text             $0.006/MP   ← currently in use
  fal-ai/flux-2-pro              ~6s      Studio photorealism          $0.03/MP
  fal-ai/z-image/turbo           ~2s      Bilingual EN/CN, 6B          $0.005/MP
  ...
```

你的选择保存到 `config.yaml`：

```yaml
image_gen:
  model: fal-ai/flux-2/klein/9b
  use_gateway: false            # 使用 Nous Subscription 时为 true
```

### GPT-Image 质量

`fal-ai/gpt-image-1.5` 和 `fal-ai/gpt-image-2` 请求质量固定为 `medium`（1024×1024 时约 $0.034–$0.06/图）。我们不将 `low` / `high` 层级作为面向用户的选项暴露，以便 Nous Portal 计费在所有用户间保持可预测——层级间成本差距为 3-22 倍。如果你想要更便宜的选项，选择 Klein 9B 或 Z-Image Turbo；如果你想要更高质量，使用 Nano Banana Pro 或 Recraft V4 Pro。

## 使用

面向代理的模式有意最小化——模型使用你配置的任何内容：

```
Generate an image of a serene mountain landscape with cherry blossoms
```

```
Create a square portrait of a wise old owl — use the typography model
```

```
Make me a futuristic cityscape, landscape orientation
```

## 宽高比

从代理的角度，每个模型接受相同的三种宽高比。内部，每个模型的原生尺寸规格自动填充：

| 代理输入 | image_size（flux/z-image/qwen/recraft/ideogram） | aspect_ratio（nano-banana-pro） | image_size（gpt-image-1.5） | image_size（gpt-image-2） |
|----------|---|---|---|---|
| `landscape` | `landscape_16_9` | `16:9` | `1536x1024` | `landscape_4_3`（1024×768） |
| `square` | `square_hd` | `1:1` | `1024x1024` | `square_hd`（1024×1024） |
| `portrait` | `portrait_16_9` | `9:16` | `1024x1536` | `portrait_4_3`（768×1024） |

GPT Image 2 映射到 4:3 预设而非 16:9，因为其最小像素数为 655,360——`landscape_16_9` 预设（1024×576 = 589,824）会被拒绝。

此转换在 `_build_fal_payload()` 中发生——代理代码永远不需要知道每模型模式差异。

## 自动放大

通过 FAL 的 **Clarity Upscaler** 放大按模型控制：

| 模型 | 放大？ | 原因 |
|------|--------|------|
| `fal-ai/flux-2-pro` | ✓ | 向后兼容（曾是选择器前的默认） |
| 所有其他 | ✗ | 快速模型会失去亚秒价值；高分辨率模型不需要 |

放大运行时，使用以下设置：

| 设置 | 值 |
|------|---|
| 放大倍数 | 2× |
| 创造力 | 0.35 |
| 相似度 | 0.6 |
| 引导比例 | 4 |
| 推理步骤 | 18 |

如果放大失败（网络问题、速率限制），自动返回原始图像。

## 内部工作原理

1. **模型解析** — `_resolve_fal_model()` 从 `config.yaml` 读取 `image_gen.model`，回退到 `FAL_IMAGE_MODEL` 环境变量，然后到 `fal-ai/flux-2/klein/9b`。
2. **载荷构建** — `_build_fal_payload()` 将你的 `aspect_ratio` 转换为模型原生格式（预设枚举、宽高比枚举或 GPT 字面量），合并模型默认参数，应用任何调用者覆盖，然后过滤到模型的 `supports` 白名单以确保不支持的键永远不会发送。
3. **提交** — `_submit_fal_request()` 通过直接 FAL 凭据或托管 Nous 网关路由。
4. **放大** — 仅当模型元数据有 `upscale: True` 时运行。
5. **投递** — 最终图像 URL 返回给代理，代理发出 `MEDIA:<url>` 标签，平台适配器转换为原生媒体。

## 调试

启用调试日志：

```bash
export IMAGE_TOOLS_DEBUG=true
```

调试日志输出到 `./logs/image_tools_debug_<session_id>.json`，包含每次调用的详细信息（模型、参数、计时、错误）。

## 平台投递

| 平台 | 投递方式 |
|------|---------|
| **CLI** | 图像 URL 作为 markdown `![](url)` 打印——点击打开 |
| **Telegram** | 带提示作为标题的照片消息 |
| **Discord** | 嵌入消息中 |
| **Slack** | Slack 展开 URL |
| **WhatsApp** | 媒体消息 |
| **其他** | 纯文本中的 URL |

## 限制

- **需要 FAL 凭据**（直接 `FAL_KEY` 或 Nous Subscription）
- **仅文本到图像** — 无修复、img2img 或通过此工具编辑
- **临时 URL** — FAL 返回托管 URL，在数小时/数天后过期；需要时本地保存
- **每模型约束** — 一些模型不支持 `seed`、`num_inference_steps` 等。`supports` 过滤器静默丢弃不支持的参数；这是预期行为
