import type { AiProvider, AiProviderConfig } from "./provider.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";

export function createAiProvider(config: AiProviderConfig): AiProvider {
  const model = config.model.toLowerCase();

  // 判断是否为 Anthropic 官方 API（只有官方 API 才用 Anthropic 格式）
  const isAnthropicOfficial =
    config.baseUrl.includes("api.anthropic.com");

  if (isAnthropicOfficial && model.includes("claude")) {
    return new AnthropicProvider(config);
  }

  // 中转代理 / 自定义 API → 走 OpenAI 兼容格式
  // 大多数中转代理（OneAPI、CloseAI 等）都兼容 OpenAI 的 /v1/chat/completions
  return new OpenAIProvider(config);
}
