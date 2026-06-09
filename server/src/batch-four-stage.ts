/**
 * 四阶段流水线批量提取
 *
 * Stage 1: 逐图 OCR → 保存 raw_text
 * Stage 2: 逐页结构化知识提取
 * Stage 3: 跨页关联
 * Stage 4: 强制查漏
 *
 * 鲁棒性：5 次重试、1200px 压缩、单张失败不终止
 */

import "dotenv/config";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";

const DIR      = "D:/Users/17092/Documents/Tencent Files/1709214954/nt_qq/nt_data/Pic/2026-06/Thumb/党课";
const BASE     = "http://localhost:3001";
const KEY      = process.env.AI_API_KEY || "";
const MAX_RETRY = 5;
const RETRY_MS = [2000, 5000, 10000, 20000, 40000];
const TIMEOUT  = 120_000;
const OUT_DIR  = join(process.cwd(), "output");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function fetchTO(url: string, opt: RequestInit, ms: number) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opt, signal: ctl.signal }); }
  finally { clearTimeout(id); }
}

async function compress(buf: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buf).metadata();
    const max = Math.max(meta.width ?? 9999, meta.height ?? 9999);
    if (max <= 1200) return sharp(buf).jpeg({ quality: 70 }).toBuffer();
    const s = 1200 / max;
    return sharp(buf)
      .resize({ width: Math.round((meta.width??1200) * s), height: Math.round((meta.height??1200) * s), fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 }).toBuffer();
  } catch { return buf; }
}

async function callWithRetry(url: string, body: any, label: string): Promise<any> {
  let lastErr: unknown;
  for (let a = 0; a <= MAX_RETRY; a++) {
    try {
      if (a > 0) { console.log(`  ⏳ ${label} 重试 ${a}/${MAX_RETRY}...`); await sleep(RETRY_MS[a-1]); }
      const res = await fetchTO(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY },
        body: JSON.stringify(body),
      }, TIMEOUT);
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(()=>"")).slice(0,200)}`);
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function main() {
  console.log("═══════════════════════════════════");
  console.log("  四阶段零遗漏流水线");
  console.log("═══════════════════════════════════\n");

  const all = await readdir(DIR);
  const files = all.filter(f => /\.(jpg|jpeg|png)$/i.test(f) && !f.includes("_720")).sort();
  console.log(`${files.length} 张图片\n`);

  const t0 = Date.now();

  // ═══════════════════════════════════════════════════════
  // STAGE 1: 逐张 OCR
  // ═══════════════════════════════════════════════════════
  console.log("═══ STAGE 1: 完整 OCR 存档 ═══\n");

  const ocrResults: { pageNumber: number; rawText: string; filename: string }[] = [];
  const stage1Fails: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const tag = `[${i+1}/${files.length}]`;
    try {
      const raw = readFileSync(join(DIR, f));
      const small = await compress(raw);
      const b64 = small.toString("base64");
      const kb = (b64.length * 0.75 / 1024).toFixed(0);

      const result = await callWithRetry(
        `${BASE}/api/pipeline/stage1`,
        { images: [{ data: b64, mediaType: "image/jpeg" }], pageNumbers: [i + 1] },
        `Stage1 ${f}`
      );

      const text = result?.results?.[0]?.rawText ?? "";
      ocrResults.push({ pageNumber: i + 1, rawText: text, filename: f });
      console.log(`${tag} ✅ ${f} (${kb}KB) → ${text.length} 字`);
    } catch (e) {
      console.log(`${tag} ❌ ${f}: ${(e as Error).message.slice(0,100)}`);
      stage1Fails.push(f);
    }
  }

  // 保存 Stage 1 原始输出
  writeFileSync(join(OUT_DIR, "stage1-ocr.json"), JSON.stringify(ocrResults, null, 2), "utf-8");
  console.log(`\nStage 1 完成: ${ocrResults.length} 页成功, ${stage1Fails.length} 页失败 → stage1-ocr.json\n`);

  if (ocrResults.length === 0) { console.log("无 OCR 结果，终止。"); return; }

  // ═══════════════════════════════════════════════════════
  // STAGE 2: 结构化知识提取（分批处理，每 5 页一批）
  // ═══════════════════════════════════════════════════════
  console.log("═══ STAGE 2: 结构化知识提取 ═══\n");

  const stage2Results: any[] = [];
  const BATCH2 = 5;

  for (let i = 0; i < ocrResults.length; i += BATCH2) {
    const batch = ocrResults.slice(i, i + BATCH2);
    const tag = `[${Math.floor(i/BATCH2)+1}/${Math.ceil(ocrResults.length/BATCH2)}]`;
    try {
      const result = await callWithRetry(
        `${BASE}/api/pipeline/stage2`,
        { pages: batch.map(p => ({ pageNumber: p.pageNumber, rawText: p.rawText })) },
        `Stage2 batch ${tag}`
      );
      const pages = result?.results ?? [];
      stage2Results.push(...pages);
      console.log(`${tag} ✅ ${pages.length} 页结构化完成`);
    } catch (e) {
      console.log(`${tag} ❌ ${(e as Error).message.slice(0,100)}`);
    }
  }

  writeFileSync(join(OUT_DIR, "stage2-knowledge.json"), JSON.stringify(stage2Results, null, 2), "utf-8");
  console.log(`\nStage 2 完成: ${stage2Results.length} 页 → stage2-knowledge.json\n`);

  // ═══════════════════════════════════════════════════════
  // STAGE 3: 跨页关联
  // ═══════════════════════════════════════════════════════
  console.log("═══ STAGE 3: 跨页关联 ═══\n");

  let stage3Result: any = null;
  try {
    stage3Result = await callWithRetry(
      `${BASE}/api/pipeline/stage3`,
      { pages: stage2Results },
      "Stage3"
    );
    writeFileSync(join(OUT_DIR, "stage3-crosspage.json"), JSON.stringify(stage3Result, null, 2), "utf-8");
    console.log(`Stage 3 完成 → stage3-crosspage.json\n`);
  } catch (e) {
    console.log(`Stage 3 ❌ ${(e as Error).message.slice(0,100)}\n`);
  }

  // ═══════════════════════════════════════════════════════
  // STAGE 4: 强制查漏
  // ═══════════════════════════════════════════════════════
  console.log("═══ STAGE 4: 强制查漏 ═══\n");

  let stage4Result: any = null;
  try {
    stage4Result = await callWithRetry(
      `${BASE}/api/pipeline/stage4`,
      {
        pages: ocrResults.map(ocr => {
          const kp = stage2Results.find((r: any) => r.pageNumber === ocr.pageNumber);
          return { pageNumber: ocr.pageNumber, rawText: ocr.rawText, knowledgePoints: kp?.knowledgePoints ?? [] };
        }),
      },
      "Stage4"
    );
    writeFileSync(join(OUT_DIR, "stage4-audit.json"), JSON.stringify(stage4Result, null, 2), "utf-8");
    console.log(`Stage 4 完成 → stage4-audit.json\n`);
  } catch (e) {
    console.log(`Stage 4 ❌ ${(e as Error).message.slice(0,100)}\n`);
  }

  // ═══════════════════════════════════════════════════════
  // 汇总输出
  // ═══════════════════════════════════════════════════════

  const allPoints = stage2Results.flatMap((r: any) => r.knowledgePoints ?? []);
  const allTerms  = stage2Results.flatMap((r: any) => r.politicalTerms ?? []);

  const summary = {
    extractedAt: new Date().toISOString(),
    elapsedSec: Math.round((Date.now() - t0) / 1000),
    stage1: { successPages: ocrResults.length, failedFiles: stage1Fails.length, failedList: stage1Fails },
    stage2: { knowledgePages: stage2Results.length, totalPoints: allPoints.length, totalTerms: allTerms.length },
    stage3: stage3Result,
    stage4: stage4Result,
    allPoints,
    allPoliticalTerms: [...new Set(allTerms)],
    allPages: stage2Results,
  };

  writeFileSync(join(OUT_DIR, "final-summary.json"), JSON.stringify(summary, null, 2), "utf-8");

  console.log("═══════════════════════════════════");
  console.log(`  总耗时: ${summary.elapsedSec}s`);
  console.log(`  Stage 1: ${ocrResults.length} 页 OCR`);
  console.log(`  Stage 2: ${allPoints.length} 个知识点`);
  console.log(`  Stage 3: ${stage3Result ? "✅" : "❌"}`);
  console.log(`  Stage 4: ${stage4Result ? "✅" : "❌"}`);
  console.log(`\n  全部输出: ${OUT_DIR}/`);
  console.log("═══════════════════════════════════");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
