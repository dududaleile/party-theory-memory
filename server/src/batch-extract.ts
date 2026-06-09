/**
 * 批量图片提取脚本 — 增强鲁棒性版
 *
 * 七项改进：
 *   1. 指数退避重试 3 次 (2s/5s/10s)
 *   2. 单图失败不终止，记录失败日志，最后汇总
 *   3. batchSize 降到 1，避免并发超时
 *   4. Sharp 自动 resize (最长 1600px, JPEG 80%)
 *   5. 90s 超时 + AbortController
 *   6. 精简 OCR Prompt
 *   7. 详细错误分类日志
 */

import "dotenv/config";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";

// ═══════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════

const IMG_DIR = String(process.argv[2] || "D:/Users/17092/Documents/Tencent Files/1709214954/nt_qq/nt_data/Pic/2026-06/Thumb/党课");
const API     = "http://localhost:3001/api/ai/vision-extract";
const KEY     = process.env.AI_API_KEY || "";

const MAX_RETRY    = 3;
const RETRY_MS     = [2000, 5000, 10000];
const TIMEOUT_MS   = 90_000;
const MAX_PX       = 1600;
const JPEG_Q       = 80;

const FAIL_LOG     = join(process.cwd(), "failed-images.log");
const OUT_JSON     = join(process.cwd(), "extracted-knowledge.json");

// ═══════════════════════════════════════════════════════════════
// 错误分类
// ═══════════════════════════════════════════════════════════════

type ErrKind = "API_FAIL" | "NETWORK_FAIL" | "IMAGE_CORRUPT" | "MODEL_TIMEOUT" | "JSON_PARSE_FAIL" | "UNKNOWN";

interface FailEntry {
  file: string;
  kind: ErrKind;
  msg: string;
}

function classify(err: unknown): { kind: ErrKind; msg: string } {
  const m = err instanceof Error ? err.message : String(err);
  if (/50[023]|abort/i.test(m)) return { kind: "MODEL_TIMEOUT", msg: m };
  if (/ECONN|ENOTFOUND|fetch|network/i.test(m)) return { kind: "NETWORK_FAIL", msg: m };
  if (/JSON|parse|Unexpected/i.test(m)) return { kind: "JSON_PARSE_FAIL", msg: m };
  if (/corrupt|invalid image/i.test(m)) return { kind: "IMAGE_CORRUPT", msg: m };
  if (/4\d\d/.test(m)) return { kind: "API_FAIL", msg: m };
  return { kind: "UNKNOWN", msg: m };
}

// ═══════════════════════════════════════════════════════════════
// 图片压缩
// ═══════════════════════════════════════════════════════════════

async function compress(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? Infinity;
    const h = meta.height ?? Infinity;
    const max = Math.max(w, h);
    if (max <= MAX_PX) {
      return sharp(buffer).jpeg({ quality: JPEG_Q }).toBuffer();
    }
    const s = MAX_PX / max;
    return sharp(buffer)
      .resize({ width: Math.round(w * s), height: Math.round(h * s), fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_Q })
      .toBuffer();
  } catch {
    return buffer; // 无法解析也发原图，让 API 报错
  }
}

// ═══════════════════════════════════════════════════════════════
// 带超时的 fetch
// ═══════════════════════════════════════════════════════════════

async function fetchTO(url: string, opt: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const id  = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opt, signal: ctl.signal });
  } finally {
    clearTimeout(id);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 单张处理（含重试）
// ═══════════════════════════════════════════════════════════════

async function processOne(name: string): Promise<any[]> {
  const buf = readFileSync(join(IMG_DIR, name));
  const small = await compress(buf);
  const b64 = small.toString("base64");

  let last: unknown;

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      if (attempt > 0) await sleep(RETRY_MS[attempt - 1]);

      const res = await fetchTO(
        API,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": KEY },
          body: JSON.stringify({ images: [{ data: b64, mediaType: "image/jpeg" }], ocrMode: true }),
        },
        TIMEOUT_MS,
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 150)}`);
      }

      const data = await res.json().catch(() => {
        throw new Error("JSON_PARSE_FAIL");
      });

      return data?.points ?? [];
    } catch (e) {
      last = e;
      const { kind } = classify(e);
      if (kind === "IMAGE_CORRUPT" || kind === "JSON_PARSE_FAIL") throw e; // 不可重试
    }
  }

  throw last;
}

// ═══════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  党课知识批量提取 (鲁棒性增强版)");
  console.log("═══════════════════════════════════════\n");

  const all = await readdir(IMG_DIR);
  const files = all
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .filter((f) => !f.includes("_720"))
    .sort();

  console.log(`总文件: ${all.length}  →  去重缩略图后: ${files.length} 张\n`);

  const points: any[] = [];
  const fails: FailEntry[] = [];
  const t0 = Date.now();

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const tag = `[${i + 1}/${files.length}]`;
    console.log(`${tag} ${f}`);

    try {
      const pts = await processOne(f);
      points.push(...pts);
      console.log(`  ✅ ${pts.length} 个知识点`);
    } catch (e) {
      const { kind, msg } = classify(e);
      console.log(`  ❌ ${kind}: ${msg.slice(0, 100)}`);
      fails.push({ file: f, kind, msg: msg.slice(0, 200) });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  ══ ${i + 1}/${files.length}  已提取 ${points.length} 知识点 ══\n`);
    }
  }

  const secs = Math.round((Date.now() - t0) / 1000);

  // 去重
  const seen = new Set<string>();
  const unique = points.filter((p) => {
    const k = ((p.title ?? "") + (p.question ?? "")).slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // ════════════════════════════════════════════════
  // 输出
  // ════════════════════════════════════════════════

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  完成`);
  console.log(`═══════════════════════════════════════`);
  console.log(`  耗时:        ${secs}s`);
  console.log(`  处理:        ${files.length} 张`);
  console.log(`  成功:        ${files.length - fails.length} 张`);
  console.log(`  失败:        ${fails.length} 张`);
  console.log(`  知识点(原始): ${points.length}`);
  console.log(`  知识点(去重): ${unique.length}`);
  console.log(`  领域数:       ${new Set(unique.map((p) => p.domainName)).size}`);

  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        extractedAt: new Date().toISOString(),
        imageCount: files.length,
        success: files.length - fails.length,
        failed: fails.length,
        elapsedSec: secs,
        points: unique,
        keyTerms: [...new Set(unique.flatMap((p: any) => p.keywords ?? []))],
        domains: [...new Set(unique.map((p: any) => p.domainName))],
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`\n✅ 知识文件: ${OUT_JSON}`);

  if (fails.length) {
    const lines = fails.map((f) => `[${f.kind}] ${f.file}: ${f.msg}`);
    appendFileSync(FAIL_LOG, `\n=== ${new Date().toISOString()} ===\n${lines.join("\n")}\n`, "utf-8");
    console.log(`❌ 失败日志: ${FAIL_LOG}`);
    console.log(`\n失败列表:`);
    lines.forEach((l) => console.log(`  ${l}`));
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
