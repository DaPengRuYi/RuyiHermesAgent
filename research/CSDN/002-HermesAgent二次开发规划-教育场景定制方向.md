# HermesAgent 二次开发规划：教育场景定制方向

> **项目背景**：基于 NousResearch/hermes-agent v0.11.0 的二次开发，面向大鹏 AI 教育团队的实际需求。

---

## 一、现状分析

### 1.1 上游优势

HermesAgent 已具备的强大基础：

- 完整的 Agent 循环 + 工具系统（40+ 内置工具）
- 多平台消息 Gateway（15+ 平台，含飞书/钉钉/企微）
- 20+ LLM 提供商支持（含国内模型）
- 自改进技能系统 + 多层记忆架构
- 三层安全体系 + MCP/ACP 集成
- Docker 容器化部署

### 1.2 教育场景的差距

从教育 AI 助手的角度看，当前缺失的关键能力：

| 能力 | 现状 | 差距 |
|------|------|------|
| 多用户管理 | 单用户/单会话 | 缺少学生-教师-管理员角色体系 |
| 课程知识 | 通用 RAG | 缺少课程结构化知识管理 |
| 作业系统 | 无 | 缺少作业发布、提交、批改流程 |
| 学习追踪 | 会话历史 | 缺少学习进度和能力画像 |
| 编程环境 | 终端工具 | 缺少在线编程沙箱集成 |
| 评估反馈 | 无 | 缺少自适应评估和个性化反馈 |

---

## 二、二次开发路线图

### Phase 1：基础能力增强（1-2 周）

**目标**：让 HermesAgent 更好地服务中文教育场景

#### 1.1 国内模型深度适配

当前项目已支持小米 MiMo、智谱 GLM、月之暗面 Kimi，但适配深度有限。

**具体工作**：
- 优化国内模型的 function calling schema 兼容性
- 添加百度文心一言、阿里通义千问适配器
- 针对中文教育场景优化系统提示词模板
- 测试各模型在教育场景下的工具调用准确率

**关键文件**：
- `agent/transports/` — 添加新的 transport 适配器
- `agent/model_metadata.py` — 添加模型元数据
- `hermes_cli/models.py` — 注册新模型

#### 1.2 飞书/钉钉深度集成

HermesAgent 已有飞书（197KB）和钉钉（57KB）适配器，可以在此基础上深化：

**具体工作**：
- 利用飞书开放平台的教育相关 API（审批、日历、文档）
- 集成钉钉教育版的班级群、家校通讯录
- 实现消息卡片交互（选择题、填空题的交互式答题）
- 支持群聊中的 @mention 触发

#### 1.3 中文知识库优化

**具体工作**：
- 集成中文向量数据库（Milvus 或 Qdrant）
- 实现中文文档的智能切片（按语义段落而非固定长度）
- 优化中文 FTS5 搜索的分词效果
- 添加教科书、课件的结构化解析

### Phase 2：教育功能开发（2-4 周）

**目标**：构建教育场景核心功能

#### 2.1 课程知识管理系统

开发一个新的技能模块 `skills/education/`：

```
skills/education/
├── SKILL.md                    # 技能元数据
├── course_manager.py           # 课程 CRUD
├── knowledge_graph.py          # 知识图谱管理
├── content_parser.py           # 课件解析（PDF/PPT/Word）
└── quiz_generator.py           # 题目生成
```

**核心能力**：
- 课程目录管理（学科 → 章节 → 知识点）
- 知识点关联图谱（前置知识、相关概念）
- 课件内容自动提取和索引
- 基于知识点的题目自动生成

#### 2.2 作业系统

开发作业相关的工具集 `tools/homework/`：

```python
# tools/homework/registry.py
registry.register(
    name="homework_publish",
    toolset="education",
    schema={...},
    handler=publish_homework,
)

registry.register(
    name="homework_submit",
    toolset="education",
    schema={...},
    handler=submit_homework,
)

registry.register(
    name="homework_grade",
    toolset="education",
    schema={...},
    handler=grade_homework,
)
```

**工作流程**：
1. 教师通过 Agent 发布作业（指定知识点、截止时间、评分标准）
2. 学生通过消息平台提交作业（文本/图片/代码）
3. Agent 自动批改（客观题）或辅助批改（主观题）
4. 生成个性化反馈和改进建议

#### 2.3 学习进度追踪

扩展现有的记忆系统，添加学习画像：

```python
# agent/memory_provider.py 扩展
class LearningProfile:
    student_id: str
    knowledge_mastery: Dict[str, float]  # 知识点掌握度
    learning_style: str                    # 学习风格
    weak_areas: List[str]                  # 薄弱环节
    study_history: List[StudySession]      # 学习历史
    recommendations: List[str]             # 个性化推荐
```

### Phase 3：高级特性（4-8 周）

**目标**：构建差异化竞争优势

#### 3.1 自适应学习引擎

基于学习画像的自适应推荐：

```
学生答题 → 更新知识掌握度 → 识别薄弱环节 → 推荐学习路径
    ↓              ↓              ↓              ↓
  正确/错误    BKT 模型更新    知识图谱分析    个性化题目
```

**技术方案**：
- 使用贝叶斯知识追踪（BKT）模型评估知识掌握度
- 基于知识图谱的先序关系推荐学习路径
- 结合遗忘曲线的复习提醒

#### 3.2 编程教育沙箱

集成在线编程环境：

**方案 A：基于现有终端工具**
- 利用 HermesAgent 的 Docker 终端后端
- 预配置编程语言环境（Python/Java/C++）
- 代码自动评测（单元测试 + 代码风格检查）

**方案 B：集成第三方平台**
- 集成 CodeSandbox / StackBlitz（前端）
- 集成 Judge0（通用代码评测）
- 集成 LeetCode 风格的题目系统

#### 3.3 多模态教学支持

利用 HermesAgent 的 vision 和 image 工具：

- **图片识别**：拍照搜题、手写公式识别
- **图像生成**：生成教学示意图、知识图谱可视化
- **TTS 语音**：朗读题目、语音讲解
- **浏览器自动化**：自动登录在线教育平台、抓取学习资源

#### 3.4 RLHF 教学优化

利用 HermesAgent 的 Atropos RL 集成：

- 收集学生-教师 Agent 交互数据
- 训练更懂教育的 Agent 模型
- 优化 Agent 的教学策略（提问方式、讲解深度、反馈风格）

---

## 三、技术架构设计

### 3.1 教育场景扩展架构

```
┌─────────────────────────────────────────────────────┐
│                   消息平台层                          │
│  飞书 │ 钉钉 │ 企微 │ 微信 │ Web Dashboard           │
├─────────────────────────────────────────────────────┤
│                   Gateway 层                         │
│  角色路由 │ 权限控制 │ 会话管理                        │
├─────────────────────────────────────────────────────┤
│                   Agent 核心                         │
│  AIAgent │ 教育技能 │ 教育工具                        │
├─────────────────────────────────────────────────────┤
│                   教育服务层                          │
│  课程管理 │ 作业系统 │ 学习追踪 │ 自适应引擎           │
├─────────────────────────────────────────────────────┤
│                   数据存储层                          │
│  SQLite │ 向量数据库 │ 知识图谱 │ 文件存储             │
└─────────────────────────────────────────────────────┘
```

### 3.2 多角色支持

在现有 Gateway 的基础上添加角色体系：

```yaml
# config.yaml 扩展
education:
  roles:
    admin:
      - manage_courses
      - manage_teachers
      - view_analytics
    teacher:
      - manage_students
      - publish_homework
      - grade_homework
      - view_progress
    student:
      - submit_homework
      - ask_questions
      - view_progress
      - take_quiz
```

### 3.3 数据模型扩展

```sql
-- 课程表
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT,
    teacher_id TEXT,
    created_at TIMESTAMP
);

-- 知识点表
CREATE TABLE knowledge_points (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER
);

-- 学习记录表
CREATE TABLE learning_records (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    knowledge_point_id TEXT,
    mastery_level REAL,
    timestamp TIMESTAMP
);

-- 作业表
CREATE TABLE homework (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    teacher_id TEXT,
    title TEXT,
    content TEXT,
    deadline TIMESTAMP
);
```

---

## 四、优先级建议

### 高优先级（立即开始）

1. **国内模型适配优化** — 基础能力，影响所有后续开发
2. **飞书/钉钉深度集成** — 教育场景的主要入口
3. **课程知识管理** — 教育核心功能

### 中优先级（Phase 2）

4. **作业系统** — 教育核心功能
5. **学习进度追踪** — 数据驱动的基础
6. **中文知识库优化** — 提升问答质量

### 低优先级（Phase 3）

7. **自适应学习引擎** — 高级特性，需要数据积累
8. **编程教育沙箱** — 特定场景需求
9. **多模态教学** — 锦上添花
10. **RLHF 优化** — 长期投入

---

## 五、风险与注意事项

### 5.1 上游同步

- 保持与上游 `NousResearch/hermes-agent` 的同步能力
- 建议使用 `upstream/*` 分支定期备份上游快照
- 核心修改尽量通过插件/技能方式实现，减少对上游代码的直接修改

### 5.2 合规性

- 教育场景涉及未成年人数据，需要符合《个人信息保护法》
- 作业批改涉及学术诚信，需要设计防作弊机制
- AI 辅助教学需要明确标注，避免学生过度依赖

### 5.3 性能

- 多用户并发场景下的性能优化
- 大规模知识库的检索效率
- 消息平台的 API 调用频率限制

---

> **作者**：大鹏 AI 教育团队
> **日期**：2026-04-26
> **状态**：规划阶段
