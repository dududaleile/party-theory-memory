# 党课理论知识智能记忆系统 — 数据库与状态设计

---

## 文档信息

| 项 | 内容 |
|---|------|
| 版本 | v1.0 |
| 日期 | 2026-06-09 |
| 数据库 | IndexedDB（Dexie.js 封装） |
| 状态管理 | Zustand + persist 中间件 |
| 设计原则 | 一张表一个实体 · 冗余可控 · 查询优先 · 离线完整 |

---

# 第一部分：IndexedDB Schema

## 1.1 表总览

```
┌──────────────────────────────────────────────────────────┐
│                    IndexedDB: partyTheoryDB               │
│                                                          │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ knowledgeDomains│  │knowledgePoints│  │ memoryCards  │ │
│  │    (领域树)     │  │   (知识点)    │  │  (记忆卡片)   │ │
│  └────────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│           │                 │                  │          │
│           │          ┌──────┴───────┐          │          │
│           │          │              │          │          │
│           ▼          ▼              ▼          ▼          │
│  ┌────────────┐ ┌────────┐ ┌────────────┐ ┌───────────┐ │
│  │reviewLogs  │ │source  │ │confusing   │ │essay      │ │
│  │ (复习记录)  │ │Texts   │ │Pairs       │ │Skeletons  │ │
│  │            │ │(来源)   │ │(易混概念)   │ │(论述骨架)  │ │
│  └────────────┘ └────────┘ └────────────┘ └───────────┘ │
│                                                          │
│  ┌────────────┐ ┌──────────────┐                         │
│  │knowledge   │ │aiRefinement  │                         │
│  │Relations   │ │Rounds        │                         │
│  │(知识关联)   │ │(AI提炼轮次)  │                         │
│  └────────────┘ └──────────────┘                         │
│                                                          │
│  ┌────────────┐                                          │
│  │userSettings│                                          │
│  │ (用户设置)  │                                          │
│  └────────────┘                                          │
└──────────────────────────────────────────────────────────┘

共 9 张表。
```

---

## 1.2 knowledgeDomains — 知识领域表

### 用途

存储党课知识的层级分类结构。这是一棵**树**，每个节点可以有自己的子节点。

### Schema

```typescript
interface KnowledgeDomain {
  id: string;                    // UUID v7（时间排序 + 唯一）
  name: string;                  // 领域名称，如 "习近平新时代中国特色社会主义思想"
  description: string;           // 领域简介（可选，AI 生成或手动填写）
  parentId: string | null;       // 父领域 ID，null = 根节点
  order: number;                 // 同级排序权重（数字越小越靠前）
  color: string | null;          // 领域代表色（HEX），用于知识图谱节点着色
  icon: string | null;           // 领域图标（emoji 或 icon name）
  createdAt: number;             // 创建时间戳（Unix ms）
  updatedAt: number;             // 最后修改时间戳

  // ── 聚合统计（冗余字段，避免每次查询计算）──
  totalPoints: number;           // 该领域及其子领域的知识点总数
  masteredPoints: number;        // 该领域及其子领域的已掌握知识点数
  // mastered 定义：domain 下所有 card 中 ease >= 2.5 且 reps >= 5 的卡片数
}
```

### 索引

```typescript
// Dexie schema
knowledgeDomains: "&id, parentId, order, [parentId+order]"
```

### 层级示例

```
id: "root-xi-thought"
  name: "习近平新时代中国特色社会主义思想"
  parentId: null
  ├── id: "sub-core-essence"
  │     name: "核心要义"
  │     parentId: "root-xi-thought"
  │     ├── id: "leaf-develop-socialism"
  │     │     name: "坚持和发展中国特色社会主义"
  │     │     parentId: "sub-core-essence"
  │     └── id: "leaf-great-rejuvenation"
  │           name: "实现中华民族伟大复兴"
  │           parentId: "sub-core-essence"
  │
  ├── id: "sub-eight-clears"
  │     name: "八个明确"
  │     parentId: "root-xi-thought"
  │     ├── id: "leaf-clear-1"
  │     │     ...
  │     └── id: "leaf-clear-8"
  │
  └── id: "sub-fourteen-persists"
        name: "十四个坚持"
        parentId: "root-xi-thought"
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| parentId 而非邻接表 | 党课知识天然是树状结构（领域→子领域→知识点），parentId 最直观、查询最简单 |
| totalPoints / masteredPoints 冗余 | 首页需要频繁展示领域掌握度，每次实时聚合所有子孙节点成本太高（递归遍历 IndexedDB 很慢） |
| order 字段 | 允许用户或 AI 控制知识点的学习顺序。先学根概念，再学叶子细节 |
| color 字段 | 知识图谱中同一领域的节点使用相同颜色，视觉聚类 |
| UUID v7 | 时间排序的 UUID，在 IndexedDB 中天然按创建时间有序，方便分页和游标查询 |

---

## 1.3 knowledgePoints — 知识点表

### 用途

存储从党课文本中提取的**每一个独立知识点**。这是知识的最小语义单元，是记忆卡片的母体。

### Schema

```typescript
interface KnowledgePoint {
  id: string;                    // UUID v7
  domainId: string;              // 所属领域 ID（外键 → knowledgeDomains.id）
  parentPointId: string | null;  // 父知识点 ID（知识点之间也可以有父子关系）

  // ── 知识点内容 ──
  title: string;                 // 知识点标题，如 "四个全面的战略布局"
  question: string;              // 问题表述（作为记忆卡片正面），如 "四个全面的战略布局是指？"
  answer: string;                // 标准答案（完整准确），如 "全面建设社会主义现代化国家、全面深化改革、全面依法治国、全面从严治党"
  answerBrief: string;           // 答案摘要（≤50 字），用于列表预览
  keywords: string[];            // 关键词数组，如 ["四个全面", "战略布局", "现代化", "深化改革", "依法治国", "从严治党"]

  // ── 元数据 ──
  difficulty: number;            // 难度预估 1-5（AI 初次评估）
  questionType: QuestionType;    // 题型标记
  tags: string[];                // 自定义标签（用户或 AI 添加），如 ["高频考点", "选择题常考"]

  // ── 来源追踪 ──
  sourceTextId: string | null;   // 来源文本 ID（外键 → sourceTexts.id）
  sourceTextIndex: number | null;// 在来源文本中的段落/句子序号（用于溯源）
  sourceTextQuote: string | null;// 对应的原文片段（用于溯源展示）

  // ── 逻辑树位置 ──
  treePath: string[];            // 从根领域到当前知识点的完整路径 ID 数组
                                 // 如 ["root-xi", "sub-core", "leaf-clear-1"]
                                 // 冗余字段，避免递归查询

  // ── AI 提炼校验 ──
  refinementRoundId: string | null;  // 最后一次提炼轮次 ID
  refinementStatus: RefinementStatus; // 提炼状态
  confidence: number;                // AI 对该知识点提取质量的置信度 0-1

  // ── 时间戳 ──
  createdAt: number;
  updatedAt: number;
}

type QuestionType =
  | "concept"       // 概念题：记忆定义、内涵
  | "list"          // 列举题：记住多个并列项
  | "essay"         // 论述题：需要结构化展开
  | "compare";      // 辨析题：区分相似概念

type RefinementStatus =
  | "draft"         // 草稿（第一轮提取，未校验）
  | "reviewed"      // 已逐句校验
  | "merged"        // 已合并去重
  | "confirmed"     // 用户已确认
  | "modified";     // 用户已修改
```

### 索引

```typescript
knowledgePoints: "&id, domainId, parentPointId, difficulty, questionType, refinementStatus, [domainId+difficulty]"
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| domainId + parentPointId 双层挂载 | 知识点首先属于领域，其次知识点之间可以有父子关系（如「四个全面」是父，「全面从严治党」是子）。这支持了复杂的逻辑树 |
| answer + answerBrief | 完整答案用于翻转后的详细展示，摘要用于列表页快速预览。卡片列表不需要加载完整答案，节省渲染内存 |
| sourceTextId + sourceTextIndex + sourceTextQuote | **来源追踪三件套**——AI 提炼的每一句话都能追溯到原文出处。这是「多轮校验」的基础：第二轮 Prompt 需要原文句子编号才能逐句比对 |
| treePath 冗余数组 | 从根到叶的完整路径。树深度一般 ≤ 4，这个数组很短。用它在首页快速计算领域掌握度，避免递归查父查子 |
| refinementStatus + confidence | AI 多轮提炼的产物标记。用户可以过滤查看「仅已确认」或「待审核」的知识点 |
| difficulty + questionType | 决定卡片生成策略。论述题需要 AI 判分模式，概念题只需自评模式 |

---

## 1.4 memoryCards — 记忆卡片表

### 用途

这是**用户实际交互的单元**。每张卡片承载一个知识点，拥有独立的 SM-2 算法参数，是间隔重复引擎的核心数据结构。

### Schema

```typescript
interface MemoryCard {
  id: string;                    // UUID v7
  pointId: string;               // 对应的知识点 ID（外键 → knowledgePoints.id）
                                 // 一个知识点可以生成多张卡片，但通常 1:1

  // ── 学习状态（SM-2 改进算法核心参数）──
  easeFactor: number;            // 舒适度因子，初始 2.5，范围 [1.3, ∞)
  interval: number;              // 当前间隔（天），小数支持（如 0.0035 = 5 分钟）
  repetitions: number;           // 连续正确次数
  nextReview: number | null;     // 下次复习时间戳（Unix ms），null = 从未学过
  lastReview: number | null;     // 上次复习时间戳（Unix ms）

  // ── 记忆强度 ──
  memoryStrength: number;        // 记忆强度 0-100（综合计算值，用于排序和展示）
                                 // 计算公式见下方

  // ── 学习阶段 ──
  learningPhase: LearningPhase;  // 当前学习阶段

  // ── 复习状态标记 ──
  isWeak: boolean;               // 是否为薄弱点
  weakSince: number | null;      // 标记为薄弱点的时间戳
  weakReason: string | null;     // 薄弱原因（AI 分析结果）
  consecutiveErrors: number;     // 连续错误次数

  // ── 历史快照（最近 N 条，方便快速展示）──
  recentRatings: number[];       // 最近 5 次评分（0-5），最新在末尾
  totalReviews: number;          // 累计复习次数
  totalCorrect: number;          // 累计正确次数（quality >= 3）

  // ── 时间戳 ──
  createdAt: number;
  updatedAt: number;
}

type LearningPhase =
  | "new"           // 从未学习
  | "encoding"      // 编码期：首次学习后 5min-12h（短间隔密集复习）
  | "consolidating" // 巩固期：1d-7d 中等间隔
  | "retrieving"    // 提取期：15d-60d 长间隔
  | "mastered";     // 自动化期：60d+ 极长间隔，视为已掌握

// ── memoryStrength 计算 ──
// memoryStrength = 基础分 + 间隔奖励 + 正确率奖励
// 基础分 = easeFactor / 3.0 * 40    (最大 40 分)
// 间隔奖励 = min(interval / 120, 1) * 30  (间隔越长越牢固，最大 30 分)
// 正确率奖励 = (totalCorrect / max(totalReviews, 1)) * 30  (最大 30 分)
// 范围 clamp 到 [0, 100]
```

### 索引

```typescript
memoryCards: "&id, pointId, nextReview, learningPhase, isWeak, [nextReview+learningPhase]"
```

### 查询用途

```typescript
// 查询 1：获取到期复习卡片（复习页核心查询）
db.memoryCards
  .where("nextReview").below(Date.now())
  .and(card => card.nextReview !== null)
  .sortBy("nextReview");

// 查询 2：获取薄弱卡片（重点强化页核心查询）
db.memoryCards
  .where("isWeak").equals(true)
  .sortBy("consecutiveErrors"); // 最差的排最前

// 查询 3：获取未学习卡片（学习页核心查询）
db.memoryCards
  .where("nextReview").equals(null)
  .toArray();

// 查询 4：获取某个领域的学习进度
db.memoryCards
  .where("pointId").anyOf(pointIds) // pointIds = 该领域所有知识点
  .toArray();
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| SM-2 参数全部冗余在卡片上 | 复习时只查 memoryCards 一张表，不需要 JOIN。IndexedDB 不是关系型数据库，跨表关联很慢 |
| interval 支持小数 | 首次学习的短间隔（5min = 0.0035 天、30min = 0.021 天、12h = 0.5 天）必须用小数表示 |
| learningPhase 冗余 | 虽然可以从 interval + repetitions 推导，但作为枚举字段可以直接建索引，查询「所有巩固期卡片」很快 |
| isWeak + consecutiveErrors | 薄弱点判定需要这两个字段。每次评分后更新，Zustand 层也实时感知 |
| recentRatings 数组 | 限制长度为 5。首页和复习页展示历史正确率只需要最近 5 次，不需要查 reviewLogs 表 |
| memoryStrength | 综合评分，用于首页和知识图谱的节点大小映射。计算逻辑固定，不依赖 AI |
| totalReviews / totalCorrect | 汇总统计，与 recentRatings 互补。长期正确率 vs 近期表现 |

---

## 1.5 reviewLogs — 复习记录表

### 用途

记录每一次复习的完整日志。这是数据最密集的表，也是未来分析记忆模式的数据基础。

### Schema

```typescript
interface ReviewLog {
  id: string;                    // UUID v7
  cardId: string;                // 卡片 ID（外键 → memoryCards.id）
  pointId: string;               // 知识点 ID（冗余，方便按知识点聚合查询）

  // ── 评分数据 ──
  quality: number;               // 用户自评 0-5
  userAnswer: string | null;     // 用户输入的答案（论述题模式）
  aiScore: number | null;        // AI 判分 0-100（论述题模式）
  aiCovered: string[] | null;    // AI 判定已覆盖的要点
  aiMissing: string[] | null;    // AI 判定遗漏的要点
  aiSuggestion: string | null;   // AI 改进建议

  // ── 间隔数据（记录当时的算法状态）──
  easeBefore: number;            // 评分前的 easeFactor
  easeAfter: number;             // 评分后的 easeFactor
  intervalBefore: number;        // 评分前的间隔
  intervalAfter: number;         // 评分后的间隔

  // ── 元数据 ──
  timeSpent: number;             // 用户在该卡片上的停留时间（秒）
  reviewedAt: number;            // 复习时间戳（Unix ms）
  source: ReviewSource;          // 来源
}

type ReviewSource =
  | "learn"       // 学习页
  | "review"      // 复习页
  | "focus"       // 重点强化页
  | "domain";     // 领域专属学习
```

### 索引

```typescript
reviewLogs: "&id, cardId, pointId, reviewedAt, [cardId+reviewedAt]"
```

### 查询用途

```typescript
// 查询 1：某张卡片的历史记录（复习页展示历史正确率）
db.reviewLogs
  .where("cardId").equals(cardId)
  .reverse()
  .sortBy("reviewedAt");

// 查询 2：某天的所有复习记录（首页持续天数计算）
db.reviewLogs
  .where("reviewedAt").between(dayStart, dayEnd)
  .count();

// 查询 3：最近 30 天复习统计（设置页数据统计）
db.reviewLogs
  .where("reviewedAt").above(thirtyDaysAgo)
  .toArray();

// 查询 4：按知识点聚合正确率
db.reviewLogs
  .where("pointId").equals(pointId)
  .toArray()
  .then(logs => {
    const total = logs.length;
    const correct = logs.filter(l => l.quality >= 3).length;
    return correct / total;
  });
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| easeBefore/After + intervalBefore/After | 记录算法状态变化，用于调试和优化算法参数。未来可以分析「什么样的 easeFactor 变化模式预示着薄弱点」 |
| pointId 冗余 | 避免跨表查询。复习统计经常以知识点维度聚合 |
| userAnswer + aiScore 等字段 | 论述题判分结果需要持久化，用户以后可以回顾自己的答案和 AI 反馈 |
| timeSpent | 停留时间 + 评分 可以分析用户的学习行为模式 |
| source 枚举 | 区分复习来源，未来可以分析「从重点强化页发起的复习是否比普通复习效果更好」 |
| 不存完整卡片数据 | 卡片数据随时在变（easeFactor、interval），历史记录不需要冗余当时的卡片内容——卡片内容属于 knowledgePoints 表 |

---

## 1.6 sourceTexts — 来源文本表

### 用途

记录用户导入的原始党课文本。多轮 AI 提炼需要反复读取原文进行逐句比对。

### Schema

```typescript
interface SourceText {
  id: string;                    // UUID v7
  title: string;                 // 文本标题（文件名或用户输入）
  content: string;               // 完整原始文本
  sentences: string[];           // 逐句拆分（用于 AI 逐句比对）
                                 // 保留序号，如 sentences[0] = 第一句

  // ── 导入元数据 ──
  importMethod: "paste" | "file";
  fileName: string | null;       // 原始文件名（如果是文件导入）
  charCount: number;             // 总字数
  sentenceCount: number;         // 句子数

  // ── 提炼状态 ──
  extractionStatus: ExtractionStatus;
  extractedPointIds: string[];   // 从该文本提取的知识点 ID 列表

  createdAt: number;
  updatedAt: number;
}

type ExtractionStatus =
  | "raw"           // 已导入，未提炼
  | "extracting"    // 提炼中
  | "extracted"     // 第一轮提炼完成
  | "reviewed"      // 第二轮逐句校验完成
  | "merged"        // 第三轮合并去重完成
  | "confirmed";    // 用户已确认
```

### 索引

```typescript
sourceTexts: "&id, extractionStatus, createdAt"
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| sentences[] 数组 | AI 第二轮提炼的 Prompt 需要「逐句编号」的原文。提前拆分好，避免每次调用 AI 时重新分词 |
| extractionStatus | 控制 AI 提炼流程的状态机。每个状态对应一个提炼轮次 |
| extractedPointIds | 方便追溯「这个知识点来自哪个文本」，也方便删除源文本时级联处理 |
| 不存 AI 提炼中间产物 | 中间产物放在 aiRefinementRounds 表，sourceTexts 只关注文本本身 |

---

## 1.7 aiRefinementRounds — AI 提炼轮次表

### 用途

记录 AI 多轮提炼的每一轮输入输出。这是「宁可多，不可漏」原则的数据保障。

### Schema

```typescript
interface AIRefinementRound {
  id: string;                    // UUID v7
  sourceTextId: string;          // 来源文本 ID

  // ── 轮次信息 ──
  round: number;                 // 轮次编号 1/2/3
  roundType: RefinementRoundType;
  status: "pending" | "running" | "completed" | "failed";

  // ── AI 调用信息 ──
  modelProvider: string;         // "openai" | "anthropic"
  modelName: string;             // "gpt-4o" | "claude-opus-4-8"
  promptTemplate: string;        // 使用的 Prompt 模板名称
  inputTokens: number;           // 消耗的输入 token 数
  outputTokens: number;          // 消耗的输出 token 数
  latency: number;               // 响应时间（ms）

  // ── 输入输出 ──
  input: string;                 // 发送给 AI 的完整 Prompt（用于调试）
  outputRaw: string;             // AI 原始输出（JSON 字符串，用于解析失败回溯）
  outputParsed: object | null;   // 解析后的 JSON 对象

  // ── 遗漏检测结果（第二轮特有）──
  missedItems: MissedItem[] | null;

  // ── 错误信息 ──
  errorMessage: string | null;   // 失败时的错误信息
  retryCount: number;            // 重试次数

  createdAt: number;
  completedAt: number | null;
}

type RefinementRoundType =
  | "extract"         // 第一轮：初次提取
  | "audit"           // 第二轮：逐句比对遗漏检查
  | "merge";          // 第三轮：合并去重修正

interface MissedItem {
  sentenceIndex: number;         // 遗漏的句子编号
  content: string;               // 遗漏内容
  suggestion: string;            // AI 建议（如何整合）
}
```

### 索引

```typescript
aiRefinementRounds: "&id, sourceTextId, round, [sourceTextId+round]"
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| 每轮独立存储 | 三轮提炼是三个独立 AI 调用，每轮有独立的 Prompt、输入、输出。分开存储可以独立重试某一轮 |
| promptTemplate + input/output 完整保存 | 这是可解释性的基础。如果用户发现某个知识点提炼有误，可以回溯到具体的 Prompt 和 AI 输出，优化 Prompt 模板 |
| missedItems | 第二轮的核心产物。这个数组直接驱动第三轮的合并逻辑 |
| token + latency 记录 | 成本追踪。用户可以知道自己为 AI 提炼花了多少钱 |
| outputRaw + outputParsed | AI 输出可能 JSON 解析失败。保留原始字符串可以手动恢复或重试 |

---

## 1.8 confusingPairs — 易混概念对表

### 用途

存储 AI 识别的易混淆知识点对，以及 AI 生成的区分说明。

### Schema

```typescript
interface ConfusingPair {
  id: string;                    // UUID v7
  pointAId: string;              // 知识点 A 的 ID
  pointBId: string;              // 知识点 B 的 ID

  // ── AI 分析结果 ──
  similarity: string;            // 相似之处（为什么容易混淆）
  distinction: string;           // 区分要点（如何辨别）
  mnemonic: string | null;       // 记忆技巧（可选）

  // ── 元数据 ──
  confidence: number;            // AI 判断这对概念确实易混淆的置信度 0-1
  generatedBy: string;           // 生成方式："ai" | "manual" | "error_driven"
                                 // ai = AI 主动扫描发现
                                 // manual = 用户手动标记
                                 // error_driven = 用户频繁在这两个概念上出错后 AI 自动生成

  createdAt: number;
  updatedAt: number;
}
```

### 索引

```typescript
confusingPairs: "&id, pointAId, pointBId, confidence, generatedBy"
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| 只存两个 ID + AI 分析，不存完整知识点内容 | 知识点内容属于 knowledgePoints 表。避免数据不一致（知识点内容可能被用户编辑） |
| generatedBy 三种来源 | AI 主动扫描是日常维护，error_driven 是精准打击——用户实际出错驱动的识别比 AI 猜测更有价值 |
| mnemonic 独立字段 | 记忆技巧是可选的增值内容，与区分要点分开存储方便前端按需展示 |

---

## 1.9 essaySkeletons — 论述骨架表

### 用途

AI 生成的论述题答题框架。

### Schema

```typescript
interface EssaySkeleton {
  id: string;                    // UUID v7
  pointId: string | null;        // 关联的知识点 ID（如果是某个知识点触发生成的）
  title: string;                 // 骨架标题，如 "论全面从严治党"

  // ── 骨架结构 ──
  thesis: string;                // 总论点（核心观点，一句话）
  arguments: EssayArgument[];    // 分论点数组（3-4 个）
  conclusion: string;            // 结论
  keyTerms: string[];            // 关键术语列表

  // ── 元数据 ──
  modelProvider: string;
  modelName: string;
  generatedBy: string;           // "ai" | "manual"

  createdAt: number;
  updatedAt: number;
}

interface EssayArgument {
  order: number;                 // 序号 1/2/3/4
  title: string;                 // 分论点标题，如 "政治建设是根本"
  content: string;               // 分论点展开内容
  keywords: string[];            // 该分论点的关键词
  relatedPointIds: string[];     // 关联的知识点 ID（用于链接到具体卡片）
}
```

### 索引

```typescript
essaySkeletons: "&id, pointId, title, createdAt"
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| EssayArgument.relatedPointIds | 每个分论点链接到具体的知识点卡片。用户在查看骨架时可以直接跳转学习该知识点 |
| thesis / arguments / conclusion 三段式 | 匹配考试论述题的「总-分-总」标准结构。AI 按照这个格式生成，用户按照这个格式输出 |
| 不存完整论述文 | 骨架 = 框架，不是范文。避免用户背诵范文而非理解结构 |

---

## 1.10 knowledgeRelations — 知识关联表

### 用途

存储知识点之间的语义关系边，用于知识图谱绘制。这是知识图谱的「边」表。

### Schema

```typescript
interface KnowledgeRelation {
  id: string;                    // UUID v7
  sourcePointId: string;         // 源知识点 ID
  targetPointId: string;         // 目标知识点 ID

  // ── 关系类型 ──
  relationType: RelationType;

  // ── 关系强度 ──
  strength: number;              // 关系强度 0-1（决定知识图谱中连线的粗细）

  // ── 关系说明 ──
  description: string | null;    // 关系描述文本

  // ── 来源 ──
  generatedBy: "ai" | "manual";

  createdAt: number;
}

type RelationType =
  | "parent_child"      // 父子关系（逻辑树中天然存在）
  | "prerequisite"      // 前置关系（学 A 之前需要先学 B）
  | "related"           // 一般关联（语义相关）
  | "contradicts"       // 辨析关系（易混淆）
  | "extends";          // 扩展关系（B 是 A 的深化）
```

### 索引

```typescript
knowledgeRelations: "&id, sourcePointId, targetPointId, relationType, [sourcePointId+relationType]"
```

### 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| 独立边表 | 知识图谱是图结构，不能仅靠 parentId 树。有些知识点在逻辑树中不在同一分支，但语义相关 |
| relationType 枚举 | 不同类型的边在知识图谱中用不同线型呈现（实线 = 父子，虚线 = 关联） |
| strength | 知识图谱中的连线粗细映射，视觉上区分强关联和弱关联 |
| AI 自动生成 | 知识导入时 AI 可以分析知识点之间的关联并自动创建边 |

---

## 1.11 userSettings — 用户设置表

### 用途

存储用户偏好设置。用 key-value 模式而非固定列，方便扩展。

### Schema

```typescript
interface UserSettings {
  key: string;                   // 设置键（主键）
  value: any;                    // 设置值（任意类型）
  updatedAt: number;
}

// 预定义的设置键
type SettingsKeys =
  | "aiProvider"            // "openai" | "anthropic" | "custom"
  | "aiModel"               // "gpt-4o" | "claude-opus-4-8" | ...
  | "aiBaseUrl"             // 自定义 API 地址
  | "aiEncryptedKey"        // 加密后的 API Key
  | "dailyNewCardLimit"     // 每日新卡片数 默认 10
  | "dailyReviewLimit"      // 每日复习上限 默认 50
  | "reminderTime"          // 提醒时间 "08:00"
  | "reminderEnabled"       // 提醒开关 true/false
  | "firstLearningIntervals" // 首次学习间隔 [5, 30, 720]（分钟）
  | "theme"                 // "light" | "dark" | "system"（V2）
  | "lastBackupDate";       // 上次备份日期
```

### 索引

```typescript
userSettings: "&key"
```

### 为什么这样设计

| 设计决策 | 理由 |
|------|------|
| Key-Value 模式 | 设置项会随着版本迭代增减。固定列需要数据库迁移，key-value 直接插入新键即可 |
| aiEncryptedKey 独立键 | API Key 使用 Web Crypto API 加密后存储，只有使用时才解密 |
| 手动索引 | 只按 key 查询，不需要其他索引 |

---

## 1.12 完整 Dexie Schema 定义

```typescript
// db/schema.ts
import Dexie, { type Table } from "dexie";

class PartyTheoryDB extends Dexie {
  knowledgeDomains!: Table<KnowledgeDomain, string>;
  knowledgePoints!: Table<KnowledgePoint, string>;
  memoryCards!: Table<MemoryCard, string>;
  reviewLogs!: Table<ReviewLog, string>;
  sourceTexts!: Table<SourceText, string>;
  aiRefinementRounds!: Table<AIRefinementRound, string>;
  confusingPairs!: Table<ConfusingPair, string>;
  essaySkeletons!: Table<EssaySkeleton, string>;
  knowledgeRelations!: Table<KnowledgeRelation, string>;
  userSettings!: Table<UserSettings, string>;

  constructor() {
    super("partyTheoryDB");

    this.version(1).stores({
      knowledgeDomains:    "&id, parentId, order, [parentId+order]",
      knowledgePoints:     "&id, domainId, parentPointId, difficulty, questionType, refinementStatus, [domainId+difficulty]",
      memoryCards:         "&id, pointId, nextReview, learningPhase, isWeak, [nextReview+learningPhase]",
      reviewLogs:          "&id, cardId, pointId, reviewedAt, [cardId+reviewedAt]",
      sourceTexts:         "&id, extractionStatus, createdAt",
      aiRefinementRounds:  "&id, sourceTextId, round, [sourceTextId+round]",
      confusingPairs:      "&id, pointAId, pointBId, confidence, generatedBy",
      essaySkeletons:      "&id, pointId, title, createdAt",
      knowledgeRelations:  "&id, sourcePointId, targetPointId, relationType, [sourcePointId+relationType]",
      userSettings:        "&key",
    });
  }
}

export const db = new PartyTheoryDB();
```

---

# 第二部分：Zustand 状态管理

## 2.1 Store 总览

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand Stores                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ domainStore  │  │  learnStore  │  │ reviewStore  │  │
│  │              │  │              │  │              │  │
│  │ 领域树       │  │ 学习会话     │  │ 复习队列     │  │
│  │ 领域掌握度   │  │ 当前卡片     │  │ 当前卡片     │  │
│  │              │  │ 进度         │  │ AI 判分      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  focusStore  │  │settingsStore │  │    uiStore   │  │
│  │              │  │              │  │              │  │
│  │ 易混概念列表 │  │ 设置键值对   │  │ Toast        │  │
│  │ 薄弱卡片列表 │  │ AI 配置      │  │ Loading      │  │
│  │ 论述骨架列表 │  │              │  │ 当前路由     │  │
│  │ 知识图谱数据 │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘

6 个 Store。
所有 Store 都不持久化到 localStorage（数据在 IndexedDB）。
Store 是 IndexedDB 的「内存缓存 + 业务逻辑层」。
```

## 2.2 核心设计原则

```
数据流向：
  IndexedDB  ←→  Zustand Store  ←→  React Component
   (持久层)       (状态层)          (视图层)

规则：
  1. 所有写操作直接写 IndexedDB，然后更新 Store
  2. 所有读操作从 Store 读（Store 启动时从 IndexedDB 加载）
  3. Store 不做持久化（Zustand persist 中间件仅用于 uiStore 的 Tab 状态）
  4. 复杂查询（聚合、统计）在 Store 的 action 中完成
  5. Store 之间不直接引用，通过自定义 hook 桥接
```

## 2.3 domainStore — 领域状态

```typescript
// stores/domainStore.ts
interface DomainStore {
  // ── 状态 ──
  domains: KnowledgeDomain[];           // 所有领域（扁平数组）
  domainTree: TreeNode[];               // 领域树（从扁平数组构建的树结构）
  domainMap: Record<string, KnowledgeDomain>; // 快速查找 Map
  points: KnowledgePoint[];             // 所有知识点（扁平数组）
  pointsByDomain: Record<string, KnowledgePoint[]>; // 按领域分组

  // ── 加载 ──
  loadAll: () => Promise<void>;         // 从 IndexedDB 加载全部数据并构建树
  buildTree: () => void;                // 从 domains 数组构建 domainTree

  // ── 领域 CRUD ──
  addDomain: (domain: Omit<KnowledgeDomain, "id" | "createdAt" | "updatedAt" | "totalPoints" | "masteredPoints">) => Promise<string>;
  updateDomain: (id: string, updates: Partial<KnowledgeDomain>) => Promise<void>;
  deleteDomain: (id: string) => Promise<void>;  // 级联删除子领域和知识点
  reorderDomain: (id: string, newOrder: number) => Promise<void>;

  // ── 知识点 CRUD ──
  addPoint: (point: Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updatePoint: (id: string, updates: Partial<KnowledgePoint>) => Promise<void>;
  deletePoint: (id: string) => Promise<void>;  // 级联删除关联卡片、复习记录

  // ── 查询 ──
  getDomainPath: (domainId: string) => KnowledgeDomain[]; // 获取从根到该领域的路径
  getDomainMastery: (domainId: string) => { total: number; mastered: number; percentage: number };
  getPointsForDomain: (domainId: string) => KnowledgePoint[];
  getAllPointsFlat: () => KnowledgePoint[];

  // ── AI 提炼后批量导入 ──
  bulkImport: (domains: KnowledgeDomain[], points: KnowledgePoint[]) => Promise<void>;
}

interface TreeNode {
  domain: KnowledgeDomain;
  children: TreeNode[];
  depth: number;
  mastery: { total: number; mastered: number; percentage: number };
}
```

### 构建 domainTree 的逻辑

```typescript
buildTree: () => {
  const { domains, points, memoryCards } = get();

  // 1. 按 parentId 分组
  const childrenMap: Record<string, KnowledgeDomain[]> = {};
  domains.forEach(d => {
    const pid = d.parentId ?? "__root__";
    if (!childrenMap[pid]) childrenMap[pid] = [];
    childrenMap[pid].push(d);
  });

  // 2. 递归构建树节点
  function buildNode(domain: KnowledgeDomain, depth: number): TreeNode {
    const children = (childrenMap[domain.id] || [])
      .sort((a, b) => a.order - b.order)
      .map(child => buildNode(child, depth + 1));

    // 3. 计算该领域的掌握度（递归聚合子节点）
    const domainPointIds = new Set(
      points
        .filter(p => p.domainId === domain.id || isDescendant(p.domainId, domain.id))
        .map(p => p.id)
    );
    const cards = memoryCards.filter(c => domainPointIds.has(c.pointId));
    const mastered = cards.filter(c => c.learningPhase === "mastered").length;

    return {
      domain,
      children,
      depth,
      mastery: {
        total: cards.length,
        mastered,
        percentage: cards.length > 0 ? Math.round((mastered / cards.length) * 100) : 0,
      },
    };
  }

  const rootDomains = childrenMap["__root__"] || [];
  const domainTree = rootDomains
    .sort((a, b) => a.order - b.order)
    .map(d => buildNode(d, 0));

  set({ domainTree });
}
```

---

## 2.4 learnStore — 学习状态

```typescript
// stores/learnStore.ts
interface LearnStore {
  // ── 会话状态 ──
  isActive: boolean;                    // 是否处于学习会话中
  mode: LearnMode;                      // 学习模式
  newCards: MemoryCard[];               // 待学习的新卡片队列（memoryCards where nextReview = null）
  currentIndex: number;                 // 当前卡片在队列中的索引
  currentCard: MemoryCard | null;       // 当前卡片（从 newCards[currentIndex] 派生）
  currentPoint: KnowledgePoint | null;  // 当前卡片对应的知识点

  // ── 卡片交互状态 ──
  isFlipped: boolean;                   // 卡片是否已翻转
  isAnimating: boolean;                 // 是否正在动画中

  // ── 会话统计 ──
  sessionStartTime: number;             // 会话开始时间
  sessionStats: {
    total: number;
    completed: number;
    ratings: Record<number, number>;    // { 0: 1, 2: 2, 4: 4, 5: 3 } 评分分布
  };

  // ── 限制 ──
  dailyLimit: number;                   // 每日新卡片上限
  todayLearnedCount: number;            // 今天已学习的新卡片数

  // ── 动作 ──
  startSession: (mode: LearnMode, domainId?: string) => Promise<void>;
  flipCard: () => void;                  // 翻转卡片
  rateCard: (quality: number) => Promise<void>;  // 评分（触发 SM-2 更新 + 写 IndexedDB）
  nextCard: () => void;                  // 加载下一张
  endSession: () => void;                // 结束会话
  resetSession: () => void;              // 重置会话状态

  // ── 检查 ──
  checkDailyLimit: () => boolean;        // 是否已达每日上限
}

type LearnMode =
  | "all"              // 全部新卡片
  | "domain"           // 按领域
  | "single";          // 单个知识点
```

### 评分动作的核心逻辑

```typescript
rateCard: async (quality: number) => {
  const { currentCard, sessionStats } = get();
  if (!currentCard || get().isAnimating) return;

  set({ isAnimating: true });

  // 1. SM-2 算法计算新参数
  const sm2Result = computeSM2(currentCard, quality);

  // 2. 更新卡片到 IndexedDB
  await db.memoryCards.update(currentCard.id, {
    easeFactor: sm2Result.easeFactor,
    interval: sm2Result.interval,
    repetitions: sm2Result.repetitions,
    nextReview: Date.now() + sm2Result.interval * 86400000,
    lastReview: Date.now(),
    learningPhase: sm2Result.phase,
    isWeak: sm2Result.isWeak,
    consecutiveErrors: sm2Result.consecutiveErrors,
    recentRatings: [...currentCard.recentRatings.slice(-4), quality],
    totalReviews: currentCard.totalReviews + 1,
    totalCorrect: currentCard.totalCorrect + (quality >= 3 ? 1 : 0),
    memoryStrength: sm2Result.memoryStrength,
    updatedAt: Date.now(),
  });

  // 3. 创建复习日志
  await db.reviewLogs.add({
    id: generateUUIDv7(),
    cardId: currentCard.id,
    pointId: currentCard.pointId,
    quality,
    userAnswer: null,
    aiScore: null,
    aiCovered: null,
    aiMissing: null,
    aiSuggestion: null,
    easeBefore: currentCard.easeFactor,
    easeAfter: sm2Result.easeFactor,
    intervalBefore: currentCard.interval,
    intervalAfter: sm2Result.interval,
    timeSpent: 0,
    reviewedAt: Date.now(),
    source: "learn",
  });

  // 4. 更新会话统计
  const newRatings = { ...sessionStats.ratings };
  newRatings[quality] = (newRatings[quality] || 0) + 1;
  set({
    sessionStats: {
      ...sessionStats,
      completed: sessionStats.completed + 1,
      ratings: newRatings,
    },
  });

  // 5. 等待动画 → 加载下一张
  await sleep(300);
  get().nextCard();
  set({ isAnimating: false, isFlipped: false });
}
```

---

## 2.5 reviewStore — 复习状态

```typescript
// stores/reviewStore.ts
interface ReviewStore {
  // ── 会话状态 ──
  isActive: boolean;
  reviewCards: MemoryCard[];            // 到期卡片队列（nextReview <= now）
  currentIndex: number;
  currentCard: MemoryCard | null;
  currentPoint: KnowledgePoint | null;

  // ── 卡片交互状态 ──
  isFlipped: boolean;
  isAnimating: boolean;

  // ── AI 判分状态 ──
  aiScoringMode: boolean;               // 当前卡片是否为 AI 判分模式
  userAnswer: string;                   // 用户输入文本
  aiResult: AiScoringResult | null;     // AI 判分结果
  isAiScoring: boolean;                 // AI 判分进行中

  // ── 会话统计 ──
  sessionStartTime: number;
  sessionStats: ReviewSessionStats;

  // ── 限制 ──
  dailyLimit: number;
  todayReviewedCount: number;

  // ── 动作 ──
  startSession: (mode?: "all" | "weak-only") => Promise<void>;
  flipCard: () => void;
  rateCard: (quality: number) => Promise<void>;
  updateUserAnswer: (answer: string) => void;
  submitForAiScoring: () => Promise<void>;
  nextCard: () => void;
  endSession: () => void;
  resetSession: () => void;
}

interface AiScoringResult {
  score: number;
  covered: string[];
  missing: string[];
  suggestion: string;
}

interface ReviewSessionStats {
  total: number;
  completed: number;
  ratings: Record<number, number>;
  aiScored: number;
  avgAiScore: number;
}
```

### AI 判分流程

```typescript
submitForAiScoring: async () => {
  const { currentCard, currentPoint, userAnswer } = get();
  if (!currentCard || !currentPoint || !userAnswer.trim()) return;

  set({ isAiScoring: true });

  try {
    // 调用服务端 AI 判分 API
    const result = await fetch("/api/ai/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standardAnswer: currentPoint.answer,
        keywords: currentPoint.keywords,
        userAnswer: userAnswer.trim(),
        questionType: currentPoint.questionType,
      }),
    }).then(r => r.json());

    set({ aiResult: result, isAiScoring: false });
  } catch (error) {
    set({
      isAiScoring: false,
      aiResult: {
        score: 0,
        covered: [],
        missing: [],
        suggestion: "AI 判分服务暂时不可用，请手动自评。",
      },
    });
  }
}
```

---

## 2.6 focusStore — 重点强化状态

```typescript
// stores/focusStore.ts
interface FocusStore {
  // ── 易混概念 ──
  confusingPairs: ConfusingPair[];
  currentPairIndex: number;

  // ── 薄弱知识点 ──
  weakCards: MemoryCard[];
  weakPoints: KnowledgePoint[];

  // ── 论述骨架 ──
  essaySkeletons: EssaySkeleton[];

  // ── 知识图谱 ──
  graphNodes: GraphNode[];              // 图谱节点（从 points + cards 构建）
  graphEdges: GraphEdge[];              // 图谱边（从 knowledgeRelations 构建）

  // ── 动作 ──
  loadAll: () => Promise<void>;
  loadConfusingPairs: () => Promise<void>;
  loadWeakPoints: () => Promise<void>;
  loadEssaySkeletons: () => Promise<void>;
  buildGraph: () => void;

  // ── AI 触发 ──
  triggerConfusingDetection: () => Promise<void>;
  triggerSkeletonGeneration: (pointId: string) => Promise<void>;
}

interface GraphNode {
  id: string;
  label: string;                        // 知识点标题（简短）
  domainId: string;
  color: string;                        // 领域代表色
  size: number;                         // 记忆强度映射 (10-40pt)
  status: "new" | "learning" | "mastered" | "weak";
  cardId: string | null;
}

interface GraphEdge {
  source: string;                       // 源节点 ID
  target: string;                       // 目标节点 ID
  type: RelationType;
  strength: number;
  strokeWidth: number;                  // 线宽（2-6pt，由 strength 映射）
  strokeDasharray: string | null;       // 虚线样式（关联关系 = "4,4"，父子关系 = null 实线）
}
```

### 构建知识图谱数据

```typescript
buildGraph: () => {
  const { points } = useDomainStore.getState();
  const { memoryCards } = useLearnStore.getState(); // 或其他方式获取
  const { domains } = useDomainStore.getState();

  // 1. 节点：每个知识点 → 一个 GraphNode
  const cardMap = new Map(memoryCards.map(c => [c.pointId, c]));
  const domainMap = new Map(domains.map(d => [d.id, d]));

  const graphNodes: GraphNode[] = points.map(p => {
    const card = cardMap.get(p.id);
    const domain = domainMap.get(p.domainId);
    return {
      id: p.id,
      label: p.title,
      domainId: p.domainId,
      color: domain?.color ?? "#AEAEB2",
      size: card ? mapMemoryStrengthToSize(card.memoryStrength) : 10,
      status: card
        ? card.isWeak ? "weak"
        : card.learningPhase === "mastered" ? "mastered"
        : card.learningPhase === "new" ? "new"
        : "learning"
        : "new",
      cardId: card?.id ?? null,
    };
  });

  // 2. 边：从 knowledgeRelations 加载 + 从 treePath 推导父子关系
  // ...（加载 knowledgeRelations 并转换）
}
```

---

## 2.7 settingsStore — 设置状态

```typescript
// stores/settingsStore.ts
interface SettingsStore {
  // ── AI 配置 ──
  aiProvider: string;                   // "openai" | "anthropic" | "custom"
  aiModel: string;                      // "gpt-4o" | "claude-opus-4-8"
  aiBaseUrl: string;                    // 自定义 API 地址
  isAiConfigured: boolean;              // 是否已完成 AI 配置（派生）

  // ── 学习偏好 ──
  dailyNewCardLimit: number;            // 默认 10
  dailyReviewLimit: number;             // 默认 50
  reminderTime: string;                 // "08:00"
  reminderEnabled: boolean;
  firstLearningIntervals: number[];     // [5, 30, 720] 分钟

  // ── 数据统计 ──
  totalPoints: number;
  totalCards: number;
  masteredCards: number;
  totalReviews: number;
  totalStudyDays: number;
  domainMastery: { name: string; percentage: number }[];

  // ── 动作 ──
  loadSettings: () => Promise<void>;
  updateSetting: (key: string, value: any) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;  // 加密后存储
  getApiKey: () => Promise<string>;           // 解密后返回
  testAiConnection: () => Promise<boolean>;
  refreshStats: () => Promise<void>;

  // ── 数据管理 ──
  exportAllData: () => Promise<string>;       // 导出为 JSON 字符串
  importAllData: (json: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}
```

### API Key 安全存取

```typescript
// utils/crypto.ts
async function encryptApiKey(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getDeviceFingerprint()),  // 设备指纹
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("party-theory-salt"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  // 返回 iv + ciphertext 的 base64 编码
  return btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(encrypted)));
}

async function decryptApiKey(ciphertext: string): Promise<string> {
  // 反向操作...
}
```

---

## 2.8 uiStore — UI 状态

```typescript
// stores/uiStore.ts
interface UIStore {
  // ── 导航 ──
  currentTab: TabName;                   // 当前选中的 Tab
  previousPath: string | null;           // 上一页路径（用于返回导航）

  // ── Toast ──
  toasts: Toast[];

  // ── 加载 ──
  isGlobalLoading: boolean;              // 全局加载态（应用初始化）
  loadingMessage: string;

  // ── 动作 ──
  setTab: (tab: TabName) => void;
  navigateTo: (path: string) => void;
  goBack: () => void;
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  setGlobalLoading: (loading: boolean, message?: string) => void;
}

type TabName = "home" | "learn" | "review" | "focus" | "settings";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration: number;                      // 0 = 不自动消失
}
```

### uiStore 持久化

```typescript
// uiStore 使用 Zustand persist 中间件（仅持久化 currentTab）
const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // ...
    }),
    {
      name: "ui-store",
      partialize: (state) => ({ currentTab: state.currentTab }), // 只存 currentTab
    }
  )
);
```

---

# 第三部分：跨 Store 数据流

## 3.1 评分动作的完整数据流

```
用户点击自评按钮
  │
  ▼
learnStore.rateCard(quality)    ← 当前 Store
  │
  ├─ 1. 计算 SM-2 新参数      ← engine/sm2.ts（纯函数）
  │
  ├─ 2. db.memoryCards.update()   ← 写 IndexedDB
  │
  ├─ 3. db.reviewLogs.add()       ← 写 IndexedDB
  │
  ├─ 4. 更新 learnStore 本地状态
  │     currentCard, isFlipped, sessionStats
  │
  ├─ 5. 检查是否需要更新其他 Store
  │     │
  │     ├─ 如果卡片变成薄弱点 (isWeak = true)
  │     │   → focusStore 需要刷新?（不主动刷新，等用户进入该页时 loadAll）
  │     │
  │     └─ 更新 domainStore 的掌握度统计
  │         → domainStore.recalculateMastery(card.pointId)
  │
  └─ 6. uiStore.showToast（可选，错 3 次以上时提示）
```

## 3.2 知识导入的完整数据流

```
用户在设置页粘贴文本 → 点击「开始 AI 提炼」
  │
  ▼
settingsStore 触发 → 调用服务端 API
  │
  ├─ Round 1: /api/ai/extract
  │   创建 aiRefinementRound (round=1)
  │   返回 { domains: [...], points: [...] }
  │   → 存入 aiRefinementRounds + 展示预览
  │
  ├─ Round 2: /api/ai/audit
  │   创建 aiRefinementRound (round=2, 携带 sentences)
  │   返回 { missedItems: [...] }
  │   → 存入 aiRefinementRounds
  │
  ├─ Round 3: /api/ai/merge
  │   创建 aiRefinementRound (round=3, 携带 points + missedItems)
  │   返回 { domains: [...], points: [...] }  ← 最终结果
  │   → 存入 aiRefinementRounds + 展示最终预览
  │
  ▼
用户确认导入
  │
  ▼
domainStore.bulkImport(domains, points)
  │
  ├─ 1. 写 knowledgeDomains 表（逐条 add）
  ├─ 2. 写 knowledgePoints 表（逐条 add）
  ├─ 3. 为每个 knowledgePoint 自动创建 memoryCard
  │     db.memoryCards.add({
  │       pointId: point.id,
  │       easeFactor: 2.5,
  │       interval: 0,
  │       repetitions: 0,
  │       nextReview: null,    // null = 从未学习
  │       learningPhase: "new",
  │       isWeak: false,
  │       ...
  │     })
  ├─ 4. 创建 knowledgeRelations（AI 生成的关联边）
  ├─ 5. 更新 sourceTexts 的 extractionStatus = "confirmed"
  ├─ 6. 刷新 domainStore 状态
  │     → loadAll()
  │
  └─ 7. 跳转到首页
        首页显示「知识就绪，开始学习吧」
```

---

# 第四部分：SM-2 算法纯函数

## 4.1 算法定义

```typescript
// engine/sm2.ts
interface SM2Input {
  easeFactor: number;          // 当前 easeFactor
  interval: number;            // 当前间隔（天）
  repetitions: number;         // 当前连续正确次数
  quality: number;             // 本次评分 0-5
  firstLearningIntervals: number[]; // [5, 30, 720] 分钟
  consecutiveErrors: number;   // 当前连续错误次数
}

interface SM2Output {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;          // 时间戳 ms
  phase: LearningPhase;
  isWeak: boolean;
  consecutiveErrors: number;
  memoryStrength: number;
}

function computeSM2(input: SM2Input): SM2Output {
  const { easeFactor, interval, repetitions, quality, firstLearningIntervals, consecutiveErrors } = input;

  let newEaseFactor = easeFactor;
  let newInterval: number;
  let newRepetitions: number;
  let newConsecutiveErrors = consecutiveErrors;

  // ── 首次学习的特殊处理（3 次短间隔）──
  if (repetitions === 0 && quality >= 3) {
    // 第一次成功 → 使用第一个短间隔（5分钟）
    newInterval = firstLearningIntervals[0] / (24 * 60); // 转换为天
    newRepetitions = 1;
    newConsecutiveErrors = 0;
  } else if (repetitions === 1 && quality >= 3) {
    // 第二次成功 → 使用第二个短间隔（30分钟）
    newInterval = firstLearningIntervals[1] / (24 * 60);
    newRepetitions = 2;
  } else if (repetitions === 2 && quality >= 3) {
    // 第三次成功 → 使用第三个短间隔（12小时）
    newInterval = firstLearningIntervals[2] / (24 * 60);
    newRepetitions = 3;
  } else if (quality >= 3) {
    // ── 正常的 SM-2 间隔计算 ──
    if (repetitions === 3) {
      newInterval = 1; // 第四次 = 1 天
    } else if (repetitions === 4) {
      newInterval = 3; // 第五次 = 3 天
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetitions = repetitions + 1;
    newConsecutiveErrors = 0;
  } else {
    // ── 失败：重置间隔 ──
    newInterval = firstLearningIntervals[0] / (24 * 60); // 重置到最短间隔
    newRepetitions = 0;
    newConsecutiveErrors = consecutiveErrors + 1;
  }

  // ── 更新 easeFactor ──
  const qualityDelta = 5 - quality;
  newEaseFactor = easeFactor + (0.1 - qualityDelta * (0.08 + qualityDelta * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;
  if (newEaseFactor > 3.0) newEaseFactor = 3.0; // 上限（避免间隔无限增长）

  // ── 推导学习阶段 ──
  let phase: LearningPhase;
  if (newRepetitions === 0) {
    phase = "encoding";
  } else if (newInterval < 1) {
    phase = "encoding";
  } else if (newInterval < 7) {
    phase = "consolidating";
  } else if (newInterval < 60) {
    phase = "retrieving";
  } else {
    phase = "mastered";
  }

  // ── 判定薄弱点 ──
  const isWeak = newConsecutiveErrors >= 3 || newEaseFactor < 1.5;

  // ── 计算记忆强度 ──
  const easeScore = Math.min(newEaseFactor / 3.0, 1) * 40;
  const intervalScore = Math.min(newInterval / 120, 1) * 30;
  // 正确率从卡片历史数据计算，这里只做局部估算
  const correctRate = newRepetitions > 0 ? (newRepetitions - consecutiveErrors) / Math.max(newRepetitions, 1) : 0;
  const correctScore = correctRate * 30;
  const memoryStrength = Math.round(Math.min(easeScore + intervalScore + correctScore, 100));

  return {
    easeFactor: Math.round(newEaseFactor * 100) / 100,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReview: Date.now() + newInterval * 86400000,
    phase,
    isWeak,
    consecutiveErrors: newConsecutiveErrors,
    memoryStrength,
  };
}
```

## 4.2 间隔对照表（直观参考）

| 评分 | 第1次 | 第2次 | 第3次 | 第4次 | 第5次 | 第6次 | 第7次 |
|------|-------|-------|-------|-------|-------|-------|-------|
| 5 (完美) | 5min | 30min | 12h | 1d | 3d | 8d | 20d |
| 4 (基本) | 5min | 30min | 12h | 1d | 3d | 7d | 15d |
| 3 (模糊) | 5min | 30min | 12h | 1d | 2d | 5d | 10d |
| 2 (困难) | 5min | 5min | 30min | 12h | 1d | - | - |
| 0-1 (遗忘) | 5min | 5min | 5min | 30min | 12h | - | - |

---

# 设计总结：为什么这样设计数据库和状态

## 核心决策 1：IndexedDB 9 张表而非 3-4 张大表

> 关系型思维的惯性是「尽可能少建表，用 JOIN」。但 IndexedDB 没有 JOIN。

把实体拆成 9 张表，每张表只做一件事：

| 表 | 单一职责 |
|----|---------|
| knowledgeDomains | 层级结构 |
| knowledgePoints | 知识内容 |
| memoryCards | 记忆状态 |
| reviewLogs | 历史记录 |
| sourceTexts | 原文存档 |
| aiRefinementRounds | 提炼审计 |
| confusingPairs | 易混分析 |
| essaySkeletons | 答题框架 |
| knowledgeRelations | 图谱边 |

**代价：** 表多。**收益：** 每张表结构简单，索引清晰，查询不跨表。

## 核心决策 2：必要冗余

> 在 IndexedDB 中，宁可冗余存储，不要跨表查询。

| 冗余字段 | 冗余位置 | 避免的查询 |
|----------|---------|-----------|
| totalPoints / masteredPoints | knowledgeDomains | 递归聚合所有子孙节点 |
| treePath | knowledgePoints | 递归查父节点 |
| recentRatings | memoryCards | 查 reviewLogs 表 |
| pointId | reviewLogs | 跨表查 card → point |
| domainId | knowledgePoints | 跨表查 point → domain |

**原则：** 冗余字段在写入时多花 1ms 更新，但在读取时节省 50-200ms 的多次 IndexedDB 查询。

## 核心决策 3：Zustand 是 IndexedDB 的缓存层

> IndexedDB 很快，但没必要每次渲染都查数据库。

Store 在应用启动时一次性加载需要的数据到内存：
- domainStore 加载全部领域和知识点（数据量小，几百条）
- learnStore / reviewStore 按需加载当前会话的卡片队列

评分、导入等写操作直接写 IndexedDB，然后更新 Store。Store 和 IndexedDB 始终保持一致。

## 核心决策 4：AI 提炼有独立的审计表

> 如果用户质疑某个知识点的正确性，我们需要能回溯到「AI 是哪一轮、用什么 Prompt、基于什么原文」提取的。

`aiRefinementRounds` 表完整记录了三轮提炼的全过程。这是「多轮校验」原则的数据保障。

## 核心决策 5：知识图谱是独立构建的

> 树（parentId）+ 图（knowledgeRelations）= 完整知识网络。

逻辑树通过 `knowledgeDomains.parentId` 和 `knowledgePoints.parentPointId` 表达层级关系。知识图谱通过 `knowledgeRelations` 表达跨分支的语义关联。

两者互补，不是替代。

---

*数据库与状态设计文档结束。*
