---
sidebar_position: 10
title: "教程：GitHub PR 审查代理"
description: "构建一个自动化的 AI 代码审查器，监控你的仓库、审查拉取请求并投递反馈 — 免手动操作"
---

# 教程：构建 GitHub PR 审查代理

**问题：** 你的团队打开 PR 的速度比你能审查的快。PR 等待数天等待关注。初级开发者合并了 bug 因为没人有时间检查。你花早上时间追赶 diff 而不是构建。

**解决方案：** 一个 AI 代理全天候监视你的仓库，审查每个新 PR 的 bug、安全问题和代码质量，并发送摘要 — 你只需在真正需要人工判断的 PR 上花时间。

**你将构建什么：**

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│   Cron 定时器  ──▶  Hermes Agent  ──▶  GitHub API  ──▶  审查     │
│   （每 2 小时）    + gh CLI            (PR diff)       投递       │
│                    + 技能                             (Telegram, │
│                    + 记忆                            Discord,     │
│                                                      本地)        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

本指南使用 **cron 作业**按调度轮询 PR — 无需服务器或公共端点。在 NAT 和防火墙后工作。

:::tip 想要实时审查？
如果你有可用的公共端点，请查看[使用 Webhook 自动化 GitHub PR 评论](./webhook-github-pr-review.md) — GitHub 在 PR 打开或更新时立即将事件推送到 Hermes。
:::

---

## 前提条件

- **Hermes Agent 已安装** — 参见[安装指南](/docs/getting-started/installation)
- **网关在运行** 用于 cron 作业：
  ```bash
  hermes gateway install   # 安装为服务
  # 或
  hermes gateway           # 在前台运行
  ```
- **GitHub CLI（`gh`）已安装并认证**：
  ```bash
  # 安装
  brew install gh        # macOS
  sudo apt install gh    # Ubuntu/Debian

  # 认证
  gh auth login
  ```
- **消息已配置**（可选） — [Telegram](/docs/user-guide/messaging/telegram) 或 [Discord](/docs/user-guide/messaging/discord)

:::tip 没有消息平台？没问题
使用 `deliver: "local"` 将审查保存到 `~/.hermes/cron/output/`。在连接通知前测试很好。
:::

---

## 步骤 1：验证设置

确保 Hermes 可以访问 GitHub。启动聊天：

```bash
hermes
```

用简单命令测试：

```
Run: gh pr list --repo NousResearch/hermes-agent --state open --limit 3
```

你应该看到打开的 PR 列表。如果这有效，你就准备好了。

---

## 步骤 2：尝试手动审查

仍在聊天中，让 Hermes 审查真实 PR：

```
审查这个拉取请求。阅读 diff，检查 bug、安全问题和代码质量。
对行号要具体并引用有问题的代码。

Run: gh pr diff 3888 --repo NousResearch/hermes-agent
```

Hermes 将：
1. 执行 `gh pr diff` 获取代码更改
2. 阅读整个 diff
3. 生成带有具体发现的结构化审查

如果你对质量满意，是时候自动化了。

---

## 步骤 3：创建审查技能

技能给 Hermes 一致的审查指南，跨会话和 cron 运行持久化。没有它，审查质量会变化。

```bash
mkdir -p ~/.hermes/skills/code-review
```

创建 `~/.hermes/skills/code-review/SKILL.md`：

```markdown
---
name: code-review
description: 审查拉取请求的 bug、安全问题和代码质量
---

# 代码审查指南

审查拉取请求时：

## 检查什么
1. **Bug** — 逻辑错误、差一错误、null/undefined 处理
2. **安全** — 注入、认证绕过、代码中的密钥、SSRF
3. **性能** — N+1 查询、无界循环、内存泄漏
4. **风格** — 命名规范、死代码、缺少错误处理
5. **测试** — 更改是否被测试？测试是否覆盖边界情况？

## 输出格式
对每个发现：
- **File:Line** — 确切位置
- **严重性** — Critical / Warning / Suggestion
- **问题** — 一句话
- **修复** — 如何修复

## 规则
- 要具体。引用有问题的代码。
- 除非影响可读性，否则不要标记风格挑剔。
- 如果 PR 看起来不错，就说。不要编造问题。
- 结尾：APPROVE / REQUEST_CHANGES / COMMENT
```

验证它已加载 — 启动 `hermes`，你应该在启动时的技能列表中看到 `code-review`。

---

## 步骤 4：教它你的规范

这是让审查者真正有用的关键。启动会话并教 Hermes 你团队的标准：

```
记住：在我们的后端仓库中，我们使用 Python 和 FastAPI。
所有端点必须有类型注解和 Pydantic 模型。
我们不允许原始 SQL — 只用 SQLAlchemy ORM。
测试文件在 tests/ 中，必须使用 pytest fixtures。
```

```
记住：在我们的前端仓库中，我们使用 TypeScript 和 React。
不允许 `any` 类型。所有组件必须有 props 接口。
我们使用 React Query 获取数据，从不使用 useEffect 进行 API 调用。
```

这些记忆永久持久化 — 审查者会在每次被告知的情况下强制执行你的规范。

---

## 步骤 5：创建自动化 Cron 作业

现在把它们连接在一起。创建一个每 2 小时运行的 cron 作业：

```bash
hermes cron create "0 */2 * * *" \
  "检查新的打开 PR 并审查它们。

要监控的仓库：
- myorg/backend-api
- myorg/frontend-app

步骤：
1. Run: gh pr list --repo REPO --state open --limit 5 --json number,title,author,createdAt
2. 对于过去 4 小时内创建或更新的每个 PR：
   - Run: gh pr diff NUMBER --repo REPO
   - 使用 code-review 指南审查 diff
3. 格式化输出为：

## PR 审查 — 今天

### [repo] #[number]: [title]
**作者：** [name] | **结论：** APPROVE/REQUEST_CHANGES/COMMENT
[发现]

如果没有找到新 PR，说：没有新 PR 需要审查。" \
  --name "pr-review" \
  --deliver telegram \
  --skill code-review
```

验证已调度：

```bash
hermes cron list
```

### 其他有用的调度

| 调度 | 时间 |
|----------|------|
| `0 */2 * * *` | 每 2 小时 |
| `0 9,13,17 * * 1-5` | 每天三次，仅工作日 |
| `0 9 * * 1` | 每周一早上汇总 |
| `30m` | 每 30 分钟（高流量仓库） |

---

## 步骤 6：按需运行

不想等调度？手动触发：

```bash
hermes cron run pr-review
```

或在聊天会话中：

```
/cron run pr-review
```

---

## 更进一步

### 直接将审查发布到 GitHub

与其投递到 Telegram，让代理直接在 PR 上评论：

在你的 cron 提示中添加：

```
审查后，发布你的审查：
- 对问题：gh pr review NUMBER --repo REPO --comment --body "YOUR_REVIEW"
- 对严重问题：gh pr review NUMBER --repo REPO --request-changes --body "YOUR_REVIEW"
- 对干净的 PR：gh pr review NUMBER --repo REPO --approve --body "Looks good"
```

:::caution
确保 `gh` 有 `repo` 范围的令牌。审查以 `gh` 认证的身份发布。
:::

### 周 PR 仪表板

创建周一早上的所有仓库概览：

```bash
hermes cron create "0 9 * * 1" \
  "生成周 PR 仪表板：
- myorg/backend-api
- myorg/frontend-app
- myorg/infra

对每个仓库显示：
1. 打开的 PR 数量和最旧 PR 的年龄
2. 本周合并的 PR
3. 过期 PR（超过 5 天）
4. 没有分配审查者的 PR

格式化为干净的摘要。" \
  --name "weekly-dashboard" \
  --deliver telegram
```

### 多仓库监控

通过在提示中添加更多仓库来扩展。代理顺序处理它们 — 无需额外设置。

---

## 故障排除

### "gh: command not found"
网关在最小环境中运行。确保 `gh` 在系统 PATH 中并重启网关。

### 审查太泛泛
1. 添加 `code-review` 技能（步骤 3）
2. 通过记忆教 Hermes 你的规范（步骤 4）
3. 它对你技术栈的上下文越多，审查越好

### Cron 作业不运行
```bash
hermes gateway status    # 网关在运行吗？
hermes cron list         # 作业启用了吗？
```

### 速率限制
GitHub 允许认证用户每小时 5,000 次 API 请求。每个 PR 审查使用约 3-5 个请求（列表 + diff + 可选评论）。即使每天审查 100 个 PR 也在限制范围内。

---

## 下一步？

- **[基于 Webhook 的 PR 审查](./webhook-github-pr-review.md)** — PR 打开时获得即时审查（需要公共端点）
- **[每日简报机器人](/docs/guides/daily-briefing-bot)** — 将 PR 审查与你的早间新闻文摘结合
- **[构建插件](/docs/guides/build-a-hermes-plugin)** — 将审查逻辑包装为可分享的插件
- **[Profiles](/docs/user-guide/profiles)** — 运行具有自己记忆和配置的专用审查者 profile
- **[回退提供者](/docs/user-guide/features/fallback-providers)** — 确保即使一个提供者宕机审查也能运行
