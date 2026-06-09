import { db } from "./schema";
import { generateId } from "@/utils/uuid";
import type { AIRefinementRound } from "@shared/types";

export async function getRoundsBySource(sourceTextId: string) {
  return db.aiRefinementRounds
    .where("sourceTextId")
    .equals(sourceTextId)
    .sortBy("round");
}

export async function addRound(data: Omit<AIRefinementRound, "id">) {
  const id = generateId();
  await db.aiRefinementRounds.add({ ...data, id });
  return id;
}
