/**
 * settingsStore — 设置 + 知识管理状态
 */

import { create } from "zustand";
import * as settingDb from "@/db/settings";
import * as cardDb from "@/db/cards";
import * as pointDb from "@/db/points";
import * as domainDb from "@/db/domains";
import { db } from "@/db/schema";

interface SettingsStore {
  // ── AI 配置 ──
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  isAiConfigured: boolean;

  // ── 学习偏好 ──
  dailyNewCardLimit: number;
  dailyReviewLimit: number;
  reminderTime: string;
  reminderEnabled: boolean;

  // ── 数据统计 ──
  totalPoints: number;
  totalCards: number;
  masteredCards: number;
  totalReviews: number;
  totalStudyDays: number;
  domainStats: { name: string; total: number; mastered: number; percentage: number }[];

  // ── 加载状态 ──
  isLoaded: boolean;

  // ── 动作 ──
  loadSettings: () => Promise<void>;
  updateSetting: (key: string, value: unknown) => Promise<void>;
  setAiProvider: (provider: string) => void;
  setAiModel: (model: string) => void;
  setAiBaseUrl: (url: string) => void;
  testAiConnection: () => Promise<{ ok: boolean; message: string }>;
  refreshStats: () => Promise<void>;

  // ── 数据管理 ──
  exportAllData: () => Promise<string>;
  importAllData: (json: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  aiProvider: "openai",
  aiModel: "gpt-4o",
  aiBaseUrl: "https://api.openai.com",
  isAiConfigured: false,
  dailyNewCardLimit: 10,
  dailyReviewLimit: 50,
  reminderTime: "08:00",
  reminderEnabled: true,
  totalPoints: 0,
  totalCards: 0,
  masteredCards: 0,
  totalReviews: 0,
  totalStudyDays: 0,
  domainStats: [],
  isLoaded: false,

  // ══════════════════════════════════════════════════════════
  // 加载
  // ══════════════════════════════════════════════════════════

  loadSettings: async () => {
    const [provider, model, baseUrl, dailyNew, dailyReview, reminderTime, reminderOn] =
      await Promise.all([
        settingDb.getSetting("aiProvider"),
        settingDb.getSetting("aiModel"),
        settingDb.getSetting("aiBaseUrl"),
        settingDb.getSetting("dailyNewCardLimit"),
        settingDb.getSetting("dailyReviewLimit"),
        settingDb.getSetting("reminderTime"),
        settingDb.getSetting("reminderEnabled"),
      ]);

    set({
      aiProvider: (provider as string) ?? "openai",
      aiModel: (model as string) ?? "gpt-4o",
      aiBaseUrl: (baseUrl as string) ?? "https://api.openai.com",
      dailyNewCardLimit: (dailyNew as number) ?? 10,
      dailyReviewLimit: (dailyReview as number) ?? 50,
      reminderTime: (reminderTime as string) ?? "08:00",
      reminderEnabled: (reminderOn as boolean) ?? true,
      isLoaded: true,
    });

    await get().refreshStats();
  },

  updateSetting: async (key, value) => {
    await settingDb.setSetting(key, value);
    set({ [key]: value } as Partial<SettingsStore>);
  },

  setAiProvider: (provider) => set({ aiProvider: provider }),
  setAiModel: (model) => set({ aiModel: model }),
  setAiBaseUrl: (url) => set({ aiBaseUrl: url }),

  testAiConnection: async () => {
    const { aiProvider, aiModel, aiBaseUrl } = get();
    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, model: aiModel, baseUrl: aiBaseUrl }),
      });
      if (res.ok) {
        set({ isAiConfigured: true });
        return { ok: true, message: "连接成功" };
      }
      return { ok: false, message: `错误: ${res.status}` };
    } catch (e) {
      return { ok: false, message: `连接失败: ${(e as Error).message}` };
    }
  },

  // ══════════════════════════════════════════════════════════
  // 统计
  // ══════════════════════════════════════════════════════════

  refreshStats: async () => {
    const [points, cards, domains] = await Promise.all([
      pointDb.getAllPoints(),
      cardDb.getAllCards(),
      domainDb.getAllDomains(),
    ]);

    const mastered = cards.filter(
      (c) => c.learningPhase === "mastered" || (c.interval >= 60 && c.totalCorrect >= c.totalReviews * 0.9)
    ).length;

    const totalReviews = cards.reduce((sum, c) => sum + (c.totalReviews || 0), 0);

    const domainStats = domains.map((d) => {
      const domainPoints = points.filter((p) => p.domainId === d.id);
      const domainCards = cards.filter((c) => domainPoints.some((p) => p.id === c.pointId));
      const dMastered = domainCards.filter(
        (c) => c.learningPhase === "mastered" || (c.interval >= 60 && c.totalCorrect >= c.totalReviews * 0.9)
      ).length;
      return {
        name: d.name,
        total: domainCards.length,
        mastered: dMastered,
        percentage: domainCards.length > 0 ? Math.round((dMastered / domainCards.length) * 100) : 0,
      };
    });

    set({
      totalPoints: points.length,
      totalCards: cards.length,
      masteredCards: mastered,
      totalReviews,
      totalStudyDays: await cardDb.getStudyStreakDays(),
      domainStats,
    });
  },

  // ══════════════════════════════════════════════════════════
  // 数据管理
  // ══════════════════════════════════════════════════════════

  exportAllData: async () => {
    const [domains, points, cards, logs, relations, pairs, skeletons, settings] = await Promise.all([
      domainDb.getAllDomains(),
      pointDb.getAllPoints(),
      cardDb.getAllCards(),
      db.reviewLogs.toArray(),
      db.knowledgeRelations.toArray(),
      db.confusingPairs.toArray(),
      db.essaySkeletons.toArray(),
      settingDb.getAllSettings(),
    ]);
    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      domains, points, cards, logs, relations, pairs, skeletons, settings,
    }, null, 2);
  },

  importAllData: async (json) => {
    const data = JSON.parse(json);
    if (data.domains) await db.knowledgeDomains.bulkPut(data.domains);
    if (data.points) await db.knowledgePoints.bulkPut(data.points);
    if (data.cards) await db.memoryCards.bulkPut(data.cards);
    if (data.logs) await db.reviewLogs.bulkPut(data.logs);
    if (data.relations) await db.knowledgeRelations.bulkPut(data.relations);
    if (data.pairs) await db.confusingPairs.bulkPut(data.pairs);
    if (data.skeletons) await db.essaySkeletons.bulkPut(data.skeletons);
    if (data.settings) await db.userSettings.bulkPut(data.settings);
    await get().loadSettings();
  },

  clearAllData: async () => {
    await Promise.all([
      db.knowledgeDomains.clear(),
      db.knowledgePoints.clear(),
      db.memoryCards.clear(),
      db.reviewLogs.clear(),
      db.knowledgeRelations.clear(),
      db.confusingPairs.clear(),
      db.essaySkeletons.clear(),
      db.sourceTexts.clear(),
      db.aiRefinementRounds.clear(),
      db.userSettings.clear(),
    ]);
    set({
      totalPoints: 0, totalCards: 0, masteredCards: 0,
      totalReviews: 0, totalStudyDays: 0, domainStats: [],
    });
  },
}));
