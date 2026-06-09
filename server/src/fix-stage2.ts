/**
 * 修复 Stage 2 — 重跑空知识点页
 * 问题根因: Stage 2 对复杂内容（表格/时间线/模糊页）返回空数组
 * 修复策略: 增大 maxTokens (6000)、强化 Prompt 引导、逐页独立处理
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3001";
const KEY = process.env.AI_API_KEY || "";
const OUT = join(process.cwd(), "output");

const stage1 = JSON.parse(readFileSync(join(OUT, "stage1-ocr.json"), "utf-8"));
const stage2 = JSON.parse(readFileSync(join(OUT, "stage2-knowledge.json"), "utf-8"));

// 空页页码
const emptyPages = stage2
  .filter((p: any) => !p.knowledgePoints || p.knowledgePoints.length === 0)
  .map((p: any) => p.pageNumber);

console.log(`空知识点页: ${emptyPages.length} 页 → ${emptyPages.join(", ")}\n`);

const FIX_SYSTEM = `你是党课知识提取专家。从 OCR 文字中提取结构化知识点。

【重要：即使 OCR 文字有错误、模糊、不完整，也必须尽力提取。不能返回空数组。】

【提取规则】
1. 对每个可辨识的事实都创建一个知识点
2. 表格内容逐行提取
3. 时间线每个节点单独提取
4. OCR 有错的文字，根据上下文修正后提取
5. 政治术语保留原文措辞
6. 会议名称保留完整届次
7. 数字内容完整记录

【输出 JSON】
{
  "knowledgePoints": [
    {"title": "标题", "content": "完整内容", "keywords": ["关键词"], "type": "概念|政治表述|时间线|会议|数字|因果|意义|对比|表格", "sourceQuote": "原文"}
  ],
  "politicalTerms": ["必背原话"],
  "timelineEvents": [{"date":"时间","event":"事件"}],
  "meetings": [{"name":"会议名称","content":"内容"}],
  "numbers": [{"count":"数量","items":"内容"}]
}`;

async function call(url: string, body: any): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(()=>"")).slice(0,200)}`);
  return res.json();
}
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function processOne(pageNum: number, retries = 5): Promise<any> {
  const ocr = stage1.find((p: any) => p.pageNumber === pageNum);
  if (!ocr) throw new Error("OCR not found");

  // 截断过长文本
  const text = ocr.rawText.slice(0, 2000);

  for (let a = 0; a <= retries; a++) {
    try {
      if (a > 0) { console.log(`  ⏳ retry ${a}/${retries}`); await sleep(3000 * a); }
      const result = await call(`${BASE}/api/pipeline/stage2`, {
        pages: [{ pageNumber: pageNum, rawText: text }],
      });
      return result.results?.[0] ?? {};
    } catch (e) {
      if (a === retries) throw e;
    }
  }
  return {};
}

async function main() {
  const fixed: any[] = [];
  const failed: number[] = [];

  for (let i = 0; i < emptyPages.length; i++) {
    const pn = emptyPages[i];
    const tag = `[${i+1}/${emptyPages.length}]`;
    try {
      const result = await processOne(pn);
      const kpCount = result?.knowledgePoints?.length ?? 0;
      console.log(`${tag} 第${pn}页 ✅ ${kpCount} 个知识点`);
      fixed.push({ pageNumber: pn, ...result });
    } catch (e) {
      console.log(`${tag} 第${pn}页 ❌ ${(e as Error).message.slice(0,80)}`);
      failed.push(pn);
    }
  }

  // 合并回 stage2
  for (const fix of fixed) {
    const idx = stage2.findIndex((p: any) => p.pageNumber === fix.pageNumber);
    if (idx >= 0) stage2[idx] = fix;
  }

  writeFileSync(join(OUT, "stage2-knowledge.json"), JSON.stringify(stage2, null, 2), "utf-8");

  // 统计
  const stillEmpty = stage2.filter((p: any) => !p.knowledgePoints || p.knowledgePoints.length === 0).length;
  const totalKP = stage2.reduce((sum: number, p: any) => sum + (p.knowledgePoints?.length ?? 0), 0);

  console.log(`\n✅ 修复完成: ${fixed.length} 页成功, ${failed.length} 页失败`);
  console.log(`剩余空页: ${stillEmpty} → ${failed.length > 0 ? failed.join(', ') : '无'}`);
  console.log(`总知识点: ${totalKP} 个`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
