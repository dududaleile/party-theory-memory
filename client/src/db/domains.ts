/**
 * knowledgeDomains CRUD
 */
import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { KnowledgeDomain } from "@shared/types";

// ── 查询 ──

export async function getAllDomains(): Promise<KnowledgeDomain[]> {
  return db.knowledgeDomains.orderBy("order").toArray();
}

export async function getDomainById(id: string): Promise<KnowledgeDomain | undefined> {
  return db.knowledgeDomains.get(id);
}

export async function getChildDomains(parentId: string): Promise<KnowledgeDomain[]> {
  return db.knowledgeDomains.where("parentId").equals(parentId).sortBy("order");
}

export async function getRootDomains(): Promise<KnowledgeDomain[]> {
  return db.knowledgeDomains
    .filter((d) => d.parentId === null)
    .sortBy("order");
}

export async function getDomainPath(domainId: string): Promise<KnowledgeDomain[]> {
  const path: KnowledgeDomain[] = [];
  let current = await db.knowledgeDomains.get(domainId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? await db.knowledgeDomains.get(current.parentId)
      : undefined;
  }
  return path;
}

// ── 写入 ──

export async function addDomain(
  data: Omit<KnowledgeDomain, "id" | "createdAt" | "updatedAt" | "totalPoints" | "masteredPoints">
): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await db.knowledgeDomains.add({
    ...data,
    id,
    totalPoints: 0,
    masteredPoints: 0,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateDomain(
  id: string,
  updates: Partial<Omit<KnowledgeDomain, "id" | "createdAt">>
): Promise<void> {
  await db.knowledgeDomains.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteDomain(id: string): Promise<void> {
  await db.knowledgeDomains.delete(id);
}

// ── 聚合更新 ──

export async function recalculateDomainStats(domainId: string): Promise<void> {
  // 汇总该领域下所有知识点的掌握情况
  // 由调用方（store）在卡片评分后触发
  const points = await db.knowledgePoints
    .where("domainId")
    .equals(domainId)
    .toArray();
  const pointIds = points.map((p) => p.id);

  if (pointIds.length === 0) {
    await db.knowledgeDomains.update(domainId, {
      totalPoints: 0,
      masteredPoints: 0,
      updatedAt: Date.now(),
    });
    return;
  }

  const cards = await db.memoryCards
    .where("pointId")
    .anyOf(pointIds)
    .toArray();

  const total = cards.length;
  const mastered = cards.filter(
    (c) => c.learningPhase === "mastered" || (c.interval >= 60 && c.totalCorrect >= c.totalReviews * 0.9)
  ).length;

  await db.knowledgeDomains.update(domainId, {
    totalPoints: total,
    masteredPoints: mastered,
    updatedAt: Date.now(),
  });
}
