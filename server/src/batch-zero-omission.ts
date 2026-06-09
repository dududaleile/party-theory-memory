/**
 * 零遗漏批量提取
 * - 最长边 1200px, JPEG 70%
 * - 每批 3 张 → /api/ai/zero-omission
 * - 5 次重试, 指数退避 2s/5s/10s/20s/40s
 * - 90s 超时
 * - 单张失败不终止
 */

import "dotenv/config";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";

const DIR      = "D:/Users/17092/Documents/Tencent Files/1709214954/nt_qq/nt_data/Pic/2026-06/Thumb/党课";
const API      = "http://localhost:3001/api/ai/zero-omission";
const KEY      = process.env.AI_API_KEY || "";
const BATCH    = 3;
const MAX_RETRY = 5;
const RETRY_MS = [2000, 5000, 10000, 20000, 40000];
const TIMEOUT  = 90_000;
const OUT_DIR  = join(process.cwd(), "output");
const FAIL_LOG = join(OUT_DIR, "failed.log");

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

type ErrKind = "API_FAIL" | "NETWORK_FAIL" | "IMAGE_CORRUPT" | "MODEL_TIMEOUT" | "JSON_PARSE_FAIL" | "UNKNOWN";

function classify(err: unknown): { kind: ErrKind; msg: string } {
  const m = err instanceof Error ? err.message : String(err);
  if (/50[023]|abort|timeout/i.test(m)) return { kind: "MODEL_TIMEOUT", msg: m };
  if (/ECONN|ENOTFOUND|fetch|network/i.test(m)) return { kind: "NETWORK_FAIL", msg: m };
  if (/JSON|parse/i.test(m)) return { kind: "JSON_PARSE_FAIL", msg: m };
  if (/corrupt|invalid image/i.test(m)) return { kind: "IMAGE_CORRUPT", msg: m };
  if (/4\d\d/.test(m)) return { kind: "API_FAIL", msg: m };
  return { kind: "UNKNOWN", msg: m };
}

async function compress(buf: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? Infinity;
    const h = meta.height ?? Infinity;
    const max = Math.max(w, h);
    if (max <= 1200) return sharp(buf).jpeg({ quality: 70 }).toBuffer();
    const s = 1200 / max;
    return sharp(buf)
      .resize({ width: Math.round(w * s), height: Math.round(h * s), fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  } catch { return buf; }
}

async function fetchTO(url: string, opt: RequestInit, ms: number) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opt, signal: ctl.signal }); }
  finally { clearTimeout(id); }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function processBatch(images: { data: string; mediaType: string }[], startPage: number) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      if (attempt > 0) { console.log(`    ⏳ 重试 ${attempt}/${MAX_RETRY}，${RETRY_MS[attempt-1]/1000}s...`); await sleep(RETRY_MS[attempt-1]); }
      const res = await fetchTO(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY },
        body: JSON.stringify({ images, startPage }),
      }, TIMEOUT);
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(()=>"")).slice(0,200)}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      const { kind } = classify(e);
      if (kind === "IMAGE_CORRUPT") throw e;
    }
  }
  throw lastErr;
}

async function main() {
  console.log("═══════════════════════════════════");
  console.log("  零遗漏批量提取 (鲁棒版)");
  console.log("═══════════════════════════════════\n");

  const all = await readdir(DIR);
  const files = all.filter(f => /\.(jpg|jpeg|png)$/i.test(f) && !f.includes("_720")).sort();
  console.log(`${files.length} 张图，每批 ${BATCH} 张，共 ${Math.ceil(files.length/BATCH)} 批\n`);

  const allPages: any[] = [];
  const fails: { file: string; kind: ErrKind; msg: string }[] = [];
  const t0 = Date.now();

  for (let i = 0; i < files.length; i += BATCH) {
    const batchFiles = files.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(files.length / BATCH);
    const tag = `[${batchNum}/${totalBatches}]`;
    const startPage = i + 1;

    console.log(`${tag} 处理: ${batchFiles.join(", ")}`);

    try {
      // 读取 + 压缩
      const images = await Promise.all(
        batchFiles.map(async (f) => {
          const raw = readFileSync(join(DIR, f));
          const small = await compress(raw);
          return { data: small.toString("base64"), mediaType: "image/jpeg" as const };
        })
      );

      console.log(`    ${images.map((img,i) => `${batchFiles[i]} ${(img.data.length*0.75/1024).toFixed(0)}KB`).join(" | ")}`);

      const result = await processBatch(images, startPage);

      // 保存逐批结果
      const pages = result?.pages ?? [];
      allPages.push(...pages);
      const batchOut = join(OUT_DIR, `batch-${String(batchNum).padStart(3,"0")}.json`);
      writeFileSync(batchOut, JSON.stringify(result, null, 2), "utf-8");
      console.log(`    ✅ ${pages.length} 页提取完成 → ${batchOut}`);
    } catch (e) {
      const { kind, msg } = classify(e);
      console.log(`    ❌ ${kind}: ${msg.slice(0,120)}`);
      for (const f of batchFiles) fails.push({ file: f, kind, msg: msg.slice(0,200) });
    }
  }

  const secs = Math.round((Date.now() - t0) / 1000);

  // 合并所有页面
  const mergedPath = join(OUT_DIR, "all-pages.json");
  writeFileSync(mergedPath, JSON.stringify({
    extractedAt: new Date().toISOString(),
    totalImages: files.length,
    successPages: allPages.length,
    failedFiles: fails.length,
    elapsedSec: secs,
    pages: allPages,
  }, null, 2), "utf-8");

  // 失败日志
  if (fails.length) {
    const lines = fails.map(f => `[${f.kind}] ${f.file}: ${f.msg}`);
    appendFileSync(FAIL_LOG, `\n=== ${new Date().toISOString()} ===\n${lines.join("\n")}\n`, "utf-8");
  }

  console.log(`\n══════════════════════════`);
  console.log(`  耗时: ${secs}s`);
  console.log(`  成功: ${allPages.length} 页`);
  console.log(`  失败: ${fails.length} 张`);
  console.log(`  合并: ${mergedPath}`);
  if (fails.length) console.log(`  失败: ${FAIL_LOG}`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
