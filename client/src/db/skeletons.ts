import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { EssaySkeleton } from "@shared/types";

export async function getAllSkeletons() {
  return db.essaySkeletons.orderBy("createdAt").reverse().toArray();
}

export async function getSkeletonById(id: string) {
  return db.essaySkeletons.get(id);
}

export async function getSkeletonsByPoint(pointId: string) {
  return db.essaySkeletons.where("pointId").equals(pointId).toArray();
}

export async function addSkeleton(data: Omit<EssaySkeleton, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const id = generateId();
  await db.essaySkeletons.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}
