/**
 * IndexedDB Schema — Dexie 定义
 *
 * 9 张表，每表单一职责。
 * 不使用复合索引以外的复杂结构。
 */

import Dexie, { type Table } from "dexie";
import type {
  KnowledgeDomain,
  KnowledgePoint,
  MemoryCard,
  ReviewLog,
  SourceText,
  AIRefinementRound,
  ConfusingPair,
  EssaySkeleton,
  KnowledgeRelation,
  UserSettings,
} from "@shared/types";

export class PartyTheoryDB extends Dexie {
  knowledgeDomains!: Table<KnowledgeDomain, string>;
  knowledgePoints!: Table<KnowledgePoint, string>;
  memoryCards!: Table<MemoryCard, string>;
  reviewLogs!: Table<ReviewLog, string>;
  sourceTexts!: Table<SourceText, string>;
  aiRefinementRounds!: Table<AIRefinementRound, string>;
  confusingPairs!: Table<ConfusingPair, string>;
  essaySkeletons!: Table<EssaySkeleton, string>;
  knowledgeRelations!: Table<KnowledgeRelation, string>;
  userSettings!: Table<UserSettings, string>;

  constructor() {
    super("partyTheoryDB");

    this.version(1).stores({
      knowledgeDomains: "&id, parentId, order, [parentId+order]",
      knowledgePoints: "&id, domainId, parentPointId, difficulty, questionType, refinementStatus, [domainId+difficulty]",
      memoryCards: "&id, pointId, nextReview, learningPhase, isWeak, [nextReview+learningPhase]",
      reviewLogs: "&id, cardId, pointId, reviewedAt, [cardId+reviewedAt]",
      sourceTexts: "&id, extractionStatus, createdAt",
      aiRefinementRounds: "&id, sourceTextId, round, [sourceTextId+round]",
      confusingPairs: "&id, pointAId, pointBId, confidence, generatedBy",
      essaySkeletons: "&id, pointId, title, createdAt",
      knowledgeRelations: "&id, sourcePointId, targetPointId, relationType, [sourcePointId+relationType]",
      userSettings: "&key",
    });
  }
}

/** 单例 */
export const db = new PartyTheoryDB();
