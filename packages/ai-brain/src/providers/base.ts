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
    protected readonly timeoutMs = 120_000,
  ) {}

  protected async fetchJson<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AiProviderError(
          `${this.id} request failed (${response.status}): ${body.slice(0, 200)}`,
          this.id,
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiProviderError(
          `${this.id} Anfrage abgebrochen nach ${Math.round(timeoutMs / 1000)}s (AI_INFERENCE_TIMEOUT_SECONDS). RTX antwortet nicht rechtzeitig.`,
          this.id,
        );
      }
      const endpoint = this.baseUrl.replace(/\/$/, "");
      throw new AiProviderError(
        `${this.id} auf ${endpoint} nicht erreichbar. RTX/Ollama/LM Studio offline oder Netzwerk blockiert.`,
        this.id,
      );
    } finally {
      clearTimeout(timeout);
    }
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
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}): { text: string; finishReason?: string; usage?: { promptTokens: number; completionTokens: number } } {
  const choice = data.choices?.[0];
  const usage =
    data.usage?.prompt_tokens != null || data.usage?.completion_tokens != null
      ? {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
        }
      : undefined;
  return {
    text: choice?.message?.content ?? "",
    finishReason: choice?.finish_reason,
    usage,
  };
}
