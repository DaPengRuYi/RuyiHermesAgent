---
sidebar_position: 7
---

# Profile 命令参考

本页涵盖所有与 [Hermes profile](../user-guide/profiles.md) 相关的命令。有关一般 CLI 命令，请参阅 [CLI 命令参考](./cli-commands.md)。

## `hermes profile`

```bash
hermes profile <子命令>
```

管理 profile 的顶级命令。不带子命令运行 `hermes profile` 会显示帮助。

| 子命令 | 描述 |
|------------|-------------|
| `list` | 列出所有 profile。 |
| `use` | 设置活跃（默认）profile。 |
| `create` | 创建新 profile。 |
| `delete` | 删除 profile。 |
| `show` | 显示 profile 的详细信息。 |
| `alias` | 重新生成 profile 的 shell 别名。 |
| `rename` | 重命名 profile。 |
| `export` | 将 profile 导出为 tar.gz 归档。 |
| `import` | 从 tar.gz 归档导入 profile。 |

## `hermes profile list`

```bash
hermes profile list
```

列出所有 profile。当前活跃的 profile 用 `*` 标记。

**示例：**

```bash
$ hermes profile list
  default
* work
  dev
  personal
```

无选项。

## `hermes profile use`

```bash
hermes profile use <名称>
```

将 `<名称>` 设置为活跃 profile。所有后续的 `hermes` 命令（不带 `-p`）将使用此 profile。

| 参数 | 描述 |
|----------|-------------|
| `<名称>` | 要激活的 profile 名称。使用 `default` 返回基础 profile。 |

**示例：**

```bash
hermes profile use work
hermes profile use default
```

## `hermes profile create`

```bash
hermes profile create <名称> [选项]
```

创建新 profile。

| 参数 / 选项 | 描述 |
|-------------------|-------------|
| `<名称>` | 新 profile 的名称。必须是有效的目录名称（字母数字、连字符、下划线）。 |
| `--clone` | 从当前 profile 复制 `config.yaml`、`.env` 和 `SOUL.md`。 |
| `--clone-all` | 从当前 profile 复制所有内容（配置、记忆、技能、会话、状态）。 |
| `--clone-from <profile>` | 从特定 profile 而不是当前 profile 克隆。与 `--clone` 或 `--clone-all` 一起使用。 |
| `--no-alias` | 跳过包装脚本创建。 |

创建 profile **不会**使该 profile 目录成为终端命令的默认项目/工作区目录。如果你想让 profile 在特定项目中启动，请在该 profile 的 `config.yaml` 中设置 `terminal.cwd`。

**示例：**

```bash
# 空白 profile — 需要完整设置
hermes profile create mybot

# 从当前 profile 仅克隆配置
hermes profile create work --clone

# 从当前 profile 克隆所有内容
hermes profile create backup --clone-all

# 从特定 profile 克隆配置
hermes profile create work2 --clone --clone-from work
```

## `hermes profile delete`

```bash
hermes profile delete <名称> [选项]
```

删除 profile 并移除其 shell 别名。

| 参数 / 选项 | 描述 |
|-------------------|-------------|
| `<名称>` | 要删除的 profile。 |
| `--yes`、`-y` | 跳过确认提示。 |

**示例：**

```bash
hermes profile delete mybot
hermes profile delete mybot --yes
```

:::warning
这将永久删除 profile 的整个目录，包括所有配置、记忆、会话和技能。无法删除当前活跃的 profile。
:::

## `hermes profile show`

```bash
hermes profile show <名称>
```

显示 profile 的详细信息，包括其主目录、配置的模型、网关状态、技能数量和配置文件状态。

这显示的是 profile 的 Hermes 主目录，而不是终端工作目录。终端命令从 `terminal.cwd` 启动（或在本地后端上当 `cwd: "."` 时从启动目录启动）。

| 参数 | 描述 |
|----------|-------------|
| `<名称>` | 要检查的 profile。 |

**示例：**

```bash
$ hermes profile show work
Profile: work
Path:    ~/.hermes/profiles/work
Model:   anthropic/claude-sonnet-4 (anthropic)
Gateway: stopped
Skills:  12
.env:    exists
SOUL.md: exists
Alias:   ~/.local/bin/work
```

## `hermes profile alias`

```bash
hermes profile alias <名称> [选项]
```

重新生成 `~/.local/bin/<名称>` 处的 shell 别名脚本。如果别名被意外删除或在移动 Hermes 安装后需要更新时很有用。

| 参数 / 选项 | 描述 |
|-------------------|-------------|
| `<名称>` | 要创建/更新别名的 profile。 |
| `--remove` | 移除包装脚本而不是创建它。 |
| `--name <别名>` | 自定义别名名称（默认：profile 名称）。 |

**示例：**

```bash
hermes profile alias work
# 创建/更新 ~/.local/bin/work

hermes profile alias work --name mywork
# 创建 ~/.local/bin/mywork

hermes profile alias work --remove
# 移除包装脚本
```

## `hermes profile rename`

```bash
hermes profile rename <旧名称> <新名称>
```

重命名 profile。更新目录和 shell 别名。

| 参数 | 描述 |
|----------|-------------|
| `<旧名称>` | 当前 profile 名称。 |
| `<新名称>` | 新的 profile 名称。 |

**示例：**

```bash
hermes profile rename mybot assistant
# ~/.hermes/profiles/mybot → ~/.hermes/profiles/assistant
# ~/.local/bin/mybot → ~/.local/bin/assistant
```

## `hermes profile export`

```bash
hermes profile export <名称> [选项]
```

将 profile 导出为压缩的 tar.gz 归档。

| 参数 / 选项 | 描述 |
|-------------------|-------------|
| `<名称>` | 要导出的 profile。 |
| `-o`、`--output <路径>` | 输出文件路径（默认：`<名称>.tar.gz`）。 |

**示例：**

```bash
hermes profile export work
# 在当前目录创建 work.tar.gz

hermes profile export work -o ./work-2026-03-29.tar.gz
```

## `hermes profile import`

```bash
hermes profile import <归档> [选项]
```

从 tar.gz 归档导入 profile。

| 参数 / 选项 | 描述 |
|-------------------|-------------|
| `<归档>` | 要导入的 tar.gz 归档路径。 |
| `--name <名称>` | 导入 profile 的名称（默认：从归档推断）。 |

**示例：**

```bash
hermes profile import ./work-2026-03-29.tar.gz
# 从归档推断 profile 名称

hermes profile import ./work-2026-03-29.tar.gz --name work-restored
```

## `hermes -p` / `hermes --profile`

```bash
hermes -p <名称> <命令> [选项]
hermes --profile <名称> <命令> [选项]
```

全局标志，在特定 profile 下运行任何 Hermes 命令，而不更改粘性默认值。这会在命令持续时间内覆盖活跃 profile。

| 选项 | 描述 |
|--------|-------------|
| `-p <名称>`、`--profile <名称>` | 用于此命令的 profile。 |

**示例：**

```bash
hermes -p work chat -q "检查服务器状态"
hermes --profile dev gateway start
hermes -p personal skills list
hermes -p work config edit
```

## `hermes completion`

```bash
hermes completion <shell>
```

生成 shell 补全脚本。包括 profile 名称和 profile 子命令的补全。

| 参数 | 描述 |
|----------|-------------|
| `<shell>` | 要生成补全的 shell：`bash` 或 `zsh`。 |

**示例：**

```bash
# 安装补全
hermes completion bash >> ~/.bashrc
hermes completion zsh >> ~/.zshrc

# 重新加载 shell
source ~/.bashrc
```

安装后，tab 补全适用于：
- `hermes profile <TAB>` — 子命令（list、use、create 等）
- `hermes profile use <TAB>` — profile 名称
- `hermes -p <TAB>` — profile 名称

## 另请参阅

- [Profile 用户指南](../user-guide/profiles.md)
- [CLI 命令参考](./cli-commands.md)
- [FAQ — Profile 部分](./faq.md#profiles)
