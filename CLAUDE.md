# HermesAgent 二次开发

## 仓库结构

- **origin** (`git@github.com:NousResearch/hermes-agent.git`) — 上游官方仓库
- **my-repo** (`git@github.com:DaPengRuYi/HermesAgent.git`) — 私有二次开发仓库

## 分支策略

| 分支 | 用途 | 可写 |
|------|------|------|
| `main` | 二次开发主分支，所有开发工作在此进行 | 是 |
| `upstream/*` | 上游备份分支，保留上游各时间点的快照 | 否（只读） |

## 目录结构

| 目录 | 用途 |
|------|------|
| `research/` | 专属研究目录，存放 CSDN 博客和公众号文章 |

### research/ 目录规范

```
research/
├── CSDN/                          # CSDN 博客文章
│   └── NNN-中文标题.md             # 三位数序号命名
└── 公众号/                         # 微信公众号文章
    └── NNN-中文标题.md
```

## 注意事项

- `upstream/*` 分支是只读的，不要直接提交或修改
- 开发工作统一在 `main` 分支进行
- 提交记录必须使用中文
