---
sidebar_position: 2
title: "配置"
description: "配置 Hermes Agent——config.yaml、提供商、模型、API 密钥等"
---

# 配置

所有设置都存储在 `~/.hermes/` 目录中，便于访问。

## 目录结构

```text
~/.hermes/
├── config.yaml     # 设置（模型、终端、TTS、压缩等）
├── .env            # API 密钥和密钥
├── auth.json       # OAuth 提供商凭据（Nous Portal 等）
├── SOUL.md         # 主要代理身份（系统提示中的第 1 槽位）
├── memories/       # 持久记忆（MEMORY.md、USER.md）
├── skills/         # 代理创建的技能（通过 skill_manage 工具管理）
├── cron/           # 定时任务
├── sessions/       # 网关会话
└── logs/           # 日志（errors.log、gateway.log——密钥自动脱敏）
```

## 管理配置

```bash
hermes config              # 查看当前配置
hermes config edit         # 在编辑器中打开 config.yaml
hermes config set KEY VAL  # 设置特定值
hermes config check        # 检查缺失的选项（更新后）
hermes config migrate      # 交互式添加缺失的选项

# 示例：
hermes config set model anthropic/claude-opus-4
hermes config set terminal.backend docker
hermes config set OPENROUTER_API_KEY sk-or-...  # 保存到 .env
```

:::tip
`hermes config set` 命令会自动将值路由到正确的文件——API 密钥保存到 `.env`，其他所有内容保存到 `config.yaml`。
:::

## 配置优先级

设置按以下顺序解析（最高优先级在前）：

1. **CLI 参数** —— 例如 `hermes chat --model anthropic/claude-sonnet-4`（每次调用覆盖）
2. **`~/.hermes/config.yaml`** —— 所有非密钥设置的主要配置文件
3. **`~/.hermes/.env`** —— 环境变量的回退；密钥（API 密钥、令牌、密码）**必须**放在此处
4. **内置默认值** —— 未设置其他值时的硬编码安全默认值

:::info 经验法则
密钥（API 密钥、机器人令牌、密码）放在 `.env` 中。其他所有内容（模型、终端后端、压缩设置、内存限制、工具集）放在 `config.yaml` 中。两者都设置时，非密钥设置以 `config.yaml` 为准。
:::

## 环境变量替换

你可以在 `config.yaml` 中使用 `${VAR_NAME}` 语法引用环境变量：

```yaml
auxiliary:
  vision:
    api_key: ${GOOGLE_API_KEY}
    base_url: ${CUSTOM_VISION_URL}

delegation:
  api_key: ${DELEGATION_KEY}
```

单个值中可以使用多个引用：`url: "${HOST}:${PORT}"`。如果引用的变量未设置，占位符会原样保留（`${UNDEFINED_VAR}` 保持不变）。仅支持 `${VAR}` 语法——裸 `$VAR` 不会展开。

有关 AI 提供商设置（OpenRouter、Anthropic、Copilot、自定义端点、自托管 LLM、回退模型等），请参见 [AI 提供商](/docs/integrations/providers)。

### 提供商超时

你可以为提供商设置 `providers.<id>.request_timeout_seconds` 的全局请求超时，以及 `providers.<id>.models.<model>.timeout_seconds` 的模型特定覆盖。适用于每个传输层（OpenAI-wire、原生 Anthropic、Anthropic 兼容）的主轮次客户端、回退链、凭据轮换后的重建，以及（对于 OpenAI-wire）每请求超时 kwarg——因此配置的值优先于旧版 `HERMES_API_TIMEOUT` 环境变量。

你还可以为非流式陈旧调用检测器设置 `providers.<id>.stale_timeout_seconds`，以及 `providers.<id>.models.<model>.stale_timeout_seconds` 的模型特定覆盖。这优先于旧版 `HERMES_API_CALL_STALE_TIMEOUT` 环境变量。

不设置这些值会保留旧版默认值（`HERMES_API_TIMEOUT=1800`s，`HERMES_API_CALL_STALE_TIMEOUT=300`s，原生 Anthropic 900s）。目前未为 AWS Bedrock 配线（`bedrock_converse` 和 AnthropicBedrock SDK 路径都使用具有自己超时配置的 boto3）。请参见 [`cli-config.yaml.example`](https://github.com/NousResearch/hermes-agent/blob/main/cli-config.yaml.example) 中的注释示例。

## 终端后端配置

Hermes 支持六种终端后端。每种后端决定代理的 shell 命令实际在哪里执行——你的本地机器、Docker 容器、通过 SSH 的远程服务器、Modal 云沙箱、Daytona 工作区或 Singularity/Apptainer 容器。

```yaml
terminal:
  backend: local    # local | docker | ssh | modal | daytona | singularity
  cwd: "."          # 工作目录（"." = 本地的当前目录，容器的 "/root"）
  timeout: 180      # 每个命令的超时时间（秒）
  env_passthrough: []  # 要转发到沙箱执行的环境变量名称（terminal + execute_code）
  singularity_image: "docker://nikolaik/python-nodejs:python3.11-nodejs20"  # Singularity 后端的容器镜像
  modal_image: "nikolaik/python-nodejs:python3.11-nodejs20"                 # Modal 后端的容器镜像
  daytona_image: "nikolaik/python-nodejs:python3.11-nodejs20"               # Daytona 后端的容器镜像
```

对于 Modal 和 Daytona 等云沙箱，`container_persistent: true` 表示 Hermes 会尝试在沙箱重建之间保留文件系统状态。它不保证相同的实时沙箱、PID 空间或后台进程稍后仍在运行。

### 后端概览

| 后端 | 命令运行位置 | 隔离性 | 适用场景 |
|------|------------|--------|---------|
| **local** | 直接在你的机器上 | 无 | 开发、个人使用 |
| **docker** | Docker 容器 | 完全（命名空间、能力降权） | 安全沙箱、CI/CD |
| **ssh** | 通过 SSH 的远程服务器 | 网络边界 | 远程开发、高性能硬件 |
| **modal** | Modal 云沙箱 | 完全（云虚拟机） | 临时云计算、评估 |
| **daytona** | Daytona 工作区 | 完全（云容器） | 托管云开发环境 |
| **singularity** | Singularity/Apptainer 容器 | 命名空间（--containall） | HPC 集群、共享机器 |

### 本地后端

默认选项。命令直接在你的机器上运行，无隔离。无需特殊设置。

```yaml
terminal:
  backend: local
```

:::warning
代理拥有与你的用户帐户相同的文件系统访问权限。使用 `hermes tools` 禁用不需要的工具，或切换到 Docker 进行沙箱隔离。
:::

### Docker 后端

在 Docker 容器中运行命令，具有安全加固（所有能力降权、无权限提升、PID 限制）。

```yaml
terminal:
  backend: docker
  docker_image: "nikolaik/python-nodejs:python3.11-nodejs20"
  docker_mount_cwd_to_workspace: false  # 将启动目录挂载到 /workspace
  docker_forward_env:              # 要转发到容器中的环境变量
    - "GITHUB_TOKEN"
  docker_volumes:                  # 主机目录挂载
    - "/home/user/projects:/workspace/projects"
    - "/home/user/data:/data:ro"   # :ro 表示只读

  # 资源限制
  container_cpu: 1                 # CPU 核心数（0 = 无限制）
  container_memory: 5120           # MB（0 = 无限制）
  container_disk: 51200            # MB（需要 XFS+pquota 上的 overlay2）
  container_persistent: true       # 跨会话持久化 /workspace 和 /root
```

**要求：** 已安装并运行 Docker Desktop 或 Docker Engine。Hermes 会探测 `$PATH` 以及常见的 macOS 安装位置（`/usr/local/bin/docker`、`/opt/homebrew/bin/docker`、Docker Desktop 应用包）。

**容器生命周期：** 每个会话启动一个长生命周期容器（`docker run -d ... sleep 2h`）。命令通过 `docker exec` 使用登录 shell 运行。清理时，容器会被停止并移除。

**安全加固：**
- `--cap-drop ALL`，仅添加回 `DAC_OVERRIDE`、`CHOWN`、`FOWNER`
- `--security-opt no-new-privileges`
- `--pids-limit 256`
- 为 `/tmp`（512MB）、`/var/tmp`（256MB）、`/run`（64MB）设置大小限制的 tmpfs

**凭据转发：** `docker_forward_env` 中列出的环境变量首先从你的 shell 环境中解析，然后回退到 `~/.hermes/.env`。技能也可以声明 `required_environment_variables`，这些会自动合并。

### SSH 后端

通过 SSH 在远程服务器上运行命令。使用 ControlMaster 进行连接复用（5 分钟空闲保活）。默认启用持久 shell——状态（cwd、环境变量）在命令之间保持。

```yaml
terminal:
  backend: ssh
  persistent_shell: true           # 保持长生命周期 bash 会话（默认：true）
```

**必需的环境变量：**

```bash
TERMINAL_SSH_HOST=my-server.example.com
TERMINAL_SSH_USER=ubuntu
```

**可选：**

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `TERMINAL_SSH_PORT` | `22` | SSH 端口 |
| `TERMINAL_SSH_KEY` | （系统默认） | SSH 私钥路径 |
| `TERMINAL_SSH_PERSISTENT` | `true` | 启用持久 shell |

**工作原理：** 初始化时使用 `BatchMode=yes` 和 `StrictHostKeyChecking=accept-new` 连接。持久 shell 在远程主机上保持一个 `bash -l` 进程存活，通过临时文件通信。需要 `stdin_data` 或 `sudo` 的命令会自动回退到一次性模式。

### Modal 后端

在 [Modal](https://modal.com) 云沙箱中运行命令。每个任务获得一个具有可配置 CPU、内存和磁盘的隔离虚拟机。文件系统可以在会话之间快照/恢复。

```yaml
terminal:
  backend: modal
  container_cpu: 1                 # CPU 核心数
  container_memory: 5120           # MB（5GB）
  container_disk: 51200            # MB（50GB）
  container_persistent: true       # 快照/恢复文件系统
```

**必需：** `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` 环境变量，或 `~/.modal.toml` 配置文件。

**持久化：** 启用后，沙箱文件系统在清理时快照，在下次会话时恢复。快照跟踪在 `~/.hermes/modal_snapshots.json` 中。这保留文件系统状态，而非实时进程、PID 空间或后台任务。

**凭据文件：** 自动从 `~/.hermes/` 挂载（OAuth 令牌等），并在每次命令前同步。

### Daytona 后端

在 [Daytona](https://daytona.io) 托管工作区中运行命令。支持停止/恢复以实现持久化。

```yaml
terminal:
  backend: daytona
  container_cpu: 1                 # CPU 核心数
  container_memory: 5120           # MB → 转换为 GiB
  container_disk: 10240            # MB → 转换为 GiB（最大 10 GiB）
  container_persistent: true       # 停止/恢复而非删除
```

**必需：** `DAYTONA_API_KEY` 环境变量。

**持久化：** 启用后，沙箱在清理时停止（而非删除），在下次会话时恢复。沙箱名称遵循 `hermes-{task_id}` 模式。

**磁盘限制：** Daytona 强制最大 10 GiB。超过此限制的请求会被截断并发出警告。

### Singularity/Apptainer 后端

在 [Singularity/Apptainer](https://apptainer.org) 容器中运行命令。专为 Docker 不可用的 HPC 集群和共享机器设计。

```yaml
terminal:
  backend: singularity
  singularity_image: "docker://nikolaik/python-nodejs:python3.11-nodejs20"
  container_cpu: 1                 # CPU 核心数
  container_memory: 5120           # MB
  container_persistent: true       # 可写覆盖层跨会话持久化
```

**要求：** `$PATH` 中有 `apptainer` 或 `singularity` 二进制文件。

**镜像处理：** Docker URL（`docker://...`）会自动转换为 SIF 文件并缓存。现有的 `.sif` 文件直接使用。

**临时目录：** 按以下顺序解析：`TERMINAL_SCRATCH_DIR` → `TERMINAL_SANDBOX_DIR/singularity` → `/scratch/$USER/hermes-agent`（HPC 惯例） → `~/.hermes/sandboxes/singularity`。

**隔离：** 使用 `--containall --no-home` 进行完全命名空间隔离，不挂载主机主目录。

### 常见终端后端问题

如果终端命令立即失败或终端工具被报告为禁用：

- **本地** —— 无特殊要求。入门时最安全的默认选项。
- **Docker** —— 运行 `docker version` 验证 Docker 是否正常工作。如果失败，修复 Docker 或 `hermes config set terminal.backend local`。
- **SSH** —— `TERMINAL_SSH_HOST` 和 `TERMINAL_SSH_USER` 都必须设置。如果缺少任一项，Hermes 会记录明确的错误。
- **Modal** —— 需要 `MODAL_TOKEN_ID` 环境变量或 `~/.modal.toml`。运行 `hermes doctor` 检查。
- **Daytona** —— 需要 `DAYTONA_API_KEY`。Daytona SDK 处理服务器 URL 配置。
- **Singularity** —— 需要 `$PATH` 中的 `apptainer` 或 `singularity`。在 HPC 集群上很常见。

如有疑问，将 `terminal.backend` 设回 `local`，先验证命令能在那里运行。

### Docker 卷挂载

使用 Docker 后端时，`docker_volumes` 允许你将主机目录与容器共享。每个条目使用标准 Docker `-v` 语法：`host_path:container_path[:options]`。

```yaml
terminal:
  backend: docker
  docker_volumes:
    - "/home/user/projects:/workspace/projects"   # 读写（默认）
    - "/home/user/datasets:/data:ro"              # 只读
    - "/home/user/.hermes/cache/documents:/output" # 网关可见的导出
```

这适用于：
- **向代理提供文件**（数据集、配置、参考代码）
- **从代理接收文件**（生成的代码、报告、导出）
- **共享工作区**，你和代理访问相同的文件

如果你使用消息网关并希望代理通过 `MEDIA:/...` 发送生成的文件，建议使用专用的主机可见导出挂载，如 `/home/user/.hermes/cache/documents:/output`。

- 在 Docker 内写入文件到 `/output/...`
- 在 `MEDIA:` 中发出**主机路径**，例如：
  `MEDIA:/home/user/.hermes/cache/documents/report.txt`
- **不要**发出 `/workspace/...` 或 `/output/...`，除非该确切路径在主机上网关进程也存在

:::warning
YAML 重复键会静默覆盖前面的键。如果你已有 `docker_volumes:` 块，请将新挂载合并到同一个列表中，而不是在文件后面添加另一个 `docker_volumes:` 键。
:::

也可以通过环境变量设置：`TERMINAL_DOCKER_VOLUMES='["/host:/container"]'`（JSON 数组）。

### Docker 凭据转发

默认情况下，Docker 终端会话不会继承任意主机凭据。如果你需要容器内的特定令牌，请将其添加到 `terminal.docker_forward_env`。

```yaml
terminal:
  backend: docker
  docker_forward_env:
    - "GITHUB_TOKEN"
    - "NPM_TOKEN"
```

Hermes 首先从当前 shell 中解析列出的每个变量，如果通过 `hermes config set` 保存过，则回退到 `~/.hermes/.env`。

:::warning
`docker_forward_env` 中列出的任何内容都会对容器内运行的命令可见。只转发你愿意暴露给终端会话的凭据。
:::

### 可选：将启动目录挂载到 `/workspace`

Docker 沙箱默认保持隔离。Hermes **不会**将当前主机工作目录传入容器，除非你明确选择启用。

在 `config.yaml` 中启用：

```yaml
terminal:
  backend: docker
  docker_mount_cwd_to_workspace: true
```

启用后：
- 如果你从 `~/projects/my-app` 启动 Hermes，该主机会被绑定挂载到 `/workspace`
- Docker 后端从 `/workspace` 启动
- 文件工具和终端命令都看到相同的挂载项目

禁用时，`/workspace` 保持沙箱所有，除非你通过 `docker_volumes` 明确挂载某些内容。

安全权衡：
- `false` 保留沙箱边界
- `true` 给沙箱直接访问你启动 Hermes 的目录

仅在你有意让容器处理实时主机文件时才使用此选项。

### 持久 Shell

默认情况下，每个终端命令在自己的子进程中运行——工作目录、环境变量和 shell 变量在命令之间重置。启用**持久 shell** 后，一个长生命周期的 bash 进程会在 `execute()` 调用之间保持存活，使状态在命令之间保持。

这对 **SSH 后端**最有用，因为它还消除了每命令的连接开销。持久 shell **默认为 SSH 启用**，本地后端禁用。

```yaml
terminal:
  persistent_shell: true   # 默认——为 SSH 启用持久 shell
```

禁用：

```bash
hermes config set terminal.persistent_shell false
```

**跨命令持久的内容：**
- 工作目录（`cd /tmp` 会保持到下一个命令）
- 导出的环境变量（`export FOO=bar`）
- Shell 变量（`MY_VAR=hello`）

**优先级：**

| 级别 | 变量 | 默认值 |
|------|------|--------|
| 配置 | `terminal.persistent_shell` | `true` |
| SSH 覆盖 | `TERMINAL_SSH_PERSISTENT` | 跟随配置 |
| 本地覆盖 | `TERMINAL_LOCAL_PERSISTENT` | `false` |

每后端环境变量具有最高优先级。如果你也想在本地后端上启用持久 shell：

```bash
export TERMINAL_LOCAL_PERSISTENT=true
```

:::note
需要 `stdin_data` 或 sudo 的命令会自动回退到一次性模式，因为持久 shell 的 stdin 已被 IPC 协议占用。
:::

有关每个后端的详细信息，请参见[代码执行](features/code-execution.md)和 [README 的终端部分](features/tools.md)。

## 技能设置

技能可以通过其 SKILL.md 前置声明自己的配置设置。这些是非密钥值（路径、偏好、领域设置），存储在 `config.yaml` 的 `skills.config` 命名空间下。

```yaml
skills:
  config:
    myplugin:
      path: ~/myplugin-data   # 示例——每个技能定义自己的键
```

**技能设置工作原理：**

- `hermes config migrate` 扫描所有已启用的技能，查找未配置的设置，并提供提示
- `hermes config show` 在"技能设置"下显示所有技能设置及其所属技能
- 技能加载时，其解析的配置值会自动注入技能上下文

**手动设置值：**

```bash
hermes config set skills.config.myplugin.path ~/myplugin-data
```

有关在自己的技能中声明配置设置的详细信息，请参见[创建技能——配置设置](/docs/developer-guide/creating-skills#config-settings-configyaml)。

## 内存配置

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  memory_char_limit: 2200   # ~800 令牌
  user_char_limit: 1375     # ~500 令牌
```

## 文件读取安全

控制单次 `read_file` 调用可以返回多少内容。超过限制的读取会被拒绝，并告诉代理使用 `offset` 和 `limit` 获取更小的范围。这防止单次读取压缩的 JS 包或大型数据文件会淹没上下文窗口。

```yaml
file_read_max_chars: 100000  # 默认——~25-35K 令牌
```

如果你使用具有大上下文窗口的模型且经常读取大文件，请提高此值。对于小上下文模型，请降低以保持读取效率：

```yaml
# 大上下文模型（200K+）
file_read_max_chars: 200000

# 小型本地模型（16K 上下文）
file_read_max_chars: 30000
```

代理还会自动去重文件读取——如果同一文件区域被读取两次且文件未更改，则返回轻量级存根而非重新发送内容。这在上下文压缩时重置，以便代理可以在内容被总结后重新读取文件。

## 工具输出截断限制

三个相关的上限控制工具在 Hermes 截断之前可以返回多少原始输出：

```yaml
tool_output:
  max_bytes: 50000        # 终端输出上限（字符数）
  max_lines: 2000         # read_file 分页上限
  max_line_length: 2000   # read_file 行号视图中每行的上限
```

- **`max_bytes`** —— 当 `terminal` 命令产生的 stdout/stderr 合计超过此字符数时，Hermes 保留前 40% 和后 60%，并在它们之间插入 `[OUTPUT TRUNCATED]` 通知。默认 `50000`（跨典型分词器约 12-15K 令牌）。
- **`max_lines`** —— 单次 `read_file` 调用的 `limit` 参数上限。超过此值的请求会被限制，使单次读取不会淹没上下文窗口。默认 `2000`。
- **`max_line_length`** —— `read_file` 发出行号视图时应用的每行上限。超过此长度的行会被截断为此字符数后跟 `... [truncated]`。默认 `2000`。

在具有大上下文窗口的模型上提高限制，以便每次调用可以容纳更多原始输出。对于小上下文模型，请降低以保持工具结果紧凑：

```yaml
# 大上下文模型（200K+）
tool_output:
  max_bytes: 150000
  max_lines: 5000

# 小型本地模型（16K 上下文）
tool_output:
  max_bytes: 20000
  max_lines: 500
```

## Git 工作树隔离

启用隔离的 git 工作树以在同一仓库上并行运行多个代理：

```yaml
worktree: true    # 始终创建工作树（与 hermes -w 相同）
# worktree: false # 默认——仅在传递 -w 标志时
```

启用后，每个 CLI 会话在 `.worktrees/` 下创建一个全新的工作树，具有自己的分支。代理可以编辑文件、提交、推送和创建 PR 而不会相互干扰。干净的工作树在退出时移除；脏的工作树保留供手动恢复。

你也可以通过仓库根目录的 `.worktreeinclude` 列出要复制到工作树中的 gitignore 文件：

```
# .worktreeinclude
.env
.venv/
node_modules/
```

## 上下文压缩

Hermes 自动压缩长对话以保持在模型的上下文窗口内。压缩摘要器是一个单独的 LLM 调用——你可以将其指向任何提供商或端点。

所有压缩设置都在 `config.yaml` 中（无环境变量）。

### 完整参考

```yaml
compression:
  enabled: true                                     # 开启/关闭压缩
  threshold: 0.50                                   # 在上下文限制的此百分比时压缩
  target_ratio: 0.20                                # 作为最近尾部保留的阈值比例
  protect_last_n: 20                                # 保持未压缩的最近消息最小数量

# 摘要模型/提供商在 auxiliary 下配置：
auxiliary:
  compression:
    model: "google/gemini-3-flash-preview"          # 用于摘要的模型
    provider: "auto"                                # 提供商："auto"、"openrouter"、"nous"、"codex"、"main" 等
    base_url: null                                  # 自定义 OpenAI 兼容端点（覆盖提供商）
```

:::info 旧版配置迁移
具有 `compression.summary_model`、`compression.summary_provider` 和 `compression.summary_base_url` 的旧配置会在首次加载时自动迁移到 `auxiliary.compression.*`（配置版本 17）。无需手动操作。
:::

### 常见设置

**默认（自动检测）——无需配置：**
```yaml
compression:
  enabled: true
  threshold: 0.50
```
使用第一个可用的提供商（OpenRouter → Nous → Codex）配合 Gemini Flash。

**强制使用特定提供商**（OAuth 或 API 密钥）：
```yaml
auxiliary:
  compression:
    provider: nous
    model: gemini-3-flash
```
适用于任何提供商：`nous`、`openrouter`、`codex`、`anthropic`、`main` 等。

**自定义端点**（自托管、Ollama、zai、DeepSeek 等）：
```yaml
auxiliary:
  compression:
    model: glm-4.7
    base_url: https://api.z.ai/api/coding/paas/v4
```
指向自定义 OpenAI 兼容端点。使用 `OPENAI_API_KEY` 进行身份验证。

### 三个旋钮如何交互

| `auxiliary.compression.provider` | `auxiliary.compression.base_url` | 结果 |
|---------------------|---------------------|------|
| `auto`（默认） | 未设置 | 自动检测最佳可用提供商 |
| `nous` / `openrouter` 等 | 未设置 | 强制使用该提供商，使用其身份验证 |
| 任意 | 已设置 | 直接使用自定义端点（忽略提供商） |

:::warning 摘要模型上下文长度要求
摘要模型的上下文窗口**必须**至少与主代理模型的一样大。压缩器将对话的完整中间部分发送给摘要模型——如果该模型的上下文窗口小于主模型的，摘要调用将因上下文长度错误而失败。发生这种情况时，中间轮次会被**丢弃而不进行总结**，静默丢失对话上下文。如果你覆盖了模型，请验证其上下文长度满足或超过主模型的。
:::

## 上下文引擎

上下文引擎控制当接近模型的令牌限制时如何管理对话。内置的 `compressor` 引擎使用有损摘要（参见[上下文压缩](/docs/developer-guide/context-compression-and-caching)）。插件引擎可以用替代策略替换它。

```yaml
context:
  engine: "compressor"    # 默认——内置有损摘要
```

使用插件引擎（例如 LCM 用于无损上下文管理）：

```yaml
context:
  engine: "lcm"          # 必须与插件名称匹配
```

插件引擎**永远不会自动激活**——你必须明确将 `context.engine` 设置为插件名称。可通过 `hermes plugins` → 提供商插件 → 上下文引擎浏览和选择可用引擎。

有关内存插件的类似单选系统，请参见[内存提供商](/docs/user-guide/features/memory-providers)。

## 迭代预算压力

当代理处理具有许多工具调用的复杂任务时，它可能会耗尽迭代预算（默认：90 轮）而没有意识到预算不足。预算压力会在接近限制时自动警告模型：

| 阈值 | 级别 | 模型看到的内容 |
|------|------|--------------|
| **70%** | 注意 | `[BUDGET: 63/90. 27 iterations left. Start consolidating.]` |
| **90%** | 警告 | `[BUDGET WARNING: 81/90. Only 9 left. Respond NOW.]` |

警告注入到最后一个工具结果的 JSON 中（作为 `_budget_warning` 字段），而不是作为单独的消息——这保留了提示缓存且不会破坏对话结构。

```yaml
agent:
  max_turns: 90                # 每个对话轮次的最大迭代次数（默认：90）
```

预算压力默认启用。代理自然地在工具结果中看到警告，鼓励它在迭代耗尽前整合工作并提供响应。

当迭代预算完全耗尽时，CLI 会向用户显示通知：`⚠ 迭代预算已用完（90/90）——响应可能不完整`。如果预算在活动工作中耗尽，代理会在停止前生成已完成工作的摘要。

### API 超时

Hermes 有单独的流式超时层，以及非流式调用的陈旧检测器。仅当你将陈旧检测器保持在其隐式默认值时，它们才会自动调整本地提供商。

| 超时 | 默认值 | 本地提供商 | 配置/环境变量 |
|------|--------|-----------|-------------|
| Socket 读取超时 | 120s | 自动提升到 1800s | `HERMES_STREAM_READ_TIMEOUT` |
| 陈旧流检测 | 180s | 自动禁用 | `HERMES_STREAM_STALE_TIMEOUT` |
| 陈旧非流检测 | 300s | 保持隐式时自动禁用 | `providers.<id>.stale_timeout_seconds` 或 `HERMES_API_CALL_STALE_TIMEOUT` |
| API 调用（非流式） | 1800s | 不变 | `providers.<id>.request_timeout_seconds` / `timeout_seconds` 或 `HERMES_API_TIMEOUT` |

**Socket 读取超时**控制 httpx 等待提供商下一个数据块的时间。本地 LLM 在大上下文上的预填充可能需要几分钟才能产生第一个令牌，因此 Hermes 在检测到本地端点时会将其提高到 30 分钟。如果你明确设置了 `HERMES_STREAM_READ_TIMEOUT`，无论端点检测如何，该值始终被使用。

**陈旧流检测**会终止接收 SSE 保活 ping 但无实际内容的连接。这对本地提供商完全禁用，因为它们在预填充期间不发送保活 ping。

**陈旧非流检测**会终止长时间无响应的非流式调用。默认情况下，Hermes 在本地端点上禁用此功能以避免长预填充期间的误报。如果你明确设置了 `providers.<id>.stale_timeout_seconds`、`providers.<id>.models.<model>.stale_timeout_seconds` 或 `HERMES_API_CALL_STALE_TIMEOUT`，即使在本地端点上也会遵循该明确值。

## 上下文压力警告

与迭代预算压力不同，上下文压力跟踪对话距离**压缩阈值**有多远——即上下文压缩触发以总结较旧消息的点。这有助于你和代理了解对话何时变长。

| 进度 | 级别 | 发生的事情 |
|------|------|-----------|
| **≥ 60%** 到阈值 | 信息 | CLI 显示青色进度条；网关发送信息通知 |
| **≥ 85%** 到阈值 | 警告 | CLI 显示粗体黄色条；网关警告压缩即将发生 |

在 CLI 中，上下文压力以工具输出反馈中的进度条形式显示：

```
  ◐ context ████████████░░░░░░░░ 62% to compaction  48k threshold (50%) · approaching compaction
```

在消息平台上，发送纯文本通知：

```
◐ Context: ████████████░░░░░░░░ 62% to compaction (threshold: 50% of window).
```

如果自动压缩被禁用，警告会告诉你上下文可能被截断。

上下文压力是自动的——无需配置。它纯粹作为面向用户的通知触发，不会修改消息流或向模型的上下文中注入任何内容。

## 凭据池策略

当你为同一提供商拥有多个 API 密钥或 OAuth 令牌时，配置轮换策略：

```yaml
credential_pool_strategies:
  openrouter: round_robin    # 均匀循环使用密钥
  anthropic: least_used      # 始终选择使用最少的密钥
```

选项：`fill_first`（默认）、`round_robin`、`least_used`、`random`。完整文档请参见[凭据池](/docs/user-guide/features/credential-pools)。

## 辅助模型

Hermes 使用轻量级"辅助"模型处理图像分析、网页摘要和浏览器截图分析等辅助任务。默认情况下，这些使用 **Gemini Flash** 通过自动检测——你无需配置任何内容。

### 视频教程

<div style={{position: 'relative', width: '100%', aspectRatio: '16 / 9', marginBottom: '1.5rem'}}>
  <iframe
    src="https://www.youtube.com/embed/NoF-YajElIM"
    title="Hermes Agent — 辅助模型教程"
    style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0}}
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

### 通用配置模式

Hermes 中的每个模型槽位——辅助任务、压缩、回退——都使用相同的三个旋钮：

| 键 | 功能 | 默认值 |
|----|------|--------|
| `provider` | 用于身份验证和路由的提供商 | `"auto"` |
| `model` | 请求的模型 | 提供商的默认值 |
| `base_url` | 自定义 OpenAI 兼容端点（覆盖提供商） | 未设置 |

设置 `base_url` 时，Hermes 忽略提供商并直接调用该端点（使用 `api_key` 或 `OPENAI_API_KEY` 进行身份验证）。仅设置 `provider` 时，Hermes 使用该提供商的内置身份验证和基础 URL。

辅助任务可用的提供商：`auto`、`main`，加上[提供商注册表](/docs/reference/environment-variables)中的任何提供商——`openrouter`、`nous`、`openai-codex`、`copilot`、`copilot-acp`、`anthropic`、`gemini`、`google-gemini-cli`、`qwen-oauth`、`zai`、`kimi-coding`、`kimi-coding-cn`、`minimax`、`minimax-cn`、`deepseek`、`nvidia`、`xai`、`ollama-cloud`、`alibaba`、`bedrock`、`huggingface`、`arcee`、`xiaomi`、`kilocode`、`opencode-zen`、`opencode-go`、`ai-gateway`、`azure-foundry`——或 `custom_providers` 列表中的任何命名自定义提供商（例如 `provider: "beans"`）。

:::warning `"main"` 仅用于辅助任务
`"main"` 提供商选项表示"使用主代理使用的任何提供商"——它仅在 `auxiliary:`、`compression:` 和 `fallback_model:` 配置中有效。它**不是**顶层 `model.provider` 设置的有效值。如果你使用自定义 OpenAI 兼容端点，请在 `model:` 部分设置 `provider: custom`。有关所有主模型提供商选项，请参见 [AI 提供商](/docs/integrations/providers)。
:::

### 完整辅助配置参考

```yaml
auxiliary:
  # 图像分析（vision_analyze 工具 + 浏览器截图）
  vision:
    provider: "auto"           # "auto"、"openrouter"、"nous"、"codex"、"main" 等
    model: ""                  # 例如 "openai/gpt-4o"、"google/gemini-2.5-flash"
    base_url: ""               # 自定义 OpenAI 兼容端点（覆盖提供商）
    api_key: ""                # base_url 的 API 密钥（回退到 OPENAI_API_KEY）
    timeout: 120               # 秒——LLM API 调用超时；视觉负载需要较大的超时
    download_timeout: 30       # 秒——图像 HTTP 下载；慢速连接时增加

  # 网页摘要 + 浏览器页面文本提取
  web_extract:
    provider: "auto"
    model: ""                  # 例如 "google/gemini-2.5-flash"
    base_url: ""
    api_key: ""
    timeout: 360               # 秒（6 分钟）——每次尝试的 LLM 摘要

  # 危险命令审批分类器
  approval:
    provider: "auto"
    model: ""
    base_url: ""
    api_key: ""
    timeout: 30                # 秒

  # 上下文压缩超时（与 compression.* 配置分开）
  compression:
    timeout: 120               # 秒——压缩总结长对话，需要更多时间

  # 会话搜索——总结过去的会话匹配
  session_search:
    provider: "auto"
    model: ""
    base_url: ""
    api_key: ""
    timeout: 30
    max_concurrency: 3       # 限制并行摘要以减少请求突发 429
    extra_body: {}           # 提供商特定的 OpenAI 兼容请求字段

  # 技能中心——技能匹配和搜索
  skills_hub:
    provider: "auto"
    model: ""
    base_url: ""
    api_key: ""
    timeout: 30

  # MCP 工具调度
  mcp:
    provider: "auto"
    model: ""
    base_url: ""
    api_key: ""
    timeout: 30
```

:::tip
每个辅助任务都有可配置的 `timeout`（以秒为单位）。默认值：vision 120s、web_extract 360s、approval 30s、compression 120s。如果你对辅助任务使用较慢的本地模型，请增加这些值。Vision 还有一个单独的 `download_timeout`（默认 30s）用于 HTTP 图像下载——对于慢速连接或自托管图像服务器，请增加此值。
:::

:::info
上下文压缩有自己的 `compression:` 块用于阈值，以及 `auxiliary.compression:` 块用于模型/提供商设置——参见上面的[上下文压缩](#context-compression)。回退模型使用 `fallback_model:` 块——参见[回退模型](/docs/integrations/providers#fallback-model)。三者都遵循相同的 provider/model/base_url 模式。
:::

### 会话搜索调优

如果你对 `auxiliary.session_search` 使用推理密集型模型，Hermes 现在提供两个内置控制：

- `auxiliary.session_search.max_concurrency`：限制 Hermes 一次总结多少个匹配的会话
- `auxiliary.session_search.extra_body`：在摘要调用中转发提供商特定的 OpenAI 兼容请求字段

示例：

```yaml
auxiliary:
  session_search:
    provider: "main"
    model: "glm-4.5-air"
    timeout: 60
    max_concurrency: 2
    extra_body:
      enable_thinking: false
```

当你的提供商限制请求突发且你希望 `session_search` 用一些并行性换取稳定性时，使用 `max_concurrency`。

仅当你的提供商记录了你希望 Hermes 为该任务传递的 OpenAI 兼容请求体字段时，才使用 `extra_body`。Hermes 原样转发该对象。

:::warning
`extra_body` 仅在你的提供商实际支持你发送的字段时有效。如果提供商不暴露原生 OpenAI 兼容的推理关闭标志，Hermes 无法为其合成一个。
:::

### 更改视觉模型

使用 GPT-4o 代替 Gemini Flash 进行图像分析：

```yaml
auxiliary:
  vision:
    model: "openai/gpt-4o"
```

或通过环境变量（在 `~/.hermes/.env` 中）：

```bash
AUXILIARY_VISION_MODEL=openai/gpt-4o
```

### 提供商选项

这些选项适用于**辅助任务配置**（`auxiliary:`、`compression:`、`fallback_model:`），而非主 `model.provider` 设置。

| 提供商 | 描述 | 要求 |
|--------|------|------|
| `"auto"` | 最佳可用（默认）。Vision 尝试 OpenRouter → Nous → Codex。 | — |
| `"openrouter"` | 强制 OpenRouter——路由到任何模型（Gemini、GPT-4o、Claude 等） | `OPENROUTER_API_KEY` |
| `"nous"` | 强制 Nous Portal | `hermes auth` |
| `"codex"` | 强制 Codex OAuth（ChatGPT 帐户）。支持视觉（gpt-5.3-codex）。 | `hermes model` → Codex |
| `"main"` | 使用你的活动自定义/主端点。这可以来自 `OPENAI_BASE_URL` + `OPENAI_API_KEY` 或通过 `hermes model` / `config.yaml` 保存的自定义端点。适用于 OpenAI、本地模型或任何 OpenAI 兼容 API。**仅限辅助任务——对 `model.provider` 无效。** | 自定义端点凭据 + 基础 URL |

### 常见设置

**使用直接自定义端点**（比 `provider: "main"` 更清晰，适用于本地/自托管 API）：
```yaml
auxiliary:
  vision:
    base_url: "http://localhost:1234/v1"
    api_key: "local-key"
    model: "qwen2.5-vl"
```

`base_url` 优先于 `provider`，因此这是将辅助任务路由到特定端点的最明确方式。对于直接端点覆盖，Hermes 使用配置的 `api_key` 或回退到 `OPENAI_API_KEY`；它不会为该自定义端点重用 `OPENROUTER_API_KEY`。

**使用 OpenAI API 密钥进行视觉：**
```yaml
# 在 ~/.hermes/.env 中：
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_API_KEY=sk-...

auxiliary:
  vision:
    provider: "main"
    model: "gpt-4o"       # 或 "gpt-4o-mini" 更便宜
```

**使用 OpenRouter 进行视觉**（路由到任何模型）：
```yaml
auxiliary:
  vision:
    provider: "openrouter"
    model: "openai/gpt-4o"      # 或 "google/gemini-2.5-flash" 等
```

**使用 Codex OAuth**（ChatGPT Pro/Plus 帐户——无需 API 密钥）：
```yaml
auxiliary:
  vision:
    provider: "codex"     # 使用你的 ChatGPT OAuth 令牌
    # 模型默认为 gpt-5.3-codex（支持视觉）
```

**使用本地/自托管模型：**
```yaml
auxiliary:
  vision:
    provider: "main"      # 使用你的活动自定义端点
    model: "my-local-model"
```

`provider: "main"` 使用 Hermes 用于正常聊天的任何提供商——无论是命名的自定义提供商（例如 `beans`）、内置提供商如 `openrouter`，还是旧版 `OPENAI_BASE_URL` 端点。

:::tip
如果你使用 Codex OAuth 作为主模型提供商，视觉会自动工作——无需额外配置。Codex 包含在视觉的自动检测链中。
:::

:::warning
**视觉需要多模态模型。** 如果你设置 `provider: "main"`，请确保你的端点支持多模态/视觉——否则图像分析将失败。
:::

### 环境变量（旧版）

辅助模型也可以通过环境变量配置。但是，`config.yaml` 是首选方法——它更易于管理并支持所有选项，包括 `base_url` 和 `api_key`。

| 设置 | 环境变量 |
|------|---------|
| Vision 提供商 | `AUXILIARY_VISION_PROVIDER` |
| Vision 模型 | `AUXILIARY_VISION_MODEL` |
| Vision 端点 | `AUXILIARY_VISION_BASE_URL` |
| Vision API 密钥 | `AUXILIARY_VISION_API_KEY` |
| Web extract 提供商 | `AUXILIARY_WEB_EXTRACT_PROVIDER` |
| Web extract 模型 | `AUXILIARY_WEB_EXTRACT_MODEL` |
| Web extract 端点 | `AUXILIARY_WEB_EXTRACT_BASE_URL` |
| Web extract API 密钥 | `AUXILIARY_WEB_EXTRACT_API_KEY` |

压缩和回退模型设置仅在 config.yaml 中。

:::tip
运行 `hermes config` 查看当前辅助模型设置。覆盖仅在与默认值不同时显示。
:::

## 推理力度

控制模型在响应前进行多少"思考"：

```yaml
agent:
  reasoning_effort: ""   # 空 = 中等（默认）。选项：none、minimal、low、medium、high、xhigh（最大）
```

未设置（默认）时，推理力度默认为"中等"——适合大多数任务的平衡级别。设置值会覆盖它——更高的推理力度在复杂任务上提供更好的结果，但代价是更多令牌和延迟。

你也可以在运行时使用 `/reasoning` 命令更改推理力度：

```
/reasoning           # 显示当前力度级别和显示状态
/reasoning high      # 设置推理力度为高
/reasoning none      # 禁用推理
/reasoning show      # 在每个响应上方显示模型思考
/reasoning hide      # 隐藏模型思考
```

## 工具使用强制

某些模型偶尔会将预期操作描述为文本而不是进行工具调用（"我会运行测试..."而不是实际调用终端）。工具使用强制注入系统提示引导，将模型引导回实际调用工具。

```yaml
agent:
  tool_use_enforcement: "auto"   # "auto" | true | false | ["model-substring", ...]
```

| 值 | 行为 |
|----|------|
| `"auto"`（默认） | 对匹配的模型启用：`gpt`、`codex`、`gemini`、`gemma`、`grok`。对其他所有模型禁用（Claude、DeepSeek、Qwen 等）。 |
| `true` | 无论模型如何，始终启用。如果你注意到当前模型描述操作而非执行操作，这很有用。 |
| `false` | 无论模型如何，始终禁用。 |
| `["gpt", "codex", "qwen", "llama"]` | 仅当模型名称包含列出的子字符串之一时启用（不区分大小写）。 |

### 注入内容

启用后，可能会向系统提示添加三层指导：

1. **通用工具使用强制**（所有匹配的模型）——指示模型立即进行工具调用而非描述意图，持续工作直到任务完成，且永不以未来行动的承诺结束轮次。

2. **OpenAI 执行纪律**（仅 GPT 和 Codex 模型）——解决 GPT 特定失败模式的额外指导：在部分结果上放弃工作、跳过前置查找、使用幻觉而非工具，以及未验证就宣布"完成"。

3. **Google 操作指导**（仅 Gemini 和 Gemma 模型）——简洁性、绝对路径、并行工具调用和编辑前验证模式。

这些对用户透明，仅影响系统提示。已经可靠使用工具的模型（如 Claude）不需要此指导，这就是为什么 `"auto"` 排除它们。

### 何时启用

如果你使用的模型不在默认自动列表中，且注意到它经常描述它*会*做什么而不是执行，设置 `tool_use_enforcement: true` 或将模型子字符串添加到列表：

```yaml
agent:
  tool_use_enforcement: ["gpt", "codex", "gemini", "grok", "my-custom-model"]
```

## TTS 配置

```yaml
tts:
  provider: "edge"              # "edge" | "elevenlabs" | "openai" | "minimax" | "mistral" | "gemini" | "xai" | "neutts"
  speed: 1.0                    # 全局速度倍数（所有提供商的回退）
  edge:
    voice: "en-US-AriaNeural"   # 322 种声音，74 种语言
    speed: 1.0                  # 速度倍数（转换为速率百分比，例如 1.5 → +50%）
  elevenlabs:
    voice_id: "pNInz6obpgDQGcFmaJgB"
    model_id: "eleven_multilingual_v2"
  openai:
    model: "gpt-4o-mini-tts"
    voice: "alloy"              # alloy、echo、fable、onyx、nova、shimmer
    speed: 1.0                  # 速度倍数（API 限制在 0.25–4.0）
    base_url: "https://api.openai.com/v1"  # 覆盖 OpenAI 兼容 TTS 端点
  minimax:
    speed: 1.0                  # 语音速度倍数
    # base_url: ""              # 可选：覆盖 OpenAI 兼容 TTS 端点
  mistral:
    model: "voxtral-mini-tts-2603"
    voice_id: "c69964a6-ab8b-4f8a-9465-ec0925096ec8"  # Paul - 中性（默认）
  gemini:
    model: "gemini-2.5-flash-preview-tts"   # 或 gemini-2.5-pro-preview-tts
    voice: "Kore"               # 30 种预设声音：Zephyr、Puck、Kore、Enceladus 等
  xai:
    voice_id: "eve"             # xAI TTS 声音
    language: "en"              # ISO 639-1
    sample_rate: 24000
    bit_rate: 128000            # MP3 比特率
    # base_url: "https://api.x.ai/v1"
  neutts:
    ref_audio: ''
    ref_text: ''
    model: neuphonic/neutts-air-q4-gguf
    device: cpu
```

这控制 `text_to_speech` 工具和语音模式中的语音回复（CLI 中的 `/voice tts` 或消息网关）。

**速度回退层级：** 提供商特定速度（例如 `tts.edge.speed`）→ 全局 `tts.speed` → `1.0` 默认值。设置全局 `tts.speed` 以在所有提供商上应用统一速度，或按提供商覆盖以进行细粒度控制。

## 显示设置

```yaml
display:
  tool_progress: all      # off | new | all | verbose
  tool_progress_command: false  # 在消息网关中启用 /verbose 斜杠命令
  tool_progress_overrides: {}  # 每平台覆盖（见下文）
  interim_assistant_messages: true  # 网关：将自然的中轮助手更新作为单独消息发送
  skin: default           # 内置或自定义 CLI 皮肤（见 user-guide/features/skins）
  personality: "kawaii"  # 旧版装饰字段仍在某些摘要中显示
  compact: false          # 紧凑输出模式（更少空白）
  resume_display: full    # full（恢复时显示之前的消息）| minimal（仅一行）
  bell_on_complete: false  # 代理完成时播放终端铃声（适合长时间任务）
  show_reasoning: false   # 在每个响应上方显示模型推理/思考（使用 /reasoning show|hide 切换）
  streaming: false        # 令牌到达时流式传输到终端（实时输出）
  show_cost: false        # 在 CLI 状态栏中显示预估 $ 费用
  tool_preview_length: 0  # 工具调用预览的最大字符数（0 = 无限制，显示完整路径/命令）
```

| 模式 | 你看到的内容 |
|------|------------|
| `off` | 静默——仅最终响应 |
| `new` | 仅当工具更改时显示工具指示器 |
| `all` | 每次工具调用都显示简短预览（默认） |
| `verbose` | 完整参数、结果和调试日志 |

在 CLI 中，使用 `/verbose` 切换这些模式。要在消息平台（Telegram、Discord、Slack 等）中使用 `/verbose`，请在上面的 `display` 部分设置 `tool_progress_command: true`。该命令将切换模式并保存到配置。

### 每平台进度覆盖

不同平台有不同的详细程度需求。例如，Signal 无法编辑消息，因此每个进度更新都成为单独的消息——很吵。使用 `tool_progress_overrides` 设置每平台模式：

```yaml
display:
  tool_progress: all          # 全局默认
  tool_progress_overrides:
    signal: 'off'             # 在 Signal 上静默进度
    telegram: verbose         # 在 Telegram 上详细进度
    slack: 'off'              # 在共享 Slack 工作区中安静
```

没有覆盖的平台回退到全局 `tool_progress` 值。有效的平台键：`telegram`、`discord`、`slack`、`signal`、`whatsapp`、`matrix`、`mattermost`、`email`、`sms`、`homeassistant`、`dingtalk`、`feishu`、`wecom`、`weixin`、`bluebubbles`、`qqbot`。

`interim_assistant_messages` 仅限网关。启用后，Hermes 将完成的中轮助手更新作为单独的聊天消息发送。这与 `tool_progress` 独立，不需要网关流式传输。

## 隐私

```yaml
privacy:
  redact_pii: false  # 从 LLM 上下文中剥离 PII（仅限网关）
```

当 `redact_pii` 为 `true` 时，网关在支持的平台上发送给 LLM 之前，从系统提示中脱敏个人身份信息：

| 字段 | 处理方式 |
|------|---------|
| 电话号码（WhatsApp/Signal 上的用户 ID） | 哈希为 `user_<12-char-sha256>` |
| 用户 ID | 哈希为 `user_<12-char-sha256>` |
| 聊天 ID | 数字部分哈希，保留平台前缀（`telegram:<hash>`） |
| 主频道 ID | 数字部分哈希 |
| 用户名/昵称 | **不受影响**（用户选择的，公开可见） |

**平台支持：** 脱敏适用于 WhatsApp、Signal 和 Telegram。Discord 和 Slack 被排除，因为它们的提及系统（`<@user_id>`）需要 LLM 上下文中的真实 ID。

哈希是确定性的——同一用户始终映射到同一哈希，因此模型仍然可以在群聊中区分用户。路由和传递内部使用原始值。

## 语音转文字（STT）

```yaml
stt:
  provider: "local"            # "local" | "groq" | "openai" | "mistral"
  local:
    model: "base"              # tiny、base、small、medium、large-v3
  openai:
    model: "whisper-1"         # whisper-1 | gpt-4o-mini-transcribe | gpt-4o-transcribe
  # model: "whisper-1"         # 旧版回退键仍然有效
```

提供商行为：

- `local` 使用在你机器上运行的 `faster-whisper`。使用 `pip install faster-whisper` 单独安装。
- `groq` 使用 Groq 的 Whisper 兼容端点并读取 `GROQ_API_KEY`。
- `openai` 使用 OpenAI 语音 API 并读取 `VOICE_TOOLS_OPENAI_KEY`。

如果请求的提供商不可用，Hermes 按以下顺序自动回退：`local` → `groq` → `openai`。

Groq 和 OpenAI 模型覆盖由环境变量驱动：

```bash
STT_GROQ_MODEL=whisper-large-v3-turbo
STT_OPENAI_MODEL=whisper-1
GROQ_BASE_URL=https://api.groq.com/openai/v1
STT_OPENAI_BASE_URL=https://api.openai.com/v1
```

## 语音模式（CLI）

```yaml
voice:
  record_key: "ctrl+b"         # CLI 中的按键说话键
  max_recording_seconds: 120    # 长时间录音的硬停止
  auto_tts: false               # 启用 /voice on 时自动启用语音回复
  beep_enabled: true            # 在 CLI 语音模式中播放录音开始/停止提示音
  silence_threshold: 200        # 语音检测的 RMS 阈值
  silence_duration: 3.0         # 自动停止前的静默秒数
```

在 CLI 中使用 `/voice on` 启用麦克风模式，`record_key` 开始/停止录音，`/voice tts` 切换语音回复。有关端到端设置和平台特定行为，请参见[语音模式](/docs/user-guide/features/voice-mode)。

## 流式传输

令牌到达时流式传输到终端或消息平台，而不是等待完整响应。

### CLI 流式传输

```yaml
display:
  streaming: true         # 实时流式传输令牌到终端
  show_reasoning: true    # 同时流式传输推理/思考令牌（可选）
```

启用后，响应在流式传输框中逐个令牌出现。工具调用仍被静默捕获。如果提供商不支持流式传输，会自动回退到正常显示。

### 网关流式传输（Telegram、Discord、Slack）

```yaml
streaming:
  enabled: true           # 启用渐进式消息编辑
  transport: edit         # "edit"（渐进式消息编辑）或 "off"
  edit_interval: 0.3      # 消息编辑之间的秒数
  buffer_threshold: 40    # 强制编辑刷新前的字符数
  cursor: " ▉"            # 流式传输期间显示的光标
```

启用后，机器人在第一个令牌时发送消息，然后随着更多令牌到达渐进式编辑它。不支持消息编辑的平台（Signal、Email、Home Assistant）会在首次尝试时自动检测——流式传输会优雅地为该会话禁用，不会产生消息洪泛。

对于不需要渐进式令牌编辑的自然中轮助手更新，设置 `display.interim_assistant_messages: true`。

**溢出处理：** 如果流式文本超过平台的消息长度限制（~4096 字符），当前消息会被终结并自动开始新消息。

:::note
流式传输默认禁用。在 `~/.hermes/config.yaml` 中启用以尝试流式传输用户体验。
:::

## 群聊会话隔离

控制共享聊天是保持每个房间一个对话还是每个参与者一个对话：

```yaml
group_sessions_per_user: true  # true = 群组/频道中的每用户隔离，false = 每个聊天一个共享会话
```

- `true` 是默认且推荐的设置。在 Discord 频道、Telegram 群组、Slack 频道和类似的共享上下文中，当平台提供用户 ID 时，每个发送者获得自己的会话。
- `false` 恢复到旧的共享房间行为。如果你明确希望 Hermes 将频道视为一个协作对话，这很有用，但它也意味着用户共享上下文、令牌费用和中断状态。
- 直接消息不受影响。Hermes 仍然按聊天/DM ID 键入 DM。
- 无论哪种方式，线程都与其父频道隔离；使用 `true` 时，每个参与者在线程内也获得自己的会话。

有关行为详情和示例，请参见[会话](/docs/user-guide/sessions)和 [Discord 指南](/docs/user-guide/messaging/discord)。

## 未授权 DM 行为

控制当未知用户发送直接消息时 Hermes 的行为：

```yaml
unauthorized_dm_behavior: pair

whatsapp:
  unauthorized_dm_behavior: ignore
```

- `pair` 是默认值。Hermes 拒绝访问，但在 DM 中回复一次性配对码。
- `ignore` 静默丢弃未授权的 DM。
- 平台部分覆盖全局默认值，因此你可以广泛启用配对，同时使一个平台更安静。

## 快捷命令

定义无需调用 LLM 即可运行 shell 命令的自定义命令——零令牌使用，即时执行。在消息平台（Telegram、Discord 等）上特别有用，用于快速服务器检查或实用脚本。

```yaml
quick_commands:
  status:
    type: exec
    command: systemctl status hermes-agent
  disk:
    type: exec
    command: df -h /
  update:
    type: exec
    command: cd ~/.hermes/hermes-agent && git pull && pip install -e .
  gpu:
    type: exec
    command: nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader
```

用法：在 CLI 或任何消息平台中输入 `/status`、`/disk`、`/update` 或 `/gpu`。命令在主机本地运行并直接返回输出——无 LLM 调用，无令牌消耗。

- **30 秒超时** —— 长时间运行的命令会被终止并显示错误消息
- **优先级** —— 快捷命令在技能命令之前检查，因此你可以覆盖技能名称
- **自动补全** —— 快捷命令在调度时解析，不会显示在内置斜杠命令自动补全表中
- **类型** —— 仅支持 `exec`（运行 shell 命令）；其他类型显示错误
- **随处可用** —— CLI、Telegram、Discord、Slack、WhatsApp、Signal、Email、Home Assistant

## 人类延迟

在消息平台上模拟类人的响应节奏：

```yaml
human_delay:
  mode: "off"                  # off | natural | custom
  min_ms: 800                  # 最小延迟（自定义模式）
  max_ms: 2500                 # 最大延迟（自定义模式）
```

## 代码执行

配置 `execute_code` 工具：

```yaml
code_execution:
  mode: project                # project（默认）| strict
  timeout: 300                 # 最大执行时间（秒）
  max_tool_calls: 50           # 代码执行内的最大工具调用次数
```

**`mode`** 控制脚本的工作目录和 Python 解释器：

- **`project`**（默认）——脚本在会话的工作目录中运行，使用活动 virtualenv/conda 环境的 python。项目依赖（`pandas`、`torch`、项目包）和相对路径（`.env`、`./data.csv`）自然解析，与 `terminal()` 看到的一致。
- **`strict`**——脚本在临时暂存目录中运行，使用 `sys.executable`（Hermes 自己的 python）。最大可重复性，但项目依赖和相对路径无法解析。

环境清理（剥离 `*_API_KEY`、`*_TOKEN`、`*_SECRET`、`*_PASSWORD`、`*_CREDENTIAL`、`*_PASSWD`、`*_AUTH`）和工具白名单在两种模式下相同——切换模式不会改变安全态势。

## 网页搜索后端

`web_search`、`web_extract` 和 `web_crawl` 工具支持四种后端提供商。在 `config.yaml` 或通过 `hermes tools` 配置后端：

```yaml
web:
  backend: firecrawl    # firecrawl | parallel | tavily | exa
```

| 后端 | 环境变量 | 搜索 | 提取 | 爬取 |
|------|---------|------|------|------|
| **Firecrawl**（默认） | `FIRECRAWL_API_KEY` | ✔ | ✔ | ✔ |
| **Parallel** | `PARALLEL_API_KEY` | ✔ | ✔ | — |
| **Tavily** | `TAVILY_API_KEY` | ✔ | ✔ | ✔ |
| **Exa** | `EXA_API_KEY` | ✔ | ✔ | — |

**后端选择：** 如果未设置 `web.backend`，后端会从可用 API 密钥自动检测。如果仅设置 `EXA_API_KEY`，则使用 Exa。如果仅设置 `TAVILY_API_KEY`，则使用 Tavily。如果仅设置 `PARALLEL_API_KEY`，则使用 Parallel。否则 Firecrawl 是默认值。

**自托管 Firecrawl：** 设置 `FIRECRAWL_API_URL` 指向你自己的实例。设置自定义 URL 时，API 密钥变为可选（在服务器上设置 `USE_DB_AUTHENTICATION=false` 以禁用身份验证）。

**Parallel 搜索模式：** 设置 `PARALLEL_SEARCH_MODE` 控制搜索行为——`fast`、`one-shot` 或 `agentic`（默认：`agentic`）。

**Exa：** 在 `~/.hermes/.env` 中设置 `EXA_API_KEY`。支持 `category` 过滤（`company`、`research paper`、`news`、`people`、`personal site`、`pdf`）和域名/日期过滤器。

## 浏览器

配置浏览器自动化行为：

```yaml
browser:
  inactivity_timeout: 120        # 自动关闭空闲会话前的秒数
  command_timeout: 30             # 浏览器命令的超时秒数（截图、导航等）
  record_sessions: false         # 自动将浏览器会话录制为 WebM 视频到 ~/.hermes/browser_recordings/
  # 可选 CDP 覆盖——设置后，Hermes 直接连接到你自己的
  # Chrome（通过 /browser connect），而不是启动无头浏览器。
  cdp_url: ""
  # 对话框监管器——控制连接 CDP 后端时如何处理原生 JS 对话框
  #（alert / confirm / prompt）（Browserbase、通过 /browser connect 的本地 Chrome）。
  # 在 Camofox 和默认本地 agent-browser 模式下忽略。
  dialog_policy: must_respond    # must_respond | auto_dismiss | auto_accept
  dialog_timeout_s: 300          # must_respond 下的安全自动关闭（秒）
  camofox:
    managed_persistence: false   # 为 true 时，Camofox 会话跨重启持久化 cookie/登录
```

**对话框策略：**

- `must_respond`（默认）——捕获对话框，在 `browser_snapshot.pending_dialogs` 中显示，并等待代理调用 `browser_dialog(action=...)`。在 `dialog_timeout_s` 秒内无响应后，对话框自动关闭以防止页面的 JS 线程永久挂起。
- `auto_dismiss`——捕获，立即关闭。代理仍然可以在事后在 `browser_snapshot.recent_dialogs` 中看到对话框记录，其中 `closed_by="auto_policy"`。
- `auto_accept`——捕获，立即接受。适用于具有激进 `beforeunload` 提示的页面。

有关完整对话框工作流，请参见[浏览器功能页面](./features/browser.md#browser_dialog)。

浏览器工具集支持多个提供商。有关 Browserbase、Browser Use 和本地 Chrome CDP 设置的详细信息，请参见[浏览器功能页面](/docs/user-guide/features/browser)。

## 时区

使用 IANA 时区字符串覆盖服务器本地时区。影响日志中的时间戳、定时调度和系统提示时间注入。

```yaml
timezone: "America/New_York"   # IANA 时区（默认："" = 服务器本地时间）
```

支持的值：任何 IANA 时区标识符（例如 `America/New_York`、`Europe/London`、`Asia/Kolkata`、`UTC`）。留空或省略表示服务器本地时间。

## Discord

为消息网关配置 Discord 特定行为：

```yaml
discord:
  require_mention: true          # 在服务器频道中需要 @提及 才响应
  free_response_channels: ""     # 逗号分隔的频道 ID，机器人无需 @提及 即响应
  auto_thread: true              # 在频道中 @提及 时自动创建线程
```

- `require_mention`——当为 `true`（默认）时，机器人仅在服务器频道中被 `@BotName` 提及时响应。DM 始终无需提及即可工作。
- `free_response_channels`——逗号分隔的频道 ID 列表，机器人无需提及即可响应每条消息。
- `auto_thread`——当为 `true`（默认）时，频道中的提及会自动创建对话线程，保持频道清洁（类似 Slack 线程）。

## 安全

执行前安全扫描和密钥脱敏：

```yaml
security:
  redact_secrets: true           # 在工具输出和日志中脱敏 API 密钥模式
  tirith_enabled: true           # 启用终端命令的 Tirith 安全扫描
  tirith_path: "tirith"          # tirith 二进制文件路径（默认：$PATH 中的 "tirith"）
  tirith_timeout: 5              # 等待 tirith 扫描的秒数
  tirith_fail_open: true         # tirith 不可用时允许命令执行
  website_blocklist:             # 见下方网站封锁列表部分
    enabled: false
    domains: []
    shared_files: []
```

- `redact_secrets`——在工具输出进入对话上下文和日志之前，自动检测并脱敏看起来像 API 密钥、令牌和密码的模式。
- `tirith_enabled`——为 `true` 时，终端命令在执行前由 [Tirith](https://github.com/StackGuardian/tirith) 扫描以检测潜在危险操作。
- `tirith_path`——tirith 二进制文件的路径。如果 tirith 安装在非标准位置，请设置此项。
- `tirith_timeout`——等待 tirith 扫描的最大秒数。如果扫描超时，命令继续执行。
- `tirith_fail_open`——为 `true`（默认）时，如果 tirith 不可用或失败，允许命令执行。设置为 `false` 以在 tirith 无法验证时阻止命令。

## 网站封锁列表

阻止代理的网页和浏览器工具访问特定域名：

```yaml
security:
  website_blocklist:
    enabled: false               # 启用 URL 阻止（默认：false）
    domains:                     # 被阻止的域名模式列表
      - "*.internal.company.com"
      - "admin.example.com"
      - "*.local"
    shared_files:                # 从外部文件加载额外规则
      - "/etc/hermes/blocked-sites.txt"
```

启用后，任何匹配被阻止域名模式的 URL 在网页或浏览器工具执行前会被拒绝。这适用于 `web_search`、`web_extract`、`browser_navigate` 以及任何访问 URL 的工具。

域名规则支持：
- 精确域名：`admin.example.com`
- 通配符子域名：`*.internal.company.com`（阻止所有子域名）
- TLD 通配符：`*.local`

共享文件每行包含一个域名规则（空行和 `#` 注释被忽略）。缺失或不可读的文件会记录警告但不会禁用其他网页工具。

策略缓存 30 秒，因此配置更改无需重启即可快速生效。

## 智能审批

控制 Hermes 如何处理潜在危险命令：

```yaml
approvals:
  mode: manual   # manual | smart | off
```

| 模式 | 行为 |
|------|------|
| `manual`（默认） | 执行任何标记命令前提醒用户。在 CLI 中，显示交互式审批对话框。在消息中，排队待审批请求。 |
| `smart` | 使用辅助 LLM 评估标记命令是否真的危险。低风险命令自动批准并具有会话级持久性。真正有风险的命令升级给用户。 |
| `off` | 跳过所有审批检查。等同于 `HERMES_YOLO_MODE=true`。**谨慎使用。** |

智能模式对于减少审批疲劳特别有用——它让代理在安全操作上更自主地工作，同时仍然捕获真正具有破坏性的命令。

:::warning
设置 `approvals.mode: off` 会禁用终端命令的所有安全检查。仅在受信任的沙箱环境中使用。
:::

## 检查点

在破坏性文件操作前自动创建文件系统快照。详见[检查点与回滚](/docs/user-guide/checkpoints-and-rollback)。

```yaml
checkpoints:
  enabled: true                  # 启用自动检查点（也：hermes --checkpoints）
  max_snapshots: 50              # 每个目录保留的最大检查点数
```


## 委托

配置委托工具的子代理行为：

```yaml
delegation:
  # model: "google/gemini-3-flash-preview"  # 覆盖模型（空 = 继承父级）
  # provider: "openrouter"                  # 覆盖提供商（空 = 继承父级）
  # base_url: "http://localhost:1234/v1"    # 直接 OpenAI 兼容端点（优先于提供商）
  # api_key: "local-key"                    # base_url 的 API 密钥（回退到 OPENAI_API_KEY）
  max_concurrent_children: 3                # 每批并行子级数（最小 1，无上限）。也可通过 DELEGATION_MAX_CONCURRENT_CHILDREN 环境变量设置。
  max_spawn_depth: 1                        # 委托树深度上限（1-3，已限制）。1 = 扁平（默认）：父级生成无法委托的叶子。2 = 编排器子级可以生成叶子孙级。3 = 三级。
  orchestrator_enabled: true                # 全局开关。为 false 时，role="orchestrator" 被忽略，每个子级无论 max_spawn_depth 如何都强制为叶子。
```

**子代理 provider:model 覆盖：** 默认情况下，子代理继承父代理的提供商和模型。设置 `delegation.provider` 和 `delegation.model` 将子代理路由到不同的 provider:model 对——例如，对范围狭窄的子任务使用廉价/快速模型，而主代理运行昂贵的推理模型。

**直接端点覆盖：** 如果你想要明显的自定义端点路径，设置 `delegation.base_url`、`delegation.api_key` 和 `delegation.model`。这将子代理直接发送到该 OpenAI 兼容端点，优先于 `delegation.provider`。如果省略 `delegation.api_key`，Hermes 仅回退到 `OPENAI_API_KEY`。

委托提供商使用与 CLI/网关启动相同的凭据解析。所有配置的提供商都支持：`openrouter`、`nous`、`copilot`、`zai`、`kimi-coding`、`minimax`、`minimax-cn`。设置提供商时，系统自动解析正确的基础 URL、API 密钥和 API 模式——无需手动凭据配线。

**优先级：** 配置中的 `delegation.base_url` → 配置中的 `delegation.provider` → 父级提供商（继承）。配置中的 `delegation.model` → 父级模型（继承）。仅设置 `model` 而不设置 `provider` 只更改模型名称，同时保留父级的凭据（适用于在同一提供商内切换模型，如 OpenRouter）。

**宽度和深度：** `max_concurrent_children` 限制每批并行运行的子代理数（默认 `3`，最小 1，无上限）。也可通过 `DELEGATION_MAX_CONCURRENT_CHILDREN` 环境变量设置。当模型提交的 `tasks` 数组超过上限时，`delegate_task` 返回解释限制的工具错误，而不是静默截断。`max_spawn_depth` 控制委托树深度（限制在 1-3）。默认 `1` 时，委托是扁平的：子级无法生成孙级，传递 `role="orchestrator"` 会静默降级为 `leaf`。提高到 `2` 以便编排器子级可以生成叶子孙级；`3` 用于三级树。代理通过 `role="orchestrator"` 每次调用选择编排；`orchestrator_enabled: false` 强制每个子级回到叶子，无论设置如何。成本按乘法缩放——在 `max_spawn_depth: 3` 且 `max_concurrent_children: 3` 时，树可以达到 3×3×3 = 27 个并发叶子代理。有关使用模式，请参见[子代理委托 → 深度限制和嵌套编排](features/delegation.md#depth-limit-and-nested-orchestration)。

## 澄清

配置澄清提示行为：

```yaml
clarify:
  timeout: 120                 # 等待用户澄清响应的秒数
```

## 上下文文件（SOUL.md、AGENTS.md）

Hermes 使用两种不同的上下文范围：

| 文件 | 用途 | 范围 |
|------|------|------|
| `SOUL.md` | **主要代理身份**——定义代理是谁（系统提示中的第 1 槽位） | `~/.hermes/SOUL.md` 或 `$HERMES_HOME/SOUL.md` |
| `.hermes.md` / `HERMES.md` | 项目特定指令（最高优先级） | 向上查找到 git 根目录 |
| `AGENTS.md` | 项目特定指令、编码规范 | 递归目录遍历 |
| `CLAUDE.md` | Claude Code 上下文文件（也会检测） | 仅工作目录 |
| `.cursorrules` | Cursor IDE 规则（也会检测） | 仅工作目录 |
| `.cursor/rules/*.mdc` | Cursor 规则文件（也会检测） | 仅工作目录 |

- **SOUL.md** 是代理的主要身份。它占据系统提示中的第 1 槽位，完全替换内置默认身份。编辑它以完全自定义代理是谁。
- 如果 SOUL.md 缺失、为空或无法加载，Hermes 回退到内置默认身份。
- **项目上下文文件使用优先级系统**——仅加载一种类型（首次匹配获胜）：`.hermes.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`。SOUL.md 始终独立加载。
- **AGENTS.md** 是分层的：如果子目录也有 AGENTS.md，则全部合并。
- Hermes 如果不存在默认 `SOUL.md` 会自动创建一个。
- 所有加载的上下文文件限制为 20,000 个字符，具有智能截断。

另请参见：
- [个性与 SOUL.md](/docs/user-guide/features/personality)
- [上下文文件](/docs/user-guide/features/context-files)

## 工作目录

| 上下文 | 默认值 |
|--------|--------|
| **CLI（`hermes`）** | 运行命令的当前目录 |
| **消息网关** | 主目录 `~`（通过 `MESSAGING_CWD` 覆盖） |
| **Docker / Singularity / Modal / SSH** | 容器或远程机器中的用户主目录 |

覆盖工作目录：
```bash
# 在 ~/.hermes/.env 或 ~/.hermes/config.yaml 中：
MESSAGING_CWD=/home/myuser/projects    # 网关会话
TERMINAL_CWD=/workspace                # 所有终端会话
```
