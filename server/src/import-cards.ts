/**
 * 将产品卡片导入 IndexedDB
 * 链 → 领域, 卡片 → 知识点 + 记忆卡片
 * 使用 Dexie.js 在 Node 端写入（通过 fake-indexeddb）
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
// UUID v7 生成（本地版，避免跨 rootDir 引用）
function generateId(): string {
  const ts = Date.now().toString(16).padStart(12, "0");
  const r = () => Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${r()}-8${r().slice(1)}-${r()}${r()}`;
}

const OUT = join(process.cwd(), "output");
const cards = JSON.parse(readFileSync(join(OUT, "product-cards.json"), "utf-8"));

// ═══════════════════════════════════════════════════
// 构建 IndexedDB 数据
// ═══════════════════════════════════════════════════

interface Domain {
  id: string; name: string; description: string; parentId: string | null;
  order: number; color: string | null; icon: string | null;
  totalPoints: number; masteredPoints: number;
  createdAt: number; updatedAt: number;
}

interface Point {
  id: string; domainId: string; parentPointId: string | null;
  title: string; question: string; answer: string; answerBrief: string;
  keywords: string[]; difficulty: number; questionType: string;
  tags: string[]; sourceTextId: null; sourceTextIndex: null; sourceTextQuote: null;
  treePath: string[]; refinementRoundId: null; refinementStatus: string;
  confidence: number; createdAt: number; updatedAt: number;
}

interface Card {
  id: string; pointId: string;
  easeFactor: number; interval: number; repetitions: number;
  nextReview: null; lastReview: null;
  memoryStrength: number; learningPhase: string;
  isWeak: boolean; weakSince: null; weakReason: null;
  consecutiveCorrect: number; consecutiveErrors: number;
  recentRatings: number[]; totalReviews: number; totalCorrect: number;
  createdAt: number; updatedAt: number;
}

const CHAIN_COLORS: Record<string, string> = {
  "primary-stage": "#0071E3",
  "chinese-modernization": "#FF3B30",
  "marxism-theory": "#AF52DE",
  "party-history": "#FF9500",
  "party-nature": "#34C759",
  "party-discipline": "#FF3B30",
  "party-organization": "#0071E3",
  "party-membership": "#34C759",
  "reform-policy": "#FF9500",
  "new-era-achievements": "#0071E3",
  "essay-questions": "#AF52DE",
  "other": "#8E8E93",
};

const CHAIN_ICONS: Record<string, string> = {
  "primary-stage": "🏛",
  "chinese-modernization": "🚀",
  "marxism-theory": "📚",
  "party-history": "📜",
  "party-nature": "🏠",
  "party-discipline": "⚖️",
  "party-organization": "🏢",
  "party-membership": "📝",
  "reform-policy": "🔧",
  "new-era-achievements": "🏆",
  "essay-questions": "✍️",
  "other": "📌",
};

function mapType(kt: string): string {
  if (kt === "政治表述" || kt === "政治表述") return "concept";
  if (kt === "数字") return "list";
  if (kt === "时间线" || kt === "会议") return "concept";
  if (kt === "意义" || kt === "因果") return "essay";
  return "concept";
}

const now = Date.now();
const rootDomainId = generateId();

// 根领域
const rootDomain: Domain = {
  id: rootDomainId, name: "党课理论知识", description: "全部党课知识卡片",
  parentId: null, order: 0, color: "#0071E3", icon: "🏛",
  totalPoints: 0, masteredPoints: 0,
  createdAt: now, updatedAt: now,
};

const domains: Domain[] = [rootDomain];
const points: Point[] = [];
const memCards: Card[] = [];
const chainDomainMap: Record<string, string> = {};

// 每个链创建一个子领域
const seenChains = new Set<string>();
cards.cards.forEach((c: any) => {
  if (!seenChains.has(c.chainId)) {
    seenChains.add(c.chainId);
    const domainId = generateId();
    chainDomainMap[c.chainId] = domainId;
    domains.push({
      id: domainId,
      name: c.chainName,
      description: cards.stats?.byChain?.[c.chainName] || "",
      parentId: rootDomainId,
      order: domains.length,
      color: CHAIN_COLORS[c.chainId] || "#8E8E93",
      icon: CHAIN_ICONS[c.chainId] || "📌",
      totalPoints: 0, masteredPoints: 0,
      createdAt: now, updatedAt: now,
    });
  }
});

// 每个卡片 → 知识点 + 记忆卡片
let parentPointId: string | null = null;

cards.cards.forEach((c: any, idx: number) => {
  const domainId = chainDomainMap[c.chainId] || rootDomainId;
  const pointId = generateId();
  const cardId = generateId();

  // 链内第一个知识点无父，后续的以链内前一个为父
  if (c.index === 1) {
    parentPointId = pointId; // 记住链的起点
  }

  const actualParent = c.index === 1 ? null : parentPointId;
  if (c.index === 1) parentPointId = pointId; // 更新为当前

  points.push({
    id: pointId, domainId,
    parentPointId: c.index === 1 ? null : (idx > 0 ? points[points.length - 1].id : null),
    title: c.title,
    question: c.title,
    answer: c.officialText,
    answerBrief: c.coreMemory.slice(0, 80),
    keywords: c.keywords || [],
    difficulty: c.frequency === "high" ? 4 : 3,
    questionType: mapType(c.type),
    tags: c.frequency === "high" ? ["高频考点"] : [],
    sourceTextId: null, sourceTextIndex: null, sourceTextQuote: null,
    treePath: [rootDomainId, domainId],
    refinementRoundId: null, refinementStatus: "confirmed",
    confidence: 0.9, createdAt: now, updatedAt: now,
  });

  memCards.push({
    id: cardId, pointId,
    easeFactor: 2.5, interval: 0, repetitions: 0,
    nextReview: null, lastReview: null,
    memoryStrength: 0, learningPhase: "new",
    isWeak: false, weakSince: null, weakReason: null,
    consecutiveCorrect: 0, consecutiveErrors: 0,
    recentRatings: [], totalReviews: 0, totalCorrect: 0,
    createdAt: now, updatedAt: now,
  });

  // 更新 parentPointId 供下一个兄弟使用
  if (c.index > 1) {
    parentPointId = pointId;
  }
});

// 更新领域统计
domains.forEach(d => {
  const domainPoints = points.filter(p => p.domainId === d.id);
  d.totalPoints = domainPoints.length;
});

rootDomain.totalPoints = points.length;

// 输出
const exportData = { domains, points, cards: memCards };

const outPath = join(OUT, "indexeddb-import.json");
writeFileSync(outPath, JSON.stringify(exportData, null, 2), "utf-8");

console.log("IndexedDB 导入数据已生成:");
console.log(`  领域: ${domains.length} (1 根 + ${domains.length - 1} 链)`);
console.log(`  知识点: ${points.length}`);
console.log(`  卡片: ${memCards.length}`);
console.log(`  高频: ${points.filter(p => p.tags.includes("高频考点")).length} 张`);
console.log(`\n  输出: ${outPath}`);
console.log(`\n  在浏览器控制台执行导入:`);
console.log(`  const data = await fetch('/output/indexeddb-import.json').then(r=>r.json());`);
console.log(`  await useDomainStore.getState().bulkImport(data.domains, data.points, data.cards);`);
