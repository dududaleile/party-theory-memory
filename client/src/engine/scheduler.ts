/**
 * 动态复习调度器
 *
 * 职责：
 *   1. 计算下次复习时间（正常调度 + 短周期）
 *   2. 构建每日复习队列（紧急度排序）
 *   3. 选择每日新卡片（树深度排序）
 *   4. 判定薄弱点
 */

import { ALGORITHM_CONFIG } from "@shared/constants/algorithm";
import { determinePhase } from "./sm2";
import type { StrengthOutput } from "./memoryStrength";
import type { SM2Output } from "./sm2";
import type { LearningPhase, MemoryCard } from "@shared/types";

// ── 类型 ──

export interface ScheduleInput {
  stability: number;
  phase: LearningPhase;
  compositeScore: number;
  keywordCoverage: number;
  strength: StrengthOutput;
  sm2result: SM2Output;
  isWeak: boolean;
  consecutiveErrors: number;
  consecutiveCorrect: number;
  avgResponseTime: number;
  totalReviews: number;
}

export interface ScheduleOutput {
  /** 下次复习时间戳 (ms) */
  nextReviewAt: number;
  /** 安排的间隔（天） */
  scheduledInterval: number;
}

export interface QueueCard {
  card: MemoryCard;
  /** 遗忘概率 = 1 - R(t) */
  urgency: number;
  /** 当前记忆留存概率 */
  retrievability: number;
}

// ── 主调度函数 ──

export function scheduleNextReview(
  input: ScheduleInput
): ScheduleOutput {
  const { strength, isWeak } = input;

  // ── 短周期优先 ──
  if (strength.needsShortCycle) {
    const intervalMinutes = getShortCycleInterval(strength.shortCyclePhase);
    return {
      nextReviewAt: Date.now() + intervalMinutes * 60 * 1000,
      scheduledInterval: intervalMinutes / (24 * 60),
    };
  }

  // ── 正常调度 ──
  const stability = input.sm2result.stability || input.stability;
  const phase = input.sm2result.phase || input.phase;

  const targetR = getTargetRetrievability(phase);
  let intervalDays = -stability * Math.log(targetR);

  // ── 调整因子 ──

  // compositeScore 微调
  const { scheduleMultiplier } = ALGORITHM_CONFIG;
  if (input.compositeScore >= 85) {
    intervalDays *= scheduleMultiplier.high;
  } else if (input.compositeScore >= 75) {
    intervalDays *= scheduleMultiplier.medium;
  } else if (input.compositeScore >= 60) {
    intervalDays *= scheduleMultiplier.low;
  }

  // 薄弱点惩罚
  if (isWeak) {
    intervalDays *= 0.5;
  }

  // 连续正确奖励
  if (input.consecutiveCorrect >= 5) {
    intervalDays *= 1 + Math.floor(input.consecutiveCorrect / 5) * 0.1;
  }

  // 连续错误惩罚
  if (input.consecutiveErrors > 0) {
    intervalDays *= Math.max(0.1, 1 - input.consecutiveErrors * 0.3);
  }

  // 速度奖励（自动化提取）
  if (input.avgResponseTime < 3 && input.consecutiveCorrect >= 5) {
    intervalDays *= 1.2;
  }

  // 关键词不完全时的额外缩减
  if (input.keywordCoverage < 1.0 && input.compositeScore >= 60) {
    intervalDays *= 0.8 - (1 - input.keywordCoverage) * 0.3;
  }

  // ── 边界约束 ──
  const minInterval = ALGORITHM_CONFIG.minNormalInterval;
  const maxInterval = ALGORITHM_CONFIG.maxInterval;
  intervalDays = Math.max(minInterval, Math.min(maxInterval, intervalDays));

  return {
    nextReviewAt: Date.now() + intervalDays * 86400000,
    scheduledInterval: intervalDays,
  };
}

// ── 复习队列构建 ──

export interface BuildQueueOptions {
  /** 所有卡片 */
  allCards: MemoryCard[];
  /** 每日复习上限 */
  dailyLimit: number;
  /** 最低每日复习量 */
  dailyMinReview: number;
}

export function buildReviewQueue(options: BuildQueueOptions): MemoryCard[] {
  const { allCards, dailyLimit, dailyMinReview } = options;
  const now = Date.now();

  // 1. 分类
  const shortCycleCards = allCards.filter(
    (c) => c.nextReview !== null && c.nextReview <= now && isShortCycle(c)
  );
  const dueCards = allCards.filter(
    (c) =>
      c.nextReview !== null &&
      c.nextReview <= now &&
      !shortCycleCards.includes(c)
  );
  const upcomingCards = allCards.filter(
    (c) => c.nextReview !== null && c.nextReview > now
  );

  // 2. 计算紧急度
  const withUrgency = (cards: MemoryCard[]): QueueCard[] =>
    cards.map((c) => {
      const t = Math.max(0, (now - (c.lastReview ?? now)) / 86400000);
      const R = Math.exp(-t / Math.max(0.001, c.interval || 0.02));
      return { card: c, urgency: 1 - R, retrievability: R };
    });

  const rankedDue = withUrgency(dueCards);
  const rankedUpcoming = withUrgency(upcomingCards);

  // 3. 构建队列（优先级：短周期 > 薄弱 > 到期紧急 > 即将到期）
  let queue: MemoryCard[] = [];

  // 短周期卡片 — 最高优先级
  queue.push(...shortCycleCards);

  // 薄弱卡片 — 次高优先级
  const weakDue = rankedDue.filter((q) => q.card.isWeak).map((q) => q.card);
  const normalDue = rankedDue.filter((q) => !q.card.isWeak);
  normalDue.sort((a, b) => b.urgency - a.urgency); // 紧急的在前
  queue.push(...weakDue, ...normalDue.map((q) => q.card));

  // 4. 如果到期卡片不够最低复习量 → 提前纳入即将到期的
  if (queue.length < dailyMinReview) {
    const needed = dailyMinReview - queue.length;
    const upcoming = rankedUpcoming
      .filter((q) => q.retrievability < 0.85)
      .sort((a, b) => a.retrievability - b.retrievability) // R 低的优先
      .slice(0, needed)
      .map((q) => q.card);
    queue.push(...upcoming);
  }

  // 5. 截断到每日上限
  if (queue.length > dailyLimit) {
    queue = queue.slice(0, dailyLimit);
  }

  return queue;
}

// ── 新卡片选择（树深度排序）──

export interface SelectNewCardsOptions {
  /** 所有未学习的卡片（nextReview === null） */
  newCards: MemoryCard[];
  /** 每个知识点对应的 treePath 深度 */
  getDepth: (pointId: string) => number;
  /** 每个知识点的父知识点 ID */
  getParentPointId: (pointId: string) => string | null;
  /** 检查父知识点是否已学过 */
  isParentLearned: (parentPointId: string) => boolean;
  /** 每日新卡片上限 */
  dailyLimit: number;
  /** 今天已学习的数量 */
  todayLearned: number;
}

export function selectNewCards(options: SelectNewCardsOptions): MemoryCard[] {
  const { newCards, getDepth, getParentPointId, isParentLearned, dailyLimit, todayLearned } =
    options;
  const remaining = Math.max(0, dailyLimit - todayLearned);
  if (remaining <= 0) return [];

  // 1. 过滤：父知识点必须已学过
  const eligible = newCards.filter((card) => {
    const parentId = getParentPointId(card.pointId);
    if (!parentId) return true; // 根节点，无父 → 可直接学
    return isParentLearned(parentId);
  });

  // 2. 排序：树深度升序（整体→局部→细节）
  const sorted = [...eligible].sort((a, b) => {
    const depthA = getDepth(a.pointId);
    const depthB = getDepth(b.pointId);
    if (depthA !== depthB) return depthA - depthB;
    // 同深度 → 保持原始顺序（order 字段在知识点层面已排序）
    return 0;
  });

  return sorted.slice(0, remaining);
}

// ── 薄弱点判定 ──

export interface WeakPointInput {
  compositeScore: number;
  consecutiveErrors: number;
  stability: number;
  totalReviews: number;
  keywordCoverage: number;
  recentKeywordCoverage: number[];
  recentCompositeScores: number[];
  /** 某关键词最大连续遗漏次数 */
  maxKeywordConsecutiveMiss: number;
  /** shortCyclePhase 为 same_day 的次数 */
  sameDayRepeatCount: number;
}

export function determineWeakPoint(input: WeakPointInput): {
  isWeak: boolean;
  reason: string | null;
} {
  const t = ALGORITHM_CONFIG.weakPointThresholds;

  // 条件 1：连续 compositeScore 低
  if (input.consecutiveErrors >= t.compositeScoreStreak) {
    return {
      isWeak: true,
      reason: `连续 ${input.consecutiveErrors} 次综合评分 < 60`,
    };
  }

  // 条件 2：某关键词连续遗漏
  if (input.maxKeywordConsecutiveMiss >= t.keywordConsecutiveMiss) {
    return {
      isWeak: true,
      reason: `关键词连续遗漏 ${input.maxKeywordConsecutiveMiss} 次`,
    };
  }

  // 条件 3：连续 keywordCoverage 不完整
  const recentIncomplete = input.recentKeywordCoverage.filter((c) => c < 1.0).length;
  if (recentIncomplete >= t.keywordCoverageStreak) {
    return {
      isWeak: true,
      reason: `连续 ${recentIncomplete} 次关键词覆盖不完整`,
    };
  }

  // 条件 4：复习多次但稳定性极低
  if (input.totalReviews > t.lowStabilityReviews && input.stability < 0.05) {
    return {
      isWeak: true,
      reason: `复习 ${input.totalReviews} 次但稳定性仍极低 (S=${input.stability.toFixed(3)})`,
    };
  }

  // 条件 5：短周期重复多次仍不达标
  if (input.sameDayRepeatCount >= t.shortCycleRepeats) {
    return {
      isWeak: true,
      reason: `短周期重复 ${input.sameDayRepeatCount} 次仍未掌握`,
    };
  }

  return { isWeak: false, reason: null };
}

// ── 工具函数 ──

function getShortCycleInterval(
  phase: StrengthOutput["shortCyclePhase"]
): number {
  const intervals = ALGORITHM_CONFIG.shortCycleIntervals;
  switch (phase) {
    case "immediate":
      return intervals.immediate;
    case "short":
      return intervals.short;
    case "same_day":
      return intervals.sameDay;
    default:
      return intervals.immediate;
  }
}

function getTargetRetrievability(phase: LearningPhase): number {
  const t = ALGORITHM_CONFIG.targetRetrievability;
  switch (phase) {
    case "encoding":
      return t.encoding;
    case "consolidating":
      return t.consolidating;
    case "retrieving":
      return t.retrieving;
    case "mastered":
      return t.mastered;
    default:
      return t.consolidating;
  }
}

function isShortCycle(card: MemoryCard): boolean {
  // 短周期卡片特征：间隔 < 12 小时
  return (
    card.interval !== undefined &&
    card.interval < 0.5 &&
    card.interval > 0 &&
    card.learningPhase !== "encoding"
  );
}
