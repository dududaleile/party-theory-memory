/**
 * domainStore — 知识领域 + 知识点状态管理
 *
 * 职责：
 *   1. 从 IndexedDB 加载领域和知识点到内存
 *   2. 构建领域树（domainTree）供 UI 渲染
 *   3. 计算每个领域的掌握度
 *   4. 提供 CRUD 操作
 *   5. 支持 AI 提炼后的批量导入
 *
 * 数据流：
 *   IndexedDB ← domainStore → HomePage / DomainTreeView / KnowledgeGraph
 */

import { create } from "zustand";
import type { KnowledgeDomain, KnowledgePoint, DomainTreeNode, MemoryCard } from "@shared/types";
import * as domainDb from "@/db/domains";
import * as pointDb from "@/db/points";
import * as cardDb from "@/db/cards";

// ── Store 类型 ──

interface DomainStore {
  // ── 数据（内存缓存）──
  domains: KnowledgeDomain[];
  points: KnowledgePoint[];
  cards: MemoryCard[];
  domainTree: DomainTreeNode[];
  domainMap: Record<string, KnowledgeDomain>;
  pointsByDomain: Record<string, KnowledgePoint[]>;

  // ── 加载状态 ──
  isLoaded: boolean;
  isLoading: boolean;

  // ── 初始化 ──
  /** 从 IndexedDB 加载所有数据并构建树 */
  loadAll: () => Promise<void>;

  // ── 领域 CRUD ──
  addDomain: (data: Omit<KnowledgeDomain, "id" | "createdAt" | "updatedAt" | "totalPoints" | "masteredPoints">) => Promise<string>;
  updateDomain: (id: string, updates: Partial<KnowledgeDomain>) => Promise<void>;
  deleteDomain: (id: string) => Promise<void>;

  // ── 知识点 CRUD ──
  addPoint: (data: Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updatePoint: (id: string, updates: Partial<KnowledgePoint>) => Promise<void>;
  deletePoint: (id: string) => Promise<void>;

  // ── 查询 ──
  /** 获取某个领域的完整路径（从根到该领域） */
  getDomainPath: (domainId: string) => KnowledgeDomain[];
  /** 获取某个领域的掌握度统计 */
  getDomainMastery: (domainId: string) => { total: number; mastered: number; percentage: number };
  /** 获取某个领域的所有知识点 */
  getPointsForDomain: (domainId: string) => KnowledgePoint[];

  // ── 批量导入（AI 提炼后）──
  directImport: (domains: KnowledgeDomain[], points: KnowledgePoint[], cards: MemoryCard[]) => Promise<void>;
  bulkImport: (domains: KnowledgeDomain[], points: KnowledgePoint[], cards: Omit<MemoryCard, "id" | "createdAt" | "updatedAt">[]) => Promise<void>;

  // ── 内部 ──
  _buildTree: () => void;
  _refreshCards: () => Promise<void>;
}

// ── Store 实现 ──

export const useDomainStore = create<DomainStore>()((set, get) => ({
  domains: [],
  points: [],
  cards: [],
  domainTree: [],
  domainMap: {},
  pointsByDomain: {},
  isLoaded: false,
  isLoading: false,

  // ══════════════════════════════════════════════════════════
  // 初始化
  // ══════════════════════════════════════════════════════════

  loadAll: async () => {
    set({ isLoading: true });

    const [domains, points, cards] = await Promise.all([
      domainDb.getAllDomains(),
      pointDb.getAllPoints(),
      cardDb.getAllCards(),
    ]);

    set({ domains, points, cards, isLoading: false, isLoaded: true });
    get()._buildTree();
  },

  // ══════════════════════════════════════════════════════════
  // 领域 CRUD
  // ══════════════════════════════════════════════════════════

  addDomain: async (data) => {
    const id = await domainDb.addDomain(data);
    await get().loadAll(); // 重新加载
    return id;
  },

  updateDomain: async (id, updates) => {
    await domainDb.updateDomain(id, updates);
    const { domains } = get();
    const idx = domains.findIndex((d) => d.id === id);
    if (idx >= 0) {
      const updated = { ...domains[idx], ...updates, updatedAt: Date.now() };
      const newDomains = [...domains];
      newDomains[idx] = updated;
      set({ domains: newDomains });
      get()._buildTree();
    }
  },

  deleteDomain: async (id) => {
    await domainDb.deleteDomain(id);
    await get().loadAll();
  },

  // ══════════════════════════════════════════════════════════
  // 知识点 CRUD
  // ══════════════════════════════════════════════════════════

  addPoint: async (data) => {
    const id = await pointDb.addPoint(data);
    await get().loadAll();
    return id;
  },

  updatePoint: async (id, updates) => {
    await pointDb.updatePoint(id, updates);
    const { points } = get();
    const idx = points.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const newPoints = [...points];
      newPoints[idx] = { ...newPoints[idx], ...updates, updatedAt: Date.now() };
      set({ points: newPoints });
      get()._buildTree();
    }
  },

  deletePoint: async (id) => {
    await pointDb.deletePoint(id);
    await get().loadAll();
  },

  // ══════════════════════════════════════════════════════════
  // 查询
  // ══════════════════════════════════════════════════════════

  getDomainPath: (domainId) => {
    const { domainMap } = get();
    const path: KnowledgeDomain[] = [];
    let current: KnowledgeDomain | undefined = domainMap[domainId];
    while (current) {
      path.unshift(current);
      current = current.parentId ? domainMap[current.parentId] : undefined;
    }
    return path;
  },

  getDomainMastery: (domainId) => {
    const { cards, points } = get();
    // 收集该领域及其所有子领域的知识点
    const { domainMap } = get();
    const domainPointIds = new Set<string>();

    function collectPointIds(did: string) {
      const pts = points.filter((p) => p.domainId === did);
      pts.forEach((p) => domainPointIds.add(p.id));
      // 递归子领域
      const children = Object.values(domainMap).filter((d) => d.parentId === did);
      children.forEach((c) => collectPointIds(c.id));
    }
    collectPointIds(domainId);

    const domainCards = cards.filter((c) => domainPointIds.has(c.pointId));
    const total = domainCards.length;
    const mastered = domainCards.filter(
      (c) => c.learningPhase === "mastered" || (c.interval >= 60 && c.totalCorrect >= c.totalReviews * 0.9)
    ).length;

    return {
      total,
      mastered,
      percentage: total > 0 ? Math.round((mastered / total) * 100) : 0,
    };
  },

  getPointsForDomain: (domainId) => {
    return get().points.filter((p) => p.domainId === domainId);
  },

  // ══════════════════════════════════════════════════════════
  // 直接导入（ID 已预生成，使用 bulkPut）
  // ══════════════════════════════════════════════════════════

  directImport: async (domains, points, cards) => {
    const { db } = await import("@/db/schema");
    await db.knowledgeDomains.bulkPut(domains);
    await db.knowledgePoints.bulkPut(points);
    await db.memoryCards.bulkPut(cards);
    await get().loadAll();
  },

  // ══════════════════════════════════════════════════════════
  // 批量导入（AI 提炼后，ID 由系统生成）
  // ══════════════════════════════════════════════════════════

  bulkImport: async (domains, points, cards) => {
    // 批量写入 IndexedDB
    await domainDb.getAllDomains().then(async (existing) => {
      for (const d of domains) {
        if (!existing.find((e) => e.id === d.id)) {
          await domainDb.addDomain(d);
        }
      }
    });

    await pointDb.bulkAddPoints(points);
    await cardDb.bulkAddCards(cards);

    // 重新计算所有领域的统计数据
    for (const d of domains) {
      await domainDb.recalculateDomainStats(d.id);
    }

    // 重新加载
    await get().loadAll();
  },

  // ══════════════════════════════════════════════════════════
  // 内部方法
  // ══════════════════════════════════════════════════════════

  _buildTree: () => {
    const { domains, points, cards } = get();

    // 构建 domainMap（快速查找）
    const domainMap: Record<string, KnowledgeDomain> = {};
    domains.forEach((d) => {
      domainMap[d.id] = d;
    });

    // 按 domain 分组知识点
    const pointsByDomain: Record<string, KnowledgePoint[]> = {};
    points.forEach((p) => {
      if (!pointsByDomain[p.domainId]) pointsByDomain[p.domainId] = [];
      pointsByDomain[p.domainId].push(p);
    });

    // 构建子领域 Map
    const childrenMap: Record<string, KnowledgeDomain[]> = {};
    domains.forEach((d) => {
      const pid = d.parentId ?? "__root__";
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(d);
    });

    // 递归构建树节点
    function buildNode(domain: KnowledgeDomain, depth: number): DomainTreeNode {
      const children = (childrenMap[domain.id] || [])
        .sort((a, b) => a.order - b.order)
        .map((child) => buildNode(child, depth + 1));

      // 计算该领域的掌握度（递归聚合子领域 + 本领域知识点）
      const allPointIds = new Set<string>();
      function collectAll(d: KnowledgeDomain) {
        (pointsByDomain[d.id] || []).forEach((p) => allPointIds.add(p.id));
        (childrenMap[d.id] || []).forEach(collectAll);
      }
      collectAll(domain);

      const domainCards = cards.filter((c) => allPointIds.has(c.pointId));
      const mastered = domainCards.filter(
        (c) => c.learningPhase === "mastered" || (c.interval >= 60 && c.totalCorrect >= c.totalReviews * 0.9)
      ).length;

      return {
        domain,
        children,
        depth,
        mastery: {
          total: domainCards.length,
          mastered,
          percentage: domainCards.length > 0 ? Math.round((mastered / domainCards.length) * 100) : 0,
        },
      };
    }

    const rootDomains = (childrenMap["__root__"] || [])
      .sort((a, b) => a.order - b.order);
    const domainTree = rootDomains.map((d) => buildNode(d, 0));

    set({ domainTree, domainMap, pointsByDomain });
  },

  _refreshCards: async () => {
    const cards = await cardDb.getAllCards();
    set({ cards });
    get()._buildTree();
  },
}));
