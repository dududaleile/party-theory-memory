import { db } from "./schema";
import type { UserSettings } from "@shared/types";

export async function getSetting(key: string): Promise<unknown | undefined> {
  const s = await db.userSettings.get(key);
  return s?.value;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.userSettings.put({ key, value, updatedAt: Date.now() });
}

export async function getAllSettings(): Promise<UserSettings[]> {
  return db.userSettings.toArray();
}

export async function deleteSetting(key: string): Promise<void> {
  await db.userSettings.delete(key);
}

// ── 常用设置的便捷方法 ──

export async function getDailyNewCardLimit(): Promise<number> {
  return (await getSetting("dailyNewCardLimit")) as number | undefined ?? 10;
}

export async function getDailyReviewLimit(): Promise<number> {
  return (await getSetting("dailyReviewLimit")) as number | undefined ?? 50;
}
