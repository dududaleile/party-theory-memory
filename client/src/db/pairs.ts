import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { ConfusingPair } from "@shared/types";

export async function getAllPairs() {
  return db.confusingPairs.orderBy("confidence").reverse().toArray();
}

export async function getPairsByPoint(pointId: string) {
  return db.confusingPairs
    .filter((p) => p.pointAId === pointId || p.pointBId === pointId)
    .toArray();
}

export async function addPair(data: Omit<ConfusingPair, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const id = generateId();
  await db.confusingPairs.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function deletePair(id: string) {
  await db.confusingPairs.delete(id);
}
