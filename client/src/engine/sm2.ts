/**
 * SM-2 改进算法 + 关键词修正
 *
 * 核心公式：
 *   成功: S_new = S_old × (1 + gain × keywordAdj × difficultyPenalty × streakBonus)
 *   失败: S_new = S_old × decayFactor
 *   难度: D_new = D_old + (expected - actual) × learningRate
 */

import { ALGORITHM_CONFIG } from "@shared/constants/algorithm";
import type { StrengthOutput } from "./memoryStrength";
import type { LearningPhase } from "@shared/types";

// ── 类型 ──

export interface SM2Input {
  stability: number;
  difficulty: number;
  compositeScore: number;
  keywordCoverage: number;
  consecutiveCorrect: number;
  consecutiveErrors: number;
  totalReviews: number;
  /** 编码期内的复习次数（0-2，满 3 次退出编码期） */
  encodingReviewCount: number;
}

export interface SM2Output {
  stability: number;
  difficulty: number;
  interval: number;         // 下次复习间隔（天）
  phase: LearningPhase;
  /** 编码期复习次数（更新后） */
  encodingReviewCount: number;
  /** 是否退出编码期 */
  exitedEncoding: boolean;
}

// ── 主函数 ──

export function computeSM2(
  input: SM2Input,
  strength: StrengthOutput
): SM2Output {
  const { compositeScore, keywordCoverage } = input;
  const config = ALGORITHM_CONFIG;

  let stability = input.stability;
  let difficulty = input.difficulty;
  let encodingReviewCount = input.encodingReviewCount;
  let exitedEncoding = false;

  const currentPhase = determinePhase(stability);

  // ── 编码期特殊处理 ──
  if (currentPhase === "encoding") {
    if (compositeScore >= 60) {
      encodingReviewCount++;
      if (encodingReviewCount >= 3) {
        exitedEncoding = true;
        // 编码期完成 → 进入正常的 S 增长
        stability = config.initialStability * 5; // ≈ 0.1
      }
      // 编码期内不使用 SM-2 公式，使用固定间隔
      const intervalMinutes =
        encodingReviewCount < 3
          ? config.encodingIntervals[encodingReviewCount]
          : config.encodingIntervals[2];
      return {
        stability,
        difficulty,
        interval: intervalMinutes / (24 * 60),
        phase: exitedEncoding ? "consolidating" : "encoding",
        encodingReviewCount,
        exitedEncoding,
      };
    } else {
      // 编码期失败 → 重置计数
      encodingReviewCount = 0;
      return {
        stability: Math.max(config.minStability, stability * 0.5),
        difficulty,
        interval: config.encodingIntervals[0] / (24 * 60),
        phase: "encoding",
        encodingReviewCount,
        exitedEncoding: false,
      };
    }
  }

  // ── 正常 SM-2 计算 ──

  if (compositeScore >= 60) {
    // ═══ 成功 ═══
    const gain = getStabilityGain(compositeScore);
    const keywordAdj = getKeywordAdjustment(keywordCoverage);
    const difficultyPenalty = 1 - difficulty * 0.6;
    const streakBonus = 1 + Math.min(input.consecutiveCorrect, 10) * 0.05;

    stability = stability * (1 + gain * keywordAdj * difficultyPenalty * streakBonus);

    // 更新难度 D
    const expectedQ = compositeScore >= 85 ? 5 : compositeScore >= 75 ? 4 : 3;
    const actualQ = compositeScore >= 85 ? 5 : compositeScore >= 75 ? 4 : 3;
    difficulty = clamp(
      difficulty + (expectedQ - actualQ) * config.difficultyLearningRate,
      0,
      1
    );

    // 连续正确 10 次以上 → D 缓慢降低（说明卡片可能比估计的简单）
    if (input.consecutiveCorrect >= 10) {
      difficulty = clamp(difficulty - 0.01, 0.05, 1);
    }
  } else {
    // ═══ 失败 ═══
    const decayFactor =
      compositeScore >= 30
        ? config.stabilityDecay.mild
        : compositeScore >= 10
          ? config.stabilityDecay.moderate
          : config.stabilityDecay.severe;

    stability = Math.max(config.minStability, stability * decayFactor);

    // 失败 → D 略微增大
    difficulty = clamp(difficulty + 0.03, 0, 1);
  }

  // ── 关键词遗漏对 D 的影响 ──
  if (keywordCoverage < 1.0 && compositeScore >= 60) {
    // 整体记得但漏了词 → D 微增（这张卡片有「坑」）
    difficulty = clamp(difficulty + (1 - keywordCoverage) * 0.05, 0, 1);
  }

  return {
    stability: Math.round(stability * 1000) / 1000,
    difficulty: Math.round(difficulty * 100) / 100,
    interval: 0, // 由 scheduler 计算
    phase: determinePhase(stability),
    encodingReviewCount,
    exitedEncoding,
  };
}

// ── 辅助函数 ──

function getStabilityGain(compositeScore: number): number {
  const { stabilityGain } = ALGORITHM_CONFIG;
  if (compositeScore >= 85) return stabilityGain.high;
  if (compositeScore >= 75) return stabilityGain.medium;
  return stabilityGain.low; // >= 60
}

function getKeywordAdjustment(coverage: number): number {
  const { keywordAdjustment } = ALGORITHM_CONFIG;
  if (coverage >= 1.0) return keywordAdjustment.full;
  if (coverage >= 0.8) return keywordAdjustment.partial;
  if (coverage >= 0.5) return keywordAdjustment.low;
  return keywordAdjustment.fail; // < 0.5 → 按失败处理
}

export function determinePhase(stability: number): LearningPhase {
  if (stability < 0.1) return "encoding";
  if (stability < 5) return "consolidating";
  if (stability < 60) return "retrieving";
  return "mastered";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
