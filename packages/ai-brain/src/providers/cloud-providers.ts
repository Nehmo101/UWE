import { timedHealthCheck } from "./base";
import type {
  AiHealthCheckResult,
  AiModel,
  AiProvider,
  GenerateTextOptions,
  GenerateTextResult,
} from "../types";
import { AiProviderError } from "../types";

export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  readonly isLocal = false;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  private async fetchJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey ?? "",
        "anthropic-version": "2023-06-01",
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AiProviderError(
        `anthropic request failed (${response.status}): ${body.slice(0, 200)}`,
        this.id,
      );
    }

    return response.json() as Promise<T>;
  }

  async listModels(): Promise<AiModel[]> {
    return [
      { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", provider: this.id },
      { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", provider: this.id },
    ];
  }

  /**
   * No `responseFormat` handling: the Anthropic Messages API has no JSON mode
   * flag — structured output there means tool use, which would change the
   * request shape for every task, not just the JSON ones. This provider is
   * therefore one of the two places where JSON is only *asked* for; the
   * router's single repair attempt and the clamping validators carry it.
   */
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const data = await this.fetchJson<{
      content?: Array<{ type: string; text?: string }>;
      model?: string;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>("/messages", {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens ?? 2048,
        system: options.systemPrompt,
        messages: [{ role: "user", content: options.prompt }],
        temperature: options.temperature ?? 0.7,
      }),
    });

    const text = data.content?.find((part) => part.type === "text")?.text ?? "";
    const usage =
      data.usage?.input_tokens != null || data.usage?.output_tokens != null
        ? {
            promptTokens: data.usage?.input_tokens ?? 0,
            completionTokens: data.usage?.output_tokens ?? 0,
          }
        : undefined;
    return {
      text,
      model: data.model ?? options.model,
      provider: this.id,
      finishReason: data.stop_reason,
      usage,
    };
  }

  async healthCheck(): Promise<AiHealthCheckResult> {
    return timedHealthCheck(this.id, async () => {
      if (!this.apiKey) {
        throw new Error("Anthropic API key fehlt");
      }
    });
  }
}

export class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  readonly isLocal = false;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async listModels(): Promise<AiModel[]> {
    return [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: this.id },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: this.id },
    ];
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    if (!this.apiKey) {
      throw new AiProviderError("Gemini API key fehlt", this.id);
    }

    const url = `${this.baseUrl.replace(/\/$/, "")}/models/${options.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: options.systemPrompt
          ? { parts: [{ text: options.systemPrompt }] }
          : undefined,
        contents: [{ parts: [{ text: options.prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
          // Gemini's own JSON mode. Without a responseSchema it still only
          // guarantees "valid JSON", not the right shape — the validators own
          // the shape.
          ...(options.responseFormat === "json"
            ? { responseMimeType: "application/json" }
            : {}),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AiProviderError(
        `gemini request failed (${response.status}): ${body.slice(0, 200)}`,
        this.id,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const usage =
      data.usageMetadata?.promptTokenCount != null ||
      data.usageMetadata?.candidatesTokenCount != null
        ? {
            promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
            completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
          }
        : undefined;

    return {
      text,
      model: options.model,
      provider: this.id,
      usage,
    };
  }

  async healthCheck(): Promise<AiHealthCheckResult> {
    return timedHealthCheck(this.id, async () => {
      if (!this.apiKey) {
        throw new Error("Gemini API key fehlt");
      }
    });
  }
}
