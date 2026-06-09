/**
 * AI 判分服务
 */

import type { AiProvider } from "./ai/provider.js";
import { SCORE_SYSTEM_PROMPT, buildScorePrompt } from "../prompts/score.js";
import { safeJsonParse } from "../utils/json.js";

export interface ScoringInput {
  standardAnswer: string;
  keywords: string[];
  userAnswer: string;
}

export interface ScoringResult {
  score: number;
  covered: string[];
  missing: string[];
  suggestion: string;
}

export async function scoreAnswer(
  provider: AiProvider,
  input: ScoringInput
): Promise<ScoringResult> {
  const userPrompt = buildScorePrompt(
    input.standardAnswer,
    input.keywords,
    input.userAnswer
  );

  const response = await provider.chat({
    systemPrompt: SCORE_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.2,
    maxTokens: 800,
    responseFormat: "json",
  });

  const parsed = safeJsonParse<ScoringResult>(response.content);

  return {
    score: clamp(parsed.score ?? 50, 0, 100),
    covered: Array.isArray(parsed.covered) ? parsed.covered : [],
    missing: Array.isArray(parsed.missing) ? parsed.missing : [],
    suggestion: typeof parsed.suggestion === "string"
      ? parsed.suggestion.slice(0, 100)
      : "",
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
