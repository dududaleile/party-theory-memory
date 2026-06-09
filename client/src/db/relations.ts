import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { KnowledgeRelation } from "@shared/types";

export async function getRelationsByPoint(pointId: string) {
  return db.knowledgeRelations
    .filter((r) => r.sourcePointId === pointId || r.targetPointId === pointId)
    .toArray();
}

export async function getAllRelations() {
  return db.knowledgeRelations.toArray();
}

export async function addRelation(data: Omit<KnowledgeRelation, "id" | "createdAt">) {
  const id = generateId();
  await db.knowledgeRelations.add({ ...data, id, createdAt: Date.now() });
  return id;
}

export async function deleteRelationsByPoint(pointId: string) {
  await db.knowledgeRelations
    .filter((r) => r.sourcePointId === pointId || r.targetPointId === pointId)
    .delete();
}
