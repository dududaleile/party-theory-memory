# 党课理论知识智能记忆系统 — AI 知识提炼管道设计

---

## 文档信息

| 项 | 内容 |
|---|------|
| 版本 | v1.0 |
| 日期 | 2026-06-09 |
| 核心目标 | 从党课原始文本中提取结构化知识，遗漏率 < 2%，错误率 < 1% |
| 设计原则 | 宁可多提取 10 条冗余，不可遗漏 1 条关键知识点 |

---

# 第一部分：管道总览

## 1.1 五轮提炼架构

```
原始文本
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│                     Round 1: 粗提取                          │
│  目标：从文本中提取所有可能的知识点，不遗漏                    │
│  策略：低温度(0.1)、大 token 预算、结构化 prompt               │
│  输出：知识点列表 + 初步领域分类 + 关键术语                    │
│  错误策略：JSON 解析失败 → 重试 2 次 → 人工介入               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Round 2: 逐句比对                         │
│  目标：逐句检查原文，找出 Round 1 遗漏的任何内容               │
│  策略：将原文拆分为编号句子，逐句要求 AI 比对                  │
│  输出：遗漏清单（句子编号 + 遗漏内容 + 整合建议）              │
│  错误策略：遗漏率 > 5% → 返回 Round 1 重新提取（换模型/温度） │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Round 3: 逻辑校验                         │
│  目标：校验知识点的准确性、逻辑一致性和层级关系                 │
│  策略：验证答案与原文的一致性 + 父子关系合理性 + 交叉验证       │
│  输出：修正后的知识点 + 逻辑错误清单 + 关联关系                │
│  错误策略：发现逻辑矛盾 → 标记为 conflicted → 人工裁决         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Round 4: 遗漏检查                          │
│  目标：最终全覆盖检查，确保没有知识点被遗漏                    │
│  策略：反向索引——原文的每个段落都至少对应一个知识点             │
│  输出：覆盖率报告 + 遗漏警告 + 最终补充                        │
│  错误策略：覆盖率 < 95% → 补充遗漏 → 重新进入 Round 4          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Round 5: 最终结构化                        │
│  目标：合并所有轮次结果，生成最终结构化 JSON                    │
│  策略：去重 + 排序 + 补全 treePath + 生成关联关系 + 出卡       │
│  输出：最终知识包（domains + points + relations + cards）      │
│  错误策略：schema 校验失败 → 自动修复 → 失败则人工确认          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     人工确认环节                               │
│  预览 → 编辑 → 确认 → 写入 IndexedDB                          │
│  支持：增/删/改/调序/合并/拆分                                 │
└──────────────────────────────────────────────────────────────┘
```

## 1.2 管道核心指标

```
┌─────────────────────────────────────────┐
│            管道质量指标                   │
│                                         │
│  遗漏率：    < 2%（目标 < 1%）           │
│  错误率：    < 1%（目标 0.5%）           │
│  逻辑正确率：> 99%                      │
│  层级合理性：人工通过率 > 95%            │
│  卡片可用率：> 90%（无需人工修改）        │
│  平均耗时：  < 90 秒（2000 字文本）       │
│  Token 成本：约 0.3-0.8 美元/1000 字     │
└─────────────────────────────────────────┘
```

---

# 第二部分：逐轮详细设计

---

## Round 1: 粗提取

### 2.1.1 设计目标

从原始文本中提取**所有可能构成知识点的内容**。这一轮的关键词是「全」——宁可把不是知识点的句子也提取出来，不能漏掉真正的知识点。

### 2.1.2 输入预处理

```typescript
// 服务端预处理
function preprocessForRound1(rawText: string): {
  fullText: string;
  paragraphs: { index: number; content: string }[];
  sentences: { index: number; paragraphIndex: number; content: string }[];
  stats: { charCount: number; paragraphCount: number; sentenceCount: number };
} {
  // 1. 清洗文本：统一全角/半角、去除多余空行、保留段落结构
  const cleanText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 2. 按段落拆分（保留层级信息）
  const paragraphs = cleanText
    .split(/\n\n+/)
    .filter(p => p.trim().length > 0)
    .map((content, index) => ({ index, content: content.trim() }));

  // 3. 按句子拆分（中文句号、问号、感叹号、分号）
  const sentenceSplitter = /([^。！？；\n]+[。！？；]?)/g;
  let sentenceIndex = 0;
  const sentences = paragraphs.flatMap((para, pIdx) => {
    const matches = para.content.match(sentenceSplitter) || [];
    return matches
      .filter(s => s.trim().length > 0)
      .map(content => ({
        index: sentenceIndex++,
        paragraphIndex: pIdx,
        content: content.trim(),
      }));
  });

  return {
    fullText: cleanText,
    paragraphs,
    sentences,
    stats: {
      charCount: cleanText.length,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
    },
  };
}
```

### 2.1.3 Prompt 设计

```
═══════════════════════════════════════════════════════════
SYSTEM PROMPT — Round 1
═══════════════════════════════════════════════════════════

你是一个党课理论知识提炼专家。你的任务是从给定的党课学习材料中
提取所有知识点。

【核心原则】
宁可多提取，不可遗漏。如果一个句子包含任何理论概念、定义、原则、
方针、历史事件、重要论述，它必须被提取为知识点。

【知识点的定义】
一个知识点是：
- 一个可独立考察的理论概念（如"四个全面的内涵"）
- 一个需要记忆的定义（如"中国特色社会主义最本质的特征"）
- 一个重要的历史时间/事件（如"遵义会议的历史意义"）
- 一项方针政策的核心内容（如"新发展理念"）
- 一组并列的记忆项（如"五位一体"总体布局包含哪些）
- 一个论述的核心论点（如"为什么说党的领导是最大优势"）

【输出格式】
必须输出严格符合以下 JSON Schema 的对象：
{
  "domains": [
    {
      "tempId": "d1",               // 临时 ID（后续轮次会转为正式 ID）
      "name": "领域名称",
      "description": "领域简述",
      "parentTempId": null,          // 父领域临时 ID，null 为根
      "order": 1                     // 同级排序
    }
  ],
  "points": [
    {
      "tempId": "p1",
      "domainTempId": "d1",          // 所属领域
      "parentPointTempId": null,     // 父知识点（如果有层级）
      "title": "知识点标题（≤20字）",
      "question": "作为记忆卡片正面的问题",
      "answer": "标准答案（完整、准确、保留原文关键措辞）",
      "answerBrief": "答案摘要（≤50字）",
      "keywords": ["关键词1", "关键词2"],
      "difficulty": 3,               // 1-5（1=非常简单，5=非常难）
      "questionType": "concept",     // "concept" | "list" | "essay" | "compare"
      "sourceQuote": "对应的原文片段",
      "sourceParagraphIndex": 0      // 原文段落索引
    }
  ],
  "keyTerms": ["术语1", "术语2"],    // 全局关键术语
  "extractionNotes": "提取说明（如有任何不确定的内容，在此说明）"
}

【质量检查清单】
在输出前自检：
□ 每个自然段都被覆盖了吗？
□ 是否有重要的理论概念被遗漏？
□ 并列结构（如"四个XX""五个YY"）是否完整拆解？
□ 定义类内容是否逐条提取？
□ 答案是否保留了原文的精确措辞（不允许改写政治表述）？
□ 关键词是否覆盖了答案中的核心术语？

【特别注意】
- 对于"四个全面""五位一体""八个明确""十四个坚持"等并列结构，
  必须将每条分别提取为独立知识点
- 答案中的政治术语必须与原文一字不差
- 如果某段文本包含多层含义，分别提取，不要合并
- 如果某个概念暂时无法判断属于哪个领域，放在最相关的领域中并在
  extractionNotes 中说明

═══════════════════════════════════════════════════════════
USER PROMPT — Round 1
═══════════════════════════════════════════════════════════

请从以下党课学习材料中提取所有知识点。

【原文标题】
{sourceTitle}

【原文内容（共 {paragraphCount} 段，{sentenceCount} 句，{charCount} 字）】
{fullText}

【补充说明】
- 这是一份党课理论学习材料
- 请严格按照输出格式返回 JSON
- 确保每个知识点的答案在原文中有依据
- 如果有任何不确定的地方，在 extractionNotes 中标注，不要猜测
```

### 2.1.4 输出校验

```typescript
// 服务端：Round 1 输出校验
function validateRound1Output(output: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. JSON 结构校验
  if (!output.domains || !Array.isArray(output.domains)) {
    errors.push("缺少 domains 数组");
  }
  if (!output.points || !Array.isArray(output.points)) {
    errors.push("缺少 points 数组");
  }

  // 2. 每个 point 必填字段校验
  output.points?.forEach((p: any, i: number) => {
    if (!p.tempId) errors.push(`points[${i}]: 缺少 tempId`);
    if (!p.title) errors.push(`points[${i}]: 缺少 title`);
    if (!p.question) errors.push(`points[${i}]: 缺少 question`);
    if (!p.answer) errors.push(`points[${i}]: 缺少 answer`);
    if (!p.keywords || p.keywords.length === 0) {
      warnings.push(`points[${i}] (${p.title}): 缺少 keywords`);
    }
    if (!p.domainTempId) errors.push(`points[${i}] (${p.title}): 缺少 domainTempId`);
    if (p.answer && p.answer.length < 5) {
      warnings.push(`points[${i}] (${p.title}): answer 过短 (${p.answer.length} 字)`);
    }
  });

  // 3. domainTempId 引用校验
  const domainIds = new Set(output.domains?.map((d: any) => d.tempId));
  output.points?.forEach((p: any, i: number) => {
    if (p.domainTempId && !domainIds.has(p.domainTempId)) {
      errors.push(`points[${i}] (${p.title}): domainTempId "${p.domainTempId}" 不存在`);
    }
  });

  // 4. 知识点数量合理性
  if (output.points?.length === 0) {
    errors.push("未提取到任何知识点，可能原文格式有问题");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    pointCount: output.points?.length ?? 0,
    domainCount: output.domains?.length ?? 0,
  };
}
```

### 2.1.5 覆盖率初检

```typescript
// Round 1 完成后立即执行覆盖率初检
function round1CoverageCheck(
  sentences: { index: number; content: string }[],
  points: { sourceParagraphIndex?: number; sourceQuote?: string; title: string }[]
): CoverageReport {
  // 统计哪些段落至少有一个知识点覆盖
  const coveredParagraphs = new Set(
    points.filter(p => p.sourceParagraphIndex !== undefined).map(p => p.sourceParagraphIndex)
  );
  const uncoveredParagraphs = sentences
    .filter(s => !coveredParagraphs.has(s.paragraphIndex))
    .map(s => s.index);

  // 如果一个段落没有任何知识点覆盖，标记为潜在遗漏
  const potentialMisses = sentences.filter(s => {
    const paraPoints = points.filter(p => p.sourceParagraphIndex === s.paragraphIndex);
    // 检查该句子的内容是否在知识点中被引用
    return paraPoints.length === 0 && s.content.length > 15;
  });

  return {
    totalSentences: sentences.length,
    coveredParagraphs: coveredParagraphs.size,
    totalParagraphs: new Set(sentences.map(s => s.paragraphIndex)).size,
    uncoveredParagraphIndices: [...uncoveredParagraphs],
    potentialMissCount: potentialMisses.length,
    potentialMisses: potentialMisses.map(s => ({
      sentenceIndex: s.index,
      content: s.content.substring(0, 100),
    })),
    coverageRate: coveredParagraphs.size / new Set(sentences.map(s => s.paragraphIndex)).size,
    status: coveredParagraphs.size / new Set(sentences.map(s => s.paragraphIndex)).size > 0.8
      ? "pass" : "review_needed",
  };
}
```

---

## Round 2: 逐句比对

### 2.2.1 设计目标

这是「宁可多，不可漏」原则的核心保障轮次。将原文逐句编号，要求 AI 逐一比对 Round 1 的提取结果，找出**所有遗漏**。

### 2.2.2 Prompt 设计

```
═══════════════════════════════════════════════════════════
SYSTEM PROMPT — Round 2
═══════════════════════════════════════════════════════════

你是一个严格的党课知识审计专家。你的任务是逐句检查原文，
找出上一轮知识点提取的所有遗漏。

【工作方式】
我会给你：
1. 原文（每句都有编号）
2. 已提取的知识点列表（每个知识点标注了它覆盖的原文句子）

你需要逐句检查：这一句是否包含任何理论知识点？
如果是，它是否已被已有知识点覆盖？

【判定标准：什么算"覆盖"？】
- 知识点的 answer 中包含了该句的核心理论内容
- 知识点的 sourceQuote 或 answer 引用了该句的关键表述
- 如果句子包含的是背景描述、过渡语句、修辞表述，不算遗漏

【判定标准：什么算"遗漏"？】
- 句子包含一个独立的理论概念，但没有任何知识点覆盖它
- 句子包含一个定义/原则/方针，但知识点列表中没有
- 句子属于一个并列结构（如"四个XX"），但只提取了其中部分
- 句子包含一个需要记忆的时间/数据/名称，但没有提取

【输出格式】
{
  "missedItems": [
    {
      "sentenceIndex": 3,              // 遗漏内容所在句子编号
      "content": "该句的原文内容",
      "reason": "该句包含XXX概念，但知识点列表中未覆盖",
      "severity": "high",              // "high" | "medium" | "low"
      "suggestion": {
        "action": "add",               // "add" | "merge" | "enrich"
        "targetPointTempId": null,     // 如果是 merge/enrich，目标知识点 tempId
        "proposedTitle": "建议的知识点标题",
        "proposedQuestion": "建议的问题表述",
        "proposedAnswer": "建议的答案内容",
        "proposedKeywords": ["关键词"],
        "proposedDifficulty": 3,
        "proposedQuestionType": "concept"
      }
    }
  ],
  "auditSummary": {
    "totalSentences": 42,
    "informativeSentences": 35,        // 包含理论内容的有效句子
    "coveredSentences": 30,            // 已被覆盖的有效句子
    "missedSentences": 5,              // 遗漏的有效句子
    "missRate": "14.3%",
    "overallAssessment": "存在重要遗漏，建议补充后再进入下一轮"
  }
}

【注意】
- 如果一句话包含多个独立知识点，且知识点只覆盖了部分，标记为遗漏
- 过渡句、疑问句、反问句如果不包含理论内容，不算遗漏
- severity = "high" 的条件：遗漏的是一个完整的理论概念或考试重点
- 宁可把 low severity 的内容也列出来，不要漏掉 high severity 的遗漏

═══════════════════════════════════════════════════════════
USER PROMPT — Round 2
═══════════════════════════════════════════════════════════

以下是原文（逐句编号）和已提取的知识点。

【原文 - 逐句编号】
{sentences.map(s => `[${s.index}] ${s.content}`).join('\n')}

【已提取知识点 ({points.length} 个)】
{points.map(p => `
---
知识点 ID: ${p.tempId}
标题: ${p.title}
问题: ${p.question}
答案: ${p.answer}
覆盖原文句子: ${p.sourceParagraphIndex !== undefined ? `段落${p.sourceParagraphIndex}` : '未标注'}
原文引用: ${p.sourceQuote || '未标注'}
`).join('\n')}

请逐句比对，找出所有遗漏。
```

### 2.2.3 遗漏严重度判定

```
severity = "high"   → 遗漏了完整的理论概念、定义、考点
                      必须补充，否则考试可能失分
                      例如：漏掉了"四个全面"中的"全面从严治党"

severity = "medium" → 遗漏了辅助性理论内容、背景知识
                      建议补充，有助于理解
                      例如：遗漏了某个概念的历史背景

severity = "low"    → 遗漏了非核心的细节、过渡性表述
                      可选补充，不影响核心知识完整性
                      例如：遗漏了某位领导人的某次讲话的具体日期
```

### 2.2.4 Round 2 质量门禁

```typescript
function round2QualityGate(
  auditResult: { missedItems: any[]; auditSummary: any },
  round1Points: any[],
  sentences: any[]
): GateResult {
  const missRate = parseFloat(auditResult.auditSummary.missRate);
  const highSeverityMisses = auditResult.missedItems.filter(m => m.severity === "high");

  if (highSeverityMisses.length > 0) {
    // 有 high severity 遗漏 → 必须补充后重新进入 Round 2
    return {
      passed: false,
      action: "supplement_and_reaudit",
      reason: `存在 ${highSeverityMisses.length} 个高严重度遗漏`,
      details: highSeverityMisses.map(m => m.content),
    };
  }

  if (missRate > 15) {
    // 遗漏率过高 → Round 1 提取质量太差，换模型或温度重新提取
    return {
      passed: false,
      action: "re_extract",
      reason: `遗漏率 ${missRate}% 超过阈值 15%，Round 1 提取质量不足`,
    };
  }

  if (missRate > 5) {
    // 中等遗漏 → 自动补充遗漏项，然后进入 Round 3
    return {
      passed: true,
      action: "auto_supplement",
      reason: `遗漏率 ${missRate}%，将自动补充 ${auditResult.missedItems.length} 个遗漏项`,
      supplementItems: auditResult.missedItems,
    };
  }

  // 遗漏率 ≤ 5% → 通过
  return {
    passed: true,
    action: "proceed",
    reason: `遗漏率 ${missRate}%，在可接受范围内`,
  };
}
```

---

## Round 3: 逻辑校验

### 2.3.1 设计目标

验证知识点的准确性、层级结构合理性、知识点之间的逻辑一致性。这一轮的核心是「校验」，不是提取。

### 2.3.2 逻辑校验的四个维度

```
维度 1: 事实准确性
  → 知识点的 answer 是否与原文一致？
  → 有没有 AI 自行发挥、改写、曲解的内容？
  → 政治术语的措辞是否精确？

维度 2: 层级合理性
  → 领域划分是否合理？
  → 父子关系是否正确？
  → 有没有知识点被放在不合理的父节点下？

维度 3: 逻辑一致性
  → 不同知识点之间有没有矛盾？
  → 同一个概念在不同知识点中的表述是否一致？
  → 并列结构是否完整（如"四个XX"是否四个都提取了）？

维度 4: 知识点完整性
  → 每个知识点的 question 是否能用 answer 完整回答？
  → answer 是否包含了 question 所问的全部内容？
  → keywords 是否覆盖了 answer 的核心术语？
```

### 2.3.3 Prompt 设计

```
═══════════════════════════════════════════════════════════
SYSTEM PROMPT — Round 3
═══════════════════════════════════════════════════════════

你是一个党课理论知识的逻辑校验专家。你的任务是对已提取的知识点
进行四维度校验，发现并修正所有错误。

【校验维度】
1. 事实准确性：答案是否与原文一致？政治术语是否一字不差？
2. 层级合理性：领域划分和父子关系是否合理？
3. 逻辑一致性：知识点之间是否有矛盾？并列结构是否完整？
4. 知识点完整性：question 和 answer 是否匹配？keywords 是否完整？

【错误类型定义】
- "factual_error": 知识点内容与原文不符
- "wording_error": 政治术语措辞不精确（用词不当）
- "structure_error": 层级关系错误（放在错误的父节点下）
- "inconsistency": 与其他知识点矛盾
- "incomplete_list": 并列结构不完整（如只提了"三个"但实际有"四个"）
- "missing_keyword": 关键词不完整
- "qa_mismatch": 问题与答案不匹配
- "duplicate": 与另一个知识点重复

【输出格式】
{
  "validationResults": [
    {
      "pointTempId": "p5",
      "hasErrors": true,
      "errors": [
        {
          "type": "wording_error",
          "field": "answer",
          "currentValue": "当前错误文本",
          "correctValue": "修正后的文本",
          "explanation": "原文中用的是'全面领导'而非'绝对领导'",
          "severity": "critical"  // "critical" | "major" | "minor"
        }
      ]
    },
    {
      "pointTempId": "p12",
      "hasErrors": false,
      "errors": []
    }
  ],
  "structureIssues": [
    {
      "type": "structure_error",
      "pointTempId": "p15",
      "currentParentId": "d2",
      "suggestedParentId": "d1",
      "reason": "该知识点属于'核心要义'范畴，而非'历史背景'"
    }
  ],
  "inconsistencies": [
    {
      "type": "inconsistency",
      "pointAId": "p7",
      "pointBId": "p23",
      "field": "answer",
      "description": "p7 说'党的领导是中国特色社会主义最本质的特征'，p23 说'人民当家作主是...最本质的特征'，存在矛盾",
      "resolution": "p7 的表述正确，p23 应修正为'人民当家作主是社会主义民主政治的本质特征'"
    }
  ],
  "completenessIssues": [
    {
      "type": "incomplete_list",
      "pointTempId": "p8",
      "description": "'四个全面'知识点目前只提取了3个子知识点，缺少'全面从严治党'"
    }
  ],
  "overallAssessment": {
    "totalErrors": 5,
    "criticalErrors": 1,
    "majorErrors": 2,
    "minorErrors": 2,
    "overallQuality": "needs_fix"  // "excellent" | "good" | "needs_fix" | "poor"
  }
}

【政治术语严格性提醒】
- 习近平新时代中国特色社会主义思想中的术语必须与官方表述完全一致
- 不可以使用近义词替换（如"以人民为中心"不能写成"以人为本"）
- 如果原文有标准表述但你在知识点中改写了，标记为 critical 错误
- 如果原文措辞不够精确，在 explanation 中说明并给出标准表述

═══════════════════════════════════════════════════════════
USER PROMPT — Round 3
═══════════════════════════════════════════════════════════

请对以下知识点进行四维度逻辑校验。

【原文（供事实校验参考）】
{fullText}

【知识领域树】
{JSON.stringify(domains, null, 2)}

【知识点列表（{points.length} 个）】
{JSON.stringify(points, null, 2)}

请逐一校验每个知识点，输出所有发现的问题。
```

### 2.3.4 逻辑校验后自动修复

```typescript
function autoFixRound3Errors(
  points: KnowledgePoint[],
  validation: ValidationResult
): { fixed: KnowledgePoint[]; unfixable: UnfixableError[] } {
  const unfixable: UnfixableError[] = [];

  const fixed = points.map(point => {
    const pointErrors = validation.validationResults?.find(
      r => r.pointTempId === point.tempId
    )?.errors || [];

    let modified = { ...point };

    for (const error of pointErrors) {
      switch (error.type) {
        case "wording_error":
          // 自动替换为正确措辞
          if (error.field === "answer" && error.correctValue) {
            modified.answer = modified.answer.replace(error.currentValue, error.correctValue);
          }
          break;

        case "missing_keyword":
          // 无法自动修复 → 标记为需人工处理
          unfixable.push({
            pointTempId: point.tempId,
            error,
            reason: "关键词缺失需人工补充",
          });
          break;

        case "incomplete_list":
          // 无法自动修复 → 需返回 Round 1/2 补充
          unfixable.push({
            pointTempId: point.tempId,
            error,
            reason: "并列结构不完整，需补充遗漏项",
          });
          break;

        case "factual_error":
        case "qa_mismatch":
        case "inconsistency":
          // critical 错误 → 标记为需人工裁决
          unfixable.push({
            pointTempId: point.tempId,
            error,
            reason: `${error.type} 需人工裁决`,
          });
          break;
      }
    }

    return modified;
  });

  return { fixed, unfixable };
}

// 如果 unfixable 包含 critical 项 → 暂停管道，等待人工裁决
// 如果 unfixable 只有 minor 项 → 自动应用可修复的，标记 minor 的待人工确认
```

### 2.3.5 逻辑校验质量门禁

```typescript
function round3QualityGate(validation: any): GateResult {
  const { criticalErrors, majorErrors } = validation.overallAssessment;

  if (criticalErrors > 0) {
    return {
      passed: false,
      action: "human_review_required",
      reason: `存在 ${criticalErrors} 个 critical 错误，必须人工裁决`,
    };
  }

  if (majorErrors > 3) {
    return {
      passed: false,
      action: "auto_fix_and_revalidate",
      reason: `存在 ${majorErrors} 个 major 错误，自动修复后需重新校验`,
    };
  }

  return { passed: true, action: "proceed" };
}
```

---

## Round 4: 遗漏检查

### 2.4.1 设计目标

这是最终的全覆盖检查。不同于 Round 2（AI 比对），Round 4 采用了**反向索引 + 确定性规则**的方法，不依赖 AI 判断。

### 2.4.2 覆盖度计算

```typescript
// 核心算法：每个有效原文句子是否至少被一个知识点覆盖？
function computeCoverageMatrix(
  sentences: { index: number; paragraphIndex: number; content: string }[],
  points: { tempId: string; sourceQuote?: string; answer: string; keywords: string[] }[]
): CoverageMatrix {
  const matrix: CoverageCell[] = [];

  for (const sentence of sentences) {
    // 过滤掉不具备理论内容的句子（纯过渡、修辞、标点）
    if (!isInformativeSentence(sentence.content)) continue;

    const coveringPoints = points.filter(point => {
      // 策略 1：sourceQuote 直接包含该句
      if (point.sourceQuote && point.sourceQuote.includes(sentence.content.substring(0, 30))) {
        return true;
      }
      // 策略 2：answer 中的关键词与该句关键词重合度 > 50%
      const sentenceWords = extractKeywords(sentence.content);
      const pointWords = new Set([...point.keywords, ...extractKeywords(point.answer)]);
      const overlap = sentenceWords.filter(w => pointWords.has(w));
      return overlap.length / sentenceWords.length > 0.5;
    });

    matrix.push({
      sentenceIndex: sentence.index,
      paragraphIndex: sentence.paragraphIndex,
      content: sentence.content.substring(0, 80),
      isCovered: coveringPoints.length > 0,
      coveringPointIds: coveringPoints.map(p => p.tempId),
      coverageCount: coveringPoints.length,
    });
  }

  return {
    cells: matrix,
    totalInformativeSentences: matrix.length,
    coveredSentences: matrix.filter(c => c.isCovered).length,
    uncoveredSentences: matrix.filter(c => !c.isCovered),
    coverageRate: matrix.filter(c => c.isCovered).length / matrix.length,
  };
}

// 判断一个句子是否包含理论内容
function isInformativeSentence(sentence: string): boolean {
  // 过滤规则：
  if (sentence.length < 8) return false;                    // 太短
  if (/^(但是|然而|因此|所以|此外|总之|综上)/.test(sentence) && sentence.length < 20) return false;  // 过渡句
  if (/^第[一二三四五六七八九十]/.test(sentence) && !/[：:]/.test(sentence)) return false;  // 章节标题句
  if (/^(例如|比如|像)/.test(sentence)) return false;      // 举例句
  if (sentence.includes("？") && sentence.length < 30) return false;  // 设问句
  return true;
}

// 中文简易关键词提取
function extractKeywords(text: string): string[] {
  // 去掉标点、按常见分隔切词（简化版，生产环境可用结巴分词）
  return text
    .replace(/[，。、；：""''《》！？（）\s]/g, " ")
    .split(" ")
    .filter(w => w.length >= 2);
}
```

### 2.4.3 覆盖度矩阵示例

```
┌─────────────────────────────────────────────────────────────┐
│                    覆盖度矩阵（示例）                         │
│                                                             │
│  句子#  内容概要                 已覆盖？  覆盖知识点          │
│  ─────────────────────────────────────────────────────────  │
│  [0]    "习近平新时代中国特色…"    ✅      p1                │
│  [1]    "是全党全国人民为实现…"    ✅      p1                │
│  [2]    "其核心内容包括'八个…"     ✅      p2                │
│  [3]    "明确坚持和发展中国…"      ✅      p3, p4            │
│  [4]    "总任务是实现社会主义…"    ✅      p3                │
│  [5]    "在全面建成小康社会…"      ✅      p5                │
│  [6]    "明确新时代我国社会…"      ✅      p6                │
│  [7]    "全面深化改革总目标…"      ✅      p7                │
│  [8]    "全面依法治国总目标…"      ❌      —                 │
│  [9]    "党在新时代的强军目标…"    ❌      —                 │
│  ...                                                        │
│                                                             │
│  覆盖率：88.6% (31/35 有效句子)                              │
│  未覆盖：4 句 → 需要补充                                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.4.4 针对未覆盖句子的补充策略

```typescript
async function supplementUncoveredSentences(
  uncoveredSentences: CoverageCell[],
  existingPoints: KnowledgePoint[],
  domains: KnowledgeDomain[],
  fullText: string
): Promise<KnowledgePoint[]> {
  // 如果未覆盖句子 ≤ 3 句 → AI 补充（小规模补充）
  if (uncoveredSentences.length <= 3) {
    return await aiSupplementPoints(uncoveredSentences, existingPoints, domains);
  }

  // 如果未覆盖句子 > 3 句 → 将未覆盖内容送回 Round 1
  const uncoveredText = uncoveredSentences
    .map(s => s.content)
    .join("\n");

  // 递归调用 Round 1 → Round 2 → Round 3 → Round 4
  const supplementalPoints = await runMiniPipeline(uncoveredText, domains);

  return supplementalPoints;
}

// AI 小规模补充的 Prompt
async function aiSupplementPoints(
  uncovered: CoverageCell[],
  existingPoints: KnowledgePoint[],
  domains: KnowledgeDomain[]
): Promise<KnowledgePoint[]> {
  const prompt = `
以下是已提取的知识点未能覆盖的原文句子。请将这些遗漏内容转化为知识点。

【未覆盖的原文句子】
${uncovered.map((s, i) => `[${i}] ${s.content}`).join('\n')}

【已有知识领域】
${domains.map(d => `- ${d.name} (ID: ${d.tempId})`).join('\n')}

【已有知识点标题（避免重复）】
${existingPoints.map(p => `- ${p.title}`).join('\n')}

请为每个未覆盖的句子生成知识点（JSON 格式）。
`;

  // ... AI 调用 + 解析
}
```

### 2.4.5 Round 4 质量门禁

```typescript
function round4QualityGate(coverageMatrix: CoverageMatrix): GateResult {
  const { coverageRate, uncoveredSentences } = coverageMatrix;

  if (coverageRate >= 0.98) {
    return { passed: true, action: "proceed", reason: `覆盖率 ${(coverageRate*100).toFixed(1)}%，优秀` };
  }

  if (coverageRate >= 0.95) {
    return {
      passed: true,
      action: "proceed_with_warning",
      reason: `覆盖率 ${(coverageRate*100).toFixed(1)}%，有 ${uncoveredSentences.length} 句未覆盖，将在人工确认阶段标出`,
    };
  }

  if (coverageRate >= 0.85) {
    return {
      passed: false,
      action: "supplement",
      reason: `覆盖率 ${(coverageRate*100).toFixed(1)}% 不足，需补充 ${uncoveredSentences.length} 句内容`,
    };
  }

  return {
    passed: false,
    action: "re_extract",
    reason: `覆盖率 ${(coverageRate*100).toFixed(1)}% 严重不足，原始提取质量可能存在系统性问题`,
  };
}
```

---

## Round 5: 最终结构化输出

### 2.5.1 设计目标

整合前四轮的产物，执行去重、排序、关系生成、卡片生成，输出最终的结构化知识包。

### 2.5.2 处理步骤

```
输入：Round 1 提取 + Round 2 补充 + Round 3 修正 + Round 4 补充
  │
  ├─ Step 1: 去重合并
  │   检测标题相似度 > 80% 或答案相似度 > 85% 的知识点
  │   相似 → 合并（保留信息更完整的版本）
  │
  ├─ Step 2: 生成正式 ID
  │   所有 tempId → UUID v7，保留 tempId → UUID 映射表
  │
  ├─ Step 3: 构建完整 treePath
  │   从根领域向下递归，为每个知识点填充完整的 treePath 数组
  │
  ├─ Step 4: 生成知识关系
  │   为知识点之间创建关联边（父子关系 + 语义关联 + 前置关系）
  │
  ├─ Step 5: 生成记忆卡片
  │   为每个知识点创建对应的 MemoryCard（初始 SM-2 参数）
  │
  ├─ Step 6: 识别易混概念
  │   扫描同一父节点下的兄弟知识点，标记可能混淆的对
  │
  └─ Step 7: Schema 校验 + 格式化为最终输出
```

### 2.5.3 Step 3: 构建 treePath

```typescript
function buildTreePaths(
  domains: KnowledgeDomain[],
  points: KnowledgePoint[]
): KnowledgePoint[] {
  // 建立 domain ID → parentId 的 Map
  const domainMap = new Map(domains.map(d => [d.id, d]));

  function getPathToRoot(domainId: string): string[] {
    const path: string[] = [];
    let current: KnowledgeDomain | undefined = domainMap.get(domainId);
    while (current) {
      path.unshift(current.id);
      current = current.parentId ? domainMap.get(current.parentId) : undefined;
    }
    return path;
  }

  return points.map(point => {
    const domainPath = getPathToRoot(point.domainId);
    const treePath = point.parentPointId
      ? [...domainPath, point.parentPointId]
      : domainPath;

    return { ...point, treePath };
  });
}
```

### 2.5.4 Step 4: 生成知识关系

```typescript
async function generateKnowledgeRelations(
  points: KnowledgePoint[],
  domains: KnowledgeDomain[]
): Promise<KnowledgeRelation[]> {
  const relations: KnowledgeRelation[] = [];

  // 4a. 父子关系（从 treePath 自动推导）
  for (const point of points) {
    if (point.parentPointId) {
      relations.push({
        sourcePointId: point.parentPointId,
        targetPointId: point.id,
        relationType: "parent_child",
        strength: 0.9,
        generatedBy: "ai",
      });
    }
  }

  // 4b. 兄弟关系（同一父节点下的知识点，AI 判断是否相关）
  const siblings = groupBy(points, p => p.parentPointId ?? p.domainId);
  for (const [, group] of Object.entries(siblings)) {
    if (group.length < 2) continue;
    // 调用 AI 判断兄弟之间是否有语义关联
    const siblingRelations = await aiDetectSiblingRelations(group);
    relations.push(...siblingRelations);
  }

  // 4c. 跨领域关联（AI 扫描全局，发现跨分支的语义关联）
  const crossDomainRelations = await aiDetectCrossDomainRelations(points);
  relations.push(...crossDomainRelations);

  return relations;
}
```

### 2.5.5 Step 5: 生成记忆卡片

```typescript
function generateMemoryCards(points: KnowledgePoint[]): Omit<MemoryCard, "id">[] {
  return points.map(point => ({
    pointId: point.id,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: null,            // null = 从未学习
    lastReview: null,
    memoryStrength: 0,
    learningPhase: "new" as const,
    isWeak: false,
    weakSince: null,
    weakReason: null,
    consecutiveErrors: 0,
    recentRatings: [],
    totalReviews: 0,
    totalCorrect: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}
```

### 2.5.6 Step 6: 识别易混概念

```typescript
async function detectConfusingPairs(
  points: KnowledgePoint[]
): Promise<ConfusingPair[]> {
  // 策略：同父节点下的兄弟知识点最容易混淆
  const groups = groupBy(points, p => p.parentPointId ?? p.domainId);

  const candidates: { pointA: KnowledgePoint; pointB: KnowledgePoint }[] = [];

  for (const [, group] of Object.entries(groups)) {
    if (group.length < 2) continue;
    // 两两组合
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        // 只考虑标题相似度 > 0.3 的（完全不相似的标题不太可能混淆）
        const similarity = calculateTitleSimilarity(group[i].title, group[j].title);
        if (similarity > 0.3) {
          candidates.push({ pointA: group[i], pointB: group[j] });
        }
      }
    }
  }

  // 限制候选数量（避免 token 爆炸）
  const topCandidates = candidates.slice(0, 10);

  if (topCandidates.length === 0) return [];

  // 调用 AI 判断是否真的容易混淆
  return await aiJudgeConfusingPairs(topCandidates);
}
```

### 2.5.7 最终输出结构

```typescript
interface FinalKnowledgePackage {
  meta: {
    version: "1.0";
    generatedAt: number;
    sourceTextId: string;
    pipelineRounds: {
      round1: { pointCount: number; domainCount: number };
      round2: { missRate: string; missedCount: number };
      round3: { errorCount: number; criticalCount: number };
      round4: { coverageRate: number; uncoveredCount: number };
      round5: { finalPointCount: number; finalDomainCount: number };
    };
    quality: {
      coverageRate: number;       // Round 4 覆盖率
      errorRate: number;          // Round 3 错误率
      humanReviewRequired: boolean;
      unresolvedIssues: number;
    };
  };

  domains: KnowledgeDomain[];
  points: KnowledgePoint[];
  cards: Omit<MemoryCard, "id">[];
  relations: KnowledgeRelation[];
  confusingPairs: ConfusingPair[];

  // 供人工确认的待处理项
  reviewItems: {
    unresolved: UnfixableError[];              // 无法自动修复的项
    lowConfidence: { pointId: string; reason: string }[];  // 低置信度项
    uncoveredSentences: { index: number; content: string }[];  // 仍未覆盖的句子
  };
}
```

### 2.5.8 Schema 最终校验

```typescript
function finalSchemaValidation(pkg: FinalKnowledgePackage): ValidationResult {
  const errors: string[] = [];

  // 1. 所有 ID 引用必须有效
  const domainIds = new Set(pkg.domains.map(d => d.id));
  const pointIds = new Set(pkg.points.map(p => p.id));

  for (const point of pkg.points) {
    if (!domainIds.has(point.domainId)) {
      errors.push(`知识点 ${point.title}: domainId "${point.domainId}" 不存在`);
    }
    if (point.parentPointId && !pointIds.has(point.parentPointId)) {
      errors.push(`知识点 ${point.title}: parentPointId "${point.parentPointId}" 不存在`);
    }
    if (!point.treePath || point.treePath.length === 0) {
      errors.push(`知识点 ${point.title}: treePath 为空`);
    }
  }

  for (const card of pkg.cards) {
    if (!pointIds.has(card.pointId)) {
      errors.push(`卡片: pointId "${card.pointId}" 不存在`);
    }
  }

  for (const rel of pkg.relations) {
    if (!pointIds.has(rel.sourcePointId)) {
      errors.push(`关联: sourcePointId "${rel.sourcePointId}" 不存在`);
    }
    if (!pointIds.has(rel.targetPointId)) {
      errors.push(`关联: targetPointId "${rel.targetPointId}" 不存在`);
    }
  }

  // 2. 知识点必须都有 domain
  const pointsWithoutDomain = pkg.points.filter(p => !p.domainId);
  if (pointsWithoutDomain.length > 0) {
    errors.push(`${pointsWithoutDomain.length} 个知识点缺少领域归属`);
  }

  // 3. 无孤立领域（每个叶子领域至少有一个知识点）
  const leafDomains = pkg.domains.filter(d =>
    !pkg.domains.some(other => other.parentId === d.id)
  );
  for (const domain of leafDomains) {
    const hasPoints = pkg.points.some(p => p.domainId === domain.id || p.treePath?.includes(domain.id));
    if (!hasPoints) {
      errors.push(`领域 "${domain.name}" 没有任何知识点`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    pointCount: pkg.points.length,
    domainCount: pkg.domains.length,
  };
}
```

---

# 第三部分：人工确认机制

## 3.1 确认界面结构（概念设计，非 UI 代码）

```
┌──────────────────────────────────────────────────────────┐
│                  人工确认页 — 信息架构                     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ 📊 提炼摘要                                     │     │
│  │                                                │     │
│  │ 知识点：32 个   领域：3 个   层级深度：3 层      │     │
│  │ 覆盖率：97.2%   错误数：0   待处理：2 项        │     │
│  │                                                │     │
│  │ ⚠️ 2 个知识点置信度低，建议人工审核              │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ 🌳 知识领域树                           [编辑]  │     │
│  │                                                │     │
│  │ 习近平新时代中国特色社会主义思想      62%    │     │
│  │ ├── 核心要义 (8 个知识点)                       │     │
│  │ │   ├── 坚持和发展中国特色社会主义              │     │
│  │ │   ├── 实现中华民族伟大复兴                    │     │
│  │ │   └── ...                                    │     │
│  │ ├── "八个明确" (8 个)                          │     │
│  │ └── "十四个坚持" (14 个)                       │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ 📋 知识点列表（可逐条编辑）            [全选]   │     │
│  │                                                │     │
│  │ ┌────────────────────────────────────────┐    │     │
│  │ │ #1 │ 习近平新时代 │ 概念题 │ ⭐ 置信度高 │    │     │
│  │ │ Q: 新时代我国社会主要矛盾是什么？       │    │     │
│  │ │ A: 人民日益增长的美好生活需要和...       │    │     │
│  │ │ 🏷 主要矛盾 美好生活 不平衡不充分       │    │     │
│  │ │ 📍 来源：原文第2段                       │    │     │
│  │ │                    [编辑] [删除] [拆分]  │    │     │
│  │ └────────────────────────────────────────┘    │     │
│  │ ┌────────────────────────────────────────┐    │     │
│  │ │ #2 │ ⚠️ 低置信度 │ 党史 │ 概念题        │    │     │
│  │ │ ...                    [审核] [编辑]     │    │     │
│  │ └────────────────────────────────────────┘    │     │
│  │ ...                                          │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ ⚠️ 待处理项 (2)                                │     │
│  │                                                │     │
│  │ · 知识点 #15: 关键词缺失，需人工补充             │     │
│  │ · 知识点 #23: 与 #7 存在潜在矛盾，需确认         │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ 📝 未覆盖内容 (3 句)                            │     │
│  │                                                │     │
│  │ · [句8] 全面依法治国总目标是...   [添加为知识点] │     │
│  │ · [句9] 党在新时代的强军目标是...  [添加为知识点] │     │
│  │ · [句21] 中国特色大国外交...      [忽略]        │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  [取消]                         [确认导入 (32 个知识点)]  │
└──────────────────────────────────────────────────────────┘
```

## 3.2 人工操作支持

| 操作 | 触发 | 效果 |
|------|------|------|
| **编辑** | 点击知识点的「编辑」按钮 | 展开行内编辑表单，可修改 title/question/answer/keywords/difficulty/questionType/domainId |
| **删除** | 点击「删除」| 二次确认后从列表中移除该知识点 |
| **拆分** | 点击「拆分」| 将一个包含多个要点的知识点拆分为多个独立知识点 |
| **合并** | 选中 2 个知识点 → 点击「合并」| 合并为 1 个，保留信息更完整的版本 |
| **添加** | 点击「添加知识点」按钮 | 空白表单，手动创建一个新知识点 |
| **移动** | 拖拽知识点到树中其他位置 | 改变 domainId 或 parentPointId |
| **调整层级** | 在领域树中拖拽领域节点 | 改变领域父子关系 |
| **处理待处理项** | 点击待处理项 | 跳转到对应知识点，展示 AI 建议的修复方案，用户选择接受/拒绝/手动修改 |
| **添加遗漏** | 点击未覆盖句子的「添加为知识点」| AI 自动填充问题的 question/answer，用户确认或修改 |

## 3.3 确认规则

```
用户确认前必须满足：

□ 所有 high-severity 待处理项已解决
□ 所有 critical 错误已人工裁决
□ 覆盖率 ≥ 95%（或用户主动确认接受当前覆盖率）
□ 至少浏览过一次知识点列表（防止直接点确认）

确认后：
  → 写入 IndexedDB（批量事务）
  → 知识点 refinementStatus → "confirmed"
  → 源文本 extractionStatus → "confirmed"
  → 跳转首页，展示「知识已就绪，开始学习吧」
```

---

# 第四部分：错误控制机制

## 4.1 错误分类

```
┌──────────────────────────────────────────────────────────┐
│                     错误分类体系                          │
│                                                          │
│  L1: 可自动恢复                                          │
│   ├── JSON 解析失败        → 重试（最多 2 次）            │
│   ├── 网络超时             → 重试（指数退避）             │
│   ├── API 限流             → 等待 + 重试                  │
│   └── Schema 校验失败      → 自动填充默认值               │
│                                                          │
│  L2: 可自动降级                                          │
│   ├── 模型不可用           → 切换备选模型                  │
│   ├── Token 超限           → 分段处理                     │
│   └── 输出不完整           → 继续处理已有部分 + 标记缺失   │
│                                                          │
│  L3: 需要人工干预                                          │
│   ├── 连续重试失败         → 暂停管道，展示错误 + 重试按钮 │
│   ├── Critical 逻辑错误    → 暂停管道，人工裁决            │
│   ├── 覆盖率严重不足       → 暂停管道，人工判断是否继续    │
│   └── AI 行为异常          → 暂停管道，换模型重试          │
│                                                          │
│  L4: 致命错误                                             │
│   ├── 原文完全无法解析     → 提示用户确认文本格式          │
│   ├── 所有模型均不可用     → 提示用户检查 API 配置         │
│   └── IndexedDB 写入失败   → 导出 JSON 兜底               │
└──────────────────────────────────────────────────────────┘
```

## 4.2 重试策略

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;           // 基础延迟 ms
  maxDelay: number;            // 最大延迟 ms
  backoffMultiplier: number;   // 退避乘数
  retryableErrors: string[];   // 可重试的错误类型
}

const roundRetryConfigs: Record<string, RetryConfig> = {
  round1: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 3,
    retryableErrors: ["json_parse_error", "timeout", "rate_limit", "incomplete_output"],
  },
  round2: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    retryableErrors: ["json_parse_error", "timeout", "rate_limit"],
  },
  round3: {
    maxRetries: 1,  // 逻辑校验重试 1 次即可（如果第一次就有大量错误，重试不会消除）
    baseDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableErrors: ["json_parse_error", "timeout"],
  },
  round4: {
    maxRetries: 0,  // 覆盖率检查是确定性算法，不需要重试
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    retryableErrors: [],
  },
  round5: {
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableErrors: ["schema_validation_error"],
  },
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  roundName: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isRetryable = config.retryableErrors.some(
        e => error.message?.includes(e)
      );

      if (!isRetryable || attempt === config.maxRetries) {
        throw new PipelineError(
          `${roundName} 失败（尝试 ${attempt + 1}/${config.maxRetries + 1}）: ${error.message}`,
          roundName,
          attempt + 1,
          error
        );
      }

      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
```

## 4.3 模型降级策略

```typescript
const modelFallbackChain: Record<string, string[]> = {
  "gpt-4o":           ["gpt-4o-mini", "claude-sonnet-4-6"],
  "gpt-4o-mini":      ["claude-haiku-4-5"],
  "claude-opus-4-8":  ["claude-sonnet-4-6", "gpt-4o"],
  "claude-sonnet-4-6":["claude-haiku-4-5", "gpt-4o-mini"],
  "claude-haiku-4-5": ["gpt-4o-mini"],
};

async function callAIWithFallback(
  prompt: string,
  preferredModel: string,
  provider: string,
  apiKey: string,
  baseUrl: string
): Promise<AIResponse> {
  const models = [preferredModel, ...(modelFallbackChain[preferredModel] || [])];

  for (const model of models) {
    try {
      // 判断 model 对应的 provider
      const modelProvider = model.startsWith("claude-") ? "anthropic" :
                            model.startsWith("gpt-") || model.startsWith("o") ? "openai" :
                            provider;

      const result = await callAI(prompt, model, modelProvider, apiKey, baseUrl);
      return { ...result, model, modelProvider, fallbackUsed: model !== preferredModel };
    } catch (error) {
      if (error.message?.includes("rate_limit") || error.message?.includes("429")) {
        continue; // 限流 → 换模型
      }
      if (error.message?.includes("not_found") || error.message?.includes("404")) {
        continue; // 模型不存在 → 换模型
      }
      throw error; // 其他错误 → 不降级，直接抛出
    }
  }

  throw new Error(`所有模型均不可用: ${models.join(", ")}`);
}
```

---

# 第五部分：数据流完整时序

## 5.1 端到端流程

```
客户端                          服务端                         AI Provider
  │                               │                               │
  │  用户粘贴文本 + 点击「提炼」   │                               │
  │ ─────────────────────────────►│                               │
  │                               │                               │
  │                               │  预处理：清洗 + 分句            │
  │                               │                               │
  │                               │  Round 1: 粗提取               │
  │                               │ ──────────────────────────────►│
  │                               │ ◄──────────────────────────────│
  │                               │  校验 JSON Schema              │
  │                               │  覆盖率初检                     │
  │                               │                               │
  │                               │  Round 2: 逐句比对              │
  │                               │ ──────────────────────────────►│
  │                               │ ◄──────────────────────────────│
  │                               │  质量门禁（遗漏率检查）          │
  │                               │  自动补充遗漏（如需要）          │
  │                               │                               │
  │                               │  Round 3: 逻辑校验              │
  │                               │ ──────────────────────────────►│
  │                               │ ◄──────────────────────────────│
  │                               │  自动修复可修复的错误            │
  │                               │  质量门禁（错误率检查）          │
  │                               │                               │
  │                               │  Round 4: 遗漏检查              │
  │                               │  （确定性算法，不调用 AI）       │
  │                               │  覆盖度矩阵计算                 │
  │                               │  补充遗漏（如需要→调用AI）       │
  │                               │  质量门禁（覆盖率检查）          │
  │                               │                               │
  │                               │  Round 5: 最终结构化            │
  │                               │  去重合并                       │
  │                               │  生成 ID                       │
  │                               │  构建 treePath                 │
  │                               │  生成关联关系（调用 AI）         │
  │                               │ ──────────────────────────────►│
  │                               │ ◄──────────────────────────────│
  │                               │  生成记忆卡片                   │
  │                               │  识别易混概念（调用 AI）         │
  │                               │ ──────────────────────────────►│
  │                               │ ◄──────────────────────────────│
  │                               │  Schema 最终校验                │
  │                               │                               │
  │  返回 FinalKnowledgePackage   │                               │
  │ ◄─────────────────────────────│                               │
  │                               │                               │
  │  展示人工确认页                │                               │
  │  用户编辑/确认                 │                               │
  │                               │                               │
  │  确认 → 写入 IndexedDB        │                               │
  │  （客户端本地操作）            │                               │
```

## 5.2 每轮耗时估算

```
文本长度：2000 字（约 40-50 句）

Round 1（粗提取）      :  ~15-20 秒
Round 2（逐句比对）     :  ~20-25 秒  （句子越多越慢）
Round 3（逻辑校验）     :  ~10-15 秒
Round 4（遗漏检查）     :  ~1 秒      （确定性算法，本地计算）
Round 5（最终结构化）   :  ~5-10 秒   （关系 + 易混需要各调一次 AI）
─────────────────────────────────
总计                    :  ~51-71 秒

注：如果 Round 4 需要补充遗漏，额外增加 15-25 秒（小规模 AI 补充）
```

## 5.3 服务端 SSE 推送

```typescript
// 服务端使用 SSE 向客户端推送管道进度
// GET /api/ai/extract-stream?sourceTextId=xxx

interface SSEEvent {
  type: "progress" | "round_start" | "round_complete" | "error" | "complete";
  round?: number;
  roundName?: string;
  status?: "running" | "completed" | "failed";
  data?: any;
  message?: string;
}

// SSE 事件序列示例
events = [
  { type: "round_start", round: 1, roundName: "粗提取", message: "正在提取知识点…" },
  { type: "round_complete", round: 1, data: { pointCount: 28, domainCount: 3 } },
  { type: "round_start", round: 2, roundName: "逐句比对", message: "正在逐句比对原文…" },
  { type: "round_complete", round: 2, data: { missRate: "8.3%", missedCount: 3 } },
  { type: "round_start", round: 3, roundName: "逻辑校验", message: "正在校验知识点准确性…" },
  { type: "round_complete", round: 3, data: { totalErrors: 2, criticalErrors: 0 } },
  { type: "round_start", round: 4, roundName: "遗漏检查", message: "正在计算覆盖率…" },
  { type: "round_complete", round: 4, data: { coverageRate: 0.972, uncoveredCount: 1 } },
  { type: "round_start", round: 5, roundName: "最终结构化", message: "正在生成知识结构…" },
  { type: "round_complete", round: 5, data: { finalPointCount: 32, finalDomainCount: 3 } },
  { type: "complete", data: finalKnowledgePackage },
];
```

---

# 第六部分：Prompt 统一规范

## 6.1 所有 Prompt 共同遵守的规则

```
1. 政治术语严格性
   - 原文中出现的政治术语必须原样保留，不得改写、简化、替换
   - "习近平新时代中国特色社会主义思想" 不能缩写成 "习思想"
   - "以人民为中心" 不能写成 "以人为本"
   - 引用领导人讲话必须逐字核对

2. JSON 格式严格性
   - 所有输出必须是合法的 JSON
   - 所有 required 字段必须存在
   - 数组不能为空（除非逻辑合理）
   - 字符串不能为 ""（除非明确允许）

3. 温度设置
   - Round 1: 0.1  （提取需要精确）
   - Round 2: 0.1  （比对需要精确）
   - Round 3: 0.2  （校验需要精确但允许一些推理）
   - Round 5 关系生成: 0.4（需要创造性发现关联）
   - Round 5 易混识别: 0.4（需要创造性判断混淆可能性）

4. Token 预算
   - max_tokens 设置为输出空间的 1.5 倍
   - 如果输出被截断 → 立即重试，不做部分解析

5. 错误处理
   - 如果 AI 返回的不是 JSON → 重试
   - 如果 AI 在 JSON 外包裹了 markdown 代码块 → 提取后解析
   - 如果 JSON 中有多余字段 → 忽略
   - 如果 JSON 中缺少必填字段 → 重试
```

## 6.2 党课知识分类参考（注入 System Prompt）

```
【党课理论知识分类参考】

一级分类：
- 习近平新时代中国特色社会主义思想
- 中共党史
- 党章党规
- 党的基本理论（马列主义、毛泽东思想、邓小平理论、"三个代表"重要思想、科学发展观）
- 党的路线方针政策
- 党的建设（政治建设、思想建设、组织建设、作风建设、纪律建设、制度建设）
- 党内法规制度

二级分类（以习近平新时代中国特色社会主义思想为例）：
- 核心要义
- "八个明确"
- "十四个坚持"
- "五位一体"总体布局
- "四个全面"战略布局
- 新发展理念
- 人类命运共同体
- 总体国家安全观
- 党在新时代的强军目标
- "一国两制"和祖国统一

这个分类体系注入到所有 Prompt 中，帮助 AI 正确归类知识点。
```

---

# 第七部分：API 路由设计

## 7.1 服务端路由

```typescript
// server/src/routes/ai.ts

// 开始提炼（SSE 流式）
POST  /api/ai/extract-stream
  Body: { sourceTextId: string }
  Response: SSE Stream<SSEEvent>
  // 前端监听 SSE，实时更新进度 UI

// 单步提炼（非流式，用于调试或单轮重试）
POST  /api/ai/extract
  Body: { sourceTextId: string }
  Response: FinalKnowledgePackage

// 重试某一轮
POST  /api/ai/retry-round
  Body: {
    sourceTextId: string,
    round: number,          // 1-5
    previousResults: {...}  // 之前轮次的结果
  }
  Response: { round: number; result: any }

// AI 判分
POST  /api/ai/score
  Body: {
    standardAnswer: string,
    keywords: string[],
    userAnswer: string,
    questionType: string
  }
  Response: { score: number; covered: string[]; missing: string[]; suggestion: string }

// 检测易混概念（手动触发）
POST  /api/ai/detect-confusing
  Body: { pointIds: string[] }
  Response: ConfusingPair[]

// 生成论述骨架（手动触发）
POST  /api/ai/generate-skeleton
  Body: { pointId: string }
  Response: EssaySkeleton

// 测试连接
POST  /api/ai/test-connection
  Body: { provider: string; model: string; apiKey: string; baseUrl?: string }
  Response: { success: boolean; latency: number; model: string }
```

## 7.2 安全措施

```typescript
// API Key 只在服务端使用，客户端不存储明文
// 客户端通过加密通道发送 API Key（首次配置时）
// 服务端收到后不存储，仅在内存中保留到请求结束

// 限流
rateLimit({
  windowMs: 60 * 1000,    // 1 分钟窗口
  max: 5,                  // 最多 5 次 AI 调用（提炼很贵）
  message: "AI 调用频率过高，请稍后再试",
});

// 输入验证
const extractSchema = z.object({
  sourceTextId: z.string().uuid(),
});
```

---

# 第八部分：设计总结

## 为什么是五轮而非三轮

| 五轮设计 | 如果合并为三轮会失去什么 |
|----------|------------------------|
| R1 粗提取 | 独立的粗提取允许使用低温度(0.1)，追求广度 |
| R2 逐句比对 | **这是防遗漏的核心**。如果没有独立轮次，逐句比对和提取混在一起，AI 会偷懒跳过 |
| R3 逻辑校验 | 独立的校验轮次使用不同的 Prompt 策略——不再是"提取"模式，而是"找茬"模式 |
| R4 遗漏检查 | 确定性算法，不依赖 AI。如果合并到 R2，就无法量化衡量"到底漏了多少" |
| R5 最终结构化 | 去重、排序、生成关联和易混识别需要整体视角，不适合分散到前面轮次 |

## 核心防遗漏策略

1. **Round 2 逐句比对** — AI 逐句检查，不跳过任何一句话
2. **Round 4 覆盖度矩阵** — 确定性算法量化覆盖率，不依赖 AI 的主观判断
3. **遗漏率门禁** — 每个质量门禁都是硬性的，不达标不能进入下一轮
4. **未覆盖句子的三种处理** — AI 小规模补充(≤3句) / 送回 Round 1(>3 句) / 人工处理(用户选择)

## 核心防错误策略

1. **Round 3 四维度校验** — 事实准确性 + 层级合理性 + 逻辑一致性 + 完整性
2. **自动修复可修复的错误** — 措辞错误自动替换，不做无意义的人工打断
3. **Critical 错误必须人工裁决** — 不自动处理可能导致知识错误的 judgment call
4. **Schema 校验贯穿全过程** — 每轮输出都过 Zod schema，不合规不通过

## 人工确认的定位

人工确认不是「AI 做完了让人复查一遍」——那是把工作量推给用户。

人工确认是「AI 标注了不确定的地方，人只需要看那些不确定的」。

- 置信度高的知识点：批量确认，一键通过
- 置信度低的知识点：逐条审核
- 待处理项：AI 给出建议方案，用户选择接受/拒绝
- 未覆盖句子：AI 给出建议知识点，用户确认/修改/忽略

---

*AI 知识提炼管道设计文档结束。*
