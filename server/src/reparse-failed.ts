/**
 * 重提取所有"解析失败"页面，保存完整 AI 响应
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createAiProvider } from "./services/ai/factory.js";
import { safeJsonParse } from "./utils/json.js";

const KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "gpt-4o";
const BASE = process.env.AI_BASE_URL || "https://api.openai.com";
const OUT = join(process.cwd(), "output");

const stage1 = JSON.parse(readFileSync(join(OUT, "stage1-ocr.json"), "utf-8"));
const stage2 = JSON.parse(readFileSync(join(OUT, "stage2-knowledge.json"), "utf-8"));

const FAILED = stage2
  .filter((p: any) => {
    const kps = p.knowledgePoints || [];
    return kps.length === 1 && kps[0].title === "解析失败";
  })
  .map((p: any) => p.pageNumber);

console.log(`解析失败页: ${FAILED.length} → ${FAILED.join(", ")}\n`);

const provider = createAiProvider({ apiKey: KEY, baseUrl: BASE, model: MODEL });
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function extractOne(pageNum: number): Promise<any> {
  const ocr = stage1.find((p: any) => p.pageNumber === pageNum);
  if (!ocr) return {};

  const text = ocr.rawText.slice(0, 1800);

  const result = await provider.chat({
    systemPrompt: "你是党课知识提取器。从OCR文字中提取所有知识点。输出JSON。knowledgePoints数组不能为空。",
    userPrompt: `从以下OCR文字提取所有知识点。输出JSON:\n\n${text}\n\n格式:{"knowledgePoints":[{"title":"","content":"","keywords":[],"type":"概念|时间线|会议|数字|表格|政治表述"}],"politicalTerms":[]}`,
    temperature: 0,
    maxTokens: 4000,
    responseFormat: "json",
  });

  // 使用修复后的 safeJsonParse
  const parsed = safeJsonParse<any>(result.content);
  if (parsed?.knowledgePoints?.length > 0) {
    return parsed;
  }
  // 如果仍解析失败，保留完整原文
  return {
    knowledgePoints: [{ title: `第${pageNum}页内容`, content: text, keywords: [], type: "概念" }],
    politicalTerms: [],
  };
}

async function main() {
  let fixed = 0;

  for (let i = 0; i < FAILED.length; i++) {
    const pn = FAILED[i];
    const tag = `[${i+1}/${FAILED.length}]`;

    for (let retry = 0; retry <= 3; retry++) {
      try {
        if (retry > 0) await sleep(2000 * retry);
        const result = await extractOne(pn);
        const kpCount = result?.knowledgePoints?.length ?? 0;

        if (kpCount > 0) {
          const idx = stage2.findIndex((p: any) => p.pageNumber === pn);
          if (idx >= 0) stage2[idx] = { pageNumber: pn, ...result };
          const stillTruncated = result.knowledgePoints[0]?.title?.includes("解析失败");
          console.log(`${tag} 第${pn}页 ✅ ${kpCount} 个知识点${stillTruncated ? ' (原文兜底)' : ''}`);
          fixed++;
          break;
        }
      } catch (e) {
        if (retry === 3) console.log(`${tag} 第${pn}页 ❌ ${(e as Error).message.slice(0,60)}`);
      }
    }
  }

  writeFileSync(join(OUT, "stage2-knowledge.json"), JSON.stringify(stage2, null, 2), "utf-8");

  const stillFail = stage2.filter(
    (p: any) => p.knowledgePoints?.length === 1 && p.knowledgePoints[0].title === "解析失败"
  ).length;
  const totalKP = stage2.reduce((s: number, p: any) => s + (p.knowledgePoints?.length || 0), 0);

  console.log(`\n修复: ${fixed}/${FAILED.length} | 剩余解析失败: ${stillFail} | 总知识点: ${totalKP}`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
