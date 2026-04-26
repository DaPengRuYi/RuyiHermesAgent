# HermesAgent 文档全面中文化：95 个文件翻译实践

> **摘要**：在完成 HermesAgent 项目 fork 和架构分析后，我们对整个项目的文档进行了全面中文化——从根目录 README 到 90+ 个网站文档，共 95 个文件。本文记录这次大规模翻译的过程、方法和经验。

---

## 一、背景

HermesAgent 是 Nous Research 开发的自改进 AI Agent 框架，我们 fork 后进行二次开发。项目的文档体系非常庞大：

- 根目录有 README.md、AGENTS.md 等核心文档
- `website/docs/` 下有完整的 Docusaurus 文档站（90+ 个 Markdown 文件）
- `environments/`、`gateway/`、`.plans/` 等目录各有技术文档

这些文档全部是英文，且包含大量 NousResearch 的品牌链接和 Discord 社区引用。作为二次开发项目，我们需要：

1. 将所有文档翻译为中文
2. 去除上游的品牌链接和"广告"性质的内容
3. 替换为大鹏 AI 教育团队的信息

---

## 二、翻译范围

### 2.1 文档分类

我们将文档分为四类：

| 类别 | 文件数 | 处理方式 |
|------|--------|---------|
| 根目录文档 | 3 | 手动重写/翻译 |
| 技术文档 | 5 | 手动翻译 |
| optional-skills 描述 | 1 | 手动翻译 |
| website/docs/ 文档站 | 86 | 并行 Agent 翻译 |

### 2.2 根目录文档

| 文件 | 内容 | 处理 |
|------|------|------|
| `README.md` | 项目主文档 | 完全重写（去品牌+中文化） |
| `AGENTS.md` | 开发指南（765 行） | 全文翻译 |
| `docker/SOUL.md` | Agent 人格模板 | 翻译 |

### 2.3 技术文档

| 文件 | 内容 |
|------|------|
| `environments/README.md` | RL 训练环境文档（325 行） |
| `gateway/platforms/ADDING_A_PLATFORM.md` | 平台适配器开发指南 |
| `.plans/openai-api-server.md` | OpenAI API 服务器设计 |
| `.plans/streaming-support.md` | 流式支持设计（700 行） |
| `optional-skills/DESCRIPTION.md` | 可选技能说明 |

### 2.4 网站文档（86 个文件）

```
website/docs/
├── index.md                          # 首页
├── getting-started/                  # 6 个文件
│   ├── installation.md
│   ├── quickstart.md
│   ├── learning-path.md
│   ├── nix-setup.md
│   ├── termux.md
│   └── updating.md
├── user-guide/                       # 12 个文件
│   ├── cli.md
│   ├── configuration.md
│   ├── security.md
│   ├── docker.md
│   └── ...
├── user-guide/features/              # 28 个文件
│   ├── tools.md
│   ├── skills.md
│   ├── memory.md
│   ├── mcp.md
│   └── ...
├── developer-guide/                  # 21 个文件
│   ├── architecture.md
│   ├── contributing.md
│   ├── agent-loop.md
│   └── ...
├── guides/                           # 17 个文件
├── reference/                        # 11 个文件
└── integrations/                     # 2 个文件
```

---

## 三、翻译方法

### 3.1 策略选择

对于 95 个文件的大规模翻译，我们采用了**分层处理策略**：

- **根目录和技术文档**（9 个文件）：手动翻译，确保质量和品牌替换
- **网站文档**（86 个文件）：使用 4 个并行 Agent 翻译，提高效率

### 3.2 翻译规则

所有翻译遵循统一规则：

1. **英文文本** → 翻译为中文
2. **代码块、文件路径、命令名** → 保持英文
3. **Markdown 格式** → 保持不变
4. **NousResearch 链接** → 移除或替换
5. **SKILL.md 文件** → 保持英文（Agent 指令，英文效果更好）

### 3.3 品牌替换

| 原文 | 替换为 |
|------|--------|
| `NousResearch/hermes-agent` | `DaPengRuYi/HermesAgent` |
| `hermes-agent.nousresearch.com` | 移除或替换为项目内路径 |
| `discord.gg/NousResearch` | 移除 |
| `Built by Nous Research` | 原创开发：Nous Research / 二次开发：大鹏 AI 教育 |
| GitHub badges | 更新为 fork 仓库的链接 |

---

## 四、执行过程

### 4.1 根目录文档（手动）

**README.md** 是改动最大的文件。原文包含：
- NousResearch 的 GitHub badges（Docs、Discord、License、Built by）
- 大量指向 `hermes-agent.nousresearch.com` 的文档链接
- Discord 社区邀请链接
- Nous Portal 推广链接

重写后：
- badges 更新为 fork 仓库链接
- 文档链接改为项目内相对路径
- 社区/推广链接全部移除
- 底部注明"原创开发：Nous Research / 二次开发：大鹏 AI 教育团队"

**AGENTS.md**（765 行）是开发指南，包含详细的架构说明、工具添加流程、测试规范等。全文翻译为中文，保留代码示例和技术术语。

### 4.2 技术文档（手动）

5 个技术文档逐一手动翻译。其中 `.plans/streaming-support.md` 最长（700 行），包含详细的流式架构设计和实施计划。

### 4.3 网站文档（并行 Agent）

86 个网站文档使用 4 个并行 Agent 处理：

| Agent | 负责目录 | 文件数 |
|-------|---------|--------|
| Agent 1 | `getting-started/` | 6 |
| Agent 2 | `user-guide/` + `features/` | 40+ |
| Agent 3 | `developer-guide/` | 21 |
| Agent 4 | `guides/` + `reference/` + `integrations/` | 30+ |

每个 Agent 的工作流程：
1. 读取文件
2. 翻译英文文本为中文
3. 保留代码块和技术术语
4. 移除 NousResearch 品牌链接
5. 写回文件

### 4.4 跳过的文件

以下文件保持英文不翻译：

- `skills/` 目录下的所有 `SKILL.md`——这是给 Agent 读的指令，LLM 对英文指令的理解更好
- `optional-skills/` 目录下的 `SKILL.md`——同上
- `website/` 目录下的非文档文件（JS/TSX 组件等）

---

## 五、成果统计

### 5.1 Git 提交

```
提交 d3d64243：全面翻译文档为中文并去除 NousResearch 品牌
95 files changed, 13,209 insertions(+), 13,603 deletions(-)
```

### 5.2 工作量

| 类别 | 文件数 | 行数变化 |
|------|--------|---------|
| 根目录文档 | 3 | ~1,000 行 |
| 技术文档 | 5 | ~2,000 行 |
| getting-started | 6 | ~1,400 行 |
| user-guide + features | 40+ | ~5,000 行 |
| developer-guide | 21 | ~3,500 行 |
| guides + reference | 30+ | ~5,000 行 |
| **合计** | **95** | **~13,200 行** |

### 5.3 耗时

- 根目录和技术文档手动翻译：约 30 分钟
- 网站文档并行 Agent 翻译：约 15 分钟
- 总计：约 45 分钟完成 95 个文件的翻译

---

## 六、经验总结

### 6.1 大规模翻译的最佳实践

1. **分层处理**：重要文件手动翻译确保质量，批量文件用 Agent 并行处理
2. **统一规则**：提前确定翻译规则（什么翻译、什么保留、什么移除），避免不一致
3. **品牌替换清单**：列出所有需要替换的品牌元素，确保不遗漏
4. **SKILL.md 保持英文**：给 LLM 的指令保持英文效果更好，不要盲目翻译一切

### 6.2 Agent 并行翻译的技巧

1. **按目录分片**：每个 Agent 负责一个目录，避免文件冲突
2. **明确规则**：在 Agent prompt 中详细说明翻译规则
3. **后台运行**：使用 `run_in_background` 并行执行，不阻塞主流程
4. **检查结果**：Agent 完成后用 `git diff --stat` 验证覆盖范围

### 6.3 注意事项

1. **CRLF 警告**：Windows 环境下 Git 会报 LF/CRLF 转换警告，不影响功能
2. **代码块保护**：翻译时必须确保代码块内容不被误翻译
3. **链接有效性**：移除外部链接后，确保内部链接仍然有效
4. **上下文连贯性**：长文档翻译时注意前后术语一致性

---

## 七、后续计划

文档翻译完成后，下一步的二次开发方向：

1. **国内模型深度适配**——优化小米 MiMo、智谱 GLM、月之暗面 Kimi 等模型的 function calling 兼容性
2. **飞书/钉钉深度集成**——利用已有的 197KB 飞书适配器，深化教育场景功能
3. **课程知识管理系统**——开发 `skills/education/` 技能模块
4. **作业系统**——开发 `tools/homework/` 工具集

---

> **作者**：大鹏 AI 教育团队
> **日期**：2026-04-26
> **项目**：[HermesAgent](https://github.com/DaPengRuYi/HermesAgent)
