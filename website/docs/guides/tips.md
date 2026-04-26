---
sidebar_position: 1
title: "技巧与最佳实践"
description: "充分利用 Hermes Agent 的实用建议 — 提示技巧、CLI 快捷方式、上下文文件、记忆、成本优化和安全"
---

# 技巧与最佳实践

一个快速见效的实用技巧集合，让你立即更高效地使用 Hermes Agent。每个部分针对不同的方面 — 浏览标题并跳转到相关部分。

---

## 获得最佳结果

### 具体说明你想要什么

模糊的提示产生模糊的结果。不要说 "修复代码"，而是说 "修复 `api/handlers.py` 第 47 行的 TypeError — `process_request()` 函数从 `parse_body()` 接收到 `None`。" 你提供的上下文越多，需要的迭代越少。

### 预先提供上下文

在请求开头提供相关细节：文件路径、错误消息、预期行为。一条精心编写的消息胜过三轮澄清。直接粘贴错误回溯 — 代理可以解析它们。

### 使用上下文文件处理重复指令

如果你发现自己在重复相同的指令（"使用制表符而不是空格"、"我们使用 pytest"、"API 在 `/api/v2`"），将它们放在 `AGENTS.md` 文件中。代理在每个会话中自动读取 — 设置后零工作量。

### 让代理使用它的工具

不要试图手把手指导每一步。说 "找到并修复失败的测试" 而不是 "打开 `tests/test_foo.py`，看第 42 行，然后..." 代理有文件搜索、终端访问和代码执行 — 让它探索和迭代。

### 使用技能处理复杂工作流

在写长提示解释如何做某事之前，检查是否已经有相关技能。输入 `/skills` 浏览可用技能，或者直接调用一个如 `/axolotl` 或 `/github-pr-workflow`。

## CLI 高级用户技巧

### 多行输入

按 **Alt+Enter**（或 **Ctrl+J**）插入换行而不发送。这让你可以编写多行提示、粘贴代码块或在按 Enter 发送前构建复杂请求。

### 粘贴检测

CLI 自动检测多行粘贴。直接粘贴代码块或错误回溯 — 它不会将每行作为单独消息发送。粘贴会被缓冲并作为一条消息发送。

### 中断和重定向

按 **Ctrl+C** 一次中断代理的响应。然后你可以输入新消息来重定向它。在 2 秒内双击 Ctrl+C 强制退出。当代理开始走错方向时，这非常有用。

### 使用 `-c` 恢复会话

忘记了上一个会话的内容？运行 `hermes -c` 恢复到你离开的地方，完整恢复对话历史。你也可以按标题恢复：`hermes -r "我的研究项目"`。

### 剪贴板图片粘贴

按 **Ctrl+V** 将剪贴板中的图片直接粘贴到聊天中。代理使用视觉分析截图、图表、错误弹窗或 UI 模拟图 — 无需先保存到文件。

### 斜杠命令自动补全

输入 `/` 并按 **Tab** 查看所有可用命令。这包括内置命令（`/compress`、`/model`、`/title`）和每个已安装的技能。你不需要记住任何东西 — Tab 补全覆盖一切。

:::tip
使用 `/verbose` 循环切换工具输出显示模式：**off → new → all → verbose**。"all" 模式适合观察代理在做什么；"off" 对简单问答最干净。
:::

## 上下文文件

### AGENTS.md：你项目的大脑

在项目根目录创建 `AGENTS.md`，包含架构决策、编码规范和项目特定指令。这会自动注入每个会话，因此代理始终知道你的项目规则。

```markdown
# 项目上下文
- 这是一个使用 SQLAlchemy ORM 的 FastAPI 后端
- 数据库操作始终使用 async/await
- 测试放在 tests/ 目录，使用 pytest-asyncio
- 永远不要提交 .env 文件
```

### SOUL.md：自定义个性

想要 Hermes 有一个稳定的默认声音？编辑 `~/.hermes/SOUL.md`（如果你使用自定义 Hermes 主目录则是 `$HERMES_HOME/SOUL.md`）。Hermes 现在会自动播种一个起始 SOUL 文件，并使用该全局文件作为实例范围的个性来源。

有关完整演练，请参见[在 Hermes 中使用 SOUL.md](/docs/guides/use-soul-with-hermes)。

```markdown
# 灵魂
你是一名资深后端工程师。简洁直接。
除非被要求，否则跳过解释。偏好单行代码而非冗长的解决方案。
始终考虑错误处理和边界情况。
```

使用 `SOUL.md` 持久化个性。使用 `AGENTS.md` 处理项目特定指令。

### .cursorrules 兼容性

已经有 `.cursorrules` 或 `.cursor/rules/*.mdc` 文件？Hermes 也会读取它们。无需复制你的编码规范 — 它们会从工作目录自动加载。

### 发现

Hermes 在会话开始时从当前工作目录加载顶级 `AGENTS.md`。子目录的 `AGENTS.md` 文件在工具调用期间懒加载发现（通过 `subdirectory_hints.py`）并注入工具结果 — 它们不会预先加载到系统提示中。

:::tip
保持上下文文件聚焦和简洁。每个字符都会计入你的 token 预算，因为它们被注入到每条消息中。
:::

## 记忆与技能

### 记忆 vs 技能：什么放在哪里

**记忆**用于事实：你的环境、偏好、项目位置以及代理学到的关于你的事情。**技能**用于程序：多步工作流、工具特定指令和可重用的配方。记忆用于 "是什么"，技能用于 "怎么做"。

### 何时创建技能

如果你发现一个需要 5 步以上且会重复执行的任务，让代理为它创建一个技能。说 "把你刚才做的保存为名为 `deploy-staging` 的技能。" 下次，只需输入 `/deploy-staging`，代理就会加载完整程序。

### 管理记忆容量

记忆是有意限制的（MEMORY.md 约 2,200 字符，USER.md 约 1,375 字符）。当它满了，代理会合并条目。你可以通过说 "清理你的记忆" 或 "替换旧的 Python 3.9 笔记 — 我们现在用 3.12 了" 来帮助。

### 让代理记住

在一个有成效的会话后，说 "记住这个以备下次"，代理会保存关键要点。你也可以具体说明："保存到记忆中，我们的 CI 使用 GitHub Actions 的 `deploy.yml` 工作流。"

:::warning
记忆是冻结快照 — 会话期间的更改在下一个会话开始之前不会出现在系统提示中。代理立即写入磁盘，但提示缓存在会话中不会失效。
:::

## 性能与成本

### 不要破坏提示缓存

大多数 LLM 提供者缓存系统提示前缀。如果你保持系统提示稳定（相同的上下文文件、相同的记忆），会话中的后续消息会获得显著更便宜的**缓存命中**。避免在会话中更改模型或系统提示。

### 在达到限制前使用 /compress

长会话会积累 token。当你注意到响应变慢或被截断时，运行 `/compress`。这会总结对话历史，保留关键上下文同时大幅减少 token 数量。使用 `/usage` 检查你的状态。

### 委托进行并行工作

需要同时研究三个主题？让代理使用 `delegate_task` 进行并行子任务。每个子代理独立运行自己的上下文，只有最终摘要返回 — 大幅减少主对话的 token 使用。

### 使用 execute_code 进行批处理操作

与其一次运行一个终端命令，不如让代理写一个一次完成所有事情的脚本。"写一个 Python 脚本将所有 `.jpeg` 文件重命名为 `.jpg` 并运行它" 比逐个重命名文件更便宜更快。

### 选择正确的模型

使用 `/model` 在会话中切换模型。使用前沿模型（Claude Sonnet/Opus、GPT-4o）进行复杂推理和架构决策。切换到更快的模型进行简单任务如格式化、重命名或样板生成。

:::tip
定期运行 `/usage` 查看你的 token 消耗。运行 `/insights` 获取过去 30 天使用模式的更广泛视图。
:::

## 消息技巧

### 设置主频道

在你首选的 Telegram 或 Discord 聊天中使用 `/sethome` 将其指定为主频道。Cron 作业结果和定时任务输出会投递到这里。没有它，代理没有地方发送主动消息。

### 使用 /title 组织会话

使用 `/title auth-refactor` 或 `/title research-llm-quantization` 为你的会话命名。命名的会话可以通过 `hermes sessions list` 轻松找到，并通过 `hermes -r "auth-refactor"` 恢复。未命名的会话会堆积起来变得无法区分。

### DM 配对用于团队访问

与其手动收集用户 ID 用于允许列表，不如启用 DM 配对。当队友给机器人发 DM 时，他们会获得一次性配对码。你通过 `hermes pairing approve telegram XKGH5N7P` 批准 — 简单且安全。

### 工具进度显示模式

使用 `/verbose` 控制你看到多少工具活动。在消息平台上，少即是多 — 保持在 "new" 只看新的工具调用。在 CLI 中，"all" 给你一个令人满意的代理所有操作的实时视图。

:::tip
在消息平台上，会话在空闲时间后自动重置（默认：24 小时）或每天凌晨 4 点。如果需要更长的会话，在 `~/.hermes/config.yaml` 中按平台调整。
:::

## 安全

### 使用 Docker 处理不受信任的代码

当处理不受信任的仓库或运行不熟悉的代码时，使用 Docker 或 Daytona 作为你的终端后端。在 `.env` 中设置 `TERMINAL_BACKEND=docker`。容器内的破坏性命令不会损害你的主机系统。

```bash
# 在你的 .env 中：
TERMINAL_BACKEND=docker
TERMINAL_DOCKER_IMAGE=hermes-sandbox:latest
```

### 避免 Windows 编码陷阱

在 Windows 上，某些默认编码（如 `cp125x`）无法表示所有 Unicode 字符，这可能在测试或脚本中写入文件时导致 `UnicodeEncodeError`。

- 优先使用显式 UTF-8 编码打开文件：

```python
with open("results.txt", "w", encoding="utf-8") as f:
    f.write("✓ All good\n")
```

- 在 PowerShell 中，你也可以将当前会话切换到 UTF-8 用于控制台和原生命令输出：

```powershell
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
```

这使 PowerShell 和子进程保持 UTF-8，有助于避免仅 Windows 的失败。

### 选择 "Always" 前仔细审查

当代理触发危险命令审批（`rm -rf`、`DROP TABLE` 等）时，你有四个选项：**once**、**session**、**always**、**deny**。选择 "always" 前要仔细考虑 — 它会永久允许该模式。在你放心之前先用 "session"。

### 命令审批是你的安全网

Hermes 在执行前检查每个命令是否匹配精心策划的危险模式列表。这包括递归删除、SQL drop、管道 curl 到 shell 等。不要在生产中禁用这个 — 它存在是有充分理由的。

:::warning
在容器后端（Docker、Singularity、Modal、Daytona）中运行时，危险命令检查会被**跳过**，因为容器就是安全边界。确保你的容器镜像被适当锁定。
:::

### 为消息机器人使用允许列表

永远不要在具有终端访问权限的机器人上设置 `GATEWAY_ALLOW_ALL_USERS=true`。始终使用平台特定的允许列表（`TELEGRAM_ALLOWED_USERS`、`DISCORD_ALLOWED_USERS`）或 DM 配对来控制谁可以与你的代理交互。

```bash
# 推荐：每个平台的显式允许列表
TELEGRAM_ALLOWED_USERS=123456789,987654321
DISCORD_ALLOWED_USERS=123456789012345678

# 或使用跨平台允许列表
GATEWAY_ALLOWED_USERS=123456789,987654321
```

---

*有应该出现在此页面的技巧？提交 issue 或 PR — 欢迎社区贡献。*
