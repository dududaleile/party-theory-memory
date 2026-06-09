/**
 * focusStore — 重点强化状态
 *
 * 管理四个区块的数据：
 *   1. 易混概念（ConfusingPair[]）
 *   2. 薄弱知识点（MemoryCard[] + KnowledgePoint[]）
 *   3. 论述骨架（EssaySkeleton[]）
 *   4. 知识图谱（graphNodes + graphEdges）
 */

import { create } from "zustand";
import type { MemoryCard, KnowledgePoint, ConfusingPair, EssaySkeleton, KnowledgeRelation } from "@shared/types";
import * as cardDb from "@/db/cards";
import * as pointDb from "@/db/points";
import * as pairDb from "@/db/pairs";
import * as skeletonDb from "@/db/skeletons";
import * as relationDb from "@/db/relations";

// ── 图谱类型 ──

export interface GraphNode {
  id: string;
  label: string;
  domainId: string;
  color: string;
  size: number;
  status: "new" | "learning" | "mastered" | "weak";
  cardId: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  strength: number;
}

// ── Store ──

interface FocusStore {
  // ── 数据 ──
  confusingPairs: ConfusingPair[];
  weakCards: MemoryCard[];
  weakPoints: KnowledgePoint[];
  essaySkeletons: EssaySkeleton[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];

  // ── 加载状态 ──
  isLoaded: boolean;

  // ── UI 状态 ──
  /** 易混概念当前索引（横向滑动） */
  currentPairIndex: number;
  /** 展开的骨架 ID */
  expandedSkeletonId: string | null;

  // ── 动作 ──
  loadAll: () => Promise<void>;
  setCurrentPairIndex: (i: number) => void;
  setExpandedSkeleton: (id: string | null) => void;
  /** 手动触发 AI 易混检测（调用后端） */
  triggerConfusingDetection: () => Promise<void>;
  /** 手动触发骨架生成 */
  triggerSkeletonGeneration: (pointId: string) => Promise<void>;
}

export const useFocusStore = create<FocusStore>()((set, get) => ({
  confusingPairs: [],
  weakCards: [],
  weakPoints: [],
  essaySkeletons: [],
  graphNodes: [],
  graphEdges: [],
  isLoaded: false,
  currentPairIndex: 0,
  expandedSkeletonId: null,

  // ══════════════════════════════════════════════════════════
  // 加载
  // ══════════════════════════════════════════════════════════

  loadAll: async () => {
    const [pairs, weakCards, skeletons, allPoints, allCards, relations] = await Promise.all([
      pairDb.getAllPairs(),
      cardDb.getWeakCards(),
      skeletonDb.getAllSkeletons(),
      pointDb.getAllPoints(),
      cardDb.getAllCards(),
      relationDb.getAllRelations(),
    ]);

    // 匹配薄弱知识点
    const pointMap = new Map(allPoints.map((p) => [p.id, p]));
    const weakPoints = weakCards
      .map((c) => pointMap.get(c.pointId))
      .filter((p): p is KnowledgePoint => Boolean(p));

    // 构建知识图谱
    const { graphNodes, graphEdges } = buildGraph(allPoints, allCards, relations, pointMap);

    set({
      confusingPairs: pairs,
      weakCards,
      weakPoints,
      essaySkeletons: skeletons,
      graphNodes,
      graphEdges,
      isLoaded: true,
    });
  },

  setCurrentPairIndex: (i) => set({ currentPairIndex: i }),
  setExpandedSkeleton: (id) => set({ expandedSkeletonId: id }),

  triggerConfusingDetection: async () => {
    // V1: 客户端不直接调 AI，标记 TODO
    // 后续通过设置页触发
  },

  triggerSkeletonGeneration: async (_pointId) => {
    // V1: 通过设置页触发
  },
}));

// ── 知识图谱构建 ──

function buildGraph(
  points: KnowledgePoint[],
  cards: MemoryCard[],
  relations: KnowledgeRelation[],
  pointMap: Map<string, KnowledgePoint>
): { graphNodes: GraphNode[]; graphEdges: GraphEdge[] } {
  const cardMap = new Map(cards.map((c) => [c.pointId, c]));

  // 节点
  const graphNodes: GraphNode[] = points.map((p) => {
    const card = cardMap.get(p.id);
    return {
      id: p.id,
      label: p.title,
      domainId: p.domainId,
      color: getDomainColor(p.domainId),
      size: card ? mapStrengthToSize(card.memoryStrength) : 8,
      status: card
        ? card.isWeak ? "weak"
        : card.learningPhase === "mastered" ? "mastered"
        : card.learningPhase === "new" ? "new"
        : "learning"
        : "new",
      cardId: card?.id ?? null,
    };
  });

  // 边
  const graphEdges: GraphEdge[] = [
    // 父子关系边（从 parentPointId 推导）
    ...points
      .filter((p) => p.parentPointId && pointMap.has(p.parentPointId))
      .map((p) => ({
        source: p.parentPointId!,
        target: p.id,
        type: "parent_child",
        strength: 0.9,
      })),
    // 显式关联边
    ...relations.map((r) => ({
      source: r.sourcePointId,
      target: r.targetPointId,
      type: r.relationType,
      strength: r.strength,
    })),
  ];

  return { graphNodes, graphEdges };
}

function getDomainColor(_domainId: string): string {
  // 简化：后续从 domainStore 获取
  const colors = ["#0071E3", "#34C759", "#FF9500", "#FF3B30", "#AF52DE"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function mapStrengthToSize(strength: number): number {
  if (strength >= 80) return 24;
  if (strength >= 60) return 18;
  if (strength >= 40) return 14;
  if (strength >= 20) return 10;
  return 6;
}
