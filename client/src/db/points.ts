/**
 * knowledgePoints CRUD
 */
import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { KnowledgePoint, QuestionType, RefinementStatus } from "@shared/types";

// ── 查询 ──

export async function getAllPoints(): Promise<KnowledgePoint[]> {
  return db.knowledgePoints.toArray();
}

export async function getPointById(id: string): Promise<KnowledgePoint | undefined> {
  return db.knowledgePoints.get(id);
}

export async function getPointsByDomain(domainId: string): Promise<KnowledgePoint[]> {
  return db.knowledgePoints.where("domainId").equals(domainId).toArray();
}

export async function getPointsByParent(parentPointId: string): Promise<KnowledgePoint[]> {
  return db.knowledgePoints
    .where("parentPointId")
    .equals(parentPointId)
    .toArray();
}

export async function getPointsByStatus(status: RefinementStatus): Promise<KnowledgePoint[]> {
  return db.knowledgePoints.where("refinementStatus").equals(status).toArray();
}

export async function getPointsByDifficulty(
  domainId: string,
  difficulty: number
): Promise<KnowledgePoint[]> {
  return db.knowledgePoints
    .where("[domainId+difficulty]")
    .equals([domainId, difficulty])
    .toArray();
}

// ── 写入 ──

export async function addPoint(
  data: Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await db.knowledgePoints.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updatePoint(
  id: string,
  updates: Partial<Omit<KnowledgePoint, "id" | "createdAt">>
): Promise<void> {
  await db.knowledgePoints.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deletePoint(id: string): Promise<void> {
  // 级联删除关联的卡片、复习记录
  const cards = await db.memoryCards.where("pointId").equals(id).toArray();
  for (const card of cards) {
    await db.reviewLogs.where("cardId").equals(card.id).delete();
    await db.memoryCards.delete(card.id);
  }
  // 删除该知识点参与的关联边
  await db.knowledgeRelations
    .filter((r) => r.sourcePointId === id || r.targetPointId === id)
    .delete();
  // 删除涉及的易混对
  await db.confusingPairs
    .filter((p) => p.pointAId === id || p.pointBId === id)
    .delete();
  await db.knowledgePoints.delete(id);
}

// ── 批量导入（AI 提炼后使用）──

export async function bulkAddPoints(points: KnowledgePoint[]): Promise<void> {
  await db.knowledgePoints.bulkAdd(points);
}

export async function bulkUpdatePoints(
  updates: Array<{ id: string; changes: Partial<KnowledgePoint> }>
): Promise<void> {
  for (const { id, changes } of updates) {
    await db.knowledgePoints.update(id, { ...changes, updatedAt: Date.now() });
  }
}
