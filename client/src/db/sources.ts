import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { SourceText, ExtractionStatus } from "@shared/types";

export async function getSourceById(id: string) {
  return db.sourceTexts.get(id);
}

export async function getAllSources() {
  return db.sourceTexts.orderBy("createdAt").reverse().toArray();
}

export async function addSource(data: Omit<SourceText, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const id = generateId();
  await db.sourceTexts.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateSourceStatus(id: string, status: ExtractionStatus, pointIds?: string[]) {
  const updates: Partial<SourceText> = { extractionStatus: status, updatedAt: Date.now() };
  if (pointIds) updates.extractedPointIds = pointIds;
  await db.sourceTexts.update(id, updates);
}
