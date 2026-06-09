/**
 * 党课知识产品化重构
 * 将 267 个知识点重构成「记忆型学习产品」卡片链
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const OUT = join(process.cwd(), "output");
const s1 = JSON.parse(readFileSync(join(OUT, "stage1-ocr.json"), "utf-8"));
const s2 = JSON.parse(readFileSync(join(OUT, "stage2-knowledge.json"), "utf-8"));

// ═══════════════════════════════════════════════════
// 知识主题链定义（按 OCR 页面顺序 + 语义聚类）
// ═══════════════════════════════════════════════════

const CHAINS: { id: string; name: string; description: string; pages: number[] }[] = [
  {
    id: "primary-stage",
    name: "社会主义初级阶段",
    description: "我国最大国情——新时代主要矛盾变化与基本国情不变",
    pages: [1, 5, 16, 21, 23, 24, 62, 75, 79, 84, 89, 92, 94],
  },
  {
    id: "chinese-modernization",
    name: "中国式现代化",
    description: "五个特征 + 两步走战略 + 新征程",
    pages: [6, 17, 18, 32, 54, 64, 68, 76],
  },
  {
    id: "marxism-theory",
    name: "马克思主义理论体系",
    description: "马列 → 毛泽东思想 → 邓小平理论 → 三个代表 → 科学发展观 → 习近平新时代中国特色社会主义思想",
    pages: [4, 19, 29, 33, 34, 40, 43, 48, 55, 58],
  },
  {
    id: "party-history",
    name: "党史关键节点",
    description: "建党 → 土地革命 → 抗日战争 → 解放战争 → 建国 → 改革开放 → 新时代",
    pages: [3, 7, 9, 31, 38, 52, 56, 57, 59, 61, 66, 73, 82, 85, 87],
  },
  {
    id: "party-nature",
    name: "党的性质与宗旨",
    description: "两个先锋队 + 三个代表 + 最高理想 + 根本宗旨",
    pages: [36, 45, 60, 69, 72, 77, 78, 86],
  },
  {
    id: "party-discipline",
    name: "党的纪律",
    description: "六大纪律 + 四种形态 + 处分类型",
    pages: [8, 22, 39, 42, 46, 67, 80, 93],
  },
  {
    id: "party-organization",
    name: "党的组织制度",
    description: "民主集中制 + 四个服从 + 党委vs党组 + 基层组织",
    pages: [26, 27, 53, 83, 91],
  },
  {
    id: "party-membership",
    name: "党员条件与入党流程",
    description: "申请条件 → 积极分子 → 发展对象 → 预备党员 → 正式党员 + 八项义务/权利",
    pages: [13, 14, 15, 20, 25, 28, 30, 35, 37, 49, 50, 74, 81, 88],
  },
  {
    id: "reform-policy",
    name: "全面深化改革",
    description: "六项原则 + 现代化产业体系 + 科技自立自强 + 新质生产力",
    pages: [11],
  },
  {
    id: "new-era-achievements",
    name: "新时代十年伟大变革",
    description: "三件大事 + 历史性胜利",
    pages: [63],
  },
  {
    id: "essay-questions",
    name: "思考题与论述题",
    description: "论述题素材",
    pages: [41, 90],
  },
  {
    id: "other",
    name: "补充知识点",
    description: "其他独立知识点",
    pages: [2, 10, 12, 44, 47, 51, 65, 70, 71, 95],
  },
];

// ═══════════════════════════════════════════════════
// 卡片格式化
// ═══════════════════════════════════════════════════

interface KnowledgePoint {
  title: string;
  content: string;
  keywords: string[];
  type: string;
  sourceQuote?: string;
}

interface Card {
  id: string;
  chainId: string;
  chainName: string;
  index: number;           // 在链中的序号
  title: string;
  mainLine: string;        // 【知识主线】
  coreMemory: string;      // 【核心记忆】
  officialText: string;    // 【官方表述】
  keywords: string[];
  timeInfo: string | null; // 【时间/会议/文件】
  whyLearn: string;        // 【为什么学这个】
  nextStep: string;        // 【下一步是什么】
  memoryHook: string;      // 【记忆钩子】
  frequency: "high" | "normal";
  type: string;
}

// 高频政治表述集合（自动标【高频】）
const HIGH_FREQ_TERMS = [
  "两个确立", "两个维护", "四个意识", "四个自信", "四个全面",
  "五位一体", "中国式现代化", "社会主义初级阶段", "新发展理念",
  "高质量发展", "新质生产力", "党的全面领导", "以人民为中心",
  "全面从严治党", "自我革命", "共同富裕", "马克思主义",
  "毛泽东思想", "邓小平理论", "三个代表", "科学发展观",
  "习近平新时代中国特色社会主义思想",
];

function isHighFreq(text: string): boolean {
  return HIGH_FREQ_TERMS.some(t => text.includes(t));
}

function buildMainLine(kp: KnowledgePoint, chainName: string, prevTitle: string | null, nextTitle: string | null): string {
  if (prevTitle && nextTitle) {
    return `在「${chainName}」知识链中，承接「${prevTitle}」，引出「${nextTitle}」`;
  }
  if (prevTitle) {
    return `「${chainName}」链的第 ${0} 步，承接「${prevTitle}」`;
  }
  return `「${chainName}」知识链的起点`;
}

function buildWhyLearn(kp: KnowledgePoint, prevTitle: string | null): string {
  if (prevTitle) {
    return `掌握「${prevTitle}」后，自然需要理解「${kp.title}」——它是前者的深化/展开`;
  }
  return `这是「${kp.title.split('').slice(0,10).join('')}」知识链的入口，必须先建立整体框架`;
}

function buildNextStep(nextTitle: string | null): string {
  if (nextTitle) {
    return `→ 下一步：「${nextTitle}」`;
  }
  return `（本链最后一个知识点，回顾整条链）`;
}

function buildMemoryHook(kp: KnowledgePoint): string {
  const kw = kp.keywords?.slice(0, 3).join(" → ") || kp.title;
  const t = kp.type || "";
  if (t === "数字" || t === "概念") return `记关键词：${kw}`;
  if (t === "时间线") return `记时间线：${kw}`;
  if (t === "会议") return `记会议名：${kw}`;
  if (t === "政治表述") return `原话必背：${kw}`;
  return `关键词链：${kw}`;
}

function buildCoreMemory(kp: KnowledgePoint): string {
  return kp.content.length <= 60 ? kp.content : kp.content.slice(0, 60) + "…";
}

// ═══════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════

function buildAllCards(): Card[] {
  const cards: Card[] = [];
  let globalIndex = 0;

  for (const chain of CHAINS) {
    // 收集该链的所有知识点
    const chainPoints: { kp: KnowledgePoint; pageNumber: number }[] = [];

    for (const pn of chain.pages) {
      const page = s2.find((p: any) => p.pageNumber === pn);
      if (!page) continue;
      for (const kp of (page.knowledgePoints || [])) {
        chainPoints.push({ kp, pageNumber: pn });
      }
    }

    if (chainPoints.length === 0) continue;

    // 按页面顺序排列
    chainPoints.sort((a, b) => a.pageNumber - b.pageNumber);

    // 为链内每个知识点生成卡片
    for (let i = 0; i < chainPoints.length; i++) {
      const { kp, pageNumber } = chainPoints[i];
      const prev = i > 0 ? chainPoints[i - 1].kp.title : null;
      const next = i < chainPoints.length - 1 ? chainPoints[i + 1].kp.title : null;

      // 跳过"解析失败"和"原文兜底"的卡片（它们没有真正的知识点）
      if (kp.title.includes("解析失败") || kp.title.includes("页内容") || kp.title.includes("第") && kp.title.includes("页")) {
        continue;
      }

      globalIndex++;

      cards.push({
        id: `card-${String(globalIndex).padStart(3, "0")}`,
        chainId: chain.id,
        chainName: chain.name,
        index: i + 1,
        title: kp.title,
        mainLine: buildMainLine(kp, chain.name, prev, next),
        coreMemory: buildCoreMemory(kp),
        officialText: kp.content,
        keywords: kp.keywords || [],
        timeInfo: kp.type === "时间线" || kp.type === "会议" ? kp.content : null,
        whyLearn: buildWhyLearn(kp, prev),
        nextStep: buildNextStep(next),
        memoryHook: buildMemoryHook(kp),
        frequency: isHighFreq(kp.title + kp.content) ? "high" : "normal",
        type: kp.type,
      });
    }
  }

  return cards;
}

// ═══════════════════════════════════════════════════
// 质量自检
// ═══════════════════════════════════════════════════

function qualityCheck(cards: Card[]): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  // 1. 官方表述不能为空
  const emptyOfficial = cards.filter(c => !c.officialText || c.officialText.length < 10);
  if (emptyOfficial.length > 0) {
    issues.push(`${emptyOfficial.length} 张卡片官方表述过短`);
  }

  // 2. 卡片不能过长（核心记忆 > 80 字告警）
  const tooLong = cards.filter(c => c.coreMemory.length > 80);
  if (tooLong.length > 0) {
    issues.push(`${tooLong.length} 张卡片核心记忆超过80字`);
  }

  // 3. 每链至少 2 张卡片（否则孤立）
  const chainCounts = new Map<string, number>();
  cards.forEach(c => chainCounts.set(c.chainId, (chainCounts.get(c.chainId) || 0) + 1));
  const isolated = [...chainCounts.entries()].filter(([_, n]) => n < 2);
  if (isolated.length > 0) {
    issues.push(`${isolated.length} 条知识链只有1张卡片（孤立）: ${isolated.map(([id]) => id).join(", ")}`);
  }

  // 4. 关键词不能为空
  const noKeywords = cards.filter(c => !c.keywords || c.keywords.length === 0);
  if (noKeywords.length > 0) {
    issues.push(`${noKeywords.length} 张卡片缺少关键词`);
  }

  // 5. 前后连接断裂检查
  const brokenLinks = cards.filter(c => c.whyLearn.length < 15);
  if (brokenLinks.length > 0) {
    issues.push(`${brokenLinks.length} 张卡片的前后连接过短`);
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

// ═══════════════════════════════════════════════════
// 执行
// ═══════════════════════════════════════════════════

const cards = buildAllCards();
const qc = qualityCheck(cards);

// 输出
const output = {
  productName: "党课理论记忆卡片",
  version: "1.0",
  generatedAt: new Date().toISOString(),
  totalCards: cards.length,
  totalChains: [...new Set(cards.map(c => c.chainId))].length,
  qualityCheck: qc,
  stats: {
    highFreq: cards.filter(c => c.frequency === "high").length,
    byType: {} as Record<string, number>,
    byChain: {} as Record<string, number>,
  },
  cards,
};

// 统计
cards.forEach(c => {
  output.stats.byType[c.type] = (output.stats.byType[c.type] || 0) + 1;
  output.stats.byChain[c.chainName] = (output.stats.byChain[c.chainName] || 0) + 1;
});

writeFileSync(join(OUT, "product-cards.json"), JSON.stringify(output, null, 2), "utf-8");

console.log(`\n卡片产品化完成:`);
console.log(`  总卡片: ${cards.length} 张`);
console.log(`  知识链: ${output.totalChains} 条`);
console.log(`  高频卡: ${output.stats.highFreq} 张`);
console.log(`  质量检查: ${qc.passed ? "✅ 通过" : "⚠️ " + qc.issues.length + " 个问题"}`);
if (!qc.passed) qc.issues.forEach(i => console.log(`    - ${i}`));
console.log(`\n  输出文件: ${join(OUT, "product-cards.json")}`);
