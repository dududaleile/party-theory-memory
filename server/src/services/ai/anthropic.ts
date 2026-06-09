import type { AiProvider, AiProviderConfig, AiRequest, AiResponse, VisionRequest } from "./provider.js";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";

  constructor(private config: AiProviderConfig) {}

  async chat(req: AiRequest): Promise<AiResponse> {
    const start = Date.now();

    const body: Record<string, unknown> = {
      model: this.config.model,
      system: req.systemPrompt,
      messages: [{ role: "user", content: req.userPrompt }],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    };

    const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      model: string;
      content: [{ text: string }];
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0].text,
      model: data.model,
      provider: "anthropic",
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      latency: Date.now() - start,
    };
  }

  // ── 视觉识别 ──

  async chatVision(req: VisionRequest): Promise<AiResponse> {
    const start = Date.now();

    // Claude Vision 的多模态消息格式
    const contentBlocks: unknown[] = [];

    // 先添加所有图片
    for (const img of req.images) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType,
          data: img.data,
        },
      });
    }

    // 再添加文本指令
    contentBlocks.push({
      type: "text",
      text: req.systemPrompt,
    });

    const body = {
      model: this.config.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    };

    const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Claude Vision ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      model: string;
      content: [{ text: string }];
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0].text,
      model: data.model,
      provider: "anthropic",
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      latency: Date.now() - start,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat({
        systemPrompt: "You are a helper.",
        userPrompt: "Reply: ok",
        temperature: 0,
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}
