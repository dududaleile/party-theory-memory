/**
 * reviewLogs CRUD
 */
import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { ReviewLog, ReviewSource, KeywordResult } from "@shared/types";

// ── 查询 ──

export async function getLogsByCard(cardId: string, limit = 20): Promise<ReviewLog[]> {
  return db.reviewLogs
    .where("cardId")
    .equals(cardId)
    .reverse()
    .sortBy("reviewedAt")
    .then((logs) => logs.slice(0, limit));
}

export async function getLogsByPoint(pointId: string): Promise<ReviewLog[]> {
  return db.reviewLogs.where("pointId").equals(pointId).toArray();
}

export async function getLogsByDateRange(start: number, end: number): Promise<ReviewLog[]> {
  return db.reviewLogs.where("reviewedAt").between(start, end, true, true).toArray();
}

// ── 写入 ──

export interface AddReviewLogInput {
  cardId: string;
  pointId: string;
  quality: number;
  userAnswer?: string | null;
  aiScore?: number | null;
  aiCovered?: string[] | null;
  aiMissing?: string[] | null;
  aiSuggestion?: string | null;
  easeBefore: number;
  easeAfter: number;
  intervalBefore: number;
  intervalAfter: number;
  timeSpent: number;
  source: ReviewSource;
  keywordResults: KeywordResult[];
  keywordCoverage: number;
  compositeScore: number;
}

export async function addReviewLog(input: AddReviewLogInput): Promise<string> {
  const id = generateId();
  await db.reviewLogs.add({
    id,
    cardId: input.cardId,
    pointId: input.pointId,
    quality: input.quality,
    userAnswer: input.userAnswer ?? null,
    aiScore: input.aiScore ?? null,
    aiCovered: input.aiCovered ?? null,
    aiMissing: input.aiMissing ?? null,
    aiSuggestion: input.aiSuggestion ?? null,
    easeBefore: input.easeBefore,
    easeAfter: input.easeAfter,
    intervalBefore: input.intervalBefore,
    intervalAfter: input.intervalAfter,
    timeSpent: input.timeSpent,
    reviewedAt: Date.now(),
    source: input.source,
    keywordResults: input.keywordResults,
    keywordCoverage: input.keywordCoverage,
    compositeScore: input.compositeScore,
  });
  return id;
}

// ── 聚合查询 ──

export async function getKeywordMissHistory(
  cardId: string,
  limit = 10
): Promise<{ keyword: string; missCount: number }[]> {
  const logs = await getLogsByCard(cardId, limit);
  const missMap = new Map<string, number>();

  for (const log of logs) {
    for (const kr of log.keywordResults) {
      if (!kr.recalled) {
        missMap.set(kr.keyword, (missMap.get(kr.keyword) ?? 0) + 1);
      }
    }
  }

  return [...missMap.entries()]
    .map(([keyword, missCount]) => ({ keyword, missCount }))
    .sort((a, b) => b.missCount - a.missCount);
}
