---
sidebar_position: 11
title: "使用 Cron 自动化任何事情"
description: "使用 Hermes cron 的真实自动化模式 — 监控、报告、管道和多技能工作流"
---

# 使用 Cron 自动化任何事情

[每日简报机器人教程](/docs/guides/daily-briefing-bot)涵盖了基础知识。本指南更进一步 — 五个你可以改编用于自己工作流的真实自动化模式。

有关完整功能参考，请参见[定时任务（Cron）](/docs/user-guide/features/cron)。

:::info 关键概念
Cron 作业在全新的代理会话中运行，没有你当前聊天的记忆。提示必须**完全自包含** — 包含代理需要知道的一切。
:::

---

## 模式 1：网站变更监控

监视 URL 的变化，只在有不同时获得通知。

`script` 参数是这里的秘密武器。Python 脚本在每次执行前运行，其 stdout 成为代理的上下文。脚本处理机械工作（获取、差异比较）；代理处理推理（这个变化有趣吗？）。

创建监控脚本：

```bash
mkdir -p ~/.hermes/scripts
```

```python title="~/.hermes/scripts/watch-site.py"
import hashlib, json, os, urllib.request

URL = "https://example.com/pricing"
STATE_FILE = os.path.expanduser("~/.hermes/scripts/.watch-site-state.json")

# 获取当前内容
req = urllib.request.Request(URL, headers={"User-Agent": "Hermes-Monitor/1.0"})
content = urllib.request.urlopen(req, timeout=30).read().decode()
current_hash = hashlib.sha256(content.encode()).hexdigest()

# 加载之前的状态
prev_hash = None
if os.path.exists(STATE_FILE):
    with open(STATE_FILE) as f:
        prev_hash = json.load(f).get("hash")

# 保存当前状态
with open(STATE_FILE, "w") as f:
    json.dump({"hash": current_hash, "url": URL}, f)

# 输出给代理
if prev_hash and prev_hash != current_hash:
    print(f"CHANGE DETECTED on {URL}")
    print(f"Previous hash: {prev_hash}")
    print(f"Current hash: {current_hash}")
    print(f"\nCurrent content (first 2000 chars):\n{content[:2000]}")
else:
    print("NO_CHANGE")
```

设置 cron 作业：

```bash
/cron add "every 1h" "如果脚本输出说 CHANGE DETECTED，总结页面上发生了什么变化以及为什么重要。如果它说 NO_CHANGE，只回复 [SILENT]。" --script ~/.hermes/scripts/watch-site.py --name "价格监控" --deliver telegram
```

:::tip [SILENT] 技巧
当代理的最终响应包含 `[SILENT]` 时，投递会被抑制。这意味着你只在实际发生事情时才收到通知 — 安静时段没有垃圾信息。
:::

---

## 模式 2：周报

从多个来源编译信息到格式化的摘要中。每周运行一次并投递到你的主频道。

```bash
/cron add "0 9 * * 1" "生成一份周报，涵盖：

1. 搜索过去一周的前 5 条 AI 新闻
2. 在 GitHub 上搜索 'machine-learning' 主题的热门仓库
3. 在 Hacker News 上查看讨论最多的 AI/ML 帖子

格式化为带有各来源部分的干净摘要。包含链接。
保持在 500 字以内 — 只突出重要内容。" --name "每周 AI 文摘" --deliver telegram
```

从 CLI：

```bash
hermes cron create "0 9 * * 1" \
  "生成一份涵盖顶级 AI 新闻、热门 ML GitHub 仓库和讨论最多 HN 帖子的周报。带部分格式化，包含链接，保持在 500 字以内。" \
  --name "每周 AI 文摘" \
  --deliver telegram
```

`0 9 * * 1` 是标准 cron 表达式：每周一上午 9:00。

---

## 模式 3：GitHub 仓库监视器

监控仓库的新 issue、PR 或发布。

```bash
/cron add "every 6h" "检查 GitHub 仓库 NousResearch/hermes-agent：
- 过去 6 小时内新开的 issue
- 过去 6 小时内新开或合并的 PR
- 任何新发布

使用终端运行 gh 命令：
  gh issue list --repo NousResearch/hermes-agent --state open --json number,title,author,createdAt --limit 10
  gh pr list --repo NousResearch/hermes-agent --state all --json number,title,author,createdAt,mergedAt --limit 10

过滤只保留过去 6 小时内的项目。如果没有新内容，回复 [SILENT]。
否则，提供活动的简要摘要。" --name "仓库监视器" --deliver discord
```

:::warning 自包含提示
注意提示包含了确切的 `gh` 命令。Cron 代理没有之前运行或你偏好的记忆 — 把所有东西都写清楚。
:::

---

## 模式 4：数据收集管道

定期抓取数据，保存到文件，并检测趋势。此模式将脚本（用于收集）与代理（用于分析）结合。

```python title="~/.hermes/scripts/collect-prices.py"
import json, os, urllib.request
from datetime import datetime

DATA_DIR = os.path.expanduser("~/.hermes/data/prices")
os.makedirs(DATA_DIR, exist_ok=True)

# 获取当前数据（示例：加密货币价格）
url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
data = json.loads(urllib.request.urlopen(url, timeout=30).read())

# 追加到历史文件
entry = {"timestamp": datetime.now().isoformat(), "prices": data}
history_file = os.path.join(DATA_DIR, "history.jsonl")
with open(history_file, "a") as f:
    f.write(json.dumps(entry) + "\n")

# 加载最近的历史用于分析
lines = open(history_file).readlines()
recent = [json.loads(l) for l in lines[-24:]]  # 最近 24 个数据点

# 输出给代理
print(f"Current: BTC=${data['bitcoin']['usd']}, ETH=${data['ethereum']['usd']}")
print(f"Data points collected: {len(lines)} total, showing last {len(recent)}")
print(f"\nRecent history:")
for r in recent[-6:]:
    print(f"  {r['timestamp']}: BTC=${r['prices']['bitcoin']['usd']}, ETH=${r['prices']['ethereum']['usd']}")
```

```bash
/cron add "every 1h" "分析脚本输出中的价格数据。报告：
1. 当前价格
2. 最近 6 个数据点的趋势方向（上涨/下跌/持平）
3. 任何显著的变动（>5% 变化）

如果价格持平且没有值得注意的，回复 [SILENT]。
如果有显著变动，解释发生了什么。" \
  --script ~/.hermes/scripts/collect-prices.py \
  --name "价格追踪器" \
  --deliver telegram
```

脚本做机械收集；代理添加推理层。

---

## 模式 5：多技能工作流

将技能链接在一起用于复杂的定时任务。技能在提示执行前按顺序加载。

```bash
# 使用 arxiv 技能查找论文，然后使用 obsidian 技能保存笔记
/cron add "0 8 * * *" "搜索 arXiv 上关于 'language model reasoning' 过去一天最有趣的 3 篇论文。为每篇论文创建一个 Obsidian 笔记，包含标题、作者、摘要总结和关键贡献。" \
  --skill arxiv \
  --skill obsidian \
  --name "论文文摘"
```

直接从工具：

```python
cronjob(
    action="create",
    skills=["arxiv", "obsidian"],
    prompt="搜索 arXiv 上关于 'language model reasoning' 过去一天的论文。将前 3 篇保存为 Obsidian 笔记。",
    schedule="0 8 * * *",
    name="论文文摘",
    deliver="local"
)
```

技能按顺序加载 — 先 `arxiv`（教代理如何搜索论文），然后 `obsidian`（教如何写笔记）。提示将它们连接在一起。

---

## 管理你的作业

```bash
# 列出所有活动作业
/cron list

# 立即触发作业（用于测试）
/cron run <job_id>

# 暂停作业而不删除
/cron pause <job_id>

# 编辑运行中作业的调度或提示
/cron edit <job_id> --schedule "every 4h"
/cron edit <job_id> --prompt "更新的任务描述"

# 为现有作业添加或移除技能
/cron edit <job_id> --skill arxiv --skill obsidian
/cron edit <job_id> --clear-skills

# 永久移除作业
/cron remove <job_id>
```

---

## 投递目标

`--deliver` 标志控制结果发送到哪里：

| 目标 | 示例 | 用例 |
|--------|---------|----------|
| `origin` | `--deliver origin` | 创建作业的同一聊天（默认） |
| `local` | `--deliver local` | 仅保存到本地文件 |
| `telegram` | `--deliver telegram` | 你的 Telegram 主频道 |
| `discord` | `--deliver discord` | 你的 Discord 主频道 |
| `slack` | `--deliver slack` | 你的 Slack 主频道 |
| 特定聊天 | `--deliver telegram:-1001234567890` | 特定 Telegram 群组 |
| 线程化 | `--deliver telegram:-1001234567890:17585` | 特定 Telegram 话题线程 |

---

## 提示

**使提示自包含。** Cron 作业中的代理没有你对话的记忆。直接在提示中包含 URL、仓库名称、格式偏好和投递指令。

**大量使用 `[SILENT]`。** 对于监控作业，始终包含类似 "如果没有变化，回复 `[SILENT]`" 的指令。这可以防止通知噪音。

**使用脚本进行数据收集。** `script` 参数让 Python 脚本处理无聊的部分（HTTP 请求、文件 I/O、状态跟踪）。代理只看到脚本的 stdout 并对其应用推理。这比让代理自己获取更便宜更可靠。

**用 `/cron run` 测试。** 在等待调度触发之前，使用 `/cron run <job_id>` 立即执行并验证输出是否正确。

**调度表达式。** 支持的格式：相对延迟（`30m`）、间隔（`every 2h`）、标准 cron 表达式（`0 9 * * *`）和 ISO 时间戳（`2025-06-15T09:00:00`）。不支持自然语言如 `daily at 9am` — 改用 `0 9 * * *`。

---

*有关完整的 cron 参考 — 所有参数、边缘情况和内部机制 — 请参见[定时任务（Cron）](/docs/user-guide/features/cron)。*
