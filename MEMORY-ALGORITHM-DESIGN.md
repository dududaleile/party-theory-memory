# 党课理论知识智能记忆系统 — 记忆系统算法设计 v2

---

## 版本变更

| 版本 | 变更 |
|------|------|
| v1.0 | SM-2 基础 + memoryStrength + 动态调度 |
| v2.0 | 新增关键词级追踪、部分掌握判定、短周期遗漏强化、树深度排序 |

---

# 第一部分：算法哲学

## 1.1 党课记忆的特殊性

```
普通间隔重复系统（Anki 等）：
  卡片 = 一个问答对
  评分 = 整体回忆质量（0-5）
  适合：语言词汇、事实记忆

党课记忆系统：
  卡片 = 一个知识点，但包含多个关键词
  评分 = 不仅要看「想起来了没」，还要看「关键词都说对了吗」
  适合：理论概念、政治术语的精确复述

核心差异：
  用户可能「四个自信」答出了三个，漏了「理论自信」
  传统 SM-2：quality=4，「基本记住了」→ 间隔 7 天
  本系统：检测到关键词遗漏 → 「不算完全掌握」→ 间隔缩短 → 短周期复习
```

## 1.2 判定原则

```
原则 1：关键词精确复述是记忆成功的必要条件
  整体想起来 ≠ 完全掌握了
  漏掉关键词 = 没有完全掌握
  必须降低稳定性，缩短间隔

原则 2：多因素共同决定下一次复习时间
  不是单一的 quality 0-5
  而是：正确率 × 关键词覆盖 × 回答速度 × 连续表现 × 主观自评

原则 3：「会一点但总漏关键词」必须进入强化
  不能因为用户「基本记得」就放长间隔
  高频遗漏词 → 短周期重复（分钟级）→ 当天多次出现

原则 4：学习顺序不是随机
  树深度升序：先学根概念，再学叶子细节
  知识点树决定了学习路径
```

---

# 第二部分：数据结构

## 2.1 卡片算法状态

```typescript
interface CardAlgorithmState {
  // ── 双组件模型 ──
  stability: number;           // S: 记忆稳定性（天）
  difficulty: number;          // D: 卡片固有难度（0-1）

  // ── 关键词级追踪（新增 v2）──
  keywordState: KeywordState[];  // 每个关键词的独立追踪状态
  
  // ── 统计字段 ──
  totalReviews: number;
  totalCorrect: number;        // quality >= 3 的次数
  consecutiveCorrect: number;
  consecutiveErrors: number;
  longestStreak: number;
  avgResponseTime: number;

  // ── 最近表现 ──
  recentQualities: number[];   // 最近 5 次评分
  recentKeywordCoverage: number[]; // 最近 5 次关键词覆盖率（0-1）
  recentResponseTimes: number[];

  // ── 调度 ──
  nextReviewAt: number | null;
  lastReviewAt: number | null;
  scheduledInterval: number;

  // ── 短周期调度（新增 v2）──
  shortCycleCount: number;     // 当前短周期复习次数
  shortCyclePhase: ShortCyclePhase;

  // ── 标记 ──
  phase: LearningPhase;
  isWeak: boolean;
  weakReason: string | null;

  createdAt: number;
  updatedAt: number;
}

interface KeywordState {
  keyword: string;             // 关键词文本
  missCount: number;           // 累计遗漏次数
  consecutiveMiss: number;     // 连续遗漏次数
  lastMissedAt: number | null; // 上次遗漏时间
}

type ShortCyclePhase = 
  | "none"           // 不处于短周期
  | "immediate"      // 1 分钟后
  | "short"          // 10 分钟后
  | "same_day";      // 当天晚些时候

type LearningPhase =
  | "encoding"       // 编码期
  | "consolidating"  // 巩固期
  | "retrieving"     // 提取期
  | "mastered";      // 掌握期
```

## 2.2 复习记录扩展

```typescript
interface ReviewLog {
  // ... 基础字段 ...
  
  // ── 关键词级记录（新增 v2）──
  keywordResults: {
    keyword: string;
    recalled: boolean;         // 用户是否准确回忆了该关键词
    userSaid: string | null;   // 用户实际说了什么（如果是输入模式）
  }[];
  keywordCoverage: number;     // 本次关键词覆盖率 0-1
}
```

---

# 第三部分：多因素判定模型

## 3.1 判定维度（5 个）

```
维度 1：自评质量（quality）
  用户主观评分 0-5
  来源：4 级自评按钮
  权重：0.25
  说明：用户对自己回忆质量的诚实评估

维度 2：关键词覆盖率（keywordCoverage）
  系统检测用户准确回忆的关键词比例
  来源：关键词检测步骤（翻转后逐词确认）
  权重：0.35 ← 最高权重
  说明：党课记忆的核心——关键术语的精确复述
  
  计算：
    keywordCoverage = 准确回忆的关键词数 / 总关键词数
    
  示例：
    四个全面有 4 个关键词，用户准确回忆了 3 个
    keywordCoverage = 3/4 = 0.75

维度 3：回答速度（responseTime）
  从翻转开始到自评的时间
  来源：系统计时
  权重：0.10
  说明：自动化提取程度

维度 4：连续表现（streakFactor）
  连续正确次数 vs 连续错误次数
  来源：卡片历史数据
  权重：0.15
  说明：稳定性的另一个信号

维度 5：主观熟练度（confidenceAdjustment）
  用户对自己长期记忆该卡片的信心
  来源：在自评后的额外选项（可选）
  权重：0.15
  说明：有时候用户虽然这次答对了，但感觉自己掌握不牢
```

## 3.2 综合评分公式

```
compositeScore = 
    quality / 5 × 100             × 0.25    ← 自评（转换为百分制）
  + keywordCoverage × 100         × 0.35    ← 关键词覆盖
  + speedScore(responseTime)      × 0.10    ← 速度得分
  + streakFactor                  × 0.15    ← 连续表现
  + confidenceAdjustment          × 0.15    ← 主观熟练度

  compositeScore 范围：0-100
```

## 3.3 「会一点但总漏关键词」的判定

```
这是党课记忆独有的判定逻辑。

场景：用户答「四个自信」，答出了「道路自信、制度自信、文化自信」
      但漏了「理论自信」

传统 SM-2：用户答出了 3/4 = 75%，quality=4（基本记住）
            → 间隔 7 天
            → 问题：7 天后用户可能还是漏「理论自信」

本系统判定：
  keywordCoverage = 0.75（4 个关键词漏了 1 个）
  漏的是同一个词（理论自信）→ 不是「忘了」，是该词没编码牢固

  判定结果：
    compositeScore 被 keywordCoverage 拉低
    → 稳定性 S 增长受限
    → 间隔不会跳到 7 天
    → 进入短周期复习（1 分钟 → 10 分钟 → 当天晚些时候）
    → 该关键词的 missCount + 1
    → 如果连续遗漏 → 该关键词标记为高频遗漏词
    → 在重点强化页单独列出

规则：
  keywordCoverage < 1.0 且 quality >= 3：
    → 不算「完全掌握」
    → stability 增长 = 正常增长 × keywordCoverage
    → 例如：正常应该 S×2.5，实际 S×2.5×0.75 = S×1.875
    → 如果某个关键词连续遗漏 ≥ 3 次 → 短周期强化
  
  keywordCoverage < 0.5：
    → 即使 quality >= 3，也按 quality < 3 处理
    → 因为漏了一半以上的关键词 = 实际没掌握
```

## 3.4 速度得分的党课适配

```
党课知识点不追求「秒答」。
理论概念需要思考，这是正常的。

速度得分调整：
  概念题（concept）：正常速度权重 0.10
  列举题（list）：    正常速度权重 0.10
  辨析题（compare）： 速度权重降低 0.05
  论述题（essay）：   速度权重降低 0.03（论述本来就需要时间）

正常速度基准：
  < 5 秒  = 很快（自动化提取）→ score = 100
  5-10 秒 = 正常           → score = 75
  10-20 秒= 较慢（在思考）  → score = 50
  > 20 秒 = 很慢（不熟悉）  → score = 25
```

---

# 第四部分：动态调度算法

## 4.1 调度决策流程

```
每次复习完成 → 计算 compositeScore

  compositeScore >= 85：
    → 高质量掌握
    → S 正常增长（gain × difficultyPenalty × streakBonus）
    → 间隔 = -S × ln(targetR)
    → 检查关键词：如果有单个关键词连续遗漏 ≥ 3 次
      → 该关键词进入短周期（但不影响整张卡片的间隔）

  compositeScore >= 60 且 < 85：
    → 中等掌握
    → S 受限增长（gain × 0.6 × difficultyPenalty × streakBonus）
    → 间隔 = -S × ln(targetR) × 0.7
    → 如果 keywordCoverage < 0.8：
      → 短周期复习（1 分钟后再次出现）

  compositeScore >= 30 且 < 60：
    → 薄弱掌握
    → S 微增长或不变
    → 间隔 = 编码期间隔（5min 或 30min）
    → 短周期复习 + 标记为薄弱候选

  compositeScore < 30：
    → 基本未掌握
    → S 衰减（decayFactor）
    → 间隔重置为编码期起点（5min）
    → 立即标记为薄弱
```

## 4.2 短周期重复机制（新增 v2）

```
短周期重复是处理「关键词遗漏」的核心机制。

触发条件（任一满足）：
  ① keywordCoverage < 0.8 且 compositeScore >= 60
     （整体记得但漏了关键词）
  ② 某个关键词连续遗漏 ≥ 2 次
     （同一个词反复忘）
  ③ quality < 3
     （整体遗忘）

短周期阶段：
  Phase 1: immediate（1 分钟后）
    → 卡片在 1 分钟后重新出现在复习队列
    → 目的：立即纠正，建立正确的关键词记忆
    
  Phase 2: short（10 分钟后）
    → 如果 Phase 1 仍然 keywordCoverage < 1.0
    → 卡片在 10 分钟后再次出现
    
  Phase 3: same_day（当天晚些时候）
    → 如果 Phase 2 仍然 keywordCoverage < 1.0
    → 卡片在 2 小时后再次出现
    → 如果还是漏 → 进入重点强化 + 标记薄弱

  如果任一阶段 keywordCoverage = 1.0：
    → 退出短周期
    → 进入正常调度
    → S 仍受限增长（不会一恢复就跳到长间隔）

短周期卡片在复习队列中的优先级：
  短周期卡片 > 薄弱卡片 > 到期卡片 > 即将到期卡片
```

## 4.3 稳定性更新（SM-2 基础 + 关键词修正）

```
回答成功 (compositeScore >= 60)：

  S_new = S_old × (1 + gain × keywordAdjustment × difficultyPenalty × streakBonus)

  gain（根据 compositeScore）：
    compositeScore >= 85：gain = 2.5
    compositeScore >= 75：gain = 1.5
    compositeScore >= 60：gain = 0.8

  keywordAdjustment（新增 v2）：
    keywordCoverage = 1.0：adjustment = 1.0    （无削减）
    keywordCoverage = 0.8：adjustment = 0.7    （削减 30%）
    keywordCoverage = 0.6：adjustment = 0.4    （削减 60%）
    keywordCoverage < 0.5：视为失败，不走成功分支

  difficultyPenalty = 1 - D × 0.6
  streakBonus = 1 + min(consecutiveCorrect, 10) × 0.05

回答失败 (compositeScore < 60)：

  S_new = S_old × decayFactor

  compositeScore >= 30：decayFactor = 0.5
  compositeScore >= 10：decayFactor = 0.25
  compositeScore < 10： decayFactor = 0.1

  最小 S 不低于 0.005
```

## 4.4 调度时间计算

```
下次复习时间 t = -S × ln(targetR) × scheduleMultiplier

  targetR（根据阶段）：
    编码期（S < 0.1）：0.95
    巩固期（S 0.1~5）：0.90
    提取期（S 5~60）：0.85
    掌握期（S ≥ 60）：0.80

  scheduleMultiplier（根据 compositeScore 微调）：
    compositeScore >= 85：× 1.0   （标准）
    compositeScore >= 75：× 0.85  （略缩短）
    compositeScore >= 60：× 0.7   （明显缩短）

  短周期阶段（不适用上述公式）：
    immediate：t = 1/1440（1 分钟）
    short：    t = 10/1440（10 分钟）
    same_day： t = 120/1440（2 小时）

  边界约束：
    正常调度最小间隔：0.5 天（12 小时）
    正常调度最大间隔：180 天
    短周期不计入上述约束
```

## 4.5 高频遗漏关键词的独立追踪

```
keywordState 数组追踪每个关键词的遗漏历史：

  如果某个关键词连续遗漏 ≥ 3 次：
    → 该关键词标记为「高频遗漏」
    → 在重点强化页的「薄弱知识点」区块中单独展示
    → 例如：「四个自信」中的「理论自信 — 连续遗漏 3 次」
    → AI 可以针对该关键词生成记忆技巧

  如果 keywordCoverage 多次在同一个词上失败：
    → 降低该卡片的 difficulty（因为这个词让卡片变得更「难」）
    → D += 0.05 × 该词连续遗漏次数

  关键词级间隔（未来扩展）：
    每个关键词有自己的 mini 间隔
    高频遗漏词以更高频率出现在用户的注意力中
    但这不改变卡片的整体调度
```

---

# 第五部分：学习顺序算法

## 5.1 禁止随机，必须整体→局部→细节

```
学习队列排序规则（按优先级）：

① 树深度升序（最优先）
   深度 1（根概念）→ 深度 2 → 深度 3 → ...
   确保用户先建立框架，再填充细节

② 同深度按 order 字段排序
   同一层级的知识点按预设顺序学习
   例如：「八个明确」的 8 个知识点按 1-8 依次学习

③ 父知识点优先于子知识点
   如果知识点 A 是 B 的父节点，A 必须先学
   即使它们深度相同（这不是树深度的保证，是 parentPointId 的保证）

④ 同父节点下按 order 排序
   确保兄弟知识点的学习顺序有意义

实现：
  function sortCardsForLearning(cards: MemoryCard[]): MemoryCard[] {
    return cards.sort((a, b) => {
      const pointA = getPoint(a.pointId);
      const pointB = getPoint(b.pointId);
      
      // ① 树深度
      const depthDiff = pointA.treePath.length - pointB.treePath.length;
      if (depthDiff !== 0) return depthDiff;
      
      // ③ 父节点优先（A 是 B 的父 → A 先学）
      if (pointB.parentPointId === pointA.id) return -1;
      if (pointA.parentPointId === pointB.id) return 1;
      
      // ②④ order 排序
      return (pointA.order ?? 0) - (pointB.order ?? 0);
    });
  }
```

## 5.2 每日新卡片选择

```
selectNewCardsForToday(limit: number): MemoryCard[] {
  1. 获取所有 nextReview === null 的卡片（从未学过）
  2. 关联知识点，获取 treePath 和 parentPointId
  3. 按树深度升序排列
  4. 过滤：父知识点至少被学过 1 次的卡片才可入选
     （parentPointId !== null）→ 检查父知识点对应的卡片
       如果父卡片 nextReview !== null（已学过至少 1 次）→ 可选
       如果父卡片 nextReview === null（也没学过）→ 跳过，等父先学
  5. 取前 limit 张
}
```

---

# 第六部分：薄弱点与强化联动

## 6.1 薄弱点判定（v2 更新）

```
一张卡片被标记为薄弱（isWeak = true）的条件：

条件 1：compositeScore 连续 3 次 < 60
  → 综合表现持续不佳

条件 2：某个关键词连续遗漏 ≥ 4 次
  → 同一个词反复忘，需要针对性强化

条件 3：keywordCoverage 连续 5 次 < 1.0
  → 虽然整体记得，但每次都有关键词遗漏

条件 4：stability < 0.05 且 totalReviews > 5
  → 反复复习但稳定性一直上不去

条件 5：处于短周期 same_day 阶段 2 次以上
  → 短周期重复都解决不了

满足任一 → isWeak = true
```

## 6.2 薄弱点干预分级

```
L1（连续 2 次 compositeScore < 60）：
  → 间隔缩短 50%
  → 不标记为薄弱

L2（标记为薄弱，进入重点强化列表）：
  → 进入短周期复习
  → 间隔重置为编码期
  → 知识图谱红色边框
  → 如果是关键词遗漏导致 → 展示遗漏关键词列表

L3（连续 5 次 compositeScore < 60）：
  → AI 重新生成该知识点的表述
  → 为遗漏关键词生成记忆技巧
  → 降低 D（重新评估难度）

薄弱解除条件：
  连续 3 次 compositeScore >= 60 且 keywordCoverage = 1.0
  → isWeak = false
```

---

# 第七部分：完整算法参数

```typescript
const ALGORITHM_CONFIG = {
  // ── 初始值 ──
  initialStability: 0.02,
  initialDifficulty: 0.3,

  // ── 综合评分权重 ──
  compositeScoreWeights: {
    quality: 0.25,           // 自评
    keywordCoverage: 0.35,   // 关键词覆盖（最高权重）
    responseSpeed: 0.10,     // 回答速度
    streakFactor: 0.15,      // 连续表现
    confidence: 0.15,        // 主观熟练度
  },

  // ── 稳定性增长 ──
  stabilityGain: {
    high: 2.5,    // compositeScore >= 85
    medium: 1.5,  // compositeScore >= 75
    low: 0.8,     // compositeScore >= 60
  },

  // ── 关键词修正因子 ──
  keywordAdjustment: {
    full: 1.0,     // coverage = 1.0
    partial: 0.7,  // coverage = 0.8
    low: 0.4,      // coverage = 0.6
    fail: 0,       // coverage < 0.5 → 按失败处理
  },

  // ── 稳定性衰减 ──
  stabilityDecay: {
    mild: 0.5,     // compositeScore >= 30
    moderate: 0.25,// compositeScore >= 10
    severe: 0.1,   // compositeScore < 10
  },

  // ── 调度 ──
  targetRetrievability: {
    encoding: 0.95,
    consolidating: 0.90,
    retrieving: 0.85,
    mastered: 0.80,
  },

  scheduleMultiplier: {
    high: 1.0,    // compositeScore >= 85
    medium: 0.85, // compositeScore >= 75
    low: 0.7,     // compositeScore >= 60
  },

  // ── 短周期 ──
  shortCycleIntervals: {
    immediate: 1,     // 1 分钟
    short: 10,        // 10 分钟
    sameDay: 120,     // 2 小时
  },

  // ── 编码期 ──
  encodingIntervals: [5, 30, 720], // 5min, 30min, 12h

  // ── 边界 ──
  minStability: 0.005,
  minInterval: 0.5,    // 12 小时（正常调度最小间隔）
  maxInterval: 180,    // 半年

  // ── 薄弱点判定 ──
  weakPointThresholds: {
    compositeScoreStreak: 3,     // 连续 N 次 < 60
    keywordConsecutiveMiss: 4,   // 某关键词连续遗漏 N 次
    keywordCoverageStreak: 5,    // 连续 N 次 coverage < 1.0
    lowStabilityReviews: 5,      // 复习 N 次后 S 仍然 < 0.05
    shortCycleRepeats: 2,        // same_day 阶段出现 N 次
  },
};
```

---

*记忆系统算法设计 v2 结束。*
