---
sidebar_position: 5
title: "捆绑技能目录"
description: "Hermes Agent 附带的捆绑技能目录"
---

# 捆绑技能目录

Hermes 附带一个大型内置技能库，在安装时复制到 `~/.hermes/skills/`。下面的每个技能都链接到一个专门页面，包含其完整定义、设置和用法。

如果某个技能在此列表中缺失但存在于仓库中，目录由 `website/scripts/generate-skill-docs.py` 重新生成。

## apple

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`apple-notes`](/docs/user-guide/skills/bundled/apple/apple-apple-notes) | 通过 macOS 上的 memo CLI 管理 Apple Notes（创建、查看、搜索、编辑）。 | `apple/apple-notes` |
| [`apple-reminders`](/docs/user-guide/skills/bundled/apple/apple-apple-reminders) | 通过 remindctl CLI 管理 Apple Reminders（列出、添加、完成、删除）。 | `apple/apple-reminders` |
| [`findmy`](/docs/user-guide/skills/bundled/apple/apple-findmy) | 通过 macOS 上的 FindMy.app 使用 AppleScript 和屏幕截图追踪 Apple 设备和 AirTag。 | `apple/findmy` |
| [`imessage`](/docs/user-guide/skills/bundled/apple/apple-imessage) | 通过 macOS 上的 imsg CLI 发送和接收 iMessage/SMS。 | `apple/imessage` |

## autonomous-ai-agents

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`claude-code`](/docs/user-guide/skills/bundled/autonomous-ai-agents/autonomous-ai-agents-claude-code) | 将编码任务委派给 Claude Code（Anthropic 的 CLI 代理）。用于构建功能、重构、PR 审查和迭代编码。需要安装 claude CLI。 | `autonomous-ai-agents/claude-code` |
| [`codex`](/docs/user-guide/skills/bundled/autonomous-ai-agents/autonomous-ai-agents-codex) | 将编码任务委派给 OpenAI Codex CLI 代理。用于构建功能、重构、PR 审查和批量 issue 修复。需要 codex CLI 和 git 仓库。 | `autonomous-ai-agents/codex` |
| [`hermes-agent`](/docs/user-guide/skills/bundled/autonomous-ai-agents/autonomous-ai-agents-hermes-agent) | 使用和扩展 Hermes Agent 的完整指南 — CLI 用法、设置、配置、生成额外代理、网关平台、技能、语音、工具、profile 和简洁的贡献者参考。在帮助用户……时加载此技能 | `autonomous-ai-agents/hermes-agent` |
| [`opencode`](/docs/user-guide/skills/bundled/autonomous-ai-agents/autonomous-ai-agents-opencode) | 将编码任务委派给 OpenCode CLI 代理，用于功能实现、重构、PR 审查和长时间运行的自主会话。需要安装并认证 opencode CLI。 | `autonomous-ai-agents/opencode` |

## creative

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`architecture-diagram`](/docs/user-guide/skills/bundled/creative/creative-architecture-diagram) | 生成软件系统和云基础设施的暗色主题 SVG 图表，作为带有内联 SVG 图形的独立 HTML 文件。语义组件颜色（cyan=前端、emerald=后端、violet=数据库、amber=云/AWS、rose=安全…… | `creative/architecture-diagram` |
| [`ascii-art`](/docs/user-guide/skills/bundled/creative/creative-ascii-art) | 使用 pyfiglet（571 种字体）、cowsay、boxes、toilet、图像转 ASCII、远程 API（asciified、ascii.co.uk）和 LLM 回退生成 ASCII 艺术。无需 API 密钥。 | `creative/ascii-art` |
| [`ascii-video`](/docs/user-guide/skills/bundled/creative/creative-ascii-video) | ASCII 艺术视频的生产管道 — 任何格式。将视频/音频/图像/生成输入转换为彩色 ASCII 字符视频输出（MP4、GIF、图像序列）。涵盖：视频转 ASCII 转换、音频响应式音乐可视化器…… | `creative/ascii-video` |
| [`baoyu-comic`](/docs/user-guide/skills/bundled/creative/creative-baoyu-comic) | 支持多种艺术风格和语调的知识漫画创作者。创建带有详细面板布局和序列图像生成的原创教育漫画。当用户要求创建"知识漫画"、"教育漫画"、"biography comic"、"tutorial……时使用 | `creative/baoyu-comic` |
| [`baoyu-infographic`](/docs/user-guide/skills/bundled/creative/creative-baoyu-infographic) | 生成具有 21 种布局类型和 21 种视觉风格的专业信息图。分析内容，推荐布局×风格组合，生成可发布的信息图。当用户要求创建"infographic"、"visual summa……时使用 | `creative/baoyu-infographic` |
| [`ideation`](/docs/user-guide/skills/bundled/creative/creative-creative-ideation) | 通过创意约束生成项目创意。当用户说"我想做点什么"、"给我一个项目创意"、"我无聊了"、"我应该做什么"、"给我灵感"或任何"我有工具但没有方向"的变体时使用。适用于…… | `creative/creative-ideation` |
| [`design-md`](/docs/user-guide/skills/bundled/creative/creative-design-md) | 编写、验证、差异比较和导出 DESIGN.md 文件 — Google 的开源格式规范，为编码代理提供持久的、结构化的设计系统理解（令牌 + 原理在一个文件中）。在构建设计系统……时使用 | `creative/design-md` |
| [`excalidraw`](/docs/user-guide/skills/bundled/creative/creative-excalidraw) | 使用 Excalidraw JSON 格式创建手绘风格图表。生成架构图、流程图、序列图、概念图等的 .excalidraw 文件。文件可以在 excalidraw.com 打开或上传以获取可分享链接…… | `creative/excalidraw` |
| [`manim-video`](/docs/user-guide/skills/bundled/creative/creative-manim-video) | 使用 Manim Community Edition 的数学和技术动画生产管道。创建 3Blue1Brown 风格的解释视频、算法可视化、方程推导、架构图和数据故事。在用户想要……时使用 | `creative/manim-video` |
| [`p5js`](/docs/user-guide/skills/bundled/creative/creative-p5js) | 使用 p5.js 的交互式和生成式视觉艺术生产管道。创建基于浏览器的草图、生成艺术、数据可视化、交互体验、3D 场景、音频响应式视觉效果和运动图形 — 导出为…… | `creative/p5js` |
| [`pixel-art`](/docs/user-guide/skills/bundled/creative/creative-pixel-art) | 将图像转换为具有硬件准确调色板（NES、Game Boy、PICO-8、C64 等）的复古像素艺术，并将其动画化为短视频。预设涵盖街机、SNES 和 10+ 时代正确的外观。使用 `clarify` 让用户选择风格…… | `creative/pixel-art` |
| [`popular-web-designs`](/docs/user-guide/skills/bundled/creative/creative-popular-web-designs) | 54 个从真实网站提取的生产质量设计系统。加载模板以生成匹配 Stripe、Linear、Vercel、Notion、Airbnb 等网站视觉标识的 HTML/CSS。每个模板包含颜色、字体…… | `creative/popular-web-designs` |
| [`songwriting-and-ai-music`](/docs/user-guide/skills/bundled/creative/creative-songwriting-and-ai-music) | 歌曲创作技巧、AI 音乐生成提示（Suno 为重点）、戏仿/改编技巧、语音技巧和经验教训。这些是工具和想法，不是规则。当艺术需要时打破任何规则。 | `creative/songwriting-and-ai-music` |

## data-science

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`jupyter-live-kernel`](/docs/user-guide/skills/bundled/data-science/data-science-jupyter-live-kernel) | 使用 live Jupyter kernel 通过 hamelnb 进行有状态的迭代 Python 执行。当任务涉及探索、迭代或检查中间结果时加载此技能 — 数据科学、ML 实验、API 探索或构建…… | `data-science/jupyter-live-kernel` |

## devops

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`webhook-subscriptions`](/docs/user-guide/skills/bundled/devops/devops-webhook-subscriptions) | 创建和管理 webhook 订阅以实现事件驱动的代理激活，或用于直接推送通知（零 LLM 成本）。当用户希望外部服务触发代理运行或向聊天推送通知时使用。 | `devops/webhook-subscriptions` |

## dogfood

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`dogfood`](/docs/user-guide/skills/bundled/dogfood/dogfood-dogfood) | Web 应用的系统性探索性 QA 测试 — 发现 bug、捕获证据并生成结构化报告 | `dogfood` |

## email

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`himalaya`](/docs/user-guide/skills/bundled/email/email-himalaya) | 通过 IMAP/SMTP 管理电子邮件的 CLI。使用 himalaya 从终端列出、阅读、撰写、回复、转发、搜索和组织电子邮件。支持多个帐户和使用 MML（MIME Meta Language）的消息撰写。 | `email/himalaya` |

## gaming

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`minecraft-modpack-server`](/docs/user-guide/skills/bundled/gaming/gaming-minecraft-modpack-server) | 从 CurseForge/Modrinth 服务器包 zip 设置模组 Minecraft 服务器。涵盖 NeoForge/Forge 安装、Java 版本、JVM 调优、防火墙、局域网配置、备份和启动脚本。 | `gaming/minecraft-modpack-server` |
| [`pokemon-player`](/docs/user-guide/skills/bundled/gaming/gaming-pokemon-player) | 通过无头模拟自主玩 Pokemon 游戏。启动游戏服务器，从 RAM 读取结构化游戏状态，做出战略决策并发送按钮输入 — 全部从终端完成。 | `gaming/pokemon-player` |

## github

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`codebase-inspection`](/docs/user-guide/skills/bundled/github/github-codebase-inspection) | 使用 pygount 检查和分析代码库，进行 LOC 计数、语言分解和代码与注释比率。在被要求检查代码行数、仓库大小、语言组成或代码库统计时使用。 | `github/codebase-inspection` |
| [`github-auth`](/docs/user-guide/skills/bundled/github/github-github-auth) | 使用 git（普遍可用）或 gh CLI 为代理设置 GitHub 认证。涵盖 HTTPS 令牌、SSH 密钥、凭据助手和 gh auth — 带有自动选择正确方法的检测流程。 | `github/github-auth` |
| [`github-code-review`](/docs/user-guide/skills/bundled/github/github-github-code-review) | 通过分析 git diff、在 PR 上留下内联评论和执行彻底的推送前审查来审查代码更改。与 gh CLI 配合使用，或回退到 git + GitHub REST API（通过 curl）。 | `github/github-code-review` |
| [`github-issues`](/docs/user-guide/skills/bundled/github/github-github-issues) | 创建、管理、分类和关闭 GitHub issue。搜索现有 issue、添加标签、分配人员和链接到 PR。与 gh CLI 配合使用，或回退到 git + GitHub REST API（通过 curl）。 | `github/github-issues` |
| [`github-pr-workflow`](/docs/user-guide/skills/bundled/github/github-github-pr-workflow) | 完整的拉取请求生命周期 — 创建分支、提交更改、打开 PR、监控 CI 状态、自动修复失败和合并。与 gh CLI 配合使用，或回退到 git + GitHub REST API（通过 curl）。 | `github/github-pr-workflow` |
| [`github-repo-management`](/docs/user-guide/skills/bundled/github/github-github-repo-management) | 克隆、创建、fork、配置和管理 GitHub 仓库。管理远程、密钥、发布和工作流。与 gh CLI 配合使用，或回退到 git + GitHub REST API（通过 curl）。 | `github/github-repo-management` |

## mcp

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`native-mcp`](/docs/user-guide/skills/bundled/mcp/mcp-native-mcp) | 内置 MCP（模型上下文协议）客户端，连接到外部 MCP 服务器，发现其工具并将它们注册为原生 Hermes Agent 工具。支持 stdio 和 HTTP 传输，具有自动重连、安全过滤…… | `mcp/native-mcp` |

## media

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`gif-search`](/docs/user-guide/skills/bundled/media/media-gif-search) | 使用 curl 从 Tenor 搜索和下载 GIF。除 curl 和 jq 外无依赖。用于查找反应 GIF、创建视觉内容和在聊天中发送 GIF。 | `media/gif-search` |
| [`heartmula`](/docs/user-guide/skills/bundled/media/media-heartmula) | 设置和运行 HeartMuLa，开源音乐生成模型系列（类似 Suno）。从歌词 + 标签生成完整歌曲，支持多语言。 | `media/heartmula` |
| [`songsee`](/docs/user-guide/skills/bundled/media/media-songsee) | 通过 CLI 从音频文件生成频谱图和音频特征可视化（mel、chroma、MFCC、tempogram 等）。用于音频分析、音乐制作调试和视觉文档。 | `media/songsee` |
| [`spotify`](/docs/user-guide/skills/bundled/media/media-spotify) | 控制 Spotify — 播放音乐、搜索目录、管理播放列表和库、检查设备和播放状态。在用户要求播放/暂停/排队音乐、搜索曲目/专辑/艺术家、管理播放列表或检查正在播放的内容……时加载 | `media/spotify` |
| [`youtube-content`](/docs/user-guide/skills/bundled/media/media-youtube-content) | 获取 YouTube 视频转录并将其转换为结构化内容（章节、摘要、线程、博客文章）。在用户分享 YouTube URL 或视频链接、要求总结视频、请求转录或想要从……提取内容时使用 | `media/youtube-content` |

## mlops

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`audiocraft-audio-generation`](/docs/user-guide/skills/bundled/mlops/mlops-models-audiocraft) | 用于音频生成的 PyTorch 库，包括文本到音乐（MusicGen）和文本到声音（AudioGen）。在需要从文本描述生成音乐、创建音效或执行旋律条件音乐生成时使用。 | `mlops/models/audiocraft` |
| [`axolotl`](/docs/user-guide/skills/bundled/mlops/mlops-training-axolotl) | 使用 Axolotl 微调 LLM 的专家指导 - YAML 配置、100+ 模型、LoRA/QLoRA、DPO/KTO/ORPO/GRPO、多模态支持 | `mlops/training/axolotl` |
| [`dspy`](/docs/user-guide/skills/bundled/mlops/mlops-research-dspy) | 使用声明式编程构建复杂 AI 系统，自动优化提示，使用 DSPy（斯坦福 NLP 的系统化 LM 编程框架）创建模块化 RAG 系统和代理 | `mlops/research/dspy` |
| [`huggingface-hub`](/docs/user-guide/skills/bundled/mlops/mlops-huggingface-hub) | Hugging Face Hub CLI (hf) — 搜索、下载和上传模型和数据集，管理仓库，使用 SQL 查询数据集，部署推理端点，管理 Spaces 和 buckets。 | `mlops/huggingface-hub` |
| [`llama-cpp`](/docs/user-guide/skills/bundled/mlops/mlops-inference-llama-cpp) | llama.cpp 本地 GGUF 推理 + HF Hub 模型发现。 | `mlops/inference/llama-cpp` |
| [`evaluating-llms-harness`](/docs/user-guide/skills/bundled/mlops/mlops-evaluation-lm-evaluation-harness) | 跨 60+ 学术基准（MMLU、HumanEval、GSM8K、TruthfulQA、HellaSwag）评估 LLM。在基准测试模型质量、比较模型、报告学术结果或跟踪训练进度时使用。Eleuther AI 使用的行业标准…… | `mlops/evaluation/lm-evaluation-harness` |
| [`obliteratus`](/docs/user-guide/skills/bundled/mlops/mlops-inference-obliteratus) | 使用 OBLITERATUS 从开放权重 LLM 中移除拒绝行为 — 机械可解释性技术（diff-in-means、SVD、whitened SVD、LEACE、SAE 分解等）以在保留推理的同时切除护栏。9 种 CLI 方法…… | `mlops/inference/obliteratus` |
| [`outlines`](/docs/user-guide/skills/bundled/mlops/mlops-inference-outlines) | 在生成期间保证有效的 JSON/XML/代码结构，使用 Pydantic 模型实现类型安全输出，支持本地模型（Transformers、vLLM），使用 Outlines（dottxt.ai 的结构化生成库）最大化推理速度 | `mlops/inference/outlines` |
| [`segment-anything-model`](/docs/user-guide/skills/bundled/mlops/mlops-models-segment-anything) | 具有零样本迁移的图像分割基础模型。在需要使用点、框或掩码作为提示分割图像中的任何对象，或自动生成图像中所有对象掩码时使用。 | `mlops/models/segment-anything` |
| [`fine-tuning-with-trl`](/docs/user-guide/skills/bundled/mlops/mlops-training-trl-fine-tuning) | 使用 TRL 的强化学习微调 LLM - SFT 用于指令调优，DPO 用于偏好对齐，PPO/GRPO 用于奖励优化，以及奖励模型训练。在需要 RLHF、将模型与偏好对齐或从……训练时使用 | `mlops/training/trl-fine-tuning` |
| [`unsloth`](/docs/user-guide/skills/bundled/mlops/mlops-training-unsloth) | 使用 Unsloth 进行快速微调的专家指导 - 训练快 2-5 倍，内存减少 50-80%，LoRA/QLoRA 优化 | `mlops/training/unsloth` |
| [`serving-llms-vllm`](/docs/user-guide/skills/bundled/mlops/mlops-inference-vllm) | 使用 vLLM 的 PagedAttention 和连续批处理以高吞吐量提供 LLM 服务。在部署生产 LLM API、优化推理延迟/吞吐量或在有限 GPU 内存下提供模型服务时使用。支持 OpenAI 兼容…… | `mlops/inference/vllm` |
| [`weights-and-biases`](/docs/user-guide/skills/bundled/mlops/mlops-evaluation-weights-and-biases) | 使用自动日志记录跟踪 ML 实验，实时可视化训练，使用 sweeps 优化超参数，使用 W&B（协作 MLOps 平台）管理模型注册表 | `mlops/evaluation/weights-and-biases` |

## note-taking

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`obsidian`](/docs/user-guide/skills/bundled/note-taking/note-taking-obsidian) | 在 Obsidian vault 中阅读、搜索和创建笔记。 | `note-taking/obsidian` |

## productivity

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`google-workspace`](/docs/user-guide/skills/bundled/productivity/productivity-google-workspace) | Gmail、Calendar、Drive、Contacts、Sheets 和 Docs 与 Hermes 的集成。使用 Hermes 管理的 OAuth2 设置，优先使用 Google Workspace CLI (`gws`)（如果可用）以获得更广泛的 API 覆盖，并回退到 Python 客户端库…… | `productivity/google-workspace` |
| [`linear`](/docs/user-guide/skills/bundled/productivity/productivity-linear) | 通过 GraphQL API 管理 Linear issue、项目和团队。创建、更新、搜索和组织 issue。使用 API 密钥认证（无需 OAuth）。所有操作通过 curl — 无依赖。 | `productivity/linear` |
| [`maps`](/docs/user-guide/skills/bundled/productivity/productivity-maps) | 位置智能 — 地理编码地点、反向地理编码坐标、查找附近地点（46 个 POI 类别）、驾驶/步行/骑行距离 + 时间、逐向导航、时区查询、命名地点的边界框 + 面积，以及 P…… | `productivity/maps` |
| [`nano-pdf`](/docs/user-guide/skills/bundled/productivity/productivity-nano-pdf) | 使用 nano-pdf CLI 通过自然语言指令编辑 PDF。修改文本、修复拼写错误、更新标题和对特定页面进行内容更改，无需手动编辑。 | `productivity/nano-pdf` |
| [`notion`](/docs/user-guide/skills/bundled/productivity/productivity-notion) | 通过 curl 创建和管理页面、数据库和块的 Notion API。直接从终端搜索、创建、更新和查询 Notion 工作区。 | `productivity/notion` |
| [`ocr-and-documents`](/docs/user-guide/skills/bundled/productivity/productivity-ocr-and-documents) | 从 PDF 和扫描文档中提取文本。对远程 URL 使用 web_extract，对本地基于文本的 PDF 使用 pymupdf，对 OCR/扫描文档使用 marker-pdf。对于 DOCX 使用 python-docx，对于 PPTX 参见 powerpoint 技能。 | `productivity/ocr-and-documents` |
| [`powerpoint`](/docs/user-guide/skills/bundled/productivity/productivity-powerpoint) | 当 .pptx 文件以任何方式涉及（作为输入、输出或两者）时使用此技能。包括：创建幻灯片、pitch deck 或演示文稿；阅读、解析或从任何 .pptx 文件中提取文本（即使提取的…… | `productivity/powerpoint` |

## red-teaming

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`godmode`](/docs/user-guide/skills/bundled/red-teaming/red-teaming-godmode) | 使用 G0DM0D3 技术越狱 API 服务的 LLM — Parseltongue 输入混淆（33 种技术）、GODMODE CLASSIC 系统提示模板、ULTRAPLINIAN 多模型竞赛、编码升级和 Hermes 原生预填充/系统提示注入…… | `red-teaming/godmode` |

## research

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`arxiv`](/docs/user-guide/skills/bundled/research/research-arxiv) | 使用 arXiv 的免费 REST API 搜索和检索学术论文。无需 API 密钥。按关键词、作者、类别或 ID 搜索。与 web_extract 或 ocr-and-documents 技能结合使用以阅读完整论文内容。 | `research/arxiv` |
| [`blogwatcher`](/docs/user-guide/skills/bundled/research/research-blogwatcher) | 使用 blogwatcher-cli 工具监控博客和 RSS/Atom 源的更新。添加博客、扫描新文章、跟踪阅读状态和按类别过滤。 | `research/blogwatcher` |
| [`llm-wiki`](/docs/user-guide/skills/bundled/research/research-llm-wiki) | Karpathy 的 LLM Wiki — 构建和维护持久的、互联的 markdown 知识库。摄取来源、查询编译的知识和检查一致性。 | `research/llm-wiki` |
| [`polymarket`](/docs/user-guide/skills/bundled/research/research-polymarket) | 查询 Polymarket 预测市场数据 — 搜索市场、获取价格、订单簿和价格历史。通过公共 REST API 只读，无需 API 密钥。 | `research/polymarket` |
| [`research-paper-writing`](/docs/user-guide/skills/bundled/research/research-research-paper-writing) | 撰写 ML/AI 研究论文的端到端管道 — 从实验设计到分析、起草、修订和投稿。涵盖 NeurIPS、ICML、ICLR、ACL、AAAI、COLM。集成自动化实验监控、统计分析…… | `research/research-paper-writing` |

## smart-home

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`openhue`](/docs/user-guide/skills/bundled/smart-home/smart-home-openhue) | 通过 OpenHue CLI 控制 Philips Hue 灯、房间和场景。开/关灯、调整亮度、颜色、色温和激活场景。 | `smart-home/openhue` |

## social-media

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`xurl`](/docs/user-guide/skills/bundled/social-media/social-media-xurl) | 通过 xurl（官方 X API CLI）与 X/Twitter 交互。用于发帖、回复、引用、搜索、时间线、提及、点赞、转发、书签、关注、DM、媒体上传和原始 v2 端点访问。 | `social-media/xurl` |

## software-development

| 技能 | 描述 | 路径 |
|-------|-------------|------|
| [`plan`](/docs/user-guide/skills/bundled/software-development/software-development-plan) | Hermes 的计划模式 — 检查上下文，将 markdown 计划写入活动工作区的 `.hermes/plans/` 目录，不执行工作。 | `software-development/plan` |
| [`requesting-code-review`](/docs/user-guide/skills/bundled/software-development/software-development-requesting-code-review) | 提交前验证管道 — 静态安全扫描、基线感知质量门、独立审查子代理和自动修复循环。在代码更改后和提交、推送或打开 PR 之前使用。 | `software-development/requesting-code-review` |
| [`subagent-driven-development`](/docs/user-guide/skills/bundled/software-development/software-development-subagent-driven-development) | 在执行具有独立任务的实现计划时使用。为每个任务分发新的 delegate_task，带两阶段审查（规范合规性然后代码质量）。 | `software-development/subagent-driven-development` |
| [`systematic-debugging`](/docs/user-guide/skills/bundled/software-development/software-development-systematic-debugging) | 在遇到任何 bug、测试失败或意外行为时使用。4 阶段根本原因调查 — 在理解问题之前不修复。 | `software-development/systematic-debugging` |
| [`test-driven-development`](/docs/user-guide/skills/bundled/software-development/software-development-test-driven-development) | 在实现任何功能或 bug 修复之前使用。强制执行 RED-GREEN-REFACTOR 循环，测试先行方法。 | `software-development/test-driven-development` |
| [`writing-plans`](/docs/user-guide/skills/bundled/software-development/software-development-writing-plans) | 当你有规范或多步任务的需求时使用。创建包含小任务、精确文件路径和完整代码示例的全面实现计划。 | `software-development/writing-plans` |
