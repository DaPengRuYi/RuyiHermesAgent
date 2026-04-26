# 可选技能

由 Nous Research 维护的**默认未激活**的官方技能。

这些技能随 hermes-agent 仓库发布，但设置期间不会复制到 `~/.hermes/skills/`。它们可通过技能中心发现：

```bash
hermes skills browse               # 浏览所有技能，官方技能优先显示
hermes skills browse --source official  # 仅浏览官方可选技能
hermes skills search <query>       # 查找标记为 "official" 的可选技能
hermes skills install <identifier> # 复制到 ~/.hermes/skills/ 并激活
```

## 为什么是可选的？

一些技能有用但并非每个用户都需要：

- **小众集成**——特定付费服务、专业工具
- **实验性功能**——有前景但尚未验证
- **重量级依赖**——需要大量设置（API 密钥、安装）

通过保持它们的可选性，我们保持默认技能集精简，同时为需要的用户提供精选的、经过测试的官方技能。
