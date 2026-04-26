---
sidebar_position: 15
title: "Web 仪表板"
description: "基于浏览器的仪表板，用于管理配置、API 密钥、会话、日志、分析、定时任务和技能"
---

# Web 仪表板

Web 仪表板是基于浏览器的 UI，用于管理你的 Hermes Agent 安装。你无需编辑 YAML 文件或运行 CLI 命令，而是可以从干净的 Web 界面配置设置、管理 API 密钥和监控会话。

## 快速开始

```bash
hermes dashboard
```

这会启动本地 Web 服务器并在浏览器中打开 `http://127.0.0.1:9119`。仪表板完全在你的机器上运行 —— 没有数据离开 localhost。

### 选项

| 标志 | 默认值 | 描述 |
|------|--------|------|
| `--port` | `9119` | 运行 Web 服务器的端口 |
| `--host` | `127.0.0.1` | 绑定地址 |
| `--no-open` | — | 不自动打开浏览器 |

```bash
# 自定义端口
hermes dashboard --port 8080

# 绑定到所有接口（在共享网络上谨慎使用）
hermes dashboard --host 0.0.0.0

# 启动但不打开浏览器
hermes dashboard --no-open
```

## 前提条件

默认 `hermes-agent` 安装不附带 HTTP 栈或 PTY 辅助程序 —— 这些是可选的额外组件。**Web 仪表板**需要 FastAPI 和 Uvicorn（`web` 扩展）。**Chat** 标签还需要 `ptyprocess` 在伪终端后生成嵌入式 TUI（POSIX 上的 `pty` 扩展）。使用以下命令安装两者：

```bash
pip install 'hermes-agent[web,pty]'
```

`web` 扩展拉取 FastAPI/Uvicorn；`pty` 拉取 `ptyprocess`（POSIX）或 `pywinpty`（原生 Windows —— 注意嵌入式 TUI 本身仍需要 WSL）。`pip install hermes-agent[all]` 包含两个扩展，如果你还想要消息/语音等功能，这是最简单的路径。

当你在没有依赖的情况下运行 `hermes dashboard` 时，它会告诉你需要安装什么。如果前端尚未构建且 `npm` 可用，首次启动时会自动构建。

## 页面

### 状态

着陆页显示你安装的实时概览：

- **代理版本**和发布日期
- **网关状态** —— 运行中/已停止、PID、已连接平台及其状态
- **活跃会话** —— 过去 5 分钟内活跃的会话数
- **最近会话** —— 20 个最近会话的列表，包含模型、消息数、令牌使用和对话预览

状态页每 5 秒自动刷新。

### 聊天

**Chat** 标签将完整的 Hermes TUI（与 `hermes --tui` 相同的界面）直接嵌入浏览器中。你在终端 TUI 中能做的一切 —— 斜杠命令、模型选择器、工具调用卡片、markdown 流式传输、clarify/sudo/approval 提示、皮肤主题 —— 在这里完全相同地工作，因为仪表板运行的是真实的 TUI 二进制文件，并通过 [xterm.js](https://xtermjs.org/) 及其 WebGL 渲染器渲染其 ANSI 输出以实现像素完美的单元格布局。

**工作原理：**

- `/api/pty` 打开一个用仪表板会话令牌认证的 WebSocket
- 服务器在 POSIX 伪终端后生成 `hermes --tui`
- 按键传输到 PTY；ANSI 输出流回浏览器
- xterm.js 的 WebGL 渲染器将每个单元格绘制到整数像素网格上；鼠标跟踪（SGR 1006）、宽字符（Unicode 11）和制表符字形都原生渲染
- 调整浏览器窗口大小会通过 `@xterm/addon-fit` 插件调整 TUI 大小

**恢复现有会话：** 从 **Sessions** 标签，点击任何会话旁的播放图标（▶）。这会跳转到 `/chat?resume=<id>` 并使用 `--resume` 启动 TUI，加载完整历史。

**前提条件：**

- Node.js（与 `hermes --tui` 相同的要求；TUI 包在首次启动时构建）
- `ptyprocess` —— 由 `pty` 扩展安装（`pip install 'hermes-agent[web,pty]'`，或 `[all]` 包含两者）
- POSIX 内核（Linux、macOS 或 WSL）。不支持原生 Windows Python —— 使用 WSL。

关闭浏览器标签后，服务器上的 PTY 会干净地回收。重新打开会生成新的会话。

### 配置

`config.yaml` 的基于表单的编辑器。所有 150+ 个配置字段从 `DEFAULT_CONFIG` 自动发现并组织到分类标签中：

- **model** —— 默认模型、提供商、基础 URL、推理设置
- **terminal** —— 后端（local/docker/ssh/modal）、超时、shell 偏好
- **display** —— 皮肤、工具进度、恢复显示、旋转器设置
- **agent** —— 最大迭代、网关超时、服务层
- **delegation** —— 子代理限制、推理努力
- **memory** —— 提供商选择、上下文注入设置
- **approvals** —— 危险命令审批模式（ask/yolo/deny）
- 以及更多 —— config.yaml 的每个部分都有对应的表单字段

具有已知有效值的字段（终端后端、皮肤、审批模式等）渲染为下拉菜单。布尔值渲染为开关。其他一切都是文本输入。

**操作：**

- **保存** —— 立即将更改写入 `config.yaml`
- **重置为默认值** —— 将所有字段恢复为默认值（在你点击保存之前不保存）
- **导出** —— 将当前配置下载为 JSON
- **导入** —— 上传 JSON 配置文件以替换当前值

:::tip
配置更改在下一个代理会话或网关重启时生效。Web 仪表板编辑的是与 `hermes config set` 和网关读取的相同的 `config.yaml` 文件。
:::

### API 密钥

管理存储 API 密钥和凭据的 `.env` 文件。密钥按类别分组：

- **LLM 提供商** —— OpenRouter、Anthropic、OpenAI、DeepSeek 等
- **工具 API 密钥** —— Browserbase、Firecrawl、Tavily、ElevenLabs 等
- **消息平台** —— Telegram、Discord、Slack 机器人令牌等
- **代理设置** —— 非机密环境变量如 `API_SERVER_ENABLED`

每个密钥显示：
- 是否当前已设置（带值的编辑预览）
- 用途描述
- 提供商注册/密钥页面链接
- 设置或更新值的输入字段
- 删除按钮

高级/不常用的密钥默认隐藏在开关后面。

### 会话

浏览和检查所有代理会话。每行显示会话标题、来源平台图标（CLI、Telegram、Discord、Slack、cron）、模型名称、消息数、工具调用数以及多久前活跃。实时会话用脉冲徽章标记。

- **搜索** —— 使用 FTS5 跨所有消息内容进行全文搜索。结果显示高亮片段，展开时自动滚动到第一条匹配消息。
- **展开** —— 点击会话加载其完整消息历史。消息按角色（用户、助手、系统、工具）颜色编码并渲染为带语法高亮的 Markdown。
- **工具调用** —— 带工具调用的助手消息显示可折叠的函数名称和 JSON 参数块。
- **删除** —— 使用垃圾桶图标删除会话及其消息历史。

### 日志

查看代理、网关和错误日志文件，支持过滤和实时跟踪。

- **文件** —— 在 `agent`、`errors` 和 `gateway` 日志文件间切换
- **级别** —— 按日志级别过滤：ALL、DEBUG、INFO、WARNING 或 ERROR
- **组件** —— 按来源组件过滤：all、gateway、agent、tools、cli 或 cron
- **行数** —— 选择显示多少行（50、100、200 或 500）
- **自动刷新** —— 切换实时跟踪，每 5 秒轮询新日志行
- **颜色编码** —— 日志行按严重性着色（错误为红色，警告为黄色，调试为灰色）

### 分析

从会话历史计算的使用和成本分析。选择时间段（7、30 或 90 天）查看：

- **摘要卡片** —— 总令牌数（输入/输出）、缓存命中百分比、总估算或实际成本以及总会话数和日平均
- **每日令牌图表** —— 堆叠条形图显示每天的输入和输出令牌使用，悬停工具提示显示细分和成本
- **每日细分表** —— 日期、会话数、输入令牌、输出令牌、缓存命中率和每天的成本
- **每模型细分** —— 显示每个使用的模型、其会话数、令牌使用和估算成本的表

### 定时任务

创建和管理按重复计划运行代理提示的定时任务。

- **创建** —— 填写名称（可选）、提示、cron 表达式（例如 `0 9 * * *`）和投递目标（本地、Telegram、Discord、Slack 或 email）
- **任务列表** —— 每个任务显示其名称、提示预览、计划表达式、状态徽章（enabled/paused/error）、投递目标、上次运行时间和下次运行时间
- **暂停/恢复** —— 在活跃和暂停状态间切换任务
- **立即触发** —— 在正常计划外立即执行任务
- **删除** —— 永久删除定时任务

### 技能

浏览、搜索和切换技能及工具集。技能从 `~/.hermes/skills/` 加载并按类别分组。

- **搜索** —— 按名称、描述或类别过滤技能和工具集
- **类别过滤** —— 点击类别药丸缩小列表（例如 MLOps、MCP、Red Teaming、AI）
- **切换** —— 使用开关启用或禁用单个技能。更改在下一个会话时生效。
- **工具集** —— 单独的部分显示内置工具集（文件操作、Web 浏览等）及其活跃/非活跃状态、设置要求和包含的工具列表

:::warning 安全
Web 仪表板读写你的 `.env` 文件，其中包含 API 密钥和机密。它默认绑定到 `127.0.0.1` —— 仅可从你的本地机器访问。如果你绑定到 `0.0.0.0`，网络上的任何人都可以查看和修改你的凭据。仪表板本身没有认证。
:::

## `/reload` 斜杠命令

仪表板 PR 还向交互式 CLI 添加了 `/reload` 斜杠命令。通过 Web 仪表板（或直接编辑 `.env`）更改 API 密钥后，在活跃的 CLI 会话中使用 `/reload` 无需重启即可获取更改：

```
You → /reload
  Reloaded .env (3 var(s) updated)
```

这会将 `~/.hermes/.env` 重新读入运行进程的环境。当你通过仪表板添加了新的提供商密钥并想立即使用时很有用。

## REST API

Web 仪表板暴露前端消费的 REST API。你也可以直接调用这些端点进行自动化：

### GET /api/status

返回代理版本、网关状态、平台状态和活跃会话数。

### GET /api/sessions

返回 20 个最近会话及其元数据（模型、令牌数、时间戳、预览）。

### GET /api/config

返回当前 `config.yaml` 内容的 JSON 格式。

### GET /api/config/defaults

返回默认配置值。

### GET /api/config/schema

返回描述每个配置字段的 schema —— 类型、描述、类别和适用时的选择选项。前端使用此为每个字段渲染正确的输入控件。

### PUT /api/config

保存新配置。Body：`{"config": {...}}`。

### GET /api/env

返回所有已知环境变量及其设置/未设置状态、编辑后的值、描述和类别。

### PUT /api/env

设置环境变量。Body：`{"key": "VAR_NAME", "value": "secret"}`。

### DELETE /api/env

删除环境变量。Body：`{"key": "VAR_NAME"}`。

### GET /api/sessions/\{session_id\}

返回单个会话的元数据。

### GET /api/sessions/\{session_id\}/messages

返回会话的完整消息历史，包括工具调用和时间戳。

### GET /api/sessions/search

跨消息内容的全文搜索。查询参数：`q`。返回匹配的会话 ID 和高亮片段。

### DELETE /api/sessions/\{session_id\}

删除会话及其消息历史。

### GET /api/logs

返回日志行。查询参数：`file`（agent/errors/gateway）、`lines`（行数）、`level`、`component`。

### GET /api/analytics/usage

返回令牌使用、成本和会话分析。查询参数：`days`（默认 30）。响应包括每日细分和每模型汇总。

### GET /api/cron/jobs

返回所有配置的定时任务及其状态、计划和运行历史。

### POST /api/cron/jobs

创建新的定时任务。Body：`{"prompt": "...", "schedule": "0 9 * * *", "name": "...", "deliver": "local"}`。

### POST /api/cron/jobs/\{job_id\}/pause

暂停定时任务。

### POST /api/cron/jobs/\{job_id\}/resume

恢复已暂停的定时任务。

### POST /api/cron/jobs/\{job_id\}/trigger

在计划外立即触发定时任务。

### DELETE /api/cron/jobs/\{job_id\}

删除定时任务。

### GET /api/skills

返回所有技能及其名称、描述、类别和启用状态。

### PUT /api/skills/toggle

启用或禁用技能。Body：`{"name": "skill-name", "enabled": true}`。

### GET /api/tools/toolsets

返回所有工具集及其标签、描述、工具列表和活跃/已配置状态。

## CORS

Web 服务器将 CORS 限制为仅 localhost 来源：

- `http://localhost:9119` / `http://127.0.0.1:9119`（生产）
- `http://localhost:3000` / `http://127.0.0.1:3000`
- `http://localhost:5173` / `http://127.0.0.1:5173`（Vite 开发服务器）

如果你在自定义端口上运行服务器，该来源会自动添加。

## 开发

如果你在为 Web 仪表板前端贡献代码：

```bash
# 终端 1：启动后端 API
hermes dashboard --no-open

# 终端 2：启动带 HMR 的 Vite 开发服务器
cd web/
npm install
npm run dev
```

Vite 开发服务器在 `http://localhost:5173` 将 `/api` 请求代理到 FastAPI 后端 `http://127.0.0.1:9119`。

前端使用 React 19、TypeScript、Tailwind CSS v4 和 shadcn/ui 风格组件构建。生产构建输出到 `hermes_cli/web_dist/`，FastAPI 服务器将其作为静态 SPA 提供。

## 更新时自动构建

运行 `hermes update` 时，如果 `npm` 可用，Web 前端会自动重建。这使仪表板与代码更新保持同步。如果未安装 `npm`，更新会跳过前端构建，`hermes dashboard` 将在首次启动时构建。

## 主题和插件

仪表板附带六个内置主题，并可通过用户定义的主题、插件标签页和后端 API 路由扩展 —— 全部即插即用，无需克隆仓库。

**从标题栏实时切换主题** —— 点击语言切换器旁的调色板图标。选择持久化到 `config.yaml` 的 `dashboard.theme` 下，并在页面加载时恢复。

内置主题：

| 主题 | 特征 |
|------|------|
| **Hermes Teal**（`default`） | 深青 + 奶油色，系统字体，舒适间距 |
| **Midnight**（`midnight`） | 深蓝紫，Inter + JetBrains Mono |
| **Ember**（`ember`） | 温暖深红 + 青铜，Spectral 衬线 + IBM Plex Mono |
| **Mono**（`mono`） | 灰度，IBM Plex，紧凑 |
| **Cyberpunk**（`cyberpunk`） | 黑底霓虹绿，Share Tech Mono |
| **Rosé**（`rose`） | 粉色 + 象牙白，Fraunces 衬线，宽敞 |

要构建自己的主题、添加插件标签页、注入 shell 槽位或暴露插件特定 REST 端点，参见**[扩展仪表板](./extending-the-dashboard)** —— 完整指南涵盖：

- 主题 YAML schema —— 调色板、排版、布局、资源、componentStyles、colorOverrides、customCSS
- 布局变体 —— `standard`、`cockpit`、`tiled`
- 插件清单、SDK、shell 槽位、页面作用域槽位（无需覆盖即可向内置页面注入控件）、后端 FastAPI 路由
- 完整的主题加插件组合演练（Strike Freedom 驾驶舱演示）
- 发现、重载和故障排除
