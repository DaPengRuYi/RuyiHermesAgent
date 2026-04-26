---
sidebar_position: 8
title: "代码执行"
description: "具有 RPC 工具访问的编程式 Python 执行——将多步骤工作流折叠为单轮"
---

# 代码执行（编程式工具调用）

`execute_code` 工具让代理编写 Python 脚本以编程方式调用 Hermes 工具，通过沙箱化 RPC 执行将多步骤工作流折叠为单个 LLM 轮次。脚本在代理主机上的子进程中运行，通过 Unix 域套接字 RPC 与 Hermes 通信。

## 工作原理

1. 代理使用 `from hermes_tools import ...` 编写 Python 脚本
2. Hermes 生成带有 RPC 函数的 `hermes_tools.py` 存根模块
3. Hermes 打开 Unix 域套接字并启动 RPC 监听线程
4. 脚本在子进程中运行——工具调用通过套接字传回 Hermes
5. 仅脚本的 `print()` 输出返回给 LLM；中间工具结果永不进入上下文窗口

```python
# 代理可以编写这样的脚本：
from hermes_tools import web_search, web_extract

results = web_search("Python 3.13 features", limit=5)
for r in results["data"]["web"]:
    content = web_extract([r["url"]])
    # ... 过滤和处理 ...
print(summary)
```

**脚本内可用的工具：** `web_search`、`web_extract`、`read_file`、`write_file`、`search_files`、`patch`、`terminal`（仅前台）。

## 代理何时使用此工具

代理在以下情况下使用 `execute_code`：

- **3+ 次工具调用** 之间有处理逻辑
- 批量数据过滤或条件分支
- 对结果的循环

关键好处：中间工具结果永不进入上下文窗口——仅最终 `print()` 输出返回，大幅减少令牌使用。

## 实际示例

### 数据处理管道

```python
from hermes_tools import search_files, read_file
import json

# 查找所有配置文件并提取数据库设置
matches = search_files("database", path=".", file_glob="*.yaml", limit=20)
configs = []
for match in matches.get("matches", []):
    content = read_file(match["path"])
    configs.append({"file": match["path"], "preview": content["content"][:200]})

print(json.dumps(configs, indent=2))
```

### 多步骤网页研究

```python
from hermes_tools import web_search, web_extract
import json

# 搜索、提取和总结在一轮中完成
results = web_search("Rust async runtime comparison 2025", limit=5)
summaries = []
for r in results["data"]["web"]:
    page = web_extract([r["url"]])
    for p in page.get("results", []):
        if p.get("content"):
            summaries.append({
                "title": r["title"],
                "url": r["url"],
                "excerpt": p["content"][:500]
            })

print(json.dumps(summaries, indent=2))
```

### 批量文件重构

```python
from hermes_tools import search_files, read_file, patch

# 查找所有使用已弃用 API 的 Python 文件并修复它们
matches = search_files("old_api_call", path="src/", file_glob="*.py")
fixed = 0
for match in matches.get("matches", []):
    result = patch(
        path=match["path"],
        old_string="old_api_call(",
        new_string="new_api_call(",
        replace_all=True
    )
    if "error" not in str(result):
        fixed += 1

print(f"Fixed {fixed} files out of {len(matches.get('matches', []))} matches")
```

### 构建和测试管道

```python
from hermes_tools import terminal, read_file
import json

# 运行测试、解析结果并报告
result = terminal("cd /project && python -m pytest --tb=short -q 2>&1", timeout=120)
output = result.get("output", "")

# 解析测试输出
passed = output.count(" passed")
failed = output.count(" failed")
errors = output.count(" error")

report = {
    "passed": passed,
    "failed": failed,
    "errors": errors,
    "exit_code": result.get("exit_code", -1),
    "summary": output[-500:] if len(output) > 500 else output
}

print(json.dumps(report, indent=2))
```

## 执行模式

`execute_code` 有两种执行模式，通过 `~/.hermes/config.yaml` 中的 `code_execution.mode` 控制：

| 模式 | 工作目录 | Python 解释器 |
|------|---------|--------------|
| **`project`**（默认） | 会话的工作目录（与 `terminal()` 相同） | 活动的 `VIRTUAL_ENV` / `CONDA_PREFIX` python，回退到 Hermes 自己的 python |
| `strict` | 与用户项目隔离的临时暂存目录 | `sys.executable`（Hermes 自己的 python） |

**何时保持 `project`：** 你希望 `import pandas`、`from my_project import foo` 或 `open(".env")` 等相对路径与 `terminal()` 中的工作方式相同。这几乎总是你想要的。

**何时切换到 `strict`：** 你需要最大可重复性——你希望每个会话使用相同的解释器，无论用户激活了哪个 venv，且你希望脚本与项目树隔离（没有通过相对路径意外读取项目文件的风险）。

```yaml
# ~/.hermes/config.yaml
code_execution:
  mode: project   # 或 "strict"
```

`project` 模式下的回退行为：如果 `VIRTUAL_ENV` / `CONDA_PREFIX` 未设置、损坏或指向早于 3.8 的 Python，解析器干净地回退到 `sys.executable`——它永远不会让代理没有可用的解释器。

两种模式下安全关键不变量相同：

- 环境清理（API 密钥、令牌、凭据被剥离）
- 工具白名单（脚本无法递归调用 `execute_code`、`delegate_task` 或 MCP 工具）
- 资源限制（超时、stdout 上限、工具调用上限）

切换模式改变脚本运行的位置和运行它们的解释器，而不是它们可以看到哪些凭据或可以调用哪些工具。

## 资源限制

| 资源 | 限制 | 注意 |
|------|------|------|
| **超时** | 5 分钟（300s） | 脚本被 SIGTERM 终止，5 秒宽限后 SIGKILL |
| **Stdout** | 50 KB | 输出截断，带有 `[output truncated at 50KB]` 通知 |
| **Stderr** | 10 KB | 非零退出时包含在输出中用于调试 |
| **工具调用** | 每次执行 50 次 | 达到限制时返回错误 |

所有限制可通过 `config.yaml` 配置：

```yaml
# 在 ~/.hermes/config.yaml 中
code_execution:
  mode: project      # project（默认）| strict
  timeout: 300       # 每个脚本的最大秒数（默认：300）
  max_tool_calls: 50 # 每次执行的最大工具调用次数（默认：50）
```

## 脚本内工具调用如何工作

当你的脚本调用 `web_search("query")` 等函数时：

1. 调用被序列化为 JSON 并通过 Unix 域套接字发送到父进程
2. 父进程通过标准 `handle_function_call` 处理器调度
3. 结果通过套接字发回
4. 函数返回解析后的结果

这意味着脚本内的工具调用行为与正常工具调用完全相同——相同的速率限制、相同的错误处理、相同的能力。唯一的限制是 `terminal()` 仅前台（无 `background` 或 `pty` 参数）。

## 错误处理

当脚本失败时，代理接收结构化错误信息：

- **非零退出码**：stderr 包含在输出中，以便代理看到完整的回溯
- **超时**：脚本被终止，代理看到 `"Script timed out after 300s and was killed."`
- **中断**：如果用户在执行期间发送新消息，脚本被终止，代理看到 `[execution interrupted — user sent a new message]`
- **工具调用限制**：达到 50 次调用限制时，后续工具调用返回错误消息

响应始终包含 `status`（success/error/timeout/interrupted）、`output`、`tool_calls_made` 和 `duration_seconds`。

## 安全

:::danger 安全模型
子进程以**最小环境**运行。API 密钥、令牌和凭据默认被剥离。脚本通过 RPC 通道专门访问工具——除非明确允许，否则无法从环境变量读取密钥。
:::

名称中包含 `KEY`、`TOKEN`、`SECRET`、`PASSWORD`、`CREDENTIAL`、`PASSWD` 或 `AUTH` 的环境变量被排除。仅安全系统变量（`PATH`、`HOME`、`LANG`、`SHELL`、`PYTHONPATH`、`VIRTUAL_ENV` 等）被传递。

### 技能环境变量透传

当技能在其前置中声明 `required_environment_variables` 时，这些变量在技能加载后**自动透传**到 `execute_code` 和 `terminal` 子进程。这让技能可以使用其声明的 API 密钥，而不削弱任意代码的安全态势。

对于非技能用例，你可以在 `config.yaml` 中明确允许列表变量：

```yaml
terminal:
  env_passthrough:
    - MY_CUSTOM_KEY
    - ANOTHER_TOKEN
```

详见[安全指南](/docs/user-guide/security#environment-variable-passthrough)。

Hermes 始终将脚本和自动生成的 `hermes_tools.py` RPC 存根写入临时暂存目录，执行后清理。在 `strict` 模式下脚本也在那里*运行*；在 `project` 模式下它在会话的工作目录中运行（暂存目录保留在 `PYTHONPATH` 上以便导入仍然解析）。子进程在自己的进程组中运行，以便在超时或中断时可以干净地终止。

## execute_code vs terminal

| 用例 | execute_code | terminal |
|------|-------------|----------|
| 工具调用之间有逻辑的多步骤工作流 | ✅ | ❌ |
| 简单 shell 命令 | ❌ | ✅ |
| 过滤/处理大型工具输出 | ✅ | ❌ |
| 运行构建或测试套件 | ❌ | ✅ |
| 循环搜索结果 | ✅ | ❌ |
| 交互式/后台进程 | ❌ | ✅ |
| 需要环境中的 API 密钥 | ⚠️ 仅通过[透传](/docs/user-guide/security#environment-variable-passthrough) | ✅（大多数透传） |

**经验法则：** 当你需要以编程方式在调用之间带有逻辑地调用 Hermes 工具时使用 `execute_code`。使用 `terminal` 运行 shell 命令、构建和进程。

## 平台支持

代码执行需要 Unix 域套接字，**仅在 Linux 和 macOS 上可用**。在 Windows 上自动禁用——代理回退到常规顺序工具调用。
