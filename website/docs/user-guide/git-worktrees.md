---
sidebar_position: 3
sidebar_label: "Git 工作树"
title: "Git 工作树"
description: "使用 git 工作树和隔离检出在同一仓库上安全运行多个 Hermes 代理"
---

# Git 工作树

Hermes Agent 通常用于大型、长期存在的仓库。当你想要：

- 在同一项目上**并行运行多个代理**，或
- 将实验性重构与主分支隔离

Git **工作树**是让每个代理拥有自己检出的最安全方式，无需复制整个仓库。

本页展示如何将工作树与 Hermes 结合，使每个会话拥有干净、隔离的工作目录。

## 为什么将工作树与 Hermes 结合使用？

Hermes 将**当前工作目录**视为项目根目录：

- CLI：你运行 `hermes` 或 `hermes chat` 的目录
- 消息网关：由 `MESSAGING_CWD` 设置的目录

如果你在**同一检出**中运行多个代理，它们的变更可能会相互干扰：

- 一个代理可能删除或重写另一个代理正在使用的文件。
- 理解哪些变更属于哪个实验变得更困难。

使用工作树，每个代理获得：

- 自己的**分支和工作目录**
- 自己的**检查点管理器历史**用于 `/rollback`

另请参见：[检查点与 /rollback](./checkpoints-and-rollback.md)。

## 快速开始：创建工作树

从你的主仓库（包含 `.git/`），为功能分支创建一个新工作树：

```bash
# 从主仓库根目录
cd /path/to/your/repo

# 在 ../repo-feature 中创建新分支和工作树
git worktree add ../repo-feature feature/hermes-experiment
```

这会创建：

- 一个新目录：`../repo-feature`
- 一个新分支：`feature/hermes-experiment` 在该目录中检出

现在你可以 `cd` 到新工作树并在那里运行 Hermes：

```bash
cd ../repo-feature

# 在工作树中启动 Hermes
hermes
```

Hermes 会：

- 将 `../repo-feature` 视为项目根目录。
- 使用该目录存放上下文文件、代码编辑和工具。
- 使用**单独的检查点历史**用于此工作树范围的 `/rollback`。

## 并行运行多个代理

你可以创建多个工作树，每个有自己的分支：

```bash
cd /path/to/your/repo

git worktree add ../repo-experiment-a feature/hermes-a
git worktree add ../repo-experiment-b feature/hermes-b
```

在不同的终端中：

```bash
# 终端 1
cd ../repo-experiment-a
hermes

# 终端 2
cd ../repo-experiment-b
hermes
```

每个 Hermes 进程：

- 在自己的分支上工作（`feature/hermes-a` vs `feature/hermes-b`）。
- 在不同的影子仓库哈希下写入检查点（从工作树路径派生）。
- 可以独立使用 `/rollback` 而不影响另一个。

这在以下情况下特别有用：

- 运行批量重构。
- 对同一任务尝试不同的方法。
- 将 CLI + 网关会话配对到同一上游仓库。

## 安全清理工作树

完成实验后：

1. 决定保留还是丢弃工作。
2. 如果你想保留它：
   - 像往常一样将分支合并到主分支。
3. 移除工作树：

```bash
cd /path/to/your/repo

# 移除工作树目录及其引用
git worktree remove ../repo-feature
```

注意：

- `git worktree remove` 会拒绝移除有未提交变更的工作树，除非你强制执行。
- 移除工作树**不会**自动删除分支；你可以使用普通的 `git branch` 命令删除或保留分支。
- 移除工作树时，`~/.hermes/checkpoints/` 下的 Hermes 检查点数据不会自动清理，但通常很小。

## 最佳实践

- **每个 Hermes 实验一个工作树**
  - 为每个重大变更创建专用分支/工作树。
  - 这保持 diff 聚焦，PR 小而可审查。
- **以实验名称命名分支**
  - 例如 `feature/hermes-checkpoints-docs`、`feature/hermes-refactor-tests`。
- **频繁提交**
  - 使用 git 提交作为高层里程碑。
  - 使用[检查点和 /rollback](./checkpoints-and-rollback.md) 作为工具驱动编辑之间的安全网。
- **使用工作树时避免从裸仓库根目录运行 Hermes**
  - 优先使用工作树目录，以便每个代理有明确的范围。

## 使用 `hermes -w`（自动工作树模式）

Hermes 有一个内置的 `-w` 标志，可**自动创建一次性 git 工作树**，带有自己的分支。你不需要手动设置工作树——只需 `cd` 到你的仓库并运行：

```bash
cd /path/to/your/repo
hermes -w
```

Hermes 会：

- 在仓库内的 `.worktrees/` 下创建临时工作树。
- 检出一个隔离的分支（例如 `hermes/hermes-<hash>`）。
- 在该工作树内运行完整的 CLI 会话。

这是获得工作树隔离的最简单方式。你也可以将其与单次查询结合：

```bash
hermes -w -q "修复问题 #123"
```

对于并行代理，打开多个终端并在每个中运行 `hermes -w`——每次调用都会自动获得自己的工作树和分支。

## 总结

- 使用 **git 工作树**让每个 Hermes 会话拥有自己的干净检出。
- 使用 **分支**捕获实验的高层历史。
- 使用 **检查点 + `/rollback`** 在每个工作树内从错误中恢复。

这种组合给你：

- 强有力的保证，不同的代理和实验不会相互干扰。
- 快速迭代周期，轻松从错误编辑中恢复。
- 干净、可审查的拉取请求。
