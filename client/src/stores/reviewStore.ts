/**
 * reviewStore — 复习会话状态
 *
 * 与 learnStore 的区别：
 *   1. 队列来源不同：到期卡片 + 短周期卡片（不是新卡片）
 *   2. 支持 AI 判分模式（论述题）
 *   3. 卡片包含复习特有信息（上次时间、正确率、复习次数）
 *   4. 短周期卡片优先于到期卡片
 */

import { create } from "zustand";
import type { MemoryCard, KnowledgePoint } from "@shared/types";
import * as cardDb from "@/db/cards";
import * as pointDb from "@/db/points";
import * as logDb from "@/db/logs";
import { buildReviewQueue } from "@/engine/scheduler";
import { calculateMemoryStrength } from "@/engine/memoryStrength";
import { computeSM2 } from "@/engine/sm2";
import { scheduleNextReview, determineWeakPoint } from "@/engine/scheduler";

// ── 类型 ──

interface ReviewCardInfo {
  card: MemoryCard;
  point: KnowledgePoint;
  /** 上次复习距今的描述文本 */
  lastReviewText: string;
  /** 历史正确率文本 */
  historyCorrectRate: string;
  /** 第几次复习 */
  reviewCount: number;
  /** 是否为短周期卡片 */
  isShortCycle: boolean;
}

interface ReviewStore {
  // ── 会话状态 ──
  isActive: boolean;
  queue: ReviewCardInfo[];
  currentIndex: number;
  current: ReviewCardInfo | null;

  // ── 卡片交互 ──
  isFlipped: boolean;
  isAnimating: boolean;
  keywords: { keyword: string; checked: boolean }[];
  responseStartTime: number | null;

  // ── AI 判分 ──
  aiMode: boolean;
  userAnswer: string;
  isAiScoring: boolean;
  aiResult: AiScoringResult | null;

  // ── 会话统计 ──
  sessionStats: ReviewStats;

  // ── 每日限制 ──
  dailyLimit: number;
  todayReviewedCount: number;

  // ── 动作 ──
  startSession: () => Promise<void>;
  flipCard: () => void;
  toggleKeyword: (index: number) => void;
  rateCard: (quality: number) => Promise<void>;
  setUserAnswer: (answer: string) => void;
  submitForAiScoring: () => Promise<void>;
  nextCard: () => void;
  endSession: () => void;
}

interface AiScoringResult {
  score: number;
  covered: string[];
  missing: string[];
  suggestion: string;
}

interface ReviewStats {
  total: number;
  completed: number;
  ratings: Record<number, number>;
  aiScored: number;
  avgAiScore: number;
}

const RATING_TO_QUALITY: Record<number, number> = {
  1: 0, 2: 2, 3: 4, 4: 5,
};

// ── 工具 ──

function formatTimeAgo(ms: number): string {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  return `${minutes} 分钟前`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Store ──

export const useReviewStore = create<ReviewStore>()((set, get) => ({
  isActive: false,
  queue: [],
  currentIndex: 0,
  current: null,
  isFlipped: false,
  isAnimating: false,
  keywords: [],
  responseStartTime: null,
  aiMode: false,
  userAnswer: "",
  isAiScoring: false,
  aiResult: null,
  sessionStats: {
    total: 0,
    completed: 0,
    ratings: { 0: 0, 2: 0, 4: 0, 5: 0 },
    aiScored: 0,
    avgAiScore: 0,
  },
  dailyLimit: 50,
  todayReviewedCount: 0,

  // ══════════════════════════════════════════════════════════
  // 开始会话
  // ══════════════════════════════════════════════════════════

  startSession: async () => {
    // 获取所有卡片
    const allCards = await cardDb.getAllCards();

    // 构建复习队列（优先短周期 → 薄弱 → 到期紧急 → 即将到期）
    const queueCards = buildReviewQueue({
      allCards: allCards.filter((c) => c.nextReview !== null),
      dailyLimit: get().dailyLimit,
      dailyMinReview: 5,
    });

    if (queueCards.length === 0) {
      set({ isActive: false });
      return;
    }

    // 加载关联知识点
    const allPoints = await pointDb.getAllPoints();
    const pointMap = new Map(allPoints.map((p) => [p.id, p]));

    const now = Date.now();
    const reviewQueue: ReviewCardInfo[] = queueCards.map((card) => {
      const point = pointMap.get(card.pointId);
      const lastMs = card.lastReview ? now - card.lastReview : 0;
      const totalR = card.totalReviews || 0;
      const totalC = card.totalCorrect || 0;
      const correctRate = totalR > 0 ? Math.round((totalC / totalR) * 100) : 0;
      const isShortCycle = (card.interval ?? 0) < 0.5 && (card.interval ?? 0) > 0;

      return {
        card,
        point: point!,
        lastReviewText: lastMs > 0 ? formatTimeAgo(lastMs) : "首次复习",
        historyCorrectRate: `${correctRate}%`,
        reviewCount: totalR + 1,
        isShortCycle,
      };
    });

    const first = reviewQueue[0];
    set({
      isActive: true,
      queue: reviewQueue,
      currentIndex: 0,
      current: first,
      isFlipped: false,
      isAnimating: false,
      keywords: first.point?.keywords?.map((k) => ({ keyword: k, checked: false })) ?? [],
      responseStartTime: Date.now(),
      aiMode: first.point?.questionType === "essay",
      userAnswer: "",
      isAiScoring: false,
      aiResult: null,
      sessionStats: {
        total: reviewQueue.length,
        completed: 0,
        ratings: { 0: 0, 2: 0, 4: 0, 5: 0 },
        aiScored: 0,
        avgAiScore: 0,
      },
    });
  },

  flipCard: () => {
    if (!get().isAnimating) set({ isFlipped: true });
  },

  toggleKeyword: (index) => {
    const kw = [...get().keywords];
    if (kw[index]) {
      kw[index] = { ...kw[index], checked: !kw[index].checked };
      set({ keywords: kw });
    }
  },

  // ══════════════════════════════════════════════════════════
  // 评分
  // ══════════════════════════════════════════════════════════

  rateCard: async (buttonRating) => {
    const { current, isAnimating, keywords, responseStartTime } = get();
    if (!current || isAnimating) return;

    set({ isAnimating: true });

    const quality = RATING_TO_QUALITY[buttonRating] ?? 0;
    const responseTime = responseStartTime ? (Date.now() - responseStartTime) / 1000 : 10;
    const totalKw = keywords.length;
    const checkedKw = keywords.filter((k) => k.checked).length;
    const keywordCoverage = totalKw > 0 ? checkedKw / totalKw : 1;
    const card = current.card;
    const point = current.point;

    // 计算 memoryStrength
    const strength = calculateMemoryStrength({
      quality,
      keywordCoverage,
      responseTime,
      consecutiveCorrect: card.consecutiveCorrect ?? 0,
      consecutiveErrors: card.consecutiveErrors ?? 0,
      questionType: point?.questionType,
      recentQualities: card.recentRatings ?? [],
      recentKeywordCoverage: [],
      stability: card.interval ?? 0.02,
      difficulty: 0.3,
      totalReviews: card.totalReviews ?? 0,
      totalCorrect: card.totalCorrect ?? 0,
    });

    // SM-2 更新
    const sm2result = computeSM2(
      {
        stability: card.interval ?? 0.02,
        difficulty: 0.3,
        compositeScore: strength.compositeScore,
        keywordCoverage,
        consecutiveCorrect: card.consecutiveCorrect ?? 0,
        consecutiveErrors: card.consecutiveErrors ?? 0,
        totalReviews: card.totalReviews ?? 0,
        encodingReviewCount: card.learningPhase === "encoding" ? (card.repetitions ?? 0) : 3,
      },
      strength
    );

    // 调度
    const schedule = scheduleNextReview({
      stability: sm2result.stability,
      phase: sm2result.phase,
      compositeScore: strength.compositeScore,
      keywordCoverage,
      strength,
      sm2result,
      isWeak: card.isWeak ?? false,
      consecutiveErrors: card.consecutiveErrors ?? 0,
      consecutiveCorrect: card.consecutiveCorrect ?? 0,
      avgResponseTime: responseTime,
      totalReviews: card.totalReviews ?? 0,
    });

    // 薄弱判定
    const weakResult = determineWeakPoint({
      compositeScore: strength.compositeScore,
      consecutiveErrors: card.consecutiveErrors ?? 0,
      stability: sm2result.stability,
      totalReviews: card.totalReviews ?? 0,
      keywordCoverage,
      recentKeywordCoverage: [],
      recentCompositeScores: [],
      maxKeywordConsecutiveMiss: 0,
      sameDayRepeatCount: 0,
    });

    // 更新卡片
    await cardDb.updateCard(card.id, {
      interval: sm2result.stability,
      easeFactor: sm2result.stability,
      repetitions: card.repetitions + (strength.compositeScore >= 60 ? 1 : 0),
      nextReview: schedule.nextReviewAt,
      lastReview: Date.now(),
      learningPhase: sm2result.phase,
      memoryStrength: strength.compositeScore,
      isWeak: weakResult.isWeak,
      weakReason: weakResult.reason,
      weakSince: weakResult.isWeak ? Date.now() : card.weakSince,
      consecutiveCorrect: strength.compositeScore >= 60 ? (card.consecutiveCorrect ?? 0) + 1 : 0,
      consecutiveErrors: strength.compositeScore >= 60 ? 0 : (card.consecutiveErrors ?? 0) + 1,
      recentRatings: [...(card.recentRatings ?? []).slice(-4), quality],
      totalReviews: (card.totalReviews ?? 0) + 1,
      totalCorrect: (card.totalCorrect ?? 0) + (quality >= 3 ? 1 : 0),
    });

    // 记录日志
    await logDb.addReviewLog({
      cardId: card.id,
      pointId: card.pointId,
      quality,
      easeBefore: card.interval ?? 0.02,
      easeAfter: sm2result.stability,
      intervalBefore: card.interval ?? 0,
      intervalAfter: schedule.scheduledInterval,
      timeSpent: Math.round(responseTime),
      source: "review",
      keywordResults: keywords.map((k) => ({ keyword: k.keyword, recalled: k.checked, userSaid: null })),
      keywordCoverage,
      compositeScore: strength.compositeScore,
    });

    // 更新会话统计
    const stats = get().sessionStats;
    const newRatings = { ...stats.ratings };
    newRatings[quality] = (newRatings[quality] || 0) + 1;
    set({
      sessionStats: {
        ...stats,
        completed: stats.completed + 1,
        ratings: newRatings,
      },
    });

    await sleep(300);
    get().nextCard();
    set({ isAnimating: false, isFlipped: false });
  },

  // ══════════════════════════════════════════════════════════
  // AI 判分
  // ══════════════════════════════════════════════════════════

  setUserAnswer: (answer) => set({ userAnswer: answer }),

  submitForAiScoring: async () => {
    const { current, userAnswer } = get();
    if (!current || !userAnswer.trim()) return;

    set({ isAiScoring: true });

    try {
      const res = await fetch("/api/ai/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardAnswer: current.point?.answer,
          keywords: current.point?.keywords,
          userAnswer: userAnswer.trim(),
          questionType: current.point?.questionType,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result: AiScoringResult = await res.json();
      set({ aiResult: result, isAiScoring: false });

      const stats = get().sessionStats;
      set({
        sessionStats: {
          ...stats,
          aiScored: stats.aiScored + 1,
          avgAiScore: Math.round(
            (stats.avgAiScore * stats.aiScored + result.score) / (stats.aiScored + 1)
          ),
        },
      });
    } catch {
      set({
        isAiScoring: false,
        aiResult: {
          score: 0,
          covered: [],
          missing: [],
          suggestion: "AI 判分服务暂不可用，请手动自评。",
        },
      });
    }
  },

  // ══════════════════════════════════════════════════════════
  // 下一张
  // ══════════════════════════════════════════════════════════

  nextCard: () => {
    const { queue, currentIndex } = get();
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      get().endSession();
      return;
    }
    const next = queue[nextIndex];
    set({
      currentIndex: nextIndex,
      current: next,
      keywords: next.point?.keywords?.map((k) => ({ keyword: k, checked: false })) ?? [],
      responseStartTime: Date.now(),
      aiMode: next.point?.questionType === "essay",
      userAnswer: "",
      isAiScoring: false,
      aiResult: null,
    });
  },

  endSession: () => {
    set({
      isActive: false,
      queue: [],
      currentIndex: 0,
      current: null,
      isFlipped: false,
      isAnimating: false,
      keywords: [],
      responseStartTime: null,
      aiMode: false,
      userAnswer: "",
      isAiScoring: false,
      aiResult: null,
    });
  },
}));
