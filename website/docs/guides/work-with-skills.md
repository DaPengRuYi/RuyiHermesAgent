---
sidebar_position: 12
title: "使用技能"
description: "查找、安装、使用和创建技能 — 教 Hermes 新工作流的按需知识"
---

# 使用技能

技能是按需的知识文档，教 Hermes 如何处理特定任务 — 从生成 ASCII 艺术到管理 GitHub PR。本指南引导你日常使用它们。

有关完整技术参考，请参见[技能系统](/docs/user-guide/features/skills)。

---

## 查找技能

每个 Hermes 安装都附带捆绑技能。查看可用内容：

```bash
# 在任何聊天会话中：
/skills

# 或从 CLI：
hermes skills list
```

这显示带有名称和描述的紧凑列表：

```
ascii-art         使用 pyfiglet、cowsay、boxes 等生成 ASCII 艺术...
arxiv             从 arXiv 搜索和检索学术论文...
github-pr-workflow 完整 PR 生命周期 — 创建分支、提交...
plan              计划模式 — 检查上下文、编写 markdown...
excalidraw        使用 Excalidraw 创建手绘风格图表...
```

### 搜索技能

```bash
# 按关键词搜索
/skills search docker
/skills search music
```

### 技能中心

官方可选技能（默认未激活的较重或小众技能）可通过中心获取：

```bash
# 浏览官方可选技能
/skills browse

# 搜索中心
/skills search blockchain
```

---

## 使用技能

每个已安装的技能自动成为斜杠命令。只需输入其名称：

```bash
# 加载技能并给它任务
/ascii-art Make a banner that says "HELLO WORLD"
/plan Design a REST API for a todo app
/github-pr-workflow Create a PR for the auth refactor

# 只有技能名称（无任务）加载它并让你描述需要什么
/excalidraw
```

你也可以通过自然对话触发技能 — 让 Hermes 使用特定技能，它会通过 `skill_view` 工具加载它。

### 渐进式披露

技能使用 token 高效的加载模式。代理不会一次加载所有内容：

1. **`skills_list()`** — 所有技能的紧凑列表（约 3k token）。在会话开始时加载。
2. **`skill_view(name)`** — 一个技能的完整 SKILL.md 内容。在代理决定需要该技能时加载。
3. **`skill_view(name, file_path)`** — 技能中的特定参考文件。仅在需要时加载。

这意味着技能在实际使用前不消耗 token。

---

## 从中心安装

官方可选技能随 Hermes 发布但默认未激活。显式安装它们：

```bash
# 安装官方可选技能
hermes skills install official/research/arxiv

# 在聊天会话中从中心安装
/skills install official/creative/songwriting-and-ai-music
```

发生什么：
1. 技能目录复制到 `~/.hermes/skills/`
2. 它出现在你的 `skills_list` 输出中
3. 它成为可用的斜杠命令

:::tip
已安装的技能在新会话中生效。如果你想要它在当前会话中可用，使用 `/reset` 重新开始，或添加 `--now` 立即失效提示缓存（下一轮消耗更多 token）。
:::

### 验证安装

```bash
# 检查它在那里
hermes skills list | grep arxiv

# 或在聊天中
/skills search arxiv
```

---

## 插件提供的技能

插件可以使用命名空间名称（`plugin:skill`）捆绑自己的技能。这可以防止与内置技能的名称冲突。

```bash
# 通过限定名称加载插件技能
skill_view("superpowers:writing-plans")

# 相同基础名称的内置技能不受影响
skill_view("writing-plans")
```

插件技能**不**列在系统提示中，也不出现在 `skills_list` 中。它们是可选加入的 — 当你知道插件提供一个时显式加载它们。加载时，代理看到列出同一插件兄弟技能的横幅。

有关如何在你自己的插件中发布技能，请参见[构建 Hermes 插件 → 捆绑技能](/docs/guides/build-a-hermes-plugin#bundle-skills)。

---

## 配置技能设置

一些技能在其前置元数据中声明需要的配置：

```yaml
metadata:
  hermes:
    config:
      - key: tenor.api_key
        description: "Tenor API key for GIF search"
        prompt: "Enter your Tenor API key"
        url: "https://developers.google.com/tenor/guides/quickstart"
```

当带有配置的技能首次加载时，Hermes 会提示你输入值。它们存储在 `config.yaml` 的 `skills.config.*` 下。

从 CLI 管理技能配置：

```bash
# 特定技能的交互式配置
hermes skills config gif-search

# 查看所有技能配置
hermes config get skills.config
```

---

## 创建你自己的技能

技能只是带有 YAML 前置元数据的 markdown 文件。创建一个不到五分钟。

### 1. 创建目录

```bash
mkdir -p ~/.hermes/skills/my-category/my-skill
```

### 2. 编写 SKILL.md

```markdown title="~/.hermes/skills/my-category/my-skill/SKILL.md"
---
name: my-skill
description: 简要描述此技能做什么
version: 1.0.0
metadata:
  hermes:
    tags: [my-tag, automation]
    category: my-category
---

# 我的技能

## 何时使用
当用户询问 [特定主题] 或需要 [特定任务] 时使用此技能。

## 步骤
1. 首先，检查 [前提条件] 是否可用
2. 运行 `command --with-flags`
3. 解析输出并呈现结果

## 陷阱
- 常见失败：[描述]。修复：[解决方案]
- 注意 [边界情况]

## 验证
运行 `check-command` 确认结果正确。
```

### 3. 添加参考文件（可选）

技能可以包含代理按需加载的支持文件：

```
my-skill/
├── SKILL.md                    # 主技能文档
├── references/
│   ├── api-docs.md             # 代理可以查阅的 API 参考
│   └── examples.md             # 示例输入/输出
├── templates/
│   └── config.yaml             # 代理可以使用的模板文件
└── scripts/
    └── setup.sh                # 代理可以执行的脚本
```

在你的 SKILL.md 中引用它们：

```markdown
有关 API 细节，加载参考：`skill_view("my-skill", "references/api-docs.md")`
```

### 4. 测试

启动新会话并尝试你的技能：

```bash
hermes chat -q "/my-skill help me with the thing"
```

技能自动出现 — 无需注册。放入 `~/.hermes/skills/` 即可生效。

:::info
代理也可以使用 `skill_manage` 自己创建和更新技能。在解决复杂问题后，Hermes 可能会主动提出将方法保存为技能以备下次使用。
:::

---

## 每平台技能管理

控制哪些技能在哪些平台上可用：

```bash
hermes skills
```

这打开一个交互式 TUI，你可以在其中按平台（CLI、Telegram、Discord 等）启用或禁用技能。当你想要某些技能仅在特定上下文中可用时很有用 — 例如，将开发技能从 Telegram 上移除。

---

## 技能 vs 记忆

两者都跨会话持久化，但它们服务于不同的目的：

| | 技能 | 记忆 |
|---|---|---|
| **什么** | 程序性知识 — 如何做事 | 事实性知识 — 事情是什么 |
| **何时** | 按需加载，仅在相关时 | 自动注入每个会话 |
| **大小** | 可以很大（数百行） | 应该紧凑（仅关键事实） |
| **成本** | 加载前零 token | 小但持续的 token 成本 |
| **示例** | "如何部署到 Kubernetes" | "用户偏好暗色模式，住在 PST" |
| **谁创建** | 你、代理或从中心安装 | 代理，基于对话 |

**经验法则：** 如果你会把它放在参考文档中，它是技能。如果你会把它放在便利贴上，它是记忆。

---

## 提示

**保持技能聚焦。** 试图覆盖 "所有 DevOps" 的技能会太长太模糊。覆盖 "部署 Python 应用到 Fly.io" 的技能足够具体，真正有用。

**让代理创建技能。** 在复杂的多步任务后，Hermes 通常会主动提出将方法保存为技能。说好 — 这些代理编写的技能捕获了确切的工作流，包括沿途发现的陷阱。

**使用类别。** 将技能组织到子目录中（`~/.hermes/skills/devops/`、`~/.hermes/skills/research/` 等）。这使列表可管理并帮助代理更快找到相关技能。

**当技能过时时更新它们。** 如果你使用技能并遇到它未涵盖的问题，告诉 Hermes 用你学到的更新技能。不维护的技能会成为负担。

---

*有关完整的技能参考 — 前置元数据字段、条件激活、外部目录等 — 请参见[技能系统](/docs/user-guide/features/skills)。*
