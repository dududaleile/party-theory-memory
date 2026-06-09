/**
 * 记忆算法引擎 — 统一导出
 *
 * 使用流程：
 *   1. calculateMemoryStrength()  → 获取综合评分 + 判定
 *   2. computeSM2()               → 更新 S/D + 计算基础间隔
 *   3. scheduleNextReview()       → 计算下次复习时间
 *   4. determineWeakPoint()       → 判定薄弱点
 *   5. buildReviewQueue()         → 构建每日复习队列
 *   6. selectNewCards()           → 选择今日新卡片
 */

export {
  calculateMemoryStrength,
  type StrengthInput,
  type StrengthOutput,
} from "./memoryStrength";

export {
  computeSM2,
  determinePhase,
  type SM2Input,
  type SM2Output,
} from "./sm2";

export {
  scheduleNextReview,
  buildReviewQueue,
  selectNewCards,
  determineWeakPoint,
  type ScheduleInput,
  type ScheduleOutput,
  type QueueCard,
  type BuildQueueOptions,
  type SelectNewCardsOptions,
  type WeakPointInput,
} from "./scheduler";
