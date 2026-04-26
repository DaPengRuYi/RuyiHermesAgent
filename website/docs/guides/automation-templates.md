---
sidebar_position: 15
title: "自动化模板"
description: "即用型自动化配方 — 定时任务、GitHub 事件触发器、API webhook 和多技能工作流"
---

# 自动化模板

常见自动化模式的复制粘贴配方。每个模板使用 Hermes 内置的 [cron 调度器](/docs/user-guide/features/cron) 进行基于时间的触发，[webhook 平台](/docs/user-guide/messaging/webhooks) 进行事件驱动的触发。

每个模板适用于**任何模型** — 不锁定到单一提供者。

:::tip 三种触发类型
| 触发 | 方式 | 工具 |
|---------|-----|------|
| **调度** | 按节奏运行（每小时、每晚、每周） | `cronjob` 工具或 `/cron` 斜杠命令 |
| **GitHub 事件** | 在 PR 打开、推送、issue、CI 结果时触发 | Webhook 平台（`hermes webhook subscribe`） |
| **API 调用** | 外部服务 POST JSON 到你的端点 | Webhook 平台（config.yaml 路由或 `hermes webhook subscribe`） |

三种都支持投递到 Telegram、Discord、Slack、SMS、邮件、GitHub 评论或本地文件。
:::

---

## 开发工作流

### 每夜待办分类

每晚标记、优先排序和总结新 issue。投递摘要到你的团队频道。

**触发：** 调度（每夜）

```bash
hermes cron create "0 2 * * *" \
  "你是一个项目经理，正在分类 NousResearch/hermes-agent GitHub 仓库。

1. Run: gh issue list --repo NousResearch/hermes-agent --state open --json number,title,labels,author,createdAt --limit 30
2. 识别过去 24 小时内打开的 issue
3. 对每个新 issue：
   - 建议优先级标签（P0-critical、P1-high、P2-medium、P3-low）
   - 建议类别标签（bug、feature、docs、security）
   - 写一行分类备注
4. 总结：总打开 issue、今天新增、按优先级分类

格式化为干净的摘要。如果没有新 issue，回复 [SILENT]。" \
  --name "每夜待办分类" \
  --deliver telegram
```

### 自动 PR 代码审查

PR 打开时自动审查。直接在 PR 上发布审查评论。

**触发：** GitHub webhook

**选项 A — 动态订阅（CLI）：**

```bash
hermes webhook subscribe github-pr-review \
  --events "pull_request" \
  --prompt "审查这个拉取请求：
仓库：{repository.full_name}
PR #{pull_request.number}: {pull_request.title}
作者：{pull_request.user.login}
操作：{action}
Diff URL：{pull_request.diff_url}

用以下获取 diff：curl -sL {pull_request.diff_url}

审查：
- 安全问题（注入、认证绕过、代码中的密钥）
- 性能问题（N+1 查询、无界循环、内存泄漏）
- 代码质量（命名、重复、错误处理）
- 新行为缺少测试

发布简洁的审查。如果 PR 是简单的文档/拼写更改，简要说明。" \
  --skills "github-code-review" \
  --deliver github_comment
```

**选项 B — 静态路由（config.yaml）：**

```yaml
platforms:
  webhook:
    enabled: true
    extra:
      port: 8644
      secret: "your-global-secret"
      routes:
        github-pr-review:
          events: ["pull_request"]
          secret: "github-webhook-secret"
          prompt: |
            审查 PR #{pull_request.number}: {pull_request.title}
            仓库：{repository.full_name}
            作者：{pull_request.user.login}
            Diff URL：{pull_request.diff_url}
            安全、性能和代码质量审查。
          skills: ["github-code-review"]
          deliver: "github_comment"
          deliver_extra:
            repo: "{repository.full_name}"
            pr_number: "{pull_request.number}"
```

然后在 GitHub 中：**Settings → Webhooks → Add webhook** → Payload URL: `http://your-server:8644/webhooks/github-pr-review`, Content type: `application/json`, Secret: `github-webhook-secret`, Events: **Pull requests**。

### 文档漂移检测

每周扫描合并的 PR 查找需要文档更新的 API 更改。

**触发：** 调度（每周）

```bash
hermes cron create "0 9 * * 1" \
  "扫描 NousResearch/hermes-agent 仓库的文档漂移。

1. Run: gh pr list --repo NousResearch/hermes-agent --state merged --json number,title,files,mergedAt --limit 30
2. 过滤过去 7 天合并的 PR
3. 对每个合并的 PR，检查是否修改了：
   - 工具 schema（tools/*.py）— 可能需要 docs/reference/tools-reference.md 更新
   - CLI 命令（hermes_cli/commands.py、hermes_cli/main.py）— 可能需要 docs/reference/cli-commands.md 更新
   - 配置选项（hermes_cli/config.py）— 可能需要 docs/user-guide/configuration.md 更新
   - 环境变量 — 可能需要 docs/reference/environment-variables.md 更新
4. 交叉引用：对每个代码更改，检查对应的文档页面是否也在同一 PR 中更新

报告代码更改但文档未更新的任何差距。如果一切同步，回复 [SILENT]。" \
  --name "文档漂移检测" \
  --deliver telegram
```

### 依赖安全审计

每日扫描项目依赖的已知漏洞。

**触发：** 调度（每日）

```bash
hermes cron create "0 6 * * *" \
  "对 hermes-agent 项目运行依赖安全审计。

1. cd ~/.hermes/hermes-agent && source .venv/bin/activate
2. Run: pip audit --format json 2>/dev/null || pip audit 2>&1
3. Run: npm audit --json 2>/dev/null（如果存在 website/ 目录）
4. 检查任何 CVSS 分数 >= 7.0 的 CVE

如果发现漏洞：
- 列出每个漏洞的包名、版本、CVE ID、严重性
- 检查是否有可用的升级
- 注意是直接依赖还是传递依赖

如果没有漏洞，回复 [SILENT]。" \
  --name "依赖审计" \
  --deliver telegram
```

---

## DevOps 和监控

### 部署验证

每次部署后触发冒烟测试。你的 CI/CD 管道在部署完成时 POST 到 webhook。

**触发：** API 调用（webhook）

```bash
hermes webhook subscribe deploy-verify \
  --events "deployment" \
  --prompt "部署刚完成：
服务：{service}
环境：{environment}
版本：{version}
部署者：{deployer}

运行这些验证步骤：
1. 检查服务是否响应：curl -s -o /dev/null -w '%{http_code}' {health_url}
2. 搜索最近日志中的错误：检查部署载荷中的任何错误指示器
3. 验证版本匹配：curl -s {health_url}/version

报告：部署状态（healthy/degraded/failed）、响应时间、发现的任何错误。
如果健康，保持简要。如果降级或失败，提供详细诊断。" \
  --deliver telegram
```

你的 CI/CD 管道触发它：

```bash
curl -X POST http://your-server:8644/webhooks/deploy-verify \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"service":"api","environment":"prod","version":"2.1.0","deployer":"ci","health_url":"https://api.example.com/health"}' | openssl dgst -sha256 -hmac 'your-secret' | cut -d' ' -f2)" \
  -d '{"service":"api","environment":"prod","version":"2.1.0","deployer":"ci","health_url":"https://api.example.com/health"}'
```

### 告警分类

将监控告警与最近的更改关联以起草响应。适用于 Datadog、PagerDuty、Grafana 或任何可以 POST JSON 的告警系统。

**触发：** API 调用（webhook）

```bash
hermes webhook subscribe alert-triage \
  --prompt "收到监控告警：
告警：{alert.name}
严重性：{alert.severity}
服务：{alert.service}
消息：{alert.message}
时间戳：{alert.timestamp}

调查：
1. 在网上搜索此错误模式的已知问题
2. 检查是否与任何最近的部署或配置更改相关
3. 起草分类摘要：
   - 可能的根本原因
   - 建议的首次响应步骤
   - 升级建议（P1-P4）

简洁。这发送到值班频道。" \
  --deliver slack
```

### 正常运行时间监控

每 30 分钟检查端点。只在宕机时通知。

**触发：** 调度（每 30 分钟）

```python title="~/.hermes/scripts/check-uptime.py"
import urllib.request, json, time

ENDPOINTS = [
    {"name": "API", "url": "https://api.example.com/health"},
    {"name": "Web", "url": "https://www.example.com"},
    {"name": "Docs", "url": "https://docs.example.com"},
]

results = []
for ep in ENDPOINTS:
    try:
        start = time.time()
        req = urllib.request.Request(ep["url"], headers={"User-Agent": "Hermes-Monitor/1.0"})
        resp = urllib.request.urlopen(req, timeout=10)
        elapsed = round((time.time() - start) * 1000)
        results.append({"name": ep["name"], "status": resp.getcode(), "ms": elapsed})
    except Exception as e:
        results.append({"name": ep["name"], "status": "DOWN", "error": str(e)})

down = [r for r in results if r.get("status") == "DOWN" or (isinstance(r.get("status"), int) and r["status"] >= 500)]
if down:
    print("OUTAGE DETECTED")
    for r in down:
        print(f"  {r['name']}: {r.get('error', f'HTTP {r[\"status\"]}')} ")
    print(f"\nAll results: {json.dumps(results, indent=2)}")
else:
    print("NO_ISSUES")
```

```bash
hermes cron create "every 30m" \
  "如果脚本报告 OUTAGE DETECTED，总结哪些服务宕机并建议可能的原因。如果 NO_ISSUES，回复 [SILENT]。" \
  --script ~/.hermes/scripts/check-uptime.py \
  --name "正常运行时间监控" \
  --deliver telegram
```

---

## 研究和情报

### 竞争对手仓库侦察

监控竞争对手仓库的有趣 PR、功能和架构决策。

**触发：** 调度（每日）

```bash
hermes cron create "0 8 * * *" \
  "侦察这些 AI 代理仓库过去 24 小时的显著活动：

要检查的仓库：
- anthropics/claude-code
- openai/codex
- All-Hands-AI/OpenHands
- Aider-AI/aider

对每个仓库：
1. gh pr list --repo <repo> --state all --json number,title,author,createdAt,mergedAt --limit 15
2. gh issue list --repo <repo> --state open --json number,title,labels,createdAt --limit 10

关注：
- 正在开发的新功能
- 架构更改
- 我们可以学习的集成模式
- 可能也影响我们的安全修复

跳过常规依赖更新和 CI 修复。如果没有值得注意的，回复 [SILENT]。
如果有发现，按仓库组织，简要分析每个项目。" \
  --skills "competitive-pr-scout" \
  --name "竞争对手侦察" \
  --deliver telegram
```

### AI 新闻文摘

每周 AI/ML 发展汇总。

**触发：** 调度（每周）

```bash
hermes cron create "0 9 * * 1" \
  "生成过去 7 天的每周 AI 新闻文摘：

1. 在网上搜索主要的 AI 公告、模型发布和研究突破
2. 搜索 GitHub 上热门的 ML 仓库
3. 在 arXiv 上查看语言模型和代理的高引用论文

结构：
## 头条（3-5 条重大故事）
## Notable Papers（2-3 篇论文带一句话摘要）
## 开源（有趣的新仓库或重大发布）
## 行业动态（融资、收购、发布）

每项保持 1-2 句。包含链接。总计 600 字以内。" \
  --name "每周 AI 文摘" \
  --deliver telegram
```

### 带笔记的论文文摘

每日 arXiv 扫描，将摘要保存到你的笔记系统。

**触发：** 调度（每日）

```bash
hermes cron create "0 8 * * *" \
  "搜索 arXiv 上关于 'language model reasoning' 或 'tool-use agents' 过去一天最有趣的 3 篇论文。对每篇论文，创建一个 Obsidian 笔记，包含标题、作者、摘要总结、关键贡献以及与 Hermes Agent 开发的潜在相关性。" \
  --skills "arxiv,obsidian" \
  --name "论文文摘" \
  --deliver local
```

---

## GitHub 事件自动化

### Issue 自动标记

自动标记和回复新 issue。

**触发：** GitHub webhook

```bash
hermes webhook subscribe github-issues \
  --events "issues" \
  --prompt "收到新 GitHub issue：
仓库：{repository.full_name}
Issue #{issue.number}: {issue.title}
作者：{issue.user.login}
操作：{action}
正文：{issue.body}
标签：{issue.labels}

如果是新 issue（action=opened）：
1. 仔细阅读 issue 标题和正文
2. 建议适当的标签（bug、feature、docs、security、question）
3. 如果是 bug 报告，检查是否可以从描述中识别受影响的组件
4. 发布有帮助的初始回复确认 issue

如果是标签或分配更改，回复 [SILENT]。" \
  --deliver github_comment
```

### CI 失败分析

分析 CI 失败并在 PR 上发布诊断。

**触发：** GitHub webhook

```yaml
# config.yaml 路由
platforms:
  webhook:
    enabled: true
    extra:
      routes:
        ci-failure:
          events: ["check_run"]
          secret: "ci-secret"
          prompt: |
            CI 检查失败：
            仓库：{repository.full_name}
            检查：{check_run.name}
            状态：{check_run.conclusion}
            PR：#{check_run.pull_requests.0.number}
            详情 URL：{check_run.details_url}

            如果 conclusion 是 "failure"：
            1. 如果可访问，从详情 URL 获取日志
            2. 识别可能的失败原因
            3. 建议修复
            如果 conclusion 是 "success"，回复 [SILENT]。
          deliver: "github_comment"
          deliver_extra:
            repo: "{repository.full_name}"
            pr_number: "{check_run.pull_requests.0.number}"
```

### 跨仓库自动移植更改

当一个仓库的 PR 合并时，自动将等效更改移植到另一个。

**触发：** GitHub webhook

```bash
hermes webhook subscribe auto-port \
  --events "pull_request" \
  --prompt "源仓库中 PR 已合并：
仓库：{repository.full_name}
PR #{pull_request.number}: {pull_request.title}
作者：{pull_request.user.login}
操作：{action}
合并提交：{pull_request.merge_commit_sha}

如果 action 是 'closed' 且 pull_request.merged 是 true：
1. 获取 diff：curl -sL {pull_request.diff_url}
2. 分析更改了什么
3. 确定此更改是否需要移植到 Go SDK 等效版本
4. 如果是，创建分支，应用等效更改，并在目标仓库上打开 PR
5. 在新 PR 描述中引用原始 PR

如果 action 不是 'closed' 或未合并，回复 [SILENT]。" \
  --skills "github-pr-workflow" \
  --deliver log
```

---

## 业务运营

### Stripe 支付监控

跟踪支付事件并获得失败摘要。

**触发：** API 调用（webhook）

```bash
hermes webhook subscribe stripe-payments \
  --events "payment_intent.succeeded,payment_intent.payment_failed,charge.dispute.created" \
  --prompt "收到 Stripe 事件：
事件类型：{type}
金额：{data.object.amount} 分（{data.object.currency}）
客户：{data.object.customer}
状态：{data.object.status}

对 payment_intent.payment_failed：
- 从 {data.object.last_payment_error} 识别失败原因
- 建议这是临时问题（重试）还是永久的（联系客户）

对 charge.dispute.created：
- 标记为紧急
- 总结争议详情

对 payment_intent.succeeded：
- 仅简要确认

对运维频道保持回复简洁。" \
  --deliver slack
```

### 每日收入摘要

每天早上编译关键业务指标。

**触发：** 调度（每日）

```bash
hermes cron create "0 8 * * *" \
  "生成早间业务指标摘要。

在网上搜索：
1. 当前比特币和以太坊价格
2. S&P 500 状态（盘前或前收盘）
3. 过去 12 小时的任何主要科技/AI 行业新闻

格式化为简要的早间简报，最多 3-4 个要点。
投递为干净、可扫描的消息。" \
  --name "早间简报" \
  --deliver telegram
```

---

## 多技能工作流

### 安全审计管道

组合多个技能进行全面的每周安全审查。

**触发：** 调度（每周）

```bash
hermes cron create "0 3 * * 0" \
  "对 hermes-agent 代码库运行全面安全审计。

1. 检查依赖漏洞（pip audit、npm audit）
2. 搜索代码库中的常见安全反模式：
   - 硬编码的密钥或 API 密钥
   - SQL 注入向量（查询中的字符串格式化）
   - 路径遍历风险（用户输入在文件路径中没有验证）
   - 不安全的反序列化（pickle.loads、没有 SafeLoader 的 yaml.load）
3. 审查最近的提交（过去 7 天）的安全相关更改
4. 检查是否有任何新环境变量添加但未记录

编写安全报告，按严重性分类发现（Critical、High、Medium、Low）。
如果没有发现，报告健康状况良好。" \
  --skills "codebase-security-audit" \
  --name "每周安全审计" \
  --deliver telegram
```

### 内容管道

研究、起草和准备内容的调度。

**触发：** 调度（每周）

```bash
hermes cron create "0 10 * * 3" \
  "研究并起草关于 AI 代理中热门话题的技术博客文章大纲。

1. 在网上搜索本周讨论最多的 AI 代理话题
2. 挑选与开源 AI 代理最相关的最有趣的一个
3. 创建大纲：
   - 引子/介绍角度
   - 3-4 个关键部分
   - 适合开发者的技术深度
   - 带可操作要点的结论
4. 将大纲保存到 ~/drafts/blog-$(date +%Y%m%d).md

大纲保持在约 300 字。这是起点，不是完成的文章。" \
  --name "博客大纲" \
  --deliver local
```

---

## 快速参考

### Cron 调度语法

| 表达式 | 含义 |
|-----------|---------|
| `every 30m` | 每 30 分钟 |
| `every 2h` | 每 2 小时 |
| `0 2 * * *` | 每天凌晨 2:00 |
| `0 9 * * 1` | 每周一上午 9:00 |
| `0 9 * * 1-5` | 工作日上午 9:00 |
| `0 3 * * 0` | 每周日凌晨 3:00 |
| `0 */6 * * *` | 每 6 小时 |

### 投递目标

| 目标 | 标志 | 备注 |
|--------|------|-------|
| 同一聊天 | `--deliver origin` | 默认 — 投递到创建作业的地方 |
| 本地文件 | `--deliver local` | 保存输出，无通知 |
| Telegram | `--deliver telegram` | 主频道，或 `telegram:CHAT_ID` 指定特定 |
| Discord | `--deliver discord` | 主频道，或 `discord:CHANNEL_ID` |
| Slack | `--deliver slack` | 主频道 |
| SMS | `--deliver sms:+15551234567` | 直接到电话号码 |
| 特定线程 | `--deliver telegram:-100123:456` | Telegram 论坛话题 |

### Webhook 模板变量

| 变量 | 描述 |
|----------|-------------|
| `{pull_request.title}` | PR 标题 |
| `{issue.number}` | Issue 编号 |
| `{repository.full_name}` | `owner/repo` |
| `{action}` | 事件操作（opened、closed 等） |
| `{__raw__}` | 完整 JSON 载荷（截断到 4000 字符） |
| `{sender.login}` | 触发事件的 GitHub 用户 |

### [SILENT] 模式

当 cron 作业的响应包含 `[SILENT]` 时，投递被抑制。用这个避免安静运行时的通知垃圾：

```
如果没有值得注意的事情发生，回复 [SILENT]。
```

这意味着你只在代理有事情要报告时才收到通知。
