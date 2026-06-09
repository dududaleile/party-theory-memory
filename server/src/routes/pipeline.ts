/**
 * 四阶段流水线路由
 *
 * POST /api/pipeline/stage1   — 完整 OCR 存档（逐图）
 * POST /api/pipeline/stage2   — 结构化知识提取
 * POST /api/pipeline/stage3   — 跨页关联
 * POST /api/pipeline/stage4   — 强制查漏
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createAiProvider } from "../services/ai/factory.js";
import {
  STAGE1_SYSTEM, buildStage1Prompt,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
  STAGE4_SYSTEM,
} from "../prompts/four-stage.js";
import { safeJsonParse } from "../utils/json.js";

export const pipelineRouter = Router();

function getProv(req: Request) {
  const apiKey = (req.headers["x-api-key"] as string) || process.env.AI_API_KEY || "";
  const model = (req.body as any)?.model || process.env.AI_MODEL || "gpt-4o";
  const baseUrl = (req.body as any)?.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com";
  if (!apiKey) return { error: "未配置 API Key" };
  return { provider: createAiProvider({ apiKey, baseUrl, model }), model };
}

// ═══════════════════════════════════════════════════════════
// Stage 1: 完整 OCR 存档
// ═══════════════════════════════════════════════════════════

const stage1Schema = z.object({
  images: z.array(z.object({ data: z.string().min(1), mediaType: z.string() })).min(1).max(3),
  pageNumbers: z.array(z.number()).optional(), // 对应的页码
});

pipelineRouter.post("/stage1", async (req: Request, res: Response) => {
  try {
    const parsed = stage1Schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效", details: parsed.error.issues }); return; }

    const prov = getProv(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }

    const results: { pageNumber: number; rawText: string }[] = [];

    // 逐张 OCR（每张独立调用，确保质量）
    for (let i = 0; i < parsed.data.images.length; i++) {
      const img = parsed.data.images[i];
      const pageNum = parsed.data.pageNumbers?.[i] ?? i + 1;

      const visionResult = await prov.provider.chatVision({
        systemPrompt: STAGE1_SYSTEM,
        images: [img],
        temperature: 0,
        maxTokens: 4000,
      });

      results.push({ pageNumber: pageNum, rawText: visionResult.content });
    }

    res.json({ results, count: results.length });
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[stage1] ${msg}`);
    res.status(502).json({ error: msg.slice(0, 300) });
  }
});

// ═══════════════════════════════════════════════════════════
// Stage 2: 结构化知识提取
// ═══════════════════════════════════════════════════════════

const stage2Schema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number(),
    rawText: z.string(),
  })),
});

pipelineRouter.post("/stage2", async (req: Request, res: Response) => {
  try {
    const parsed = stage2Schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效" }); return; }

    const prov = getProv(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }

    // 逐页结构化提取
    const results: any[] = [];
    for (const page of parsed.data.pages) {
      const chatResult = await prov.provider.chat({
        systemPrompt: STAGE2_SYSTEM,
        userPrompt: `以下是第 ${page.pageNumber} 页的 OCR 提取文字。请从中提取结构化知识点。\n\n【OCR 文字】\n${page.rawText}`,
        temperature: 0.1,
        maxTokens: 6000,
        responseFormat: "json",
      });

      const parsed_output = safeJsonParse<Record<string, unknown>>(chatResult.content);
      results.push({
        pageNumber: page.pageNumber,
        ...(typeof parsed_output === "object" && parsed_output !== null ? parsed_output : {}),
      });
    }

    res.json({ results, count: results.length });
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[stage2] ${msg}`);
    res.status(502).json({ error: msg.slice(0, 300) });
  }
});

// ═══════════════════════════════════════════════════════════
// Stage 3: 跨页关联
// ═══════════════════════════════════════════════════════════

const stage3Schema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number(),
    knowledgePoints: z.array(z.any()).optional(),
    politicalTerms: z.array(z.string()).optional(),
  })),
});

pipelineRouter.post("/stage3", async (req: Request, res: Response) => {
  try {
    const parsed = stage3Schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效" }); return; }

    const prov = getProv(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }

    // 构建所有页面的摘要
    const summaries = parsed.data.pages.map(p =>
      `第${p.pageNumber}页: ${(p.politicalTerms ?? []).join("；")} | 知识点: ${(p.knowledgePoints ?? []).map((kp: any) => kp.title).join(", ")}`
    ).join("\n");

    const chatResult = await prov.provider.chat({
      systemPrompt: STAGE3_SYSTEM,
      userPrompt: `以下是 ${parsed.data.pages.length} 页 PPT 的知识摘要。请进行跨页关联分析。\n\n${summaries}`,
      temperature: 0.1,
      maxTokens: 3000,
      responseFormat: "json",
    });

    const parsed_output = safeJsonParse(chatResult.content);
    res.json(parsed_output);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[stage3] ${msg}`);
    res.status(502).json({ error: msg.slice(0, 300) });
  }
});

// ═══════════════════════════════════════════════════════════
// Stage 4: 强制查漏
// ═══════════════════════════════════════════════════════════

const stage4Schema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number(),
    rawText: z.string(),
    knowledgePoints: z.array(z.any()).optional(),
  })),
});

pipelineRouter.post("/stage4", async (req: Request, res: Response) => {
  try {
    const parsed = stage4Schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效" }); return; }

    const prov = getProv(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }

    // 构建完整输入（raw_text + 已提取知识点）
    const fullInput = parsed.data.pages.map(p =>
      `=== 第${p.pageNumber}页 ===\n【OCR 原始文字】\n${p.rawText}\n【已提取知识点】\n${JSON.stringify(p.knowledgePoints ?? [])}`
    ).join("\n\n");

    const chatResult = await prov.provider.chat({
      systemPrompt: STAGE4_SYSTEM,
      userPrompt: `请对以下 ${parsed.data.pages.length} 页 PPT 的提取结果进行强制遗漏检查。\n\n${fullInput}`,
      temperature: 0,
      maxTokens: 4000,
      responseFormat: "json",
    });

    const parsed_output = safeJsonParse(chatResult.content);
    res.json(parsed_output);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[stage4] ${msg}`);
    res.status(502).json({ error: msg.slice(0, 300) });
  }
});
