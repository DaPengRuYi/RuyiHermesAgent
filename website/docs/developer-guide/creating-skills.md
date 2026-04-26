---
sidebar_position: 3
title: "创建技能"
description: "如何为 Hermes Agent 创建技能 — SKILL.md 格式、指南和发布"
---

# 创建技能

技能是向 Hermes Agent 添加新功能的首选方式。它们比工具更容易创建，不需要对代理进行代码更改，并且可以与社区共享。

## 应该是技能还是工具？

当以下情况时，将其作为**技能**：
- 功能可以表示为指令 + shell 命令 + 现有工具
- 它包装了代理可以通过 `terminal` 或 `web_extract` 调用的外部 CLI 或 API
- 它不需要嵌入代理的自定义 Python 集成或 API 密钥管理
- 示例：arXiv 搜索、git 工作流、Docker 管理、PDF 处理、通过 CLI 工具发送邮件

当以下情况时，将其作为**工具**：
- 它需要与 API 密钥、认证流程或多组件配置进行端到端集成
- 它需要每次精确执行的自定义处理逻辑
- 它处理二进制数据、流式传输或实时事件
- 示例：浏览器自动化、TTS、视觉分析

## 技能目录结构

内置技能位于 `skills/`，按类别组织。官方可选技能在 `optional-skills/` 中使用相同结构：

```text
skills/
├── research/
│   └── arxiv/
│       ├── SKILL.md              # 必需：主要指令
│       └── scripts/              # 可选：辅助脚本
│           └── search_arxiv.py
├── productivity/
│   └── ocr-and-documents/
│       ├── SKILL.md
│       ├── scripts/
│       └── references/
└── ...
```

## SKILL.md 格式

```markdown
---
name: my-skill
description: Brief description (shown in skill search results)
version: 1.0.0
author: Your Name
license: MIT
platforms: [macos, linux]          # 可选 — 限制到特定操作系统平台
                                   #   有效值：macos、linux、windows
                                   #   省略则在所有平台加载（默认）
metadata:
  hermes:
    tags: [Category, Subcategory, Keywords]
    related_skills: [other-skill-name]
    requires_toolsets: [web]            # 可选 — 仅在这些工具集活跃时显示
    requires_tools: [web_search]        # 可选 — 仅在这些工具可用时显示
    fallback_for_toolsets: [browser]    # 可选 — 在这些工具集活跃时隐藏
    fallback_for_tools: [browser_navigate]  # 可选 — 在这些工具存在时隐藏
    config:                              # 可选 — 技能需要的 config.yaml 设置
      - key: my.setting
        description: "What this setting controls"
        default: "sensible-default"
        prompt: "Display prompt for setup"
required_environment_variables:          # 可选 — 技能需要的环境变量
  - name: MY_API_KEY
    prompt: "Enter your API key"
    help: "Get one at https://example.com"
    required_for: "API access"
---

# 技能标题

简要介绍。

## 何时使用
触发条件 — 代理何时应该加载此技能？

## 快速参考
常用命令或 API 调用的表格。

## 步骤
代理遵循的分步指令。

## 陷阱
已知的失败模式及处理方法。

## 验证
代理如何确认它成功了。
```

### 平台特定技能

技能可以使用 `platforms` 字段限制到特定操作系统：

```yaml
platforms: [macos]            # 仅 macOS（例如 iMessage、Apple 提醒事项）
platforms: [macos, linux]     # macOS 和 Linux
platforms: [windows]          # 仅 Windows
```

设置后，技能在不兼容平台上会自动从系统提示词、`skills_list()` 和斜杠命令中隐藏。如果省略或为空，技能在所有平台加载（向后兼容）。

### 条件技能激活

技能可以声明对特定工具或工具集的依赖。这控制技能是否出现在给定会话的系统提示词中。

```yaml
metadata:
  hermes:
    requires_toolsets: [web]           # 如果 web 工具集未激活则隐藏
    requires_tools: [web_search]       # 如果 web_search 工具不可用则隐藏
    fallback_for_toolsets: [browser]   # 如果 browser 工具集激活则隐藏
    fallback_for_tools: [browser_navigate]  # 如果 browser_navigate 存在则隐藏
```

| 字段 | 行为 |
|------|------|
| `requires_toolsets` | 当任何列出的工具集**不**可用时，技能被**隐藏** |
| `requires_tools` | 当任何列出的工具**不**可用时，技能被**隐藏** |
| `fallback_for_toolsets` | 当任何列出的工具集**可用**时，技能被**隐藏** |
| `fallback_for_tools` | 当任何列出的工具**可用**时，技能被**隐藏** |

**`fallback_for_*` 的用例：** 创建一个作为主要工具不可用时的替代方案的技能。例如，`duckduckgo-search` 技能带有 `fallback_for_tools: [web_search]`，仅在 web 搜索工具（需要 API 密钥）未配置时显示。

**`requires_*` 的用例：** 创建一个仅在某些工具存在时才有意义的技能。例如，带有 `requires_toolsets: [web]` 的 web 抓取工作流技能在 web 工具禁用时不会干扰提示词。

### 环境变量要求

技能可以声明所需的环境变量。当技能通过 `skill_view` 加载时，其必需的变量会自动注册透传到沙箱执行环境（终端、execute_code）。

```yaml
required_environment_variables:
  - name: TENOR_API_KEY
    prompt: "Tenor API key"               # 提示用户时显示
    help: "Get your key at https://tenor.com"  # 帮助文本或 URL
    required_for: "GIF search functionality"   # 需要此变量的功能
```

每个条目支持：
- `name`（必需）— 环境变量名称
- `prompt`（可选）— 向用户请求值时的提示文本
- `help`（可选）— 获取值的帮助文本或 URL
- `required_for`（可选）— 描述哪个功能需要此变量

用户还可以在 `config.yaml` 中手动配置透传变量：

```yaml
terminal:
  env_passthrough:
    - MY_CUSTOM_VAR
    - ANOTHER_VAR
```

参见 `skills/apple/` 了解仅限 macOS 技能的示例。

## 加载时的安全设置

当技能需要 API 密钥或令牌时使用 `required_environment_variables`。缺失的值**不会**将技能从发现中隐藏。相反，Hermes 在本地 CLI 中加载技能时会安全地提示它们。

```yaml
required_environment_variables:
  - name: TENOR_API_KEY
    prompt: Tenor API key
    help: Get a key from https://developers.google.com/tenor
    required_for: full functionality
```

用户可以跳过设置并继续加载技能。Hermes 永远不会将原始密钥值暴露给模型。网关和消息会话显示本地设置指导，而非在带内收集密钥。

:::tip 沙箱透传
当你的技能加载时，任何已设置的声明 `required_environment_variables` 都会**自动透传**到 `execute_code` 和 `terminal` 沙箱 — 包括 Docker 和 Modal 等远程后端。你的技能脚本可以访问 `$TENOR_API_KEY`（或 Python 中的 `os.environ["TENOR_API_KEY"]`），用户无需配置任何额外内容。详情请参阅[环境变量透传](/docs/user-guide/security#environment-variable-passthrough)。
:::

旧版 `prerequisites.env_vars` 仍作为向后兼容别名支持。

### 配置设置（config.yaml）

技能可以声明存储在 `config.yaml` 的 `skills.config` 命名空间下的非密钥设置。与环境变量（存储在 `.env` 中的密钥）不同，配置设置用于路径、偏好和其他非敏感值。

```yaml
metadata:
  hermes:
    config:
      - key: myplugin.path
        description: Path to the plugin data directory
        default: "~/myplugin-data"
        prompt: Plugin data directory path
      - key: myplugin.domain
        description: Domain the plugin operates on
        default: ""
        prompt: Plugin domain (e.g., AI/ML research)
```

每个条目支持：
- `key`（必需）— 设置的点路径（例如 `myplugin.path`）
- `description`（必需）— 解释设置控制什么
- `default`（可选）— 用户未配置时的默认值
- `prompt`（可选）— `hermes config migrate` 期间显示的提示文本；回退到 `description`

**工作原理：**

1. **存储：** 值写入 `config.yaml` 的 `skills.config.<key>` 下：
   ```yaml
   skills:
     config:
       myplugin:
         path: ~/my-data
   ```

2. **发现：** `hermes config migrate` 扫描所有已启用的技能，找到未配置的设置，并提示用户。设置也出现在 `hermes config show` 的"技能设置"下。

3. **运行时注入：** 当技能加载时，其配置值被解析并附加到技能消息：
   ```
   [Skill config (from ~/.hermes/config.yaml):
     myplugin.path = /home/user/my-data
   ]
   ```
   代理看到配置的值而无需自己读取 `config.yaml`。

4. **手动设置：** 用户也可以直接设置值：
   ```bash
   hermes config set skills.config.myplugin.path ~/my-data
   ```

:::tip 何时使用哪个
对 API 密钥、令牌和其他**密钥**使用 `required_environment_variables`（存储在 `~/.hermes/.env`，永不显示给模型）。对**路径、偏好和非敏感设置**使用 `config`（存储在 `config.yaml`，在 config show 中可见）。
:::

### 凭据文件要求（OAuth 令牌等）

使用 OAuth 或基于文件凭据的技能可以声明需要挂载到远程沙箱的文件。这是用于以**文件**形式存储的凭据（非环境变量）— 通常是设置脚本生成的 OAuth 令牌文件。

```yaml
required_credential_files:
  - path: google_token.json
    description: Google OAuth2 token (created by setup script)
  - path: google_client_secret.json
    description: Google OAuth2 client credentials
```

每个条目支持：
- `path`（必需）— 相对于 `~/.hermes/` 的文件路径
- `description`（可选）— 解释文件是什么以及如何创建

加载时，Hermes 检查这些文件是否存在。缺失的文件触发 `setup_needed`。现有文件会自动：
- 以只读绑定挂载**挂载到 Docker** 容器
- **同步到 Modal** 沙箱（创建时 + 每个命令前，因此会话中 OAuth 可工作）
- 在**本地**后端无需特殊处理即可使用

:::tip 何时使用哪个
对简单的 API 密钥和令牌（存储在 `~/.hermes/.env` 中的字符串）使用 `required_environment_variables`。对 OAuth 令牌文件、客户端密钥、服务帐户 JSON、证书或任何磁盘上的凭据文件使用 `required_credential_files`。
:::

参见 `skills/productivity/google-workspace/SKILL.md` 了解使用两者的完整示例。

## 技能指南

### 无外部依赖

优先使用标准库 Python、curl 和现有 Hermes 工具（`web_extract`、`terminal`、`read_file`）。如果需要依赖，在技能中记录安装步骤。

### 渐进式披露

将最常见的工作流放在最前面。边缘情况和高级用法放在底部。这保持常见任务的令牌使用量低。

### 包含辅助脚本

对于 XML/JSON 解析或复杂逻辑，在 `scripts/` 中包含辅助脚本 — 不要期望 LLM 每次都内联编写解析器。

#### 从 SKILL.md 引用内置脚本

当技能加载时，激活消息将绝对技能目录暴露为 `[Skill directory: /abs/path]`，并在 SKILL.md 正文中的任何位置替换两个模板令牌：

| 令牌 | 替换为 |
|------|--------|
| `${HERMES_SKILL_DIR}` | 技能目录的绝对路径 |
| `${HERMES_SESSION_ID}` | 活跃会话 ID（如果没有会话则保留原样） |

因此 SKILL.md 可以告诉代理直接运行内置脚本：

```markdown
要分析输入，运行：

    node ${HERMES_SKILL_DIR}/scripts/analyse.js <input>
```

代理看到替换后的绝对路径，并使用可运行的命令调用 `terminal` 工具 — 无需路径计算，无需额外的 `skill_view` 往返。通过 `config.yaml` 中的 `skills.template_vars: false` 全局禁用替换。

#### 内联 shell 代码片段（可选启用）

技能还可以在 SKILL.md 正文中嵌入写为 `` !`cmd` `` 的内联 shell 代码片段。启用时，每个代码片段的 stdout 在代理读取之前内联到消息中，因此技能可以注入动态上下文：

```markdown
当前日期：!`date -u +%Y-%m-%d`
Git 分支：!`git -C ${HERMES_SKILL_DIR} rev-parse --abbrev-ref HEAD`
```

这**默认关闭** — SKILL.md 中的任何代码片段都在主机上无需批准运行，因此仅对你信任的技能来源启用：

```yaml
# config.yaml
skills:
  inline_shell: true
  inline_shell_timeout: 10   # 每个代码片段的秒数
```

代码片段以技能目录作为工作目录运行，输出限制为 4000 字符。失败（超时、非零退出）显示为简短的 `[inline-shell error: ...]` 标记，而非破坏整个技能。

### 测试它

运行技能并验证代理正确遵循指令：

```bash
hermes chat --toolsets skills -q "Use the X skill to do Y"
```

## 技能应该放在哪里？

内置技能（在 `skills/` 中）随每个 Hermes 安装一起发布。它们应该**对大多数用户广泛有用**：

- 文档处理、网络研究、常见开发工作流、系统管理
- 被广泛人群定期使用

如果你的技能是官方的且有用但不是普遍需要的（例如付费服务集成、重量级依赖），将其放在 **`optional-skills/`** 中 — 它随仓库发布，可通过 `hermes skills browse` 发现（标记为"官方"），并以内置信任安装。

如果你的技能是专业的、社区贡献的或小众的，它更适合**技能中心** — 上传到注册表并通过 `hermes skills install` 共享。

## 发布技能

### 到技能中心

```bash
hermes skills publish skills/my-skill --to github --repo owner/repo
```

### 到自定义仓库

将你的仓库添加为 tap：

```bash
hermes skills tap add owner/repo
```

用户随后可以从你的仓库搜索和安装。

## 安全扫描

所有中心安装的技能都经过安全扫描器检查：

- 数据外泄模式
- 提示词注入尝试
- 破坏性命令
- Shell 注入

信任级别：
- `builtin` — 随 Hermes 发布（始终受信任）
- `official` — 来自仓库中的 `optional-skills/`（内置信任，无第三方警告）
- `trusted` — 来自 openai/skills、anthropics/skills
- `community` — 非危险发现可以用 `--force` 覆盖；`dangerous` 裁决仍然被阻止

Hermes 现在可以从多个外部发现模型消费第三方技能：
- 直接 GitHub 标识符（例如 `openai/skills/k8s`）
- `skills.sh` 标识符（例如 `skills-sh/vercel-labs/json-render/json-render-react`）
- 从 `/.well-known/skills/index.json` 提供的知名端点

如果你希望你的技能无需特定于 GitHub 的安装程序即可被发现，考虑在仓库或市场中发布的同时从知名端点提供它们。
