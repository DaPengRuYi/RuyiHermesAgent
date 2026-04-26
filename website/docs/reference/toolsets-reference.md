---
sidebar_position: 4
title: "工具集参考"
description: "Hermes 核心工具集、复合工具集、平台工具集和动态工具集参考"
---

# 工具集参考

工具集是命名的工具捆绑包，控制代理可以执行的操作。它们是按平台、按会话或按任务配置工具可用性的主要机制。

## 工具集的工作原理

每个工具恰好属于一个工具集。当你启用一个工具集时，该捆绑包中的所有工具都会对代理可用。工具集有三种类型：

- **核心工具集** — 单个逻辑相关的工具组（例如，`file` 捆绑了 `read_file`、`write_file`、`patch`、`search_files`）
- **复合工具集** — 为常见场景组合多个核心工具集（例如，`debugging` 捆绑了 file、terminal 和 web 工具）
- **平台工具集** — 特定部署上下文的完整工具配置（例如，`hermes-cli` 是交互式 CLI 会话的默认配置）

## 配置工具集

### 按会话配置（CLI）

```bash
hermes chat --toolsets web,file,terminal
hermes chat --toolsets debugging        # 复合工具集 — 展开为 file + terminal + web
hermes chat --toolsets all              # 全部工具
```

### 按平台配置（config.yaml）

```yaml
toolsets:
  - hermes-cli          # CLI 默认值
  # - hermes-telegram   # 覆盖 Telegram 网关配置
```

### 交互式管理

```bash
hermes tools                            # 用于按平台启用/禁用的 curses UI
```

或在会话中：

```
/tools list
/tools disable browser
/tools enable rl
```

## 核心工具集

| 工具集 | 工具 | 用途 |
|---------|-------|---------|
| `browser` | `browser_back`、`browser_cdp`、`browser_click`、`browser_console`、`browser_dialog`、`browser_get_images`、`browser_navigate`、`browser_press`、`browser_scroll`、`browser_snapshot`、`browser_type`、`browser_vision`、`web_search` | 完整的浏览器自动化。包含 `web_search` 作为快速查找的备选方案。`browser_cdp` 和 `browser_dialog` 受限于可达的 CDP 端点——仅在 `/browser connect` 激活、设置了 `browser.cdp_url` 或 Browserbase 会话活跃时才显示。`browser_dialog` 与 `browser_snapshot` 在附加 CDP 监督器时添加的 `pending_dialogs` 和 `frame_tree` 字段配合使用。 |
| `clarify` | `clarify` | 当代理需要澄清时向用户提问。 |
| `code_execution` | `execute_code` | 运行可编程调用 Hermes 工具的 Python 脚本。 |
| `cronjob` | `cronjob` | 调度和管理定期任务。 |
| `delegation` | `delegate_task` | 生成隔离的子代理实例以并行工作。 |
| `feishu_doc` | `feishu_doc_read` | 读取飞书/Lark 文档内容。供飞书文档评论智能回复处理器使用。 |
| `feishu_drive` | `feishu_drive_add_comment`、`feishu_drive_list_comments`、`feishu_drive_list_comment_replies`、`feishu_drive_reply_comment` | 飞书/Lark 云盘评论操作。限定于评论代理；不在 `hermes-cli` 或其他消息工具集上暴露。 |
| `file` | `patch`、`read_file`、`search_files`、`write_file` | 文件读取、写入、搜索和编辑。 |
| `homeassistant` | `ha_call_service`、`ha_get_state`、`ha_list_entities`、`ha_list_services` | 通过 Home Assistant 进行智能家居控制。仅在设置了 `HASS_TOKEN` 时可用。 |
| `image_gen` | `image_generate` | 通过 FAL.ai 进行文本到图像生成。 |
| `memory` | `memory` | 跨会话的持久化内存管理。 |
| `messaging` | `send_message` | 从会话内向其他平台（Telegram、Discord 等）发送消息。 |
| `moa` | `mixture_of_agents` | 通过混合代理进行多模型共识。 |
| `rl` | `rl_check_status`、`rl_edit_config`、`rl_get_current_config`、`rl_get_results`、`rl_list_environments`、`rl_list_runs`、`rl_select_environment`、`rl_start_training`、`rl_stop_training`、`rl_test_inference` | RL 训练环境管理（Atropos）。 |
| `search` | `web_search` | 仅网络搜索（不含 extract）。 |
| `session_search` | `session_search` | 搜索过去的会话记录。 |
| `skills` | `skill_manage`、`skill_view`、`skills_list` | 技能的 CRUD 和浏览。 |
| `terminal` | `process`、`terminal` | Shell 命令执行和后台进程管理。 |
| `todo` | `todo` | 会话内的任务列表管理。 |
| `tts` | `text_to_speech` | 文本到语音音频生成。 |
| `vision` | `vision_analyze` | 通过视觉模型进行图像分析。 |
| `web` | `web_extract`、`web_search` | 网络搜索和页面内容提取。 |

## 复合工具集

这些工具集会展开为多个核心工具集，为常见场景提供便捷的简写：

| 工具集 | 展开为 | 用途 |
|---------|-----------|----------|
| `debugging` | `web` + `file` + `process`、`terminal`（通过 `includes`）— 实际上是 `patch`、`process`、`read_file`、`search_files`、`terminal`、`web_extract`、`web_search`、`write_file` | 调试会话 — 文件访问、终端和网络研究，无浏览器或委派开销。 |
| `safe` | `image_generate`、`vision_analyze`、`web_extract`、`web_search` | 只读研究和媒体生成。无文件写入、无终端访问、无代码执行。适用于不受信任或受限环境。 |

## 平台工具集

平台工具集定义了部署目标的完整工具配置。大多数消息平台使用与 `hermes-cli` 相同的工具集：

| 工具集 | 与 `hermes-cli` 的差异 |
|---------|-------------------------------|
| `hermes-cli` | 完整工具集 — 包括 `clarify` 在内的全部 36 个核心工具。交互式 CLI 会话的默认配置。 |
| `hermes-acp` | 移除 `clarify`、`cronjob`、`image_generate`、`send_message`、`text_to_speech`、homeassistant 工具。专注于 IDE 上下文中的编码任务。 |
| `hermes-api-server` | 移除 `clarify`、`send_message` 和 `text_to_speech`。添加其他所有工具 — 适用于无法进行用户交互的编程访问。 |
| `hermes-telegram` | 与 `hermes-cli` 相同。 |
| `hermes-discord` | 与 `hermes-cli` 相同。 |
| `hermes-slack` | 与 `hermes-cli` 相同。 |
| `hermes-whatsapp` | 与 `hermes-cli` 相同。 |
| `hermes-signal` | 与 `hermes-cli` 相同。 |
| `hermes-matrix` | 与 `hermes-cli` 相同。 |
| `hermes-mattermost` | 与 `hermes-cli` 相同。 |
| `hermes-email` | 与 `hermes-cli` 相同。 |
| `hermes-sms` | 与 `hermes-cli` 相同。 |
| `hermes-bluebubbles` | 与 `hermes-cli` 相同。 |
| `hermes-dingtalk` | 与 `hermes-cli` 相同。 |
| `hermes-feishu` | 与 `hermes-cli` 相同。注意：`feishu_doc` / `feishu_drive` 工具集仅由文档评论处理器使用，不由常规飞书聊天适配器使用。 |
| `hermes-qqbot` | 与 `hermes-cli` 相同。 |
| `hermes-wecom` | 与 `hermes-cli` 相同。 |
| `hermes-wecom-callback` | 与 `hermes-cli` 相同。 |
| `hermes-weixin` | 与 `hermes-cli` 相同。 |
| `hermes-homeassistant` | 与 `hermes-cli` 相同，加上始终启用的 `homeassistant` 工具集。 |
| `hermes-webhook` | 与 `hermes-cli` 相同。 |
| `hermes-gateway` | 内部网关编排器工具集 — 当网关需要接受任何消息源时，为最广泛的可能工具集的并集。 |

## 动态工具集

### MCP 服务器工具集

每个已配置的 MCP 服务器在运行时生成一个 `mcp-<server>` 工具集。例如，如果你配置了一个 `github` MCP 服务器，就会创建一个 `mcp-github` 工具集，包含该服务器暴露的所有工具。

```yaml
# config.yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
```

这会创建一个 `mcp-github` 工具集，你可以在 `--toolsets` 或平台配置中引用它。

### 插件工具集

插件可以在插件初始化期间通过 `ctx.register_tool()` 注册自己的工具集。这些工具集会与内置工具集一起显示，并且可以以相同方式启用/禁用。

### 自定义工具集

在 `config.yaml` 中定义自定义工具集以创建项目特定的捆绑包：

```yaml
toolsets:
  - hermes-cli
custom_toolsets:
  data-science:
    - file
    - terminal
    - code_execution
    - web
    - vision
```

### 通配符

- `all` 或 `*` — 展开为每个已注册的工具集（内置 + 动态 + 插件）

## 与 `hermes tools` 的关系

`hermes tools` 命令提供了一个基于 curses 的 UI，用于按平台逐个启用或禁用工具。这在工具级别（比工具集更细）进行操作，并持久化到 `config.yaml`。即使工具集已启用，被禁用的工具也会被过滤掉。

另请参阅：[工具参考](./tools-reference.md) 获取完整的工具列表及其参数。
