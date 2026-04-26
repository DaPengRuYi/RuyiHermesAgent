---
sidebar_position: 3
title: "内置工具参考"
description: "Hermes 内置工具的权威参考，按工具集分组"
---

# 内置工具参考

本页记录了 Hermes 工具注册表中的所有 55 个内置工具，按工具集分组。可用性因平台、凭据和已启用的工具集而异。

**快速统计：** 12 个浏览器工具、4 个文件工具、10 个 RL 工具、4 个 Home Assistant 工具、2 个终端工具、2 个网络工具、5 个飞书工具，以及其他工具集中的 15 个独立工具。

:::tip MCP 工具
除了内置工具外，Hermes 还可以从 MCP 服务器动态加载工具。MCP 工具以服务器名称前缀显示（例如，`github` MCP 服务器的 `github_create_issue`）。有关配置，请参阅 [MCP 集成](/docs/user-guide/features/mcp)。
:::

## `browser` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `browser_back` | 在浏览器历史记录中导航到上一页。需要先调用 browser_navigate。 | — |
| `browser_cdp` | 发送原始 Chrome DevTools Protocol (CDP) 命令。用于 browser_navigate、browser_click、browser_console 等未涵盖的浏览器操作的逃生通道。仅在会话开始时可达 CDP 端点时可用——通过 `/browser connect` 或 `browser.cdp_url` 配置。参见 https://chromedevtools.github.io/devtools-protocol/ | — |
| `browser_dialog` | 响应原生 JavaScript 对话框（alert / confirm / prompt / beforeunload）。先调用 `browser_snapshot`——待处理的对话框出现在其 `pending_dialogs` 字段中。然后调用 `browser_dialog(action='accept'|'dismiss')`。与 `browser_cdp` 相同的可用性（Browserbase 或 `/browser connect`）。 | — |
| `browser_click` | 点击通过快照中的 ref ID 标识的元素（例如 '@e5'）。ref ID 显示在快照输出的方括号中。需要先调用 browser_navigate 和 browser_snapshot。 | — |
| `browser_console` | 获取当前页面的浏览器控制台输出和 JavaScript 错误。返回 console.log/warn/error/info 消息和未捕获的 JS 异常。用于检测静默 JavaScript 错误、失败的 API 调用和应用程序警告。需要先调用 browser_navigate。 | — |
| `browser_get_images` | 获取当前页面上所有图像的列表，包含其 URL 和 alt 文本。用于查找要使用 vision 工具分析的图像。需要先调用 browser_navigate。 | — |
| `browser_navigate` | 在浏览器中导航到 URL。初始化会话并加载页面。必须在其他浏览器工具之前调用。对于简单的信息检索，优先使用 web_search 或 web_extract（更快、更便宜）。当你需要交互式浏览时使用浏览器工具…… | — |
| `browser_press` | 按下键盘按键。用于提交表单（Enter）、导航（Tab）或键盘快捷键。需要先调用 browser_navigate。 | — |
| `browser_scroll` | 向某个方向滚动页面。用于显示当前视口上方或下方的更多内容。需要先调用 browser_navigate。 | — |
| `browser_snapshot` | 获取当前页面可访问性树的基于文本的快照。返回带有 ref ID（如 @e1、@e2）的交互元素，供 browser_click 和 browser_type 使用。full=false（默认）：包含交互元素的紧凑视图。full=true：完整…… | — |
| `browser_type` | 在由 ref ID 标识的输入字段中输入文本。先清除字段，然后输入新文本。需要先调用 browser_navigate 和 browser_snapshot。 | — |
| `browser_vision` | 对当前页面截图并使用视觉 AI 分析。当你需要视觉理解页面内容时使用——特别适用于 CAPTCHA、视觉验证挑战、复杂布局或文本快照…… | — |

## `clarify` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `clarify` | 当你需要澄清、反馈或在继续之前做出决定时向用户提问。支持两种模式：1. **多选** — 提供最多 4 个选项。用户选择一个或通过第 5 个"其他"选项输入自己的答案。2.…… | — |

## `code_execution` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `execute_code` | 运行可以编程调用 Hermes 工具的 Python 脚本。当你需要 3 次以上的工具调用并在它们之间处理逻辑时使用，需要在工具输出进入上下文之前过滤/减少大型工具输出，需要条件分支…… | — |

## `cronjob` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `cronjob` | 统一的定时任务管理器。使用 `action="create"`、`"list"`、`"update"`、`"pause"`、`"resume"`、`"run"` 或 `"remove"` 来管理作业。支持带有技能支持的作业，可附加一个或多个技能，`skills=[]` 在更新时清除已附加的技能。Cron 运行在没有当前聊天上下文的新会话中进行。 | — |

## `delegation` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `delegate_task` | 生成一个或多个子代理在隔离上下文中处理任务。每个子代理获得自己的对话、终端会话和工具集。只返回最终摘要——中间工具结果永远不会进入你的上下文窗口。两个…… | — |

## `feishu_doc` 工具集

限定于飞书文档评论智能回复处理器（`gateway/platforms/feishu_comment.py`）。不在 `hermes-cli` 或常规飞书聊天适配器上暴露。

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `feishu_doc_read` | 给定 file_type 和 token，读取飞书/Lark 文档（Docx、Doc 或 Sheet）的完整文本内容。 | 飞书应用凭据 |

## `feishu_drive` 工具集

限定于飞书文档评论处理器。驱动云盘文件上的评论读写操作。

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `feishu_drive_add_comment` | 在飞书/Lark 文档或文件上添加顶级评论。 | 飞书应用凭据 |
| `feishu_drive_list_comments` | 列出飞书/Lark 文件上的全文档评论，按最新排序。 | 飞书应用凭据 |
| `feishu_drive_list_comment_replies` | 列出特定飞书评论线程（全文档或本地选择）上的回复。 | 飞书应用凭据 |
| `feishu_drive_reply_comment` | 在飞书评论线程上发布回复，可选 `@` 提及。 | 飞书应用凭据 |

## `file` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `patch` | 文件中的定向查找和替换编辑。在终端中使用此工具代替 sed/awk。使用模糊匹配（9 种策略），因此轻微的空白/缩进差异不会破坏它。返回统一差异。编辑后自动运行语法检查…… | — |
| `read_file` | 读取带行号和分页的文本文件。在终端中使用此工具代替 cat/head/tail。输出格式：'LINE_NUM\|CONTENT'。如果未找到则建议类似文件名。对大文件使用 offset 和 limit。注意：无法读取图像或…… | — |
| `search_files` | 搜索文件内容或按名称查找文件。在终端中使用此工具代替 grep/rg/find/ls。基于 Ripgrep，比 shell 等效命令更快。内容搜索（target='content'）：在文件内进行正则表达式搜索。输出模式：完整匹配，带行…… | — |
| `write_file` | 将内容写入文件，完全替换现有内容。在终端中使用此工具代替 echo/cat heredoc。自动创建父目录。覆盖整个文件——使用 'patch' 进行定向编辑。 | — |

## `homeassistant` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `ha_call_service` | 调用 Home Assistant 服务来控制设备。使用 ha_list_services 发现每个域的可用服务及其参数。 | — |
| `ha_get_state` | 获取单个 Home Assistant 实体的详细状态，包括所有属性（亮度、颜色、温度设定值、传感器读数等）。 | — |
| `ha_list_entities` | 列出 Home Assistant 实体。可选按域（light、switch、climate、sensor、binary_sensor、cover、fan 等）或按区域名称（客厅、厨房、卧室等）过滤。 | — |
| `ha_list_services` | 列出可用于设备控制的 Home Assistant 服务（操作）。显示每种设备类型可以执行什么操作以及它们接受什么参数。使用此工具发现通过 ha_list_entities 找到的设备如何控制。 | — |

:::note
**Honcho 工具**（`honcho_profile`、`honcho_search`、`honcho_context`、`honcho_reasoning`、`honcho_conclude`）不再是内置的。它们通过 Honcho 内存提供者插件在 `plugins/memory/honcho/` 中提供。参见 [内存提供者](../user-guide/features/memory-providers.md) 了解安装和用法。
:::

## `image_gen` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `image_generate` | 使用 FAL.ai 从文本提示生成高质量图像。底层模型由用户配置（默认：FLUX 2 Klein 9B，亚秒级生成），不可由代理选择。返回单个图像 URL。使用……显示它 | FAL_KEY |

## `memory` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `memory` | 将重要信息保存到跨会话持久化的内存中。你的内存出现在会话开始时的系统提示中——这是你在对话之间记住用户和环境信息的方式。何时保存…… | — |

## `messaging` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `send_message` | 向已连接的消息平台发送消息，或列出可用目标。重要：当用户要求发送到特定频道或人员（而不仅仅是平台名称）时，先调用 send_message(action='list') 查看可用目标…… | — |

## `moa` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `mixture_of_agents` | 通过多个前沿 LLM 协作路由困难问题。进行 5 次 API 调用（4 个参考模型 + 1 个聚合器），最大推理力度——谨慎使用，仅用于真正困难的问题。最适合：复杂数学、高级算法…… | OPENROUTER_API_KEY |

## `rl` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `rl_check_status` | 获取训练运行的状态和指标。速率限制：对同一运行强制执行 30 分钟最小检查间隔。返回 WandB 指标：step、state、reward_mean、loss、percent_correct。 | TINKER_API_KEY、WANDB_API_KEY |
| `rl_edit_config` | 更新配置字段。先使用 rl_get_current_config() 查看所选环境的所有可用字段。每个环境有不同的可配置选项。基础设施设置（tokenizer、URL、lora_rank、learning_ra…… | TINKER_API_KEY、WANDB_API_KEY |
| `rl_get_current_config` | 获取当前环境配置。仅返回可修改的字段：group_size、max_token_length、total_steps、steps_per_eval、use_wandb、wandb_name、max_num_workers。 | TINKER_API_KEY、WANDB_API_KEY |
| `rl_get_results` | 获取已完成训练运行的最终结果和指标。返回最终指标和训练权重路径。 | TINKER_API_KEY、WANDB_API_KEY |
| `rl_list_environments` | 列出所有可用的 RL 环境。返回环境名称、路径和描述。提示：使用文件工具读取 file_path 以了解每个环境的工作方式（验证器、数据加载、奖励）。 | TINKER_API_KEY、WANDB_API_KEY |
| `rl_list_runs` | 列出所有训练运行（活跃和已完成）及其状态。 | TINKER_API_KEY、WANDB_API_KEY |
| `rl_select_environment` | 选择用于训练的 RL 环境。加载环境的默认配置。选择后，使用 rl_get_current_config() 查看设置，使用 rl_edit_config() 修改它们。 | TINKER_API_KEY、WANDB_API_KEY |
| `rl_start_training` | 使用当前环境和配置开始新的 RL 训练运行。大多数训练参数（lora_rank、learning_rate 等）是固定的。使用 rl_edit_config() 在开始前设置 group_size、batch_size、wandb_project。警告：训练…… | TINKER_API_KEY、WANDB_API_KEY |
| `rl_stop_training` | 停止正在运行的训练作业。如果指标看起来不好、训练停滞或你想尝试不同设置时使用。 | TINKER_API_KEY、WANDB_API_KEY |
| `rl_test_inference` | 任何环境的快速推理测试。使用 OpenRouter 运行几步推理 + 评分。默认：3 步 x 16 次完成 = 每个模型 48 次滚动，测试 3 个模型 = 共 144 次。测试环境加载、提示构建、…… | TINKER_API_KEY、WANDB_API_KEY |

## `session_search` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `session_search` | 搜索你过去对话的长期记忆。这是你的回忆——每个过去的会话都可搜索，此工具会总结发生的事情。主动使用此工具：当用户说"我们以前做过这个"、"还记得吗"、"上次……" | — |

## `skills` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `skill_manage` | 管理技能（创建、更新、删除）。技能是你的程序性记忆——可重复用于常见任务类型的方法。新技能保存到 ~/.hermes/skills/；现有技能可以在其所在位置修改。操作：create（完整 SKILL.m…… | — |
| `skill_view` | 技能允许加载关于特定任务和工作流的信息，以及脚本和模板。加载技能的完整内容或访问其链接文件（参考资料、模板、脚本）。首次调用返回 SKILL.md 内容加上…… | — |
| `skills_list` | 列出可用技能（名称 + 描述）。使用 skill_view(name) 加载完整内容。 | — |

## `terminal` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `process` | 管理使用 terminal(background=true) 启动的后台进程。操作：'list'（显示全部）、'poll'（检查状态 + 新输出）、'log'（完整输出带分页）、'wait'（阻塞直到完成或超时）、'kill'（终止）、'write'（发送…… | — |
| `terminal` | 在 Linux 环境上执行 shell 命令。文件系统在调用之间持久化。设置 `background=true` 用于长时间运行的服务器。设置 `notify_on_complete=true`（与 `background=true` 一起）在进程完成时自动通知——无需轮询。不要使用 cat/head/tail——使用 read_file。不要使用 grep/rg/find——使用 search_files。 | — |

## `todo` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `todo` | 管理当前会话的任务列表。用于包含 3 个以上步骤的复杂任务或当用户提供多个任务时。无参数调用以读取当前列表。写入：提供 'todos' 数组以创建/更新项目，merge=…… | — |

## `vision` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `vision_analyze` | 使用 AI 视觉分析图像。提供全面描述并回答关于图像内容的具体问题。 | — |

## `web` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `web_search` | 搜索网络上的任何主题信息。返回最多 5 个相关结果，包含标题、URL 和描述。 | EXA_API_KEY 或 PARALLEL_API_KEY 或 FIRECRAWL_API_KEY 或 TAVILY_API_KEY |
| `web_extract` | 从网页 URL 提取内容。返回 markdown 格式的页面内容。也适用于 PDF URL——直接传递 PDF 链接并转换为 markdown 文本。低于 5000 字符的页面返回完整 markdown；更大的页面由 LLM 摘要。 | EXA_API_KEY 或 PARALLEL_API_KEY 或 FIRECRAWL_API_KEY 或 TAVILY_API_KEY |

## `tts` 工具集

| 工具 | 描述 | 需要环境 |
|------|-------------|----------------------|
| `text_to_speech` | 将文本转换为语音音频。返回 MEDIA: 路径，由平台作为语音消息传递。在 Telegram 上作为语音气泡播放，在 Discord/WhatsApp 上作为音频附件。在 CLI 模式下，保存到 ~/voice-memos/。语音和提供者…… | — |
