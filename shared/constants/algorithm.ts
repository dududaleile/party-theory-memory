/**
 * 记忆算法全局配置
 * 所有参数集中管理，方便调优
 */
export const ALGORITHM_CONFIG = {
  // ── 初始值 ──
  /** 初始稳定性 S₀（天）—— 首次学习后约 30 分钟开始遗忘 */
  initialStability: 0.02,
  /** 初始难度 D₀ —— 中等偏易 */
  initialDifficulty: 0.3,

  // ── 综合评分权重（五因素）──
  compositeScoreWeights: {
    /** 用户自评 0-5 */
    quality: 0.25,
    /** 关键词覆盖率 0-1 —— 最高权重 */
    keywordCoverage: 0.35,
    /** 回答速度 */
    responseSpeed: 0.1,
    /** 连续表现因子 */
    streakFactor: 0.15,
    /** 主观熟练度 */
    confidence: 0.15,
  },

  // ── 稳定性增长（compositeScore → gain）──
  stabilityGain: {
    /** compositeScore >= 85 */
    high: 2.5,
    /** compositeScore >= 75 */
    medium: 1.5,
    /** compositeScore >= 60 */
    low: 0.8,
  },

  // ── 关键词修正因子 ──
  keywordAdjustment: {
    /** keywordCoverage = 1.0，无削减 */
    full: 1.0,
    /** keywordCoverage = 0.8，削减 30% */
    partial: 0.7,
    /** keywordCoverage = 0.6，削减 60% */
    low: 0.4,
    /** keywordCoverage < 0.5 → 按失败处理 */
    fail: 0,
  },

  // ── 稳定性衰减（compositeScore → decayFactor）──
  stabilityDecay: {
    /** compositeScore >= 30 */
    mild: 0.5,
    /** compositeScore >= 10 */
    moderate: 0.25,
    /** compositeScore < 10 */
    severe: 0.1,
  },

  // ── 调度参数 ──
  targetRetrievability: {
    encoding: 0.95,
    consolidating: 0.9,
    retrieving: 0.85,
    mastered: 0.8,
  },

  scheduleMultiplier: {
    /** compositeScore >= 85 */
    high: 1.0,
    /** compositeScore >= 75 */
    medium: 0.85,
    /** compositeScore >= 60 */
    low: 0.7,
  },

  // ── 短周期重复（分钟）──
  shortCycleIntervals: {
    /** Phase 1: 1 分钟后 */
    immediate: 1,
    /** Phase 2: 10 分钟后 */
    short: 10,
    /** Phase 3: 2 小时后 */
    sameDay: 120,
  },

  // ── 编码期固定间隔（分钟）──
  encodingIntervals: [5, 30, 720],

  // ── 边界 ──
  /** 最低稳定性 */
  minStability: 0.005,
  /** 正常调度最小间隔（天）= 12 小时 */
  minNormalInterval: 0.5,
  /** 最大间隔（天）= 半年 */
  maxInterval: 180,

  // ── 难度更新 ──
  difficultyLearningRate: 0.02,

  // ── 薄弱点判定阈值 ──
  weakPointThresholds: {
    /** 连续 N 次 compositeScore < 60 */
    compositeScoreStreak: 3,
    /** 某关键词连续遗漏 N 次 */
    keywordConsecutiveMiss: 4,
    /** 连续 N 次 keywordCoverage < 1.0 */
    keywordCoverageStreak: 5,
    /** 复习 N 次后 stability 仍 < 0.05 */
    lowStabilityReviews: 5,
    /** same_day 阶段出现 N 次 */
    shortCycleRepeats: 2,
  },
} as const;

export type AlgorithmConfig = typeof ALGORITHM_CONFIG;
