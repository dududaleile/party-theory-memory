/**
 * 直接调用 AI（绕过 pipeline 路由）重提取剩余空页
 * 使用精简 Prompt + 单页独立调用 + responseFormat: json_object
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createAiProvider } from "./services/ai/factory.js";

const KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "gpt-4o";
const BASE = process.env.AI_BASE_URL || "https://api.openai.com";
const OUT = join(process.cwd(), "output");

const stage1 = JSON.parse(readFileSync(join(OUT, "stage1-ocr.json"), "utf-8"));
let stage2 = JSON.parse(readFileSync(join(OUT, "stage2-knowledge.json"), "utf-8"));
const REMAINING = stage2
  .filter((p: any) => !p.knowledgePoints || p.knowledgePoints.length === 0)
  .map((p: any) => p.pageNumber);

console.log(`剩余空页: ${REMAINING.length} → ${REMAINING.join(", ")}\n`);

const provider = createAiProvider({ apiKey: KEY, baseUrl: BASE, model: MODEL });

const SYSTEM = `你是党课知识提取器。从 OCR 文字中逐句提取知识点。输出 JSON。knowledgePoints 数组绝对不能为空。`;

async function extractOne(pageNum: number): Promise<any> {
  const ocr = stage1.find((p: any) => p.pageNumber === pageNum);
  if (!ocr) return {};

  const text = ocr.rawText.slice(0, 1800);

  const userPrompt = `从以下 OCR 文字中提取所有知识点。输出 JSON，knowledgePoints 不能为空。

【OCR 文字】
${text}

输出格式: {"knowledgePoints":[{"title":"...","content":"...","keywords":[...],"type":"概念|时间线|会议|数字|表格|政治表述"}],"politicalTerms":[...]}`;

  const result = await provider.chat({
    systemPrompt: SYSTEM,
    userPrompt,
    temperature: 0,
    maxTokens: 4000,
    responseFormat: "json",
  });

  try {
    const cleaned = result.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // 尝试直接作为 JSON 解析
    return { knowledgePoints: [{ title: "解析失败", content: result.content.slice(0, 200), keywords: [], type: "概念" }], rawOutput: result.content };
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function main() {
  let fixed = 0;

  for (let i = 0; i < REMAINING.length; i++) {
    const pn = REMAINING[i];
    const tag = `[${i+1}/${REMAINING.length}]`;

    for (let retry = 0; retry <= 3; retry++) {
      try {
        if (retry > 0) { await sleep(2000 * retry); }
        const result = await extractOne(pn);
        const kpCount = result?.knowledgePoints?.length ?? 0;

        if (kpCount > 0) {
          const idx = stage2.findIndex((p: any) => p.pageNumber === pn);
          if (idx >= 0) stage2[idx] = { pageNumber: pn, ...result };
          console.log(`${tag} 第${pn}页 ✅ ${kpCount} 个知识点`);
          fixed++;
        } else {
          console.log(`${tag} 第${pn}页 ⚠️ 仍为0 (retry ${retry})`);
          if (retry === 3) {
            // 最后一次尝试：手动创建一条知识点
            const ocr = stage1.find((p: any) => p.pageNumber === pn);
            const idx = stage2.findIndex((p: any) => p.pageNumber === pn);
            if (idx >= 0) {
              stage2[idx] = {
                pageNumber: pn,
                knowledgePoints: [{
                  title: `第${pn}页内容`,
                  content: (ocr?.rawText ?? "").slice(0, 300).replace(/\n/g, " "),
                  keywords: [],
                  type: "概念",
                  sourceQuote: (ocr?.rawText ?? "").slice(0, 100),
                }],
                politicalTerms: [],
                note: "AI 无法结构化提取，已保留原文"
              };
              console.log(`  ↳ 手动兜底：保留原文`);
              fixed++;
            }
          }
        }
        break;
      } catch (e) {
        if (retry === 3) console.log(`${tag} 第${pn}页 ❌ ${(e as Error).message.slice(0,60)}`);
      }
    }
  }

  writeFileSync(join(OUT, "stage2-knowledge.json"), JSON.stringify(stage2, null, 2), "utf-8");

  const stillEmpty = stage2.filter((p: any) => !p.knowledgePoints || p.knowledgePoints.length === 0).length;
  const totalKP = stage2.reduce((s: number, p: any) => s + (p.knowledgePoints?.length ?? 0), 0);

  console.log(`\n✅ 修复: ${fixed}/${REMAINING.length} 页`);
  console.log(`剩余空页: ${stillEmpty}`);
  console.log(`总知识点: ${totalKP} 个`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
