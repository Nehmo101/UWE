import type {
  AiHealthCheckResult,
  AiModel,
  AiProvider,
  AiProviderId,
  GenerateTextOptions,
  GenerateTextResult,
} from "../types";
import { AiProviderError } from "../types";

export abstract class BaseHttpProvider implements AiProvider {
  abstract readonly id: AiProviderId;
  abstract readonly isLocal: boolean;

  constructor(
    protected readonly baseUrl: string,
    protected readonly apiKey?: string,
  ) {}

  protected async fetchJson<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AiProviderError(
        `${this.id} request failed (${response.status}): ${body.slice(0, 200)}`,
        this.id,
      );
    }

    return response.json() as Promise<T>;
  }

  abstract listModels(): Promise<AiModel[]>;
  abstract generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  abstract healthCheck(): Promise<AiHealthCheckResult>;
}

export function mapOpenAiCompatibleModels(
  provider: AiProviderId,
  models: Array<{ id?: string; name?: string }>,
): AiModel[] {
  return models
    .filter((model) => model.id)
    .map((model) => ({
      id: model.id!,
      name: model.name ?? model.id!,
      provider,
    }));
}

export async function timedHealthCheck(
  provider: AiProviderId,
  fn: () => Promise<void>,
): Promise<AiHealthCheckResult> {
  const started = Date.now();
  try {
    await fn();
    return {
      ok: true,
      provider,
      message: "Provider erreichbar",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      message: error instanceof Error ? error.message : "Unbekannter Fehler",
      latencyMs: Date.now() - started,
    };
  }
}

export function buildChatCompletionBody(options: GenerateTextOptions) {
  return {
    model: options.model,
    messages: [
      ...(options.systemPrompt
        ? [{ role: "system" as const, content: options.systemPrompt }]
        : []),
      { role: "user" as const, content: options.prompt },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    stream: false,
  };
}

export function extractOpenAiText(data: {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
}): { text: string; finishReason?: string } {
  const choice = data.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    finishReason: choice?.finish_reason,
  };
}
