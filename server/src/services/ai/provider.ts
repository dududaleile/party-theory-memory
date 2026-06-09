/**
 * AI Provider 抽象接口
 * 支持 OpenAI / Anthropic / 自定义兼容接口
 */

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AiRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  responseFormat?: "json" | "text";
}

export interface AiResponse {
  content: string;
  model: string;
  provider: string;
  usage: { inputTokens: number; outputTokens: number };
  latency: number;
}

/** 视觉识别请求 */
export interface VisionRequest {
  systemPrompt: string;
  /** base64 编码的图片数组 */
  images: Array<{
    data: string;        // base64（不含 data:xxx;base64, 前缀）
    mediaType: string;   // "image/png" | "image/jpeg" | "image/gif" | "image/webp"
  }>;
  temperature: number;
  maxTokens: number;
}

export interface AiProvider {
  readonly name: string;
  chat(req: AiRequest): Promise<AiResponse>;
  /** 视觉识别 —— 从图片中提取文字 */
  chatVision(req: VisionRequest): Promise<AiResponse>;
  testConnection(): Promise<boolean>;
}
