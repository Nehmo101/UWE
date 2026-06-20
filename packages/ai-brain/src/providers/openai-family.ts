import {
  BaseHttpProvider,
  buildChatCompletionBody,
  extractOpenAiText,
  mapOpenAiCompatibleModels,
  timedHealthCheck,
} from "./base";
import type { AiModel, GenerateTextOptions, GenerateTextResult } from "../types";

export class OllamaProvider extends BaseHttpProvider {
  readonly id = "ollama" as const;
  readonly isLocal = true;

  async listModels(): Promise<AiModel[]> {
    const data = await this.fetchJson<{ models?: Array<{ name: string }> }>("/api/tags");
    return (data.models ?? []).map((model) => ({
      id: model.name,
      name: model.name,
      provider: this.id,
    }));
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const data = await this.fetchJson<{
      message?: { content?: string };
      model?: string;
    }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        messages: [
          ...(options.systemPrompt
            ? [{ role: "system", content: options.systemPrompt }]
            : []),
          { role: "user", content: options.prompt },
        ],
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      }),
    });

    return {
      text: data.message?.content ?? "",
      model: data.model ?? options.model,
      provider: this.id,
    };
  }

  async *streamText(options: GenerateTextOptions): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        messages: [{ role: "user", content: options.prompt }],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as { message?: { content?: string } };
          if (chunk.message?.content) {
            yield chunk.message.content;
          }
        } catch {
          // ignore partial json lines
        }
      }
    }
  }

  async embedText(text: string, model = "nomic-embed-text"): Promise<number[]> {
    const data = await this.fetchJson<{ embedding?: number[] }>("/api/embeddings", {
      method: "POST",
      body: JSON.stringify({ model, prompt: text }),
    });
    return data.embedding ?? [];
  }

  async healthCheck() {
    return timedHealthCheck(this.id, async () => {
      await this.fetchJson("/api/tags");
    });
  }
}

export class OpenAiCompatibleProvider extends BaseHttpProvider {
  readonly id = "openai_compatible" as const;
  readonly isLocal = true;

  async listModels(): Promise<AiModel[]> {
    const data = await this.fetchJson<{ data?: Array<{ id: string }> }>("/models");
    return mapOpenAiCompatibleModels(this.id, data.data ?? []);
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const data = await this.fetchJson<{
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(buildChatCompletionBody(options)),
    });
    const extracted = extractOpenAiText(data);
    return {
      text: extracted.text,
      model: data.model ?? options.model,
      provider: this.id,
      finishReason: extracted.finishReason,
      usage: extracted.usage,
    };
  }

  async healthCheck() {
    return timedHealthCheck(this.id, async () => {
      await this.fetchJson("/models");
    });
  }
}

export class OpenAiProvider extends BaseHttpProvider {
  readonly id = "openai" as const;
  readonly isLocal = false;

  async listModels(): Promise<AiModel[]> {
    const data = await this.fetchJson<{ data?: Array<{ id: string }> }>("/models");
    return mapOpenAiCompatibleModels(this.id, data.data ?? []);
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const data = await this.fetchJson<{
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(buildChatCompletionBody(options)),
    });
    const extracted = extractOpenAiText(data);
    return {
      text: extracted.text,
      model: data.model ?? options.model,
      provider: this.id,
      finishReason: extracted.finishReason,
      usage: extracted.usage,
    };
  }

  async healthCheck() {
    return timedHealthCheck(this.id, async () => {
      await this.fetchJson("/models");
    });
  }
}

export class OpenRouterProvider extends BaseHttpProvider {
  readonly id = "openrouter" as const;
  readonly isLocal = false;

  async listModels(): Promise<AiModel[]> {
    const data = await this.fetchJson<{ data?: Array<{ id: string }> }>("/models");
    return mapOpenAiCompatibleModels(this.id, data.data ?? []);
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const data = await this.fetchJson<{
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(buildChatCompletionBody(options)),
    });
    const extracted = extractOpenAiText(data);
    return {
      text: extracted.text,
      model: data.model ?? options.model,
      provider: this.id,
      finishReason: extracted.finishReason,
      usage: extracted.usage,
    };
  }

  async healthCheck() {
    return timedHealthCheck(this.id, async () => {
      await this.fetchJson("/models");
    });
  }

  protected async fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = {
      ...(init.headers as Record<string, string> | undefined),
      "HTTP-Referer": "https://uwe.local",
      "X-Title": "UWE AI Brain",
    };
    return super.fetchJson(path, { ...init, headers });
  }
}
