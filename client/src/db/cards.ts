/**
 * memoryCards CRUD + 核心查询
 *
 * 这是使用频率最高的数据访问文件。
 * 复习队列、学习队列、薄弱点列表都从这里查询。
 */
import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { MemoryCard, LearningPhase } from "@shared/types";

// ── 查询：单个 ──

export async function getCardById(id: string): Promise<MemoryCard | undefined> {
  return db.memoryCards.get(id);
}

export async function getCardByPointId(pointId: string): Promise<MemoryCard | undefined> {
  return db.memoryCards.where("pointId").equals(pointId).first();
}

// ── 查询：复习队列 ──

/** 获取所有到期卡片（nextReview <= now） */
export async function getDueCards(): Promise<MemoryCard[]> {
  const now = Date.now();
  return db.memoryCards
    .where("nextReview")
    .between(0, now) // Dexie: between 包含两端
    .toArray();
}

/** 获取所有到期卡片，按下次复习时间升序（最紧急的在前） */
export async function getDueCardsSorted(): Promise<MemoryCard[]> {
  const due = await getDueCards();
  due.sort((a, b) => (a.nextReview ?? 0) - (b.nextReview ?? 0));
  return due;
}

/** 获取即将到期的卡片（未来 24 小时内到期） */
export async function getUpcomingCards(): Promise<MemoryCard[]> {
  const now = Date.now();
  const tomorrow = now + 86400000;
  return db.memoryCards
    .where("nextReview")
    .between(now, tomorrow, false, true) // 不包含 now（已到期），包含 tomorrow
    .toArray();
}

// ── 查询：学习队列 ──

/** 获取所有未学习的卡片（nextReview === null） */
export async function getNewCards(): Promise<MemoryCard[]> {
  return db.memoryCards
    .filter((c) => c.nextReview === null)
    .toArray();
}

/** 获取指定领域的未学习卡片 */
export async function getNewCardsByDomain(domainId: string): Promise<MemoryCard[]> {
  // 先找到该领域的所有知识点
  const points = await db.knowledgePoints
    .where("domainId")
    .equals(domainId)
    .toArray();
  const pointIds = points.map((p) => p.id);

  return db.memoryCards
    .filter((c) => c.nextReview === null && pointIds.includes(c.pointId))
    .toArray();
}

// ── 查询：薄弱点 ──

export async function getWeakCards(): Promise<MemoryCard[]> {
  return db.memoryCards.filter((c) => c.isWeak === true).toArray();
}

// ── 查询：按阶段 ──

export async function getCardsByPhase(phase: LearningPhase): Promise<MemoryCard[]> {
  return db.memoryCards.where("learningPhase").equals(phase).toArray();
}

// ── 查询：今日统计 ──

export async function getTodayReviewCount(): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return db.reviewLogs
    .where("reviewedAt")
    .between(todayStart.getTime(), Date.now(), true, true)
    .count();
}

export async function getStudyStreakDays(): Promise<number> {
  // 统计有多少个不同的自然日有复习记录
  const logs = await db.reviewLogs.orderBy("reviewedAt").reverse().toArray();
  if (logs.length === 0) return 0;

  const days = new Set(
    logs.map((l) => {
      const d = new Date(l.reviewedAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  return days.size;
}

export async function getRetentionRate(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 86400000;
  const recentLogs = await db.reviewLogs
    .where("reviewedAt")
    .above(cutoff)
    .toArray();
  if (recentLogs.length === 0) return 100;
  const correct = recentLogs.filter((l) => l.quality >= 3).length;
  return Math.round((correct / recentLogs.length) * 100);
}

// ── 写入 ──

export async function addCard(
  data: Omit<MemoryCard, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await db.memoryCards.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<MemoryCard, "id" | "createdAt">>
): Promise<void> {
  await db.memoryCards.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteCard(id: string): Promise<void> {
  await db.reviewLogs.where("cardId").equals(id).delete();
  await db.memoryCards.delete(id);
}

// ── 批量操作 ──

export async function bulkAddCards(cards: Omit<MemoryCard, "id" | "createdAt" | "updatedAt">[]): Promise<string[]> {
  const now = Date.now();
  const ids = cards.map(() => generateId());
  const fullCards = cards.map((c, i) => ({ ...c, id: ids[i], createdAt: now, updatedAt: now }));
  await db.memoryCards.bulkAdd(fullCards);
  return ids;
}

/** 一次性获取所有卡片（用于 domainStore 初始化） */
export async function getAllCards(): Promise<MemoryCard[]> {
  return db.memoryCards.toArray();
}
