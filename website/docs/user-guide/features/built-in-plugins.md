---
sidebar_position: 12
sidebar_label: "内置插件"
title: "内置插件"
description: "Hermes Agent 附带的插件，通过生命周期钩子自动运行——disk-cleanup 等"
---

# 内置插件

Hermes 附带一小组随仓库捆绑的插件。它们位于 `<repo>/plugins/<name>/` 下，与用户安装在 `~/.hermes/plugins/` 中的插件一起自动加载。它们使用与第三方插件相同的插件接口——钩子、工具、斜杠命令——只是在树内维护。

有关通用插件系统，请参见[插件](/docs/user-guide/features/plugins)页面，有关编写自己的插件，请参见[构建 Hermes 插件](/docs/guides/build-a-hermes-plugin)。

## 发现工作原理

`PluginManager` 按顺序扫描四个来源：

1. **捆绑** —— `<repo>/plugins/<name>/`（本页文档记录的内容）
2. **用户** —— `~/.hermes/plugins/<name>/`
3. **项目** —— `./.hermes/plugins/<name>/`（需要 `HERMES_ENABLE_PROJECT_PLUGINS=1`）
4. **Pip 入口点** —— `hermes_agent.plugins`

名称冲突时，后面的来源获胜——名为 `disk-cleanup` 的用户插件会替换捆绑的。

`plugins/memory/` 和 `plugins/context_engine/` 被故意排除在捆绑扫描之外。这些目录使用自己的发现路径，因为内存提供商和上下文引擎是通过 `hermes memory setup` / `context.engine` 在配置中配置的单选提供商。

## 捆绑插件需要选择启用

捆绑插件默认禁用。发现会找到它们（它们出现在 `hermes plugins list` 和交互式 `hermes plugins` UI 中），但在你明确启用之前不会加载：

```bash
hermes plugins enable disk-cleanup
```

或通过 `~/.hermes/config.yaml`：

```yaml
plugins:
  enabled:
    - disk-cleanup
```

这与用户安装插件使用的机制相同。捆绑插件永远不会自动启用——不是在全新安装时，也不是在现有用户升级到更新的 Hermes 时。你总是明确选择启用。

要再次关闭捆绑插件：

```bash
hermes plugins disable disk-cleanup
# 或：从 config.yaml 的 plugins.enabled 中移除它
```

## 当前附带的插件

### disk-cleanup

自动跟踪和移除会话期间创建的临时文件——测试脚本、临时输出、定时日志、过期的 chrome 配置文件——无需代理记住调用工具。

**工作原理：**

| 钩子 | 行为 |
|------|------|
| `post_tool_call` | 当 `write_file` / `terminal` / `patch` 在 `HERMES_HOME` 或 `/tmp/hermes-*` 内创建匹配 `test_*`、`tmp_*` 或 `*.test.*` 的文件时，静默跟踪为 `test` / `temp` / `cron-output`。 |
| `on_session_end` | 如果轮次期间自动跟踪了任何测试文件，运行安全的 `quick` 清理并记录单行摘要。否则保持静默。 |

**删除规则：**

| 类别 | 阈值 | 确认 |
|------|------|------|
| `test` | 每次会话结束 | 从不 |
| `temp` | 跟踪后 >7 天 | 从不 |
| `cron-output` | 跟踪后 >14 天 | 从不 |
| HERMES_HOME 下的空目录 | 始终 | 从不 |
| `research` | >30 天，超出最新 10 个 | 始终（仅深度） |
| `chrome-profile` | 跟踪后 >14 天 | 始终（仅深度） |
| >500 MB 的文件 | 永不自动 | 始终（仅深度） |

**斜杠命令** —— `/disk-cleanup` 在 CLI 和网关会话中均可用：

```
/disk-cleanup status                     # 分类 + 前 10 个最大文件
/disk-cleanup dry-run                    # 预览但不删除
/disk-cleanup quick                      # 立即运行安全清理
/disk-cleanup deep                       # quick + 列出需要确认的项目
/disk-cleanup track <path> <category>    # 手动跟踪
/disk-cleanup forget <path>              # 停止跟踪（不删除）
```

**状态** —— 所有内容位于 `$HERMES_HOME/disk-cleanup/`：

| 文件 | 内容 |
|------|------|
| `tracked.json` | 带类别、大小和时间戳的跟踪路径 |
| `tracked.json.bak` | 上述内容的原子写入备份 |
| `cleanup.log` | 每次跟踪/跳过/拒绝/删除的仅追加审计跟踪 |

**安全** —— 清理仅触及 `HERMES_HOME` 或 `/tmp/hermes-*` 下的路径。Windows 挂载（`/mnt/c/...`）被拒绝。知名顶层状态目录（`logs/`、`memories/`、`sessions/`、`cron/`、`cache/`、`skills/`、`plugins/`、`disk-cleanup/` 本身）即使为空也永不移除——全新安装不会在首次会话结束时被清空。

**启用：** `hermes plugins enable disk-cleanup`（或在 `hermes plugins` 中勾选）。

**再次禁用：** `hermes plugins disable disk-cleanup`。

## 添加捆绑插件

捆绑插件的编写方式与任何其他 Hermes 插件完全相同——参见[构建 Hermes 插件](/docs/guides/build-a-hermes-plugin)。唯一的区别是：

- 目录位于 `<repo>/plugins/<name>/` 而不是 `~/.hermes/plugins/<name>/`
- 清单来源在 `hermes plugins list` 中报告为 `bundled`
- 同名用户插件覆盖捆绑版本

当满足以下条件时，插件适合捆绑：

- 它没有可选依赖（或者它们已经是 `pip install .[all]` 的依赖）
- 行为使大多数用户受益，且是选择退出而非选择加入
- 逻辑绑定到生命周期钩子，否则代理需要记住调用
- 它补充核心能力而不扩展模型可见的工具表面

反例——应保持为用户可安装插件而非捆绑的内容：需要 API 密钥的第三方集成、小众工作流、大型依赖树、任何会默认显著改变代理行为的内容。
