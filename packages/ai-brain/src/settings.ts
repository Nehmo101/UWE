import { resolveInferenceConfig } from "./inference-config";
import type { AiBrainSettings, AiProviderId, AiProviderSettings, ApiKeyStore } from "./types";

const PROVIDER_DEFINITIONS: Omit<AiProviderSettings, "enabled" | "hasApiKey">[] = [
  {
    id: "ollama",
    label: "Lokale KI (RTX)",
    isLocal: true,
    baseUrl: "http://localhost:11434",
    defaultModel: "llama3.2",
  },
  {
    id: "openai_compatible",
    label: "Lokale KI (OpenAI-kompatibel)",
    isLocal: true,
    baseUrl: "http://localhost:8080/v1",
    defaultModel: "local-model",
  },
  {
    id: "openai",
    label: "OpenAI",
    isLocal: false,
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    isLocal: false,
    defaultModel: "claude-3-5-haiku-latest",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    isLocal: false,
    defaultModel: "gemini-2.0-flash",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    isLocal: false,
    defaultModel: "openrouter/auto",
  },
];

export class InMemoryApiKeyStore implements ApiKeyStore {
  private readonly keys = new Map<AiProviderId, string>();

  get(providerId: AiProviderId): string | undefined {
    return this.keys.get(providerId);
  }

  set(providerId: AiProviderId, key: string): void {
    this.keys.set(providerId, key);
  }

  delete(providerId: AiProviderId): void {
    this.keys.delete(providerId);
  }

  has(providerId: AiProviderId): boolean {
    return this.keys.has(providerId) && this.keys.get(providerId)!.length > 0;
  }
}

export function createApiKeyStoreFromEnv(): InMemoryApiKeyStore {
  const store = new InMemoryApiKeyStore();
  const cloudProvider = process.env.CLOUD_AI_PROVIDER?.trim() as AiProviderId | undefined;
  const cloudKey = process.env.CLOUD_AI_API_KEY?.trim();
  if (cloudProvider && cloudKey && isCloudProvider(cloudProvider)) {
    store.set(cloudProvider, cloudKey);
  }

  const envMap: Partial<Record<AiProviderId, string | undefined>> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };

  for (const [providerId, key] of Object.entries(envMap)) {
    if (key) {
      store.set(providerId as AiProviderId, key);
    }
  }

  return store;
}

export function resolveAiBrainSettings(
  apiKeyStore: ApiKeyStore,
  overrides?: Partial<Pick<AiBrainSettings, "datenschutzMode" | "localOnly" | "defaultProvider" | "enabled">>,
): AiBrainSettings {
  const datenschutzMode =
    overrides?.datenschutzMode ??
    (process.env.AI_DATENSCHUTZ_MODE === "true" || process.env.AI_LOCAL_ONLY === "true");
  const localOnly =
    overrides?.localOnly ??
    (datenschutzMode || process.env.AI_LOCAL_ONLY === "true");

  const inferenceConfig = resolveInferenceConfig();

  const providers: AiProviderSettings[] = PROVIDER_DEFINITIONS.map((def) => {
    const envBaseUrl = resolveProviderBaseUrlFromEnv(def.id);
    const inferenceBaseUrl =
      def.id === inferenceConfig.providerId ? inferenceConfig.baseUrl : undefined;
    return {
      ...def,
      baseUrl: inferenceBaseUrl ?? envBaseUrl ?? def.baseUrl,
      defaultModel:
        def.id === inferenceConfig.providerId ? inferenceConfig.defaultModel : def.defaultModel,
      enabled:
        def.isLocal
          ? inferenceConfig.enabled && inferenceConfig.urlAllowed
          : apiKeyStore.has(def.id),
      hasApiKey: def.isLocal || apiKeyStore.has(def.id),
    };
  });

  const defaultProvider =
    overrides?.defaultProvider ??
    (localOnly
      ? inferenceConfig.providerId
      : ((process.env.AI_DEFAULT_PROVIDER as AiProviderId | undefined) ??
        inferenceConfig.providerId));

  return {
    enabled: overrides?.enabled ?? inferenceConfig.enabled,
    datenschutzMode,
    localOnly,
    defaultProvider,
    providers,
  };
}

function resolveProviderBaseUrlFromEnv(providerId: AiProviderId): string | undefined {
  const inference = resolveInferenceConfig();
  if (providerId === inference.providerId && process.env.AI_INFERENCE_BASE_URL?.trim()) {
    return inference.baseUrl;
  }

  switch (providerId) {
    case "ollama":
      return process.env.OLLAMA_BASE_URL ?? process.env.AI_INFERENCE_BASE_URL;
    case "openai_compatible":
      return process.env.OPENAI_COMPATIBLE_BASE_URL ?? process.env.AI_INFERENCE_BASE_URL;
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

export function isCloudProvider(providerId: AiProviderId): boolean {
  const def = PROVIDER_DEFINITIONS.find((p) => p.id === providerId);
  return def ? !def.isLocal : true;
}

export function getProviderDefinition(providerId: AiProviderId) {
  return PROVIDER_DEFINITIONS.find((p) => p.id === providerId);
}
