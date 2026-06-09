/**
 * learnStore — 学习会话状态
 *
 * 管理一张卡片从「出现 → 思考 → 翻转 → 关键词检测 → 自评 → 下一张」的完整生命周期。
 * 调用 engine/ 执行算法，调用 db/ 持久化数据。
 */

import { create } from "zustand";
import type { MemoryCard, KnowledgePoint } from "@shared/types";
import * as cardDb from "@/db/cards";
import * as pointDb from "@/db/points";
import * as logDb from "@/db/logs";
import { selectNewCards } from "@/engine/scheduler";
import { calculateMemoryStrength } from "@/engine/memoryStrength";
import { computeSM2 } from "@/engine/sm2";
import { scheduleNextReview, determineWeakPoint } from "@/engine/scheduler";

// ── 类型 ──

export type LearnMode = "all" | "domain" | "single";

interface KeywordCheckItem {
  keyword: string;
  checked: boolean; // 用户是否确认准确回忆了该关键词
}

interface LearnStore {
  // ── 会话状态 ──
  isActive: boolean;
  mode: LearnMode;
  domainId: string | undefined;

  // ── 卡片队列 ──
  queue: MemoryCard[];
  currentIndex: number;
  currentCard: MemoryCard | null;
  currentPoint: KnowledgePoint | null;

  // ── 卡片交互状态 ──
  isFlipped: boolean;
  isAnimating: boolean;
  keywords: KeywordCheckItem[];     // 当前卡片的关键词检测列表
  responseStartTime: number | null; // 用户看到问题面的时间戳

  // ── 评分中间结果 ──
  lastCompositeScore: number | null;

  // ── 会话统计 ──
  sessionStartTime: number;
  sessionStats: {
    total: number;
    completed: number;
    ratings: Record<number, number>; // quality → count
    avgKeywordCoverage: number;
  };

  // ── 每日限制 ──
  dailyLimit: number;
  todayLearnedCount: number;

  // ── 动作 ──

  /** 开始学习会话 */
  startSession: (mode?: LearnMode, domainId?: string) => Promise<void>;

  /** 用户点击翻转按钮 */
  flipCard: () => void;

  /** 用户切换关键词检测项的选中状态 */
  toggleKeyword: (index: number) => void;

  /** 用户提交自评（4 级 → quality 0/2/4/5） */
  rateCard: (quality: number) => Promise<void>;

  /** 加载下一张卡片 */
  nextCard: () => void;

  /** 结束会话 */
  endSession: () => void;

  /** 检查是否达到每日上限 */
  checkDailyLimit: () => Promise<boolean>;
}

// ── 自评按钮 → SM-2 quality 映射 ──
// 完全忘记 = 0, 模糊 = 2, 基本记住 = 4, 完全掌握 = 5
const RATING_TO_QUALITY: Record<number, number> = {
  1: 0,  // 完全忘记
  2: 2,  // 模糊
  3: 4,  // 基本记住
  4: 5,  // 完全掌握
};

// ── Store ──

export const useLearnStore = create<LearnStore>()((set, get) => ({
  isActive: false,
  mode: "all",
  domainId: undefined,
  queue: [],
  currentIndex: 0,
  currentCard: null,
  currentPoint: null,
  isFlipped: false,
  isAnimating: false,
  keywords: [],
  responseStartTime: null,
  lastCompositeScore: null,
  sessionStartTime: 0,
  sessionStats: {
    total: 0,
    completed: 0,
    ratings: { 0: 0, 2: 0, 4: 0, 5: 0 },
    avgKeywordCoverage: 0,
  },
  dailyLimit: 10,
  todayLearnedCount: 0,

  // ══════════════════════════════════════════════════════════
  // 开始会话
  // ══════════════════════════════════════════════════════════

  startSession: async (mode: LearnMode = "all", domainId?: string) => {
    // 获取新卡片（未学习）
    let newCards: MemoryCard[];
    if (domainId) {
      newCards = await cardDb.getNewCardsByDomain(domainId);
    } else {
      newCards = await cardDb.getNewCards();
    }

    if (newCards.length === 0) {
      set({ isActive: false });
      return;
    }

    // 按树深度排序：整体 → 局部 → 细节
    const allPoints = await pointDb.getAllPoints();
    const pointMap = new Map(allPoints.map((p) => [p.id, p]));

    function getDepth(pointId: string): number {
      return pointMap.get(pointId)?.treePath?.length ?? 99;
    }

    function getParentPointId(pointId: string): string | null {
      return pointMap.get(pointId)?.parentPointId ?? null;
    }

    function isParentLearned(parentPointId: string): boolean {
      // 父知识点对应的卡片是否已学过（nextReview !== null）
      return newCards.some(
        (c) => c.pointId === parentPointId && c.nextReview !== null
      ) === false
        ? false
        : true;
    }

    const selected = selectNewCards({
      newCards,
      getDepth,
      getParentPointId,
      isParentLearned,
      dailyLimit: get().dailyLimit,
      todayLearned: get().todayLearnedCount,
    });

    if (selected.length === 0) {
      set({ isActive: false });
      return;
    }

    // 加载当前卡片的知识点
    const firstCard = selected[0];
    const firstPoint = pointMap.get(firstCard.pointId) ?? null;

    set({
      isActive: true,
      mode,
      domainId,
      queue: selected,
      currentIndex: 0,
      currentCard: firstCard,
      currentPoint: firstPoint,
      isFlipped: false,
      isAnimating: false,
      keywords: (firstPoint?.keywords ?? []).map((k) => ({ keyword: k, checked: false })),
      responseStartTime: Date.now(),
      sessionStartTime: Date.now(),
      sessionStats: {
        total: selected.length,
        completed: 0,
        ratings: { 0: 0, 2: 0, 4: 0, 5: 0 },
        avgKeywordCoverage: 0,
      },
    });
  },

  // ══════════════════════════════════════════════════════════
  // 翻转卡片
  // ══════════════════════════════════════════════════════════

  flipCard: () => {
    if (get().isAnimating) return;
    set({ isFlipped: true });
  },

  // ══════════════════════════════════════════════════════════
  // 关键词检测
  // ══════════════════════════════════════════════════════════

  toggleKeyword: (index: number) => {
    const keywords = [...get().keywords];
    if (keywords[index]) {
      keywords[index] = { ...keywords[index], checked: !keywords[index].checked };
      set({ keywords });
    }
  },

  // ══════════════════════════════════════════════════════════
  // 评分（核心逻辑）
  // ══════════════════════════════════════════════════════════

  rateCard: async (buttonRating: number) => {
    const {
      currentCard,
      currentPoint,
      responseStartTime,
      isAnimating,
      keywords,
    } = get();
    if (!currentCard || !currentPoint || isAnimating) return;

    set({ isAnimating: true });

    // ── 1. 计算评分参数 ──
    const quality = RATING_TO_QUALITY[buttonRating] ?? 0;
    const responseTime = responseStartTime
      ? (Date.now() - responseStartTime) / 1000
      : 10;

    const totalKeywords = keywords.length;
    const checkedKeywords = keywords.filter((k) => k.checked).length;
    const keywordCoverage = totalKeywords > 0 ? checkedKeywords / totalKeywords : 1;

    // ── 2. 计算 memoryStrength ──
    const strength = calculateMemoryStrength({
      quality,
      keywordCoverage,
      responseTime,
      consecutiveCorrect: currentCard.consecutiveCorrect ?? 0,
      consecutiveErrors: currentCard.consecutiveErrors ?? 0,
      questionType: currentPoint.questionType,
      recentQualities: currentCard.recentRatings ?? [],
      recentKeywordCoverage: [],
      stability: currentCard.interval ?? 0.02,
      difficulty: 0.3,
      totalReviews: currentCard.totalReviews ?? 0,
      totalCorrect: currentCard.totalCorrect ?? 0,
    });

    // ── 3. 更新 SM-2 参数 ──
    const sm2result = computeSM2(
      {
        stability: currentCard.interval ?? 0.02,
        difficulty: 0.3,
        compositeScore: strength.compositeScore,
        keywordCoverage,
        consecutiveCorrect: currentCard.consecutiveCorrect ?? 0,
        consecutiveErrors: currentCard.consecutiveErrors ?? 0,
        totalReviews: currentCard.totalReviews ?? 0,
        encodingReviewCount: currentCard.learningPhase === "encoding"
          ? (currentCard.repetitions ?? 0) : 3,
      },
      strength
    );

    // ── 4. 计算调度 ──
    const schedule = scheduleNextReview({
      stability: sm2result.stability,
      phase: sm2result.phase,
      compositeScore: strength.compositeScore,
      keywordCoverage,
      strength,
      sm2result,
      isWeak: currentCard.isWeak ?? false,
      consecutiveErrors: currentCard.consecutiveErrors ?? 0,
      consecutiveCorrect: currentCard.consecutiveCorrect ?? 0,
      avgResponseTime: responseTime,
      totalReviews: currentCard.totalReviews ?? 0,
    });

    // ── 5. 判定薄弱点 ──
    const weakResult = determineWeakPoint({
      compositeScore: strength.compositeScore,
      consecutiveErrors: currentCard.consecutiveErrors ?? 0,
      stability: sm2result.stability,
      totalReviews: currentCard.totalReviews ?? 0,
      keywordCoverage,
      recentKeywordCoverage: [],
      recentCompositeScores: [],
      maxKeywordConsecutiveMiss: 0,
      sameDayRepeatCount: 0,
    });

    // ── 6. 更新 IndexedDB ──
    const updatedCard: Partial<MemoryCard> = {
      interval: sm2result.stability,
      easeFactor: sm2result.stability, // 在 v2 中 stability 替代 easeFactor
      repetitions: currentCard.repetitions + (strength.compositeScore >= 60 ? 1 : 0),
      nextReview: schedule.nextReviewAt,
      lastReview: Date.now(),
      learningPhase: sm2result.phase,
      memoryStrength: strength.compositeScore,
      isWeak: weakResult.isWeak,
      weakReason: weakResult.reason,
      weakSince: weakResult.isWeak ? Date.now() : currentCard.weakSince,
      consecutiveErrors: strength.compositeScore >= 60
        ? 0
        : (currentCard.consecutiveErrors ?? 0) + 1,
      recentRatings: [
        ...(currentCard.recentRatings ?? []).slice(-4),
        quality,
      ],
      totalReviews: (currentCard.totalReviews ?? 0) + 1,
      totalCorrect: (currentCard.totalCorrect ?? 0) + (quality >= 3 ? 1 : 0),
    };

    await cardDb.updateCard(currentCard.id, updatedCard);

    // ── 7. 记录复习日志 ──
    await logDb.addReviewLog({
      cardId: currentCard.id,
      pointId: currentCard.pointId,
      quality,
      easeBefore: currentCard.interval ?? 0.02,
      easeAfter: sm2result.stability,
      intervalBefore: currentCard.interval ?? 0,
      intervalAfter: schedule.scheduledInterval,
      timeSpent: Math.round(responseTime),
      source: "learn",
      keywordResults: keywords.map((k) => ({
        keyword: k.keyword,
        recalled: k.checked,
        userSaid: null,
      })),
      keywordCoverage,
      compositeScore: strength.compositeScore,
    });

    // ── 8. 更新会话统计 ──
    const { sessionStats } = get();
    const newRatings = { ...sessionStats.ratings };
    newRatings[quality] = (newRatings[quality] || 0) + 1;

    const newAvgCoverage =
      (sessionStats.avgKeywordCoverage * sessionStats.completed + keywordCoverage) /
      (sessionStats.completed + 1);

    set({
      sessionStats: {
        ...sessionStats,
        completed: sessionStats.completed + 1,
        ratings: newRatings,
        avgKeywordCoverage: Math.round(newAvgCoverage * 100) / 100,
      },
      lastCompositeScore: strength.compositeScore,
    });

    // ── 9. 动画延迟 → 加载下一张 ──
    await sleep(300);
    get().nextCard();
    set({ isAnimating: false, isFlipped: false });
  },

  // ══════════════════════════════════════════════════════════
  // 下一张
  // ══════════════════════════════════════════════════════════

  nextCard: () => {
    const { queue, currentIndex } = get();
    const nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      // 队列结束
      get().endSession();
      return;
    }

    const nextCard = queue[nextIndex];
    // 需要异步加载知识点——但为了保持同步，在 startSession 时预加载
    // 这里简化处理，知识点从 queue 的 pointId 关联获取
    set({
      currentIndex: nextIndex,
      currentCard: nextCard,
      keywords: [],
      responseStartTime: Date.now(),
    });

    // 异步加载知识点
    pointDb.getPointById(nextCard.pointId).then((point) => {
      if (point) {
        set({
          currentPoint: point,
          keywords: point.keywords.map((k) => ({ keyword: k, checked: false })),
        });
      }
    });
  },

  // ══════════════════════════════════════════════════════════
  // 结束会话
  // ══════════════════════════════════════════════════════════

  endSession: () => {
    set({
      isActive: false,
      queue: [],
      currentIndex: 0,
      currentCard: null,
      currentPoint: null,
      isFlipped: false,
      isAnimating: false,
      keywords: [],
      responseStartTime: null,
    });
  },

  // ══════════════════════════════════════════════════════════
  // 每日上限检查
  // ══════════════════════════════════════════════════════════

  checkDailyLimit: async () => {
    const todayCount = await cardDb.getTodayReviewCount();
    set({ todayLearnedCount: todayCount });
    return todayCount >= get().dailyLimit;
  },
}));

// ── 工具 ──

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
