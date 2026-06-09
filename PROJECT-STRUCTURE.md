# 党课理论知识智能记忆系统 — 项目工程结构

---

## 文档信息

| 项 | 内容 |
|---|------|
| 版本 | v1.0 |
| 日期 | 2026-06-09 |
| 原则 | 高可维护 · 高扩展 · 禁止过度复杂 |

---

# 第一部分：目录结构

## 1.1 顶层

```
party-theory-memory/
├── client/                          # 前端应用
│   ├── public/                      # 静态资源
│   │   ├── favicon.svg
│   │   ├── manifest.json            # PWA manifest
│   │   └── sw.js                    # Service Worker（vite-plugin-pwa 生成）
│   ├── src/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── server/                          # 后端服务
│   ├── src/
│   ├── tsconfig.json
│   └── package.json
│
├── shared/                          # 共享类型
│   ├── types/                       # TypeScript 类型定义
│   │   ├── domain.ts                # 知识领域
│   │   ├── knowledge.ts             # 知识点
│   │   ├── memory.ts                # 记忆卡片
│   │   ├── review.ts                # 复习记录
│   │   ├── ai.ts                    # AI 管道
│   │   ├── settings.ts              # 用户设置
│   │   └── index.ts                 # 统一导出
│   └── constants/                   # 共享常量
│       ├── algorithm.ts             # 算法默认参数
│       ├── questionTypes.ts         # 题型枚举
│       └── phases.ts                # 学习阶段枚举
│
├── .gitignore
├── .prettierrc
├── .eslintrc.cjs
└── README.md
```

---

## 1.2 前端目录 (client/src)

```
client/src/
├── app/                             # 应用入口
│   ├── App.tsx                      # 根组件：路由 + TabBar + Toast
│   ├── router.tsx                   # 路由配置（5 个页面）
│   └── main.tsx                     # ReactDOM.createRoot
│
├── pages/                           # 页面（每个页面一个文件夹）
│   ├── home/
│   │   ├── HomePage.tsx             # 首页主组件
│   │   ├── StatusCardGroup.tsx      # 状态卡片组（今日复习/持续天数/保持率）
│   │   ├── DomainList.tsx           # 知识领域列表
│   │   └── DomainCard.tsx           # 单个领域卡片
│   │
│   ├── learn/
│   │   ├── LearnPage.tsx            # 学习页主组件
│   │   ├── LearnSession.tsx         # 学习会话（卡片队列管理）
│   │   ├── LearnComplete.tsx        # 学习完成画面
│   │   └── DailyLimitReached.tsx    # 每日上限提示
│   │
│   ├── review/
│   │   ├── ReviewPage.tsx           # 复习页主组件
│   │   ├── ReviewSession.tsx        # 复习会话
│   │   ├── AiScoringInput.tsx       # AI 判分输入区
│   │   ├── AiScoringResult.tsx      # AI 判分结果卡片
│   │   └── ReviewComplete.tsx       # 复习完成画面
│   │
│   ├── focus/
│   │   ├── FocusPage.tsx            # 重点强化页主组件
│   │   ├── ConfusingPairSection.tsx # 易混概念区块
│   │   ├── ConfusingPairCard.tsx    # 对比卡片
│   │   ├── WeakPointSection.tsx     # 薄弱知识点区块
│   │   ├── WeakPointCard.tsx        # 薄弱卡片
│   │   ├── EssaySkeletonSection.tsx # 论述骨架区块
│   │   ├── EssaySkeletonCard.tsx    # 骨架摘要卡片
│   │   ├── EssaySkeletonDetail.tsx  # 骨架展开详情
│   │   ├── KnowledgeGraphSection.tsx# 知识图谱区块
│   │   └── KnowledgeGraphCanvas.tsx # 力导向图画布
│   │
│   └── settings/
│       ├── SettingsPage.tsx         # 设置页主组件
│       ├── AiConfigSection.tsx      # AI 配置区块
│       ├── KnowledgeManageSection.tsx# 知识库管理区块
│       ├── ImportTextPage.tsx       # 粘贴文本导入页
│       ├── ImportPreviewPage.tsx    # 提炼预览确认页
│       ├── LearningPrefSection.tsx  # 学习偏好区块
│       ├── DataStatsSection.tsx     # 数据统计区块
│       └── DangerZoneSection.tsx    # 危险操作区块
│
├── components/                      # 共享组件
│   ├── card/                        # 卡片组件族
│   │   ├── FlipCard.tsx             # 翻转卡片容器（正面/背面切换）
│   │   ├── CardFront.tsx            # 卡片正面（问题面）
│   │   ├── CardBack.tsx             # 卡片背面（答案面）
│   │   ├── CardBreadcrumb.tsx       # 卡片面包屑（知识树路径）
│   │   └── CardKeywords.tsx         # 关键词标签组
│   │
│   ├── rating/                      # 评分组件
│   │   ├── RatingButtons.tsx        # 4 级自评按钮组
│   │   └── RatingButton.tsx         # 单个自评按钮
│   │
│   ├── progress/                    # 进度组件
│   │   ├── ThinProgressBar.tsx      # 顶部细进度条
│   │   └── RingProgress.tsx         # 环形进度图（领域掌握度）
│   │
│   ├── navigation/                  # 导航组件
│   │   ├── TabBar.tsx               # 底部 Tab Bar
│   │   └── TabBarItem.tsx           # 单个 Tab
│   │
│   ├── feedback/                    # 反馈组件
│   │   ├── Toast.tsx                # Toast 提示
│   │   ├── ToastContainer.tsx       # Toast 容器（定位层）
│   │   ├── ConfirmDialog.tsx        # 确认对话框（唯一 Modal）
│   │   └── LoadingSkeleton.tsx      # 骨架屏
│   │
│   ├── tree/                        # 知识树组件
│   │   ├── DomainTreeView.tsx       # 领域树视图
│   │   └── TreeNode.tsx             # 树节点
│   │
│   └── common/                      # 通用原子组件
│       ├── Button.tsx               # 通用按钮（主/次/危险 3 变体）
│       ├── Input.tsx                # 文本输入框
│       ├── Select.tsx               # 下拉选择器
│       ├── Stepper.tsx              # 步进器
│       ├── Toggle.tsx               # 开关
│       ├── EmptyState.tsx           # 空状态占位
│       └── Sheet.tsx                # 底部弹出 Sheet
│
├── stores/                          # Zustand 状态管理
│   ├── domainStore.ts               # 领域 + 知识点状态
│   ├── learnStore.ts                # 学习会话状态
│   ├── reviewStore.ts               # 复习会话状态
│   ├── focusStore.ts                # 重点强化状态
│   ├── settingsStore.ts             # 设置状态
│   ├── uiStore.ts                   # UI 状态
│   └── index.ts                     # 统一导出
│
├── hooks/                           # 自定义 Hooks
│   ├── useCards.ts                  # 卡片 CRUD + 查询
│   ├── useReviewQueue.ts            # 复习队列构建 + 排序
│   ├── useLearnSession.ts           # 学习会话生命周期
│   ├── useReviewSession.ts          # 复习会话生命周期
│   ├── useFlipCard.ts               # 卡片翻转动画状态
│   ├── useMemoryStrength.ts         # memoryStrength 实时计算
│   ├── useForgettingCurve.ts        # 遗忘曲线数据生成
│   ├── useAiScoring.ts              # AI 判分请求
│   ├── useAiExtraction.ts           # AI 提炼管道 + SSE
│   ├── useKnowledgeGraph.ts         # 知识图谱数据构建
│   ├── useDebounce.ts               # 防抖
│   ├── useOnlineStatus.ts           # 在线/离线检测
│   └── useNotification.ts           # 推送通知
│
├── services/                        # 服务层
│   ├── api/                         # API 调用
│   │   ├── client.ts                # fetch 封装（baseUrl、headers、错误处理）
│   │   ├── ai.ts                    # AI 相关 API（提炼、判分、骨架）
│   │   └── health.ts                # 健康检查
│   │
│   └── ai/                          # AI Provider 抽象
│       ├── provider.ts              # Provider 接口定义
│       ├── openai.ts                # OpenAI 实现
│       ├── anthropic.ts             # Anthropic Claude 实现
│       ├── factory.ts               # Provider 工厂（根据配置创建）
│       └── stream.ts                # SSE 流式处理
│
├── engine/                          # 记忆算法引擎（纯函数）
│   ├── sm2.ts                       # SM-2 改进算法核心
│   ├── memoryStrength.ts            # memoryStrength 五维度计算
│   ├── forgettingCurve.ts           # 遗忘曲线 + R(t) 计算
│   ├── scheduler.ts                 # 复习调度 + 队列构建
│   └── index.ts
│
├── db/                              # IndexedDB 数据层
│   ├── schema.ts                    # Dexie 数据库定义 + 版本
│   ├── domains.ts                   # knowledgeDomains CRUD
│   ├── points.ts                    # knowledgePoints CRUD
│   ├── cards.ts                     # memoryCards CRUD + 查询
│   ├── logs.ts                      # reviewLogs CRUD + 聚合
│   ├── sources.ts                   # sourceTexts CRUD
│   ├── relations.ts                 # knowledgeRelations CRUD
│   ├── pairs.ts                     # confusingPairs CRUD
│   ├── skeletons.ts                 # essaySkeletons CRUD
│   ├── settings.ts                  # userSettings CRUD
│   ├── rounds.ts                    # aiRefinementRounds CRUD
│   └── index.ts
│
├── utils/                           # 工具函数
│   ├── uuid.ts                      # UUID v7 生成
│   ├── crypto.ts                    # Web Crypto API 加解密
│   ├── time.ts                      # 时间格式化、相对时间
│   ├── text.ts                      # 文本处理（分句、分词、清洗）
│   ├── similarity.ts                # 标题相似度计算
│   └── coverage.ts                  # 覆盖度矩阵计算
│
├── styles/                          # 样式
│   ├── globals.css                  # 全局样式 + Tailwind 指令
│   └── variables.css                # CSS 自定义属性（颜色、间距）
│
└── types/                           # 前端特有问题
    └── ui.ts                        # UI 状态类型（Tab、Toast、Loading）
```

---

## 1.3 后端目录 (server/src)

```
server/src/
├── index.ts                         # Express 应用入口
├── app.ts                           # Express 配置（中间件、路由挂载）
│
├── routes/                          # 路由
│   ├── ai.ts                        # /api/ai/* AI 代理路由
│   └── health.ts                    # /api/health 健康检查
│
├── services/                        # 业务逻辑
│   ├── ai/                          # AI 服务
│   │   ├── provider.ts              # AI Provider 接口（同前端抽象）
│   │   ├── openai.ts               # OpenAI 实现
│   │   ├── anthropic.ts            # Anthropic 实现
│   │   └── factory.ts              # Provider 工厂
│   │
│   ├── extraction/                  # 知识提炼管道
│   │   ├── pipeline.ts              # 五轮管道编排
│   │   ├── round1-extract.ts        # 第一轮：粗提取
│   │   ├── round2-audit.ts          # 第二轮：逐句比对
│   │   ├── round3-validate.ts       # 第三轮：逻辑校验
│   │   ├── round4-coverage.ts       # 第四轮：遗漏检查（确定性算法）
│   │   └── round5-structure.ts      # 第五轮：最终结构化
│   │
│   ├── scoring.ts                   # AI 判分
│   ├── confusing.ts                 # 易混概念检测
│   ├── skeleton.ts                  # 论述骨架生成
│   └── relation.ts                  # 知识关联生成
│
├── prompts/                         # Prompt 模板
│   ├── extract.ts                   # Round 1 提取 Prompt
│   ├── audit.ts                     # Round 2 比对 Prompt
│   ├── validate.ts                  # Round 3 校验 Prompt
│   ├── score.ts                     # 判分 Prompt
│   ├── confusing.ts                 # 易混识别 Prompt
│   ├── skeleton.ts                  # 骨架生成 Prompt
│   ├── relation.ts                  # 关联生成 Prompt
│   └── system.ts                    # System Prompt 公共部分
│
├── middleware/                       # 中间件
│   ├── rateLimit.ts                 # API 限流
│   ├── validateBody.ts              # Zod 请求体校验
│   └── errorHandler.ts             # 全局错误处理
│
├── utils/                           # 工具函数
│   ├── text.ts                      # 文本预处理（分句、分词）
│   ├── json.ts                      # JSON 安全解析 + 修复
│   └── retry.ts                     # 重试逻辑
│
└── types/                           # 服务端特有问题
    └── express.ts                   # Express 类型扩展
```

---

# 第二部分：组件树

## 2.1 完整组件树

```
App
├── ToastContainer                  ← 全局 Toast 层
├── ConfirmDialog                   ← 全局 Modal（条件渲染）
│
├── <Router>                        ← React Router
│   │
│   ├── HomePage                    ← 路由: /
│   │   ├── StatusCardGroup
│   │   │   ├── StatusCard          (今日待复习)
│   │   │   ├── StatusCard          (持续学习)
│   │   │   └── StatusCard          (记忆保持率)
│   │   ├── Button                  (开始学习 → 智能分流)
│   │   └── DomainList
│   │       └── DomainCard × N
│   │           └── RingProgress    (掌握度环形图)
│   │
│   ├── LearnPage                   ← 路由: /learn
│   │   ├── ThinProgressBar         (顶部进度)
│   │   ├── LearnSession
│   │   │   ├── FlipCard
│   │   │   │   ├── CardFront
│   │   │   │   │   └── CardBreadcrumb
│   │   │   │   └── CardBack
│   │   │   │       └── CardKeywords
│   │   │   ├── Button              (翻转按钮)
│   │   │   └── RatingButtons
│   │   │       └── RatingButton × 4
│   │   ├── DailyLimitReached       (条件渲染)
│   │   └── LearnComplete           (条件渲染)
│   │
│   ├── ReviewPage                  ← 路由: /review
│   │   ├── ThinProgressBar
│   │   ├── ReviewSession
│   │   │   ├── FlipCard            (同 LearnSession 共享)
│   │   │   ├── AiScoringInput      (论述题时显示)
│   │   │   ├── AiScoringResult     (判分返回后显示)
│   │   │   ├── Button              (提交答案 / 翻转)
│   │   │   └── RatingButtons
│   │   └── ReviewComplete
│   │
│   ├── FocusPage                   ← 路由: /focus
│   │   ├── ConfusingPairSection
│   │   │   └── ConfusingPairCard × N
│   │   ├── WeakPointSection
│   │   │   └── WeakPointCard × N
│   │   │       └── ThinProgressBar (错误率)
│   │   ├── EssaySkeletonSection
│   │   │   └── EssaySkeletonCard × N
│   │   └── KnowledgeGraphSection
│   │       └── KnowledgeGraphCanvas
│   │
│   ├── SettingsPage                ← 路由: /settings
│   │   ├── AiConfigSection
│   │   │   ├── Select              (Provider)
│   │   │   ├── Input               (API Key)
│   │   │   ├── Select              (Model)
│   │   │   └── Button              (测试连接)
│   │   ├── KnowledgeManageSection
│   │   │   ├── Button              (粘贴文本)
│   │   │   ├── Button              (导入文件)
│   │   │   ├── Button              (导出数据)
│   │   │   └── Button              (导入备份)
│   │   ├── LearningPrefSection
│   │   │   ├── Stepper × 2         (每日新卡片/复习上限)
│   │   │   ├── Input               (提醒时间)
│   │   │   └── Toggle              (提醒开关)
│   │   ├── DataStatsSection
│   │   ├── DangerZoneSection
│   │   │   └── Button              (清空数据 - 危险变体)
│   │   ├── ImportTextPage          ← 路由: /settings/import
│   │   │   ├── Input               (文本输入区)
│   │   │   └── Button              (开始 AI 提炼)
│   │   └── ImportPreviewPage       ← 路由: /settings/import/preview
│   │       ├── DomainTreeView
│   │       │   └── TreeNode × N
│   │       ├── [知识点列表 - 可编辑]
│   │       └── Button              (确认导入)
│   │
│   └── <Navigate>                  ← 默认重定向到 /
│
└── TabBar                          ← 固定在底部
    └── TabBarItem × 5
```

## 2.2 组件拆分原则

```
拆分信号：
  ✅ 组件超过 150 行
  ✅ 有独立的状态逻辑
  ✅ 在 2 个以上页面中使用
  ✅ 有独立的动画
  ✅ 有条件渲染的变体

不拆分信号：
  ❌ 只有 10 行 JSX
  ❌ 只在一个地方使用且没有独立逻辑
  ❌ 拆开后需要传递大量 props

一个文件一个组件。
组件名 = 文件名。
用 named export 而非 default export（方便重构时改名）。
```

---

# 第三部分：数据流架构

## 3.1 数据流全景

```
┌─────────────────────────────────────────────────────────────┐
│                        数据流                                │
│                                                             │
│  IndexedDB (Dexie)                                          │
│  ┌──────────────────────────────────────────────────┐      │
│  │  持久层：9 张表                                    │      │
│  │  所有数据的真实来源（Source of Truth）             │      │
│  └──────────────────┬───────────────────────────────┘      │
│                     │                                        │
│                     │ 读写                                   │
│                     ▼                                        │
│  db/ (数据访问层)                                            │
│  ┌──────────────────────────────────────────────────┐      │
│  │  cards.ts / points.ts / domains.ts / logs.ts ...  │      │
│  │  每张表一个文件，封装 CRUD + 查询方法              │      │
│  └──────────────────┬───────────────────────────────┘      │
│                     │                                        │
│                     │ 调用                                   │
│                     ▼                                        │
│  engine/ (算法引擎)                                          │
│  ┌──────────────────────────────────────────────────┐      │
│  │  纯函数，不依赖 IndexedDB，不依赖 React            │      │
│  │  sm2.ts / memoryStrength.ts / scheduler.ts        │      │
│  └──────────────────┬───────────────────────────────┘      │
│                     │                                        │
│                     │ 被调用                                 │
│                     ▼                                        │
│  stores/ (Zustand)                                           │
│  ┌──────────────────────────────────────────────────┐      │
│  │  内存缓存 + 业务逻辑编排                          │      │
│  │  domainStore / learnStore / reviewStore / ...     │      │
│  └──────────────────┬───────────────────────────────┘      │
│                     │                                        │
│                     │ 消费                                   │
│                     ▼                                        │
│  hooks/ (自定义 Hooks)                                       │
│  ┌──────────────────────────────────────────────────┐      │
│  │  连接 Store 和 Component                          │      │
│  │  封装副作用（useEffect）、动画状态、异步请求       │      │
│  └──────────────────┬───────────────────────────────┘      │
│                     │                                        │
│                     │ 消费                                   │
│                     ▼                                        │
│  components/ + pages/ (UI 层)                                │
│  ┌──────────────────────────────────────────────────┐      │
│  │  只负责渲染 + 用户交互                            │      │
│  │  不直接访问 IndexedDB                             │      │
│  │  不包含业务逻辑（算法调用）                        │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 3.2 各层职责边界

```
┌──────────────┬──────────────────────────────────────────────┐
│     层       │              允许做什么                       │
├──────────────┼──────────────────────────────────────────────┤
│ components/  │ 渲染 JSX、接收 props、触发事件               │
│ pages/       │ 组合组件、调用 hooks、页面级布局              │
│              │ 禁止：直接调 db/、直接调 engine/              │
├──────────────┼──────────────────────────────────────────────┤
│ hooks/       │ 连接 Store 和 Component                      │
│              │ 管理组件生命周期副作用                        │
│              │ 禁止：直接写 IndexedDB（通过 Store 或 db/）   │
├──────────────┼──────────────────────────────────────────────┤
│ stores/      │ 全局状态缓存 + 业务逻辑编排                   │
│              │ 调用 db/ 读写数据                             │
│              │ 调用 engine/ 执行算法                         │
│              │ 禁止：包含 JSX 或 DOM 操作                    │
├──────────────┼──────────────────────────────────────────────┤
│ engine/      │ 纯函数，无副作用                              │
│              │ 输入 → 计算 → 输出                            │
│              │ 禁止：访问 IndexedDB、访问 store、调 API       │
├──────────────┼──────────────────────────────────────────────┤
│ db/          │ IndexedDB CRUD 封装                           │
│              │ 仅被 stores/ 调用                             │
│              │ 禁止：包含业务逻辑                            │
├──────────────┼──────────────────────────────────────────────┤
│ services/    │ 网络请求封装                                  │
│              │ 仅被 stores/ 或 hooks/ 调用                   │
│              │ 禁止：直接操作 DOM、访问 IndexedDB             │
├──────────────┼──────────────────────────────────────────────┤
│ utils/       │ 纯工具函数                                    │
│              │ 任何层都可以调用                              │
│              │ 禁止：产生副作用                              │
└──────────────┴──────────────────────────────────────────────┘
```

---

# 第四部分：路由设计

## 4.1 路由表

```typescript
// app/router.tsx
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,     // TabBar + ToastContainer
    children: [
      { index: true, element: <HomePage /> },
      { path: "learn", element: <LearnPage /> },
      { path: "review", element: <ReviewPage /> },
      { path: "focus", element: <FocusPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/settings/import",
    element: <ImportTextPage />, // 无 TabBar（全屏）
  },
  {
    path: "/settings/import/preview",
    element: <ImportPreviewPage />, // 无 TabBar（全屏）
  },
  {
    path: "/focus/skeleton/:skeletonId",
    element: <EssaySkeletonDetail />, // 无 TabBar（全屏展开）
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
```

## 4.2 路由层级

```
/ (AppLayout + TabBar)
├── /                  首页
├── /learn             学习
├── /review            复习
├── /focus             重点强化
└── /settings          设置

全屏页（无 TabBar）
├── /settings/import             粘贴文本导入
├── /settings/import/preview     提炼预览确认
└── /focus/skeleton/:id          论述骨架详情
```

---

# 第五部分：AI Provider 抽象

## 5.1 接口定义

```typescript
// services/ai/provider.ts

interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AiRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  responseFormat?: "json" | "text";
}

interface AiResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latency: number;
}

interface AiProvider {
  readonly name: string;
  chat(req: AiRequest): Promise<AiResponse>;
  chatStream(req: AiRequest): AsyncGenerator<string, void, unknown>;
  testConnection(): Promise<boolean>;
}

// services/ai/factory.ts
function createAiProvider(config: AiProviderConfig): AiProvider {
  if (config.model.startsWith("gpt-") || config.model.startsWith("o")) {
    return new OpenAIProvider(config);
  }
  if (config.model.startsWith("claude-")) {
    return new AnthropicProvider(config);
  }
  // 根据 baseUrl 兜底推断
  if (config.baseUrl.includes("openai")) {
    return new OpenAIProvider(config);
  }
  if (config.baseUrl.includes("anthropic")) {
    return new AnthropicProvider(config);
  }
  // 默认走 OpenAI 兼容接口（大多数自定义 API 兼容 OpenAI 格式）
  return new OpenAIProvider(config);
}
```

## 5.2 OpenAI 实现

```typescript
// services/ai/openai.ts
class OpenAIProvider implements AiProvider {
  readonly name = "openai";

  constructor(private config: AiProviderConfig) {}

  async chat(req: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();
    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        response_format: req.responseFormat === "json"
          ? { type: "json_object" }
          : undefined,
      }),
    });

    if (!res.ok) {
      throw new AiProviderError(
        `OpenAI 请求失败: ${res.status}`,
        res.status,
        await res.text()
      );
    }

    const data = await res.json();
    return {
      content: data.choices[0].message.content,
      model: data.model,
      provider: "openai",
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
      latency: Date.now() - startTime,
    };
  }

  async *chatStream(req: AiRequest): AsyncGenerator<string> {
    // SSE 流式处理
    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        stream: true,
      }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {}
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat({
        systemPrompt: "你是一个助手。",
        userPrompt: "ping",
        temperature: 0,
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

## 5.3 Anthropic 实现

```typescript
// services/ai/anthropic.ts
class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";

  constructor(private config: AiProviderConfig) {}

  async chat(req: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();
    const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        system: req.systemPrompt,
        messages: [{ role: "user", content: req.userPrompt }],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
      }),
    });

    if (!res.ok) {
      throw new AiProviderError(
        `Anthropic 请求失败: ${res.status}`,
        res.status,
        await res.text()
      );
    }

    const data = await res.json();
    return {
      content: data.content[0].text,
      model: data.model,
      provider: "anthropic",
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      latency: Date.now() - startTime,
    };
  }

  async *chatStream(req: AiRequest): AsyncGenerator<string> {
    const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        system: req.systemPrompt,
        messages: [{ role: "user", content: req.userPrompt }],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        stream: true,
      }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta") {
              yield parsed.delta?.text || "";
            }
          } catch {}
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat({
        systemPrompt: "你是一个助手。",
        userPrompt: "ping",
        temperature: 0,
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

# 第六部分：关键文件清单

## 6.1 前端核心文件（共约 80 个）

```
组件（~40 个）：
  components/card/FlipCard.tsx            ← 核心交互（翻转动画）
  components/card/CardFront.tsx
  components/card/CardBack.tsx
  components/rating/RatingButtons.tsx      ← 核心交互（评分）
  components/navigation/TabBar.tsx
  components/feedback/Toast.tsx
  ...

页面（5 个页面 × 平均 4 个文件 = ~20 个）：
  pages/home/HomePage.tsx
  pages/learn/LearnPage.tsx
  pages/learn/LearnSession.tsx            ← 核心页面（卡片队列）
  pages/review/ReviewPage.tsx
  pages/review/ReviewSession.tsx          ← 核心页面（复习队列）
  ...

Store（6 个）：
  stores/learnStore.ts                    ← 核心 Store（学习会话 + SM-2）
  stores/reviewStore.ts                   ← 核心 Store（复习队列 + AI 判分）
  stores/domainStore.ts
  ...

Hooks（13 个）：
  hooks/useLearnSession.ts
  hooks/useReviewSession.ts
  hooks/useFlipCard.ts
  hooks/useMemoryStrength.ts
  hooks/useAiExtraction.ts               ← 复杂 Hook（SSE + 管道状态）
  ...

Engine（4 个）：
  engine/memoryStrength.ts                ← 核心算法（五维度计算）
  engine/scheduler.ts                     ← 核心算法（动态调度）
  engine/sm2.ts
  engine/forgettingCurve.ts

DB（11 个）：
  db/schema.ts
  db/cards.ts
  ...

Services（7 个）：
  services/api/client.ts
  services/ai/provider.ts
  services/ai/openai.ts
  services/ai/anthropic.ts
  ...

Utils（6 个）：
  utils/uuid.ts
  utils/crypto.ts
  utils/coverage.ts
  ...
```

## 6.2 后端核心文件（共约 25 个）

```
入口（2 个）：
  index.ts
  app.ts

路由（2 个）：
  routes/ai.ts                            ← 核心路由（提炼、判分、骨架）
  routes/health.ts

AI Provider（4 个）：
  services/ai/provider.ts
  services/ai/openai.ts
  services/ai/anthropic.ts
  services/ai/factory.ts

提炼管道（6 个）：
  services/extraction/pipeline.ts         ← 核心编排（五轮调度）
  services/extraction/round1-extract.ts
  services/extraction/round2-audit.ts
  services/extraction/round3-validate.ts
  services/extraction/round4-coverage.ts  ← 确定性算法
  services/extraction/round5-structure.ts

其他服务（4 个）：
  services/scoring.ts
  services/confusing.ts
  services/skeleton.ts
  services/relation.ts

Prompt 模板（8 个）：
  prompts/extract.ts
  prompts/audit.ts
  prompts/validate.ts
  prompts/score.ts
  prompts/confusing.ts
  prompts/skeleton.ts
  prompts/relation.ts
  prompts/system.ts

中间件（3 个）：
  middleware/rateLimit.ts
  middleware/validateBody.ts
  middleware/errorHandler.ts
```

## 6.3 共享文件（3 个）

```
shared/types/domain.ts
shared/types/knowledge.ts
shared/types/memory.ts
shared/types/review.ts
shared/types/ai.ts
shared/types/settings.ts
shared/types/index.ts
shared/constants/algorithm.ts
shared/constants/questionTypes.ts
shared/constants/phases.ts
```

---

# 第七部分：命名规范

## 7.1 文件命名

```
组件文件：         PascalCase.tsx         FlipCard.tsx
页面文件：         PascalCase.tsx         HomePage.tsx
Hook 文件：        use + CamelCase.ts     useFlipCard.ts
Store 文件：       camelCase + Store.ts   learnStore.ts
Service 文件：     camelCase.ts           openai.ts
Engine 文件：      camelCase.ts           memoryStrength.ts
DB 文件：          camelCase.ts           cards.ts
Utils 文件：       camelCase.ts           uuid.ts
Types 文件：       camelCase.ts           domain.ts
Prompt 文件：      camelCase.ts           extract.ts
```

## 7.2 变量/函数命名

```
组件：             PascalCase             FlipCard
Hook：             use + PascalCase       useFlipCard
Store：            use + PascalCase       useLearnStore
函数：             camelCase              calculateMemoryStrength
常量：             UPPER_SNAKE            MAX_INTERVAL_DAYS
类型/接口：        PascalCase             CardAlgorithmState
枚举：             PascalCase             LearningPhase
事件处理函数：     handle + Event         handleFlipClick
回调 props：       on + Event             onRatingSelect
布尔值：           is/has/should 前缀     isWeak, hasDueCards
```

## 7.3 导入顺序

```typescript
// 1. React 相关
import { useState, useEffect } from "react";

// 2. 第三方库
import { motion } from "framer-motion";

// 3. 内部 Store
import { useLearnStore } from "@/stores/learnStore";

// 4. 内部 Hooks
import { useFlipCard } from "@/hooks/useFlipCard";

// 5. 内部组件
import { FlipCard } from "@/components/card/FlipCard";

// 6. 内部工具
import { calculateMemoryStrength } from "@/engine/memoryStrength";

// 7. 类型
import type { MemoryCard } from "@/shared/types/memory";

// 8. 样式
import "./styles.css"; // 如果有组件级样式
```

---

# 第八部分：扩展点

## 8.1 预设扩展场景

```
┌─────────────────────────────────────────────────────────────┐
│                    扩展点设计                                │
│                                                             │
│  1. 新增 AI Provider                                        │
│     → services/ai/ 下新增一个文件                           │
│     → 实现 AiProvider 接口                                  │
│     → factory.ts 中注册                                     │
│     无需修改其他任何代码                                     │
│                                                             │
│  2. 新增题型                                                │
│     → shared/constants/questionTypes.ts 添加枚举值          │
│     → 在 RatingButtons 中处理新题型的评分逻辑               │
│     → 在 AI 判分 Prompt 中增加新题型的处理                  │
│                                                             │
│  3. 调整算法参数                                            │
│     → shared/constants/algorithm.ts 修改参数                │
│     → 所有 engine/ 文件读取该常量                           │
│     → 无需修改组件代码                                      │
│                                                             │
│  4. 新增页面（V2）                                          │
│     → pages/ 下新建文件夹                                   │
│     → router.tsx 添加路由                                   │
│     → TabBar 添加新 Tab（如需）                             │
│     → 新增对应的 Store（如需）                              │
│                                                             │
│  5. 新增 IndexedDB 表                                       │
│     → shared/types/ 添加类型定义                            │
│     → db/schema.ts 新增版本 + 表                            │
│     → db/ 新增 CRUD 文件                                    │
│     → stores/ 新增或扩展现有 Store                          │
│                                                             │
│  6. 替换 UI 库 / 动画库                                     │
│     → 组件层完全隔离，只需修改 components/ 下的文件          │
│     → Store / Engine / DB 层不受影响                        │
│                                                             │
│  7. 添加多语言（V2）                                        │
│     → 所有用户可见文字集中在 locales/                       │
│     → 使用 i18n hook 替换硬编码字符串                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 8.2 不做的「过度设计」

```
❌ 不使用依赖注入容器（InversifyJS 等）
   → 项目规模不需要。AiProvider 工厂函数足够。

❌ 不建 Component Library / Storybook
   → 5 个页面的项目不需要。组件直接在页面中调试。

❌ 不做 E2E 测试框架搭建
   → V1 手动测试。关键算法（engine/）做好单元测试即可。

❌ 不做 CI/CD Pipeline 脚本
   → V1 手动部署。后续可以加。

❌ 不做 Monorepo 工具（Nx / Turborepo）
   → 代码量不够大。npm workspaces 足够管理 client + server。

❌ 不做 GraphQL / tRPC
   → 服务端只有 5 个 API 端点。REST + SSE 足够。

❌ 不做 Feature Flag 系统
   → 单人项目。代码分支管理需求即可。

❌ 不做国际化（i18n）
   → 党课只有中文。V2 如果做英文版再加。

❌ 不做 A/B 测试框架
   → V1 先上线。后续如果需要优化算法参数再加。
```

---

# 第九部分：启动顺序

## 9.1 开发环境启动

```bash
# 1. 安装依赖
cd party-theory-memory
cd shared && npm install
cd ../client && npm install
cd ../server && npm install

# 2. 启动后端（端口 3001）
cd server
npm run dev          # tsx watch src/index.ts

# 3. 启动前端（端口 5173）
cd client
npm run dev          # vite

# 4. 打开浏览器
# http://localhost:5173
```

## 9.2 构建部署

```bash
# 前端构建
cd client
npm run build        # 输出到 client/dist/

# 后端构建
cd server
npm run build        # tsc → server/dist/

# 生产运行
# Nginx 托管 client/dist/ 静态文件
# PM2 运行 server/dist/index.js
# Nginx 反向代理 /api/* → localhost:3001
```

---

# 第十部分：依赖清单

## 10.1 client/package.json

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "zustand": "^4.5.0",
    "dexie": "^4.0.0",
    "framer-motion": "^11.0.0",
    "d3-force": "^3.0.0",
    "d3-selection": "^3.0.0",
    "d3-zoom": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vite-plugin-pwa": "^0.20.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/d3-force": "^3.0.0"
  }
}
```

## 10.2 server/package.json

```json
{
  "dependencies": {
    "express": "^4.19.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0",
    "cors": "^2.8.0",
    "express-rate-limit": "^7.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.11.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0"
  }
}
```

---

*项目工程结构文档结束。*
