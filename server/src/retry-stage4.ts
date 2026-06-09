/**
 * 重试 Stage 4 — 分批强制查漏（每 10 页一批）
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3001";
const KEY = process.env.AI_API_KEY || "";
const OUT = join(process.cwd(), "output");

const stage1 = JSON.parse(readFileSync(join(OUT, "stage1-ocr.json"), "utf-8"));
const stage2 = JSON.parse(readFileSync(join(OUT, "stage2-knowledge.json"), "utf-8"));

const BATCH = 10;
const allResults: any[] = [];

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

async function main() {
  console.log(`Stage 1: ${stage1.length} 页, Stage 2: ${stage2.length} 页`);
  console.log(`每 ${BATCH} 页一批，共 ${Math.ceil(stage1.length / BATCH)} 批\n`);

  for (let i = 0; i < stage1.length; i += BATCH) {
    const batch1 = stage1.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(stage1.length / BATCH);
    const tag = `[${batchNum}/${total}]`;

    const pages = batch1.map((ocr: any) => {
      const kp = stage2.find((r: any) => r.pageNumber === ocr.pageNumber);
      return {
        pageNumber: ocr.pageNumber,
        rawText: ocr.rawText.slice(0, 1500), // 截断长文本
        knowledgePoints: (kp?.knowledgePoints ?? []).slice(0, 10),
      };
    });

    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        if (attempt > 0) { console.log(`  ⏳ ${tag} retry ${attempt}/3...`); await sleep(3000 * attempt); }
        const result = await call(`${BASE}/api/pipeline/stage4`, { pages });
        allResults.push({
          startPage: i + 1,
          endPage: Math.min(i + BATCH, stage1.length),
          ...result,
        });
        console.log(`${tag} ✅ 第${i+1}-${Math.min(i+BATCH, stage1.length)}页查漏完成`);
        break;
      } catch (e) {
        console.log(`${tag} ❌ ${(e as Error).message.slice(0,100)}`);
        if (attempt === 3) allResults.push({ startPage: i+1, error: (e as Error).message });
      }
    }
  }

  // 汇总遗漏
  const allMissing: any[] = [];
  const allIssues: any[] = [];
  let highRisk = 0;
  for (const r of allResults) {
    if (r.missingItems) allMissing.push(...r.missingItems);
    if (r.checklist) {
      for (const [k, v] of Object.entries(r.checklist as Record<string,any>)) {
        if (v && !v.passed) allIssues.push({ category: k, ...v });
      }
    }
    if (r.overallOmissionRisk === "高") highRisk++;
  }

  const final = {
    auditedAt: new Date().toISOString(),
    batches: allResults.length,
    totalMissing: allMissing.length,
    totalIssues: allIssues.length,
    highRiskBatches: highRisk,
    allMissing,
    allIssues,
    allResults,
  };

  writeFileSync(join(OUT, "stage4-audit.json"), JSON.stringify(final, null, 2), "utf-8");
  console.log(`\n✅ Stage4 完成: ${allMissing.length} 个遗漏, ${allIssues.length} 个问题类别, ${highRisk} 批高风险`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
