import type { AiProvider, AiProviderConfig, AiRequest, AiResponse, VisionRequest } from "./provider.js";

export class OpenAIProvider implements AiProvider {
  readonly name = "openai";

  constructor(private config: AiProviderConfig) {}

  async chat(req: AiRequest): Promise<AiResponse> {
    const start = Date.now();
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: req.userPrompt },
      ],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    };
    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      model: string;
      choices: [{ message: { content: string } }];
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0].message.content,
      model: data.model,
      provider: "openai",
      usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens },
      latency: Date.now() - start,
    };
  }

  // ── 视觉识别（GPT-4o / GPT-4o-mini）──

  async chatVision(req: VisionRequest): Promise<AiResponse> {
    const start = Date.now();

    // OpenAI Vision 的多模态消息格式
    const imageBlocks = req.images.map((img) => ({
      type: "image_url",
      image_url: {
        url: `data:${img.mediaType};base64,${img.data}`,
        detail: "high" as const,
      },
    }));

    const body = {
      model: this.config.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: req.systemPrompt },
            ...imageBlocks,
          ],
        },
      ],
      max_tokens: req.maxTokens,
      temperature: req.temperature,
    };

    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI Vision ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      model: string;
      choices: [{ message: { content: string } }];
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0].message.content,
      model: data.model,
      provider: "openai",
      usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens },
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
