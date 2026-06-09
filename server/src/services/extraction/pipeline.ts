/**
 * 知识提炼管道 — 五轮编排
 *
 * V1 实现：Round 1 粗提取 + 基本校验
 * 后续轮次在后续版本中完善。
 */

import type { AiProvider } from "../ai/provider.js";
import { EXTRACT_SYSTEM_PROMPT, buildExtractPrompt } from "../../prompts/extract.js";
import { safeJsonParse } from "../../utils/json.js";

export interface ExtractResult {
  points: ExtractedPoint[];
  keyTerms: string[];
  stats: {
    pointCount: number;
    domainCount: number;
    inputCharCount: number;
  };
}

export interface ExtractedPoint {
  title: string;
  question: string;
  answer: string;
  answerBrief: string;
  keywords: string[];
  difficulty: number;
  questionType: "concept" | "list" | "essay" | "compare";
  domainName: string;
}

/**
 * V1: 执行粗提取（Round 1）
 * 后续可以通过 pipeline 编排加入 Round 2-5
 */
export async function extractKnowledge(
  provider: AiProvider,
  rawText: string
): Promise<ExtractResult> {
  // ── 预处理 ──
  const cleanText = preprocessText(rawText);

  // ── AI 提取 ──
  const userPrompt = buildExtractPrompt(cleanText);

  const response = await provider.chat({
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.1,
    maxTokens: 4000,
    responseFormat: "json",
  });

  const parsed = safeJsonParse<{
    points: ExtractedPoint[];
    keyTerms: string[];
  }>(response.content);

  const points: ExtractedPoint[] = (parsed.points ?? [])
    .filter((p: ExtractedPoint) => p.title && p.question && p.answer)
    .map((p: ExtractedPoint) => ({
      title: p.title?.slice(0, 40) ?? "",
      question: p.question?.slice(0, 200) ?? "",
      answer: p.answer?.slice(0, 1000) ?? "",
      answerBrief: p.answerBrief?.slice(0, 80) ?? p.answer?.slice(0, 80) ?? "",
      keywords: Array.isArray(p.keywords) ? p.keywords.slice(0, 8) : [],
      difficulty: clamp(p.difficulty ?? 3, 1, 5),
      questionType: ["concept", "list", "essay", "compare"].includes(p.questionType)
        ? p.questionType
        : "concept",
      domainName: p.domainName?.slice(0, 50) ?? "未分类",
    }));

  const domains = [...new Set(points.map((p) => p.domainName))];

  return {
    points,
    keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms.slice(0, 20) : [],
    stats: {
      pointCount: points.length,
      domainCount: domains.length,
      inputCharCount: rawText.length,
    },
  };
}

function preprocessText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
