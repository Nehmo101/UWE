import type {
  AiHealthCheckResult,
  AiModel,
  AiProvider,
  AiProviderId,
  GenerateTextOptions,
  GenerateTextResult,
} from "../types";
import { getProviderDefinition } from "../settings";
import type { ApiKeyStore } from "../types";
import { AnthropicProvider, GeminiProvider } from "./cloud-providers";
import {
  OllamaProvider,
  OpenAiCompatibleProvider,
  OpenAiProvider,
  OpenRouterProvider,
} from "./openai-family";

export class MockAiProvider implements AiProvider {
  readonly id: AiProviderId;
  readonly isLocal: boolean;
  readonly responses: Map<string, string>;

  constructor(id: AiProviderId, isLocal: boolean, responses?: Record<string, string>) {
    this.id = id;
    this.isLocal = isLocal;
    this.responses = new Map(Object.entries(responses ?? {}));
  }

  async listModels(): Promise<AiModel[]> {
    return [{ id: "mock-model", name: "Mock Model", provider: this.id }];
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    return {
      text: this.responses.get(options.prompt) ?? `Mock-Antwort für ${this.id}: ${options.prompt.slice(0, 120)}…`,
      model: options.model,
      provider: this.id,
      finishReason: "stop",
    };
  }

  async healthCheck(): Promise<AiHealthCheckResult> {
    return {
      ok: true,
      provider: this.id,
      message: "Mock provider bereit",
      latencyMs: 1,
    };
  }
}

export function createProvider(
  providerId: AiProviderId,
  apiKeyStore: ApiKeyStore,
  options?: { useMock?: boolean },
): AiProvider {
  if (options?.useMock) {
    const def = getProviderDefinition(providerId);
    return new MockAiProvider(providerId, def?.isLocal ?? false);
  }

  const def = getProviderDefinition(providerId);
  const baseUrl =
    resolveProviderBaseUrl(providerId) ??
    def?.baseUrl ??
    defaultBaseUrl(providerId);
  const apiKey = apiKeyStore.get(providerId);

  switch (providerId) {
    case "ollama":
      return new OllamaProvider(baseUrl);
    case "openai_compatible":
      return new OpenAiCompatibleProvider(baseUrl, apiKey);
    case "openai":
      return new OpenAiProvider(baseUrl, apiKey);
    case "openrouter":
      return new OpenRouterProvider(baseUrl, apiKey);
    case "anthropic":
      return new AnthropicProvider(baseUrl, apiKey);
    case "gemini":
      return new GeminiProvider(baseUrl, apiKey);
    default:
      throw new Error(`Unbekannter Provider: ${providerId satisfies never}`);
  }
}

function resolveProviderBaseUrl(providerId: AiProviderId): string | undefined {
  switch (providerId) {
    case "ollama":
      return process.env.OLLAMA_BASE_URL;
    case "openai_compatible":
      return process.env.OPENAI_COMPATIBLE_BASE_URL;
    case "openai":
      return process.env.OPENAI_BASE_URL;
    case "anthropic":
      return process.env.ANTHROPIC_BASE_URL;
    case "gemini":
      return process.env.GEMINI_BASE_URL;
    case "openrouter":
      return process.env.OPENROUTER_BASE_URL;
    default:
      return undefined;
  }
}

function defaultBaseUrl(providerId: AiProviderId): string {
  switch (providerId) {
    case "ollama":
      return "http://localhost:11434";
    case "openai_compatible":
      return "http://localhost:8080/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    default:
      throw new Error(`Keine Default-URL für ${providerId satisfies never}`);
  }
}

export async function runAiTask(
  provider: AiProvider,
  options: GenerateTextOptions,
): Promise<GenerateTextResult> {
  return provider.generateText(options);
}
