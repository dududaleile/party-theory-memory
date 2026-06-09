/**
 * AI 路由
 *
 * POST /api/ai/test-connection   — 测试 AI 连接
 * POST /api/ai/score             — AI 判分
 * POST /api/ai/extract           — 文本 → 知识提炼
 * POST /api/ai/vision-extract    — 图片 → OCR → 知识提炼
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createAiProvider } from "../services/ai/factory.js";
import { scoreAnswer } from "../services/scoring.js";
import { extractKnowledge } from "../services/extraction/pipeline.js";
import { ZERO_OMISSION_SYSTEM_PROMPT, buildZeroOmissionPrompt } from "../prompts/ocr-zero-omission.js";

export const aiRouter = Router();

// ── Schema ──

const testConnectionSchema = z.object({
  provider: z.string().optional(),
  model: z.string(),
  baseUrl: z.string().optional(),
});

const scoreSchema = z.object({
  standardAnswer: z.string().min(1),
  keywords: z.array(z.string()),
  userAnswer: z.string().min(1),
  questionType: z.string().optional(),
});

const extractSchema = z.object({
  text: z.string().min(10),
});

const visionExtractSchema = z.object({
  images: z.array(z.object({
    data: z.string().min(1),
    mediaType: z.string(),
  })).min(1).max(5),
  ocrMode: z.boolean().optional(),
});

// ── 零遗漏模式专用 Schema ──
const zeroOmissionSchema = z.object({
  images: z.array(z.object({
    data: z.string().min(1),
    mediaType: z.string(),
  })).min(1).max(5),
  /** 这批图片的起始页码偏移 */
  startPage: z.number().int().min(1).default(1),
});

// ── Prompt ──

const OCR_SHORT_PROMPT = `提取图片中所有文字。保留原文结构和政治术语的精确措辞。不要添加解释。`;

function getProviderFromRequest(req: Request) {
  const apiKey = (req.headers["x-api-key"] as string) || process.env.AI_API_KEY || "";
  const model = req.body.model || process.env.AI_MODEL || "gpt-4o";
  const baseUrl = req.body.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com";
  if (!apiKey) {
    return { error: "未配置 API Key。请在请求头 x-api-key 中提供，或在 .env 中设置 AI_API_KEY。" };
  }
  return { provider: createAiProvider({ apiKey, baseUrl, model }), model };
}

// ── POST /api/ai/test-connection ──
aiRouter.post("/test-connection", async (req: Request, res: Response) => {
  try {
    const parsed = testConnectionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效", details: parsed.error.issues }); return; }
    const apiKey = (req.headers["x-api-key"] as string) || process.env.AI_API_KEY || "";
    if (!apiKey) { res.json({ success: false, error: "未配置 API Key" }); return; }
    const model = parsed.data.model || process.env.AI_MODEL || "gpt-4o";
    const baseUrl = parsed.data.baseUrl || process.env.AI_BASE_URL || "https://api.openai.com";
    const provider = createAiProvider({ apiKey, baseUrl, model });
    const ok = await provider.testConnection();
    res.json({ success: ok, model, latency: 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ── POST /api/ai/score ──
aiRouter.post("/score", async (req: Request, res: Response) => {
  try {
    const parsed = scoreSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效" }); return; }
    const prov = getProviderFromRequest(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }
    const result = await scoreAnswer(prov.provider, {
      standardAnswer: parsed.data.standardAnswer,
      keywords: parsed.data.keywords,
      userAnswer: parsed.data.userAnswer,
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── POST /api/ai/extract ──
aiRouter.post("/extract", async (req: Request, res: Response) => {
  try {
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效" }); return; }
    const prov = getProviderFromRequest(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }
    const result = await extractKnowledge(prov.provider, parsed.data.text);
    res.json(result);
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── POST /api/ai/vision-extract (普通模式) ──
aiRouter.post("/vision-extract", async (req: Request, res: Response) => {
  try {
    const parsed = visionExtractSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效" }); return; }
    const prov = getProviderFromRequest(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }
    const useShort = parsed.data.ocrMode === true;
    const visionPrompt = useShort ? OCR_SHORT_PROMPT : OCR_SHORT_PROMPT;

    const visionResult = await prov.provider.chatVision({
      systemPrompt: visionPrompt,
      images: parsed.data.images,
      temperature: 0,
      maxTokens: useShort ? 4000 : 8000,
    });

    const result = await extractKnowledge(prov.provider, visionResult.content);
    res.json({
      ...result,
      visionMeta: {
        extractedTextLength: visionResult.content.length,
        visionModel: visionResult.model,
        visionLatency: visionResult.latency,
        imageCount: parsed.data.images.length,
        ocrMode: useShort,
      },
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[vision-extract] ${msg}`);
    res.status(502).json({ error: msg.slice(0, 300) });
  }
});

// ── POST /api/ai/zero-omission (零遗漏模式) ──
aiRouter.post("/zero-omission", async (req: Request, res: Response) => {
  try {
    const parsed = zeroOmissionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "参数无效", details: parsed.error.issues }); return; }

    const prov = getProviderFromRequest(req);
    if ("error" in prov) { res.status(400).json({ error: prov.error }); return; }

    const imageCount = parsed.data.images.length;
    const startPage = parsed.data.startPage;

    // 使用零遗漏专用 Prompt
    const userPrompt = buildZeroOmissionPrompt(imageCount);
    const systemPrompt = ZERO_OMISSION_SYSTEM_PROMPT;

    const visionResult = await prov.provider.chatVision({
      systemPrompt: `${systemPrompt}\n\n当前批次起始页码：第 ${startPage} 页。共 ${imageCount} 张图片，对应第 ${startPage} 到第 ${startPage + imageCount - 1} 页。`,
      images: parsed.data.images,
      temperature: 0,
      maxTokens: 8000,
    });

    // 尝试解析 JSON 输出
    let parsed_output: any;
    try {
      const cleaned = visionResult.content
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed_output = JSON.parse(cleaned);
    } catch {
      // 如果 AI 没返回 JSON，返回原始文字
      parsed_output = {
        rawText: visionResult.content,
        parseError: true,
      };
    }

    res.json({
      pages: parsed_output?.pages ?? [],
      finalReport: parsed_output?.finalOmissionReport ?? null,
      parseError: parsed_output?.parseError ?? false,
      rawText: parsed_output?.rawText ?? null,
      visionMeta: {
        extractedTextLength: visionResult.content.length,
        visionModel: visionResult.model,
        visionLatency: visionResult.latency,
        imageCount,
        startPage,
      },
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[zero-omission] ${msg}`);
    res.status(502).json({ error: msg.slice(0, 300) });
  }
});
