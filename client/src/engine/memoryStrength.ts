/**
 * memoryStrength 计算引擎
 *
 * 五因素综合模型：
 *   1. 自评质量 (quality)             权重 0.25
 *   2. 关键词覆盖率 (keywordCoverage)  权重 0.35 ← 最高
 *   3. 回答速度 (responseTime)        权重 0.10
 *   4. 连续表现 (streakFactor)        权重 0.15
 *   5. 主观熟练度 (confidence)        权重 0.15
 *
 * 输出：0-100 的整数
 */

import { ALGORITHM_CONFIG } from "@shared/constants/algorithm";

// ── 类型定义 ──

export interface StrengthInput {
  /** 用户自评 0-5 */
  quality: number;
  /** 关键词覆盖率 0-1 */
  keywordCoverage: number;
  /** 从翻转开始到自评的时间（秒） */
  responseTime: number;
  /** 连续正确次数 */
  consecutiveCorrect: number;
  /** 连续错误次数 */
  consecutiveErrors: number;
  /** 主观熟练度 0-1（可选，默认从 quality 推断） */
  confidence?: number;
  /** 题型（影响速度权重） */
  questionType?: "concept" | "list" | "essay" | "compare";
  /** 最近 5 次评分（用于计算近期正确率） */
  recentQualities?: number[];
  /** 最近 5 次关键词覆盖率 */
  recentKeywordCoverage?: number[];
  /** 当前稳定性 S */
  stability: number;
  /** 当前难度 D */
  difficulty: number;
  /** 总复习次数 */
  totalReviews: number;
  /** 总正确次数 */
  totalCorrect: number;
}

export interface StrengthOutput {
  /** 综合得分 0-100 */
  compositeScore: number;
  /** 各维度得分（用于调试和展示） */
  breakdown: {
    qualityScore: number;
    keywordScore: number;
    speedScore: number;
    streakScore: number;
    confidenceScore: number;
  };
  /** 是否判定为「部分掌握」（会一点但漏关键词） */
  isPartialMastery: boolean;
  /** 是否需要进入短周期 */
  needsShortCycle: boolean;
  /** 短周期阶段（如需要） */
  shortCyclePhase: "none" | "immediate" | "short" | "same_day";
  /** 判定说明 */
  assessment: string;
}

// ── 计算入口 ──

export function calculateMemoryStrength(input: StrengthInput): StrengthOutput {
  const weights = ALGORITHM_CONFIG.compositeScoreWeights;
  const { questionType = "concept" } = input;

  // 1. 自评得分 (0-100)
  const qualityScore = (input.quality / 5) * 100;

  // 2. 关键词覆盖得分 (0-100)
  const keywordScore = input.keywordCoverage * 100;

  // 3. 速度得分 (0-100) — 根据题型调整
  const speedWeightByType = {
    concept: 1.0,
    list: 1.0,
    compare: 0.5,
    essay: 0.3,
  };
  const speedScore = calculateSpeedScore(input.responseTime) * speedWeightByType[questionType];

  // 4. 连续表现得分 (0-100)
  const streakScore = calculateStreakScore(
    input.consecutiveCorrect,
    input.consecutiveErrors,
    input.recentQualities
  );

  // 5. 主观熟练度得分 (0-100)
  const confidence = input.confidence ?? inferConfidence(input.quality, input.keywordCoverage);
  const confidenceScore = confidence * 100;

  // ── 综合得分 ──
  const compositeScore = Math.round(
    qualityScore * weights.quality +
    keywordScore * weights.keywordCoverage +
    speedScore * weights.responseSpeed +
    streakScore * weights.streakFactor +
    confidenceScore * weights.confidence
  );

  // ── 判定 ──
  const { isPartialMastery, needsShortCycle, shortCyclePhase, assessment } =
    evaluateState(input, compositeScore);

  return {
    compositeScore: clamp(compositeScore, 0, 100),
    breakdown: {
      qualityScore: Math.round(qualityScore),
      keywordScore: Math.round(keywordScore),
      speedScore: Math.round(speedScore),
      streakScore: Math.round(streakScore),
      confidenceScore: Math.round(confidenceScore),
    },
    isPartialMastery,
    needsShortCycle,
    shortCyclePhase,
    assessment,
  };
}

// ── 子函数 ──

/**
 * 速度得分：回答越快 = 越自动化 = 分数越高
 */
function calculateSpeedScore(seconds: number): number {
  if (seconds <= 3) return 100;
  if (seconds <= 5) return 90;
  if (seconds <= 10) return 75;
  if (seconds <= 20) return 50;
  if (seconds <= 30) return 30;
  return 10;
}

/**
 * 连续表现得分
 */
function calculateStreakScore(
  consecutiveCorrect: number,
  consecutiveErrors: number,
  recentQualities?: number[]
): number {
  // 正向：连续正确的加成
  const correctBonus = Math.min(consecutiveCorrect / 10, 1.0) * 70;

  // 负向：连续错误的惩罚
  const errorPenalty = Math.min(consecutiveErrors / 5, 1.0) * 50;

  // 近期趋势：如果最近 3 次中有 2 次以上 quality >= 3，加分
  let trendBonus = 0;
  if (recentQualities && recentQualities.length >= 3) {
    const recent = recentQualities.slice(-3);
    const goodCount = recent.filter((q) => q >= 3).length;
    if (goodCount >= 2) trendBonus = 30;
  }

  return clamp(correctBonus - errorPenalty + trendBonus + 30, 0, 100);
}

/**
 * 从 quality 和 keywordCoverage 推断主观熟练度
 */
function inferConfidence(quality: number, keywordCoverage: number): number {
  // quality 高 + 关键词全对 → 高信心
  // quality 高 + 关键词有遗漏 → 中等信心
  // quality 低 → 低信心
  if (quality >= 4 && keywordCoverage >= 1.0) return 0.9;
  if (quality >= 4 && keywordCoverage >= 0.8) return 0.7;
  if (quality >= 3 && keywordCoverage >= 1.0) return 0.75;
  if (quality >= 3 && keywordCoverage >= 0.5) return 0.5;
  if (quality >= 2) return 0.3;
  return 0.1;
}

/**
 * 综合判定
 */
function evaluateState(
  input: StrengthInput,
  compositeScore: number
): Pick<StrengthOutput, "isPartialMastery" | "needsShortCycle" | "shortCyclePhase" | "assessment"> {
  const { quality, keywordCoverage, consecutiveErrors } = input;

  // ── 部分掌握判定 ──
  // quality >= 3（自评觉得还行）但 keywordCoverage < 1.0（漏了关键词）
  const isPartialMastery = quality >= 3 && keywordCoverage < 1.0;

  // ── 短周期判定 ──
  let needsShortCycle = false;
  let shortCyclePhase: StrengthOutput["shortCyclePhase"] = "none";

  if (compositeScore < 30 || quality < 2) {
    // 严重遗忘 → 立即短周期
    needsShortCycle = true;
    shortCyclePhase = "immediate";
  } else if (isPartialMastery && keywordCoverage < 0.8) {
    // 漏了不少关键词 → 1 分钟后
    needsShortCycle = true;
    shortCyclePhase = consecutiveErrors >= 2 ? "short" : "immediate";
  } else if (isPartialMastery && keywordCoverage < 1.0) {
    // 漏了少量关键词 → 10 分钟后
    needsShortCycle = true;
    shortCyclePhase = "short";
  } else if (compositeScore >= 60 && compositeScore < 75 && keywordCoverage < 1.0) {
    // 整体还行但关键词不完整 → 当天晚些时候
    needsShortCycle = true;
    shortCyclePhase = "same_day";
  }

  // ── 评估文字 ──
  let assessment: string;
  if (compositeScore >= 85 && keywordCoverage >= 1.0) {
    assessment = "完全掌握，关键词准确，建议长间隔";
  } else if (compositeScore >= 85 && keywordCoverage < 1.0) {
    assessment = "整体掌握但有关键词遗漏，降低稳定性增长";
  } else if (compositeScore >= 60) {
    assessment = isPartialMastery
      ? "基本记得但关键词不完整，进入短周期复习"
      : "基本掌握，正常间隔";
  } else if (compositeScore >= 30) {
    assessment = "记忆模糊，缩短间隔，重点强化";
  } else {
    assessment = "严重遗忘，重置间隔，立即短周期复习";
  }

  return { isPartialMastery, needsShortCycle, shortCyclePhase, assessment };
}

// ── 工具 ──

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
