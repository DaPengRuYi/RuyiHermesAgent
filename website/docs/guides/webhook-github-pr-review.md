---
sidebar_position: 11
sidebar_label: "通过 Webhook 的 GitHub PR 审查"
title: "使用 Webhook 自动化 GitHub PR 评论"
description: "将 Hermes 连接到 GitHub，使其自动获取 PR diff、分析代码更改并发布评论 — 由 webhook 触发，无需手动提示"
---

# 使用 Webhook 自动化 GitHub PR 评论

本指南引导你将 Hermes Agent 连接到 GitHub，使其自动获取拉取请求的 diff、分析代码更改并发布评论 — 由 webhook 事件触发，无需手动提示。

当 PR 被打开或更新时，GitHub 发送 webhook POST 到你的 Hermes 实例。Hermes 运行代理，提示指示它通过 `gh` CLI 检索 diff，响应发布回 PR 线程。

:::tip 想要没有公共端点的更简单设置？
如果你没有公共 URL 或只想快速开始，请查看[构建 GitHub PR 审查代理](./github-pr-review-agent.md) — 使用 cron 作业按调度轮询 PR，在 NAT 和防火墙后工作。
:::

:::info 参考文档
有关完整的 webhook 平台参考（所有配置选项、投递类型、动态订阅、安全模型），请参见 [Webhooks](/docs/user-guide/messaging/webhooks)。
:::

:::warning 提示注入风险
Webhook 载荷包含攻击者控制的数据 — PR 标题、提交消息和描述可能包含恶意指令。当你的 webhook 端点暴露到互联网时，在沙箱环境（Docker、SSH 后端）中运行网关。参见下面的[安全部分](#安全说明)。
:::

---

## 前提条件

- Hermes Agent 已安装并运行（`hermes gateway`）
- [`gh` CLI](https://cli.github.com/) 已安装并在网关主机上认证（`gh auth login`）
- 你的 Hermes 实例的公共可达 URL（如果在本地运行，请参见[使用 ngrok 进行本地测试](#使用-ngrok-进行本地测试)）
- GitHub 仓库的管理员访问权限（管理 webhook 所需）

---

## 步骤 1 — 启用 webhook 平台

在你的 `~/.hermes/config.yaml` 中添加以下内容：

```yaml
platforms:
  webhook:
    enabled: true
    extra:
      port: 8644          # 默认；如果其他服务占用此端口则更改
      rate_limit: 30      # 每路由每分钟最大请求数（不是全局上限）

      routes:
        github-pr-review:
          secret: "your-webhook-secret-here"   # 必须与 GitHub webhook 密钥完全匹配
          events:
            - pull_request

          # 代理被指示在审查前获取实际 diff。
          # {number} 和 {repository.full_name} 从 GitHub 载荷解析。
          prompt: |
            收到了拉取请求事件（action: {action}）。

            PR #{number}: {pull_request.title}
            作者：{pull_request.user.login}
            分支：{pull_request.head.ref} → {pull_request.base.ref}
            描述：{pull_request.body}
            URL：{pull_request.html_url}

            如果 action 是 "closed" 或 "labeled"，在此停止且不发布评论。

            否则：
            1. Run: gh pr diff {number} --repo {repository.full_name}
            2. 审查代码更改的正确性、安全问题和清晰度。
            3. 编写简洁、可操作的审查评论并发布。

          deliver: github_comment
          deliver_extra:
            repo: "{repository.full_name}"
            pr_number: "{number}"
```

**关键字段：**

| 字段 | 描述 |
|---|---|
| `secret`（路由级） | 此路由的 HMAC 密钥。如果省略则回退到 `extra.secret` 全局。 |
| `events` | 要接受的 `X-GitHub-Event` 头值列表。空列表 = 接受所有。 |
| `prompt` | 模板；`{field}` 和 `{nested.field}` 从 GitHub 载荷解析。 |
| `deliver` | `github_comment` 通过 `gh pr comment` 发布。`log` 只写入网关日志。 |
| `deliver_extra.repo` | 从载荷解析为例如 `org/repo`。 |
| `deliver_extra.pr_number` | 从载荷解析为 PR 编号。 |

:::note 载荷不包含代码
GitHub webhook 载荷包含 PR 元数据（标题、描述、分支名称、URL）但**不包含 diff**。上面的提示指示代理运行 `gh pr diff` 来获取实际更改。`terminal` 工具包含在默认的 `hermes-webhook` 工具集中，因此无需额外配置。
:::

---

## 步骤 2 — 启动网关

```bash
hermes gateway
```

你应该看到：

```
[webhook] Listening on 0.0.0.0:8644 — routes: github-pr-review
```

验证它在运行：

```bash
curl http://localhost:8644/health
# {"status": "ok", "platform": "webhook"}
```

---

## 步骤 3 — 在 GitHub 上注册 webhook

1. 进入你的仓库 → **Settings** → **Webhooks** → **Add webhook**
2. 填写：
   - **Payload URL：** `https://your-public-url.example.com/webhooks/github-pr-review`
   - **Content type：** `application/json`
   - **Secret：** 与你在路由配置中设置的 `secret` 相同的值
   - **Which events?** → Select individual events → 勾选 **Pull requests**
3. 点击 **Add webhook**

GitHub 会立即发送 `ping` 事件确认连接。它被安全忽略 — `ping` 不在你的 `events` 列表中 — 并返回 `{"status": "ignored", "event": "ping"}`。它只在 DEBUG 级别记录，因此在默认日志级别不会出现在控制台中。

---

## 步骤 4 — 打开测试 PR

创建分支，推送更改，打开 PR。在 30-90 秒内（取决于 PR 大小和模型），Hermes 应该发布审查评论。

要实时跟踪代理的进度：

```bash
tail -f "${HERMES_HOME:-$HOME/.hermes}/logs/gateway.log"
```

---

## 使用 ngrok 进行本地测试

如果 Hermes 在你的笔记本上运行，使用 [ngrok](https://ngrok.com/) 暴露它：

```bash
ngrok http 8644
```

复制 `https://...ngrok-free.app` URL 并将其用作你的 GitHub Payload URL。在免费 ngrok 层级上，URL 每次 ngrok 重启时都会更改 — 每个会话更新你的 GitHub webhook。付费 ngrok 账户获得静态域名。

你可以直接用 `curl` 冒烟测试静态路由 — 无需 GitHub 账户或真实 PR。

:::tip 本地测试时使用 `deliver: log`
测试时将 `deliver: github_comment` 改为 `deliver: log`。否则代理会尝试在测试载荷中向假的 `org/repo#99` 仓库发布评论，这会失败。对提示输出满意后切换回 `deliver: github_comment`。
:::

```bash
SECRET="your-webhook-secret-here"
BODY='{"action":"opened","number":99,"pull_request":{"title":"Test PR","body":"Adds a feature.","user":{"login":"testuser"},"head":{"ref":"feat/x"},"base":{"ref":"main"},"html_url":"https://github.com/org/repo/pull/99"},"repository":{"full_name":"org/repo"}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print "sha256="$2}')

curl -s -X POST http://localhost:8644/webhooks/github-pr-review \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$BODY"
# 预期：{"status":"accepted","route":"github-pr-review","event":"pull_request","delivery_id":"..."}
```

然后观察代理运行：
```bash
tail -f "${HERMES_HOME:-$HOME/.hermes}/logs/gateway.log"
```

:::note
`hermes webhook test <name>` 仅适用于使用 `hermes webhook subscribe` 创建的**动态订阅**。它不从 `config.yaml` 读取路由。
:::

---

## 过滤特定操作

GitHub 对许多操作发送 `pull_request` 事件：`opened`、`synchronize`、`reopened`、`closed`、`labeled` 等。`events` 列表仅按 `X-GitHub-Event` 头值过滤 — 它不能在路由级别按操作子类型过滤。

步骤 1 中的提示已经通过指示代理对 `closed` 和 `labeled` 事件提前停止来处理此问题。

:::warning 代理仍然运行并消耗 token
"在此停止" 的指令阻止了有意义的审查，但代理仍然对每个 `pull_request` 事件运行到完成，无论操作如何。GitHub webhook 只能按事件类型（`pull_request`、`push`、`issues` 等）过滤 — 不能按操作子类型（`opened`、`closed`、`labeled`）。没有路由级别的子操作过滤器。对于高流量仓库，接受此成本或使用有条件调用 webhook URL 的 GitHub Actions 工作流在上游过滤。
:::

> 没有 Jinja2 或条件模板语法。`{field}` 和 `{nested.field}` 是唯一支持的替换。其他任何内容都原样传递给代理。

---

## 使用技能获得一致的审查风格

加载 [Hermes 技能](/docs/user-guide/features/skills) 给代理一致的审查角色。在 `config.yaml` 中 `platforms.webhook.extra.routes` 内的路由中添加 `skills`：

```yaml
platforms:
  webhook:
    enabled: true
    extra:
      routes:
        github-pr-review:
          secret: "your-webhook-secret-here"
          events: [pull_request]
          prompt: |
            收到了拉取请求事件（action: {action}）。
            PR #{number}: {pull_request.title} by {pull_request.user.login}
            URL: {pull_request.html_url}

            如果 action 是 "closed" 或 "labeled"，在此停止且不发布评论。

            否则：
            1. Run: gh pr diff {number} --repo {repository.full_name}
            2. 使用你的审查指南审查 diff。
            3. 编写简洁、可操作的审查评论并发布。
          skills:
            - review
          deliver: github_comment
          deliver_extra:
            repo: "{repository.full_name}"
            pr_number: "{number}"
```

> **注意：** 只加载找到的第一个技能。Hermes 不堆叠多个技能 — 后续条目被忽略。

---

## 将响应发送到 Slack 或 Discord

用你的目标平台替换路由中的 `deliver` 和 `deliver_extra` 字段：

```yaml
# 在 platforms.webhook.extra.routes.<route-name> 中：

# Slack
deliver: slack
deliver_extra:
  chat_id: "C0123456789"   # Slack 频道 ID（省略使用配置的主频道）

# Discord
deliver: discord
deliver_extra:
  chat_id: "987654321012345678"  # Discord 频道 ID（省略使用主频道）
```

目标平台也必须在网关中启用和连接。如果省略 `chat_id`，响应发送到该平台配置的主频道。

有效的 `deliver` 值：`log` · `github_comment` · `telegram` · `discord` · `slack` · `signal` · `sms`

---

## GitLab 支持

相同的适配器适用于 GitLab。GitLab 使用 `X-Gitlab-Token` 进行认证（纯字符串匹配，不是 HMAC）— Hermes 自动处理两者。

对于事件过滤，GitLab 将 `X-GitLab-Event` 设置为 `Merge Request Hook`、`Push Hook`、`Pipeline Hook` 等值。在 `events` 中使用确切的头值：

```yaml
events:
  - Merge Request Hook
```

GitLab 载荷字段与 GitHub 不同 — 例如 MR 标题用 `{object_attributes.title}`，MR 编号用 `{object_attributes.iid}`。发现完整载荷结构最简单的方式是 GitLab webhook 设置中的 **Test** 按钮，结合 **Recent Deliveries** 日志。或者，从路由配置中省略 `prompt` — Hermes 将把完整载荷作为格式化的 JSON 直接传递给代理，代理的响应（在网关日志中用 `deliver: log` 可见）将描述其结构。

---

## 安全说明

- **永远不要在生产中使用 `INSECURE_NO_AUTH`** — 它完全禁用签名验证。仅用于本地开发。
- **定期轮换你的 webhook 密钥**并在 GitHub（webhook 设置）和你的 `config.yaml` 中更新。
- **速率限制**默认每路由每分钟 30 个请求（可通过 `extra.rate_limit` 配置）。超过返回 `429`。
- **重复投递**（webhook 重试）通过 1 小时的幂等缓存去重。缓存键是 `X-GitHub-Delivery`（如果存在），然后是 `X-Request-ID`，然后是毫秒时间戳。当两个投递 ID 头都未设置时，重试**不会**去重。
- **提示注入：** PR 标题、描述和提交消息是攻击者控制的。恶意 PR 可能试图操纵代理的操作。当暴露到公共互联网时，在沙箱环境（Docker、VM）中运行网关。

---

## 故障排除

| 症状 | 检查 |
|---|---|
| `401 Invalid signature` | config.yaml 中的密钥与 GitHub webhook 密钥不匹配 |
| `404 Unknown route` | URL 中的路由名称与 `routes:` 中的键不匹配 |
| `429 Rate limit exceeded` | 超过每路由每分钟 30 个请求 — 从 GitHub UI 重新投递测试事件时常见；等一分钟或提高 `extra.rate_limit` |
| 没有发布评论 | `gh` 未安装、不在 PATH 中或未认证（`gh auth login`） |
| 代理运行但没有评论 | 检查网关日志 — 如果代理输出为空或只是 "SKIP"，投递仍会尝试 |
| 端口已被占用 | 更改 config.yaml 中的 `extra.port` |
| 代理运行但只审查 PR 描述 | 提示没有包含 `gh pr diff` 指令 — diff 不在 webhook 载荷中 |
| 看不到 ping 事件 | 被忽略的事件仅在 DEBUG 日志级别返回 `{"status":"ignored","event":"ping"}` — 检查 GitHub 的投递日志（repo → Settings → Webhooks → your webhook → Recent Deliveries） |

**GitHub 的 Recent Deliveries 标签**（repo → Settings → Webhooks → your webhook）显示每个投递的确切请求头、载荷、HTTP 状态和响应体。这是不碰服务器日志诊断失败的最快方式。

---

## 完整配置参考

```yaml
platforms:
  webhook:
    enabled: true
    extra:
      host: "0.0.0.0"         # 绑定地址（默认：0.0.0.0）
      port: 8644               # 监听端口（默认：8644）
      secret: ""               # 可选全局回退密钥
      rate_limit: 30           # 每路由每分钟请求数
      max_body_bytes: 1048576  # 载荷大小限制字节数（默认：1 MB）

      routes:
        <route-name>:
          secret: "required-per-route"
          events: []            # [] = 接受所有；否则列出 X-GitHub-Event 值
          prompt: ""            # {field} / {nested.field} 从载荷解析
          skills: []            # 加载第一个匹配的技能（仅一个）
          deliver: "log"        # log | github_comment | telegram | discord | slack | signal | sms
          deliver_extra: {}     # github_comment 用 repo + pr_number；其他用 chat_id
```

---

## 下一步？

- **[基于 Cron 的 PR 审查](./github-pr-review-agent.md)** — 按调度轮询 PR，无需公共端点
- **[Webhook 参考](/docs/user-guide/messaging/webhooks)** — webhook 平台的完整配置参考
- **[构建插件](/docs/guides/build-a-hermes-plugin)** — 将审查逻辑打包为可分享的插件
- **[Profiles](/docs/user-guide/profiles)** — 运行具有自己记忆和配置的专用审查者 profile
