import { createProvider } from "./providers/registry";
import { createApiKeyStoreFromEnv } from "./settings";
import {
  assertInferenceConfigUsable,
  resolveInferenceConfig,
  type InferenceConfig,
  type InferenceProviderKind,
} from "./inference-config";
import { InferenceUrlBlockedError } from "./inference-url-guard";
import type { AiHealthCheckResult, AiModel, AiProviderId } from "./types";
import { AiProviderError } from "./types";

export interface InferenceStatus {
  enabled: boolean;
  configured: boolean;
  provider: InferenceProviderKind;
  providerId: AiProviderId;
  endpoint: string;
  defaultModel: string;
  timeoutSeconds: number;
  allowPublicUrl: boolean;
  urlAllowed: boolean;
  urlKind: string;
  online: boolean;
  message: string;
  health?: AiHealthCheckResult;
  modelCount?: number;
  offlineReason?: string;
}

export interface InferenceTestResult {
  ok: boolean;
  provider: AiProviderId;
  model: string;
  text: string;
  latencyMs: number;
  message: string;
}

function offlineStatus(config: InferenceConfig, message: string, offlineReason?: string): InferenceStatus {
  return {
    enabled: config.enabled,
    configured: config.urlAllowed,
    provider: config.provider,
    providerId: config.providerId,
    endpoint: config.endpointLabel,
    defaultModel: config.defaultModel,
    timeoutSeconds: config.timeoutSeconds,
    allowPublicUrl: config.allowPublicUrl,
    urlAllowed: config.urlAllowed,
    urlKind: config.urlKind,
    online: false,
    message,
    offlineReason,
  };
}

export async function getInferenceStatus(options?: {
  useMock?: boolean;
  config?: InferenceConfig;
}): Promise<InferenceStatus> {
  const config = options?.config ?? resolveInferenceConfig();

  if (!config.enabled) {
    return offlineStatus(config, "Maschinenraum-Inference ist deaktiviert.");
  }

  if (!config.urlAllowed) {
    return offlineStatus(
      config,
      config.urlBlockReason ?? "Inference-Endpoint ist blockiert.",
      config.urlBlockReason,
    );
  }

  if (options?.useMock) {
    const provider = createProvider(config.providerId, createApiKeyStoreFromEnv(), { useMock: true });
    const health = await provider.healthCheck();
    return {
      enabled: true,
      configured: true,
      provider: config.provider,
      providerId: config.providerId,
      endpoint: config.endpointLabel,
      defaultModel: config.defaultModel,
      timeoutSeconds: config.timeoutSeconds,
      allowPublicUrl: config.allowPublicUrl,
      urlAllowed: true,
      urlKind: config.urlKind,
      online: health.ok,
      message: health.message,
      health,
      modelCount: 1,
    };
  }

  try {
    assertInferenceConfigUsable(config);
    const provider = createProvider(config.providerId, createApiKeyStoreFromEnv(), {
      useMock: false,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      apiKey: config.apiKey,
    });

    const health = await provider.healthCheck();
    let modelCount: number | undefined;

    if (health.ok) {
      try {
        const models = await provider.listModels();
        modelCount = models.length;
      } catch {
        modelCount = undefined;
      }
    }

    return {
      enabled: true,
      configured: true,
      provider: config.provider,
      providerId: config.providerId,
      endpoint: config.endpointLabel,
      defaultModel: config.defaultModel,
      timeoutSeconds: config.timeoutSeconds,
      allowPublicUrl: config.allowPublicUrl,
      urlAllowed: true,
      urlKind: config.urlKind,
      online: health.ok,
      message: health.ok ? "Maschinenraum-Inference erreichbar" : health.message,
      health,
      modelCount,
      offlineReason: health.ok ? undefined : health.message,
    };
  } catch (error) {
    if (error instanceof InferenceUrlBlockedError) {
      return offlineStatus(config, error.message, error.message);
    }

    const message =
      error instanceof AiProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Maschinenraum-Inference nicht erreichbar";

    return offlineStatus(config, message, message);
  }
}

export async function runInferenceTestPrompt(options?: {
  prompt?: string;
  model?: string;
  useMock?: boolean;
  config?: InferenceConfig;
}): Promise<InferenceTestResult> {
  const config = options?.config ?? resolveInferenceConfig();
  const started = Date.now();
  const prompt = options?.prompt ?? "Antworte nur mit: pong";
  const model = options?.model ?? config.defaultModel;

  if (!config.enabled) {
    return {
      ok: false,
      provider: config.providerId,
      model,
      text: "",
      latencyMs: Date.now() - started,
      message: "Maschinenraum-Inference ist deaktiviert.",
    };
  }

  try {
    assertInferenceConfigUsable(config);
    const provider = createProvider(config.providerId, createApiKeyStoreFromEnv(), {
      useMock: options?.useMock ?? false,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      apiKey: config.apiKey,
    });

    const result = await provider.generateText({
      model,
      prompt,
      systemPrompt: "Du bist ein kurzer Test-Assistent für UWE.",
      maxTokens: 64,
      temperature: 0,
    });

    return {
      ok: result.text.trim().length > 0,
      provider: result.provider,
      model: result.model,
      text: result.text,
      latencyMs: Date.now() - started,
      message: "Testprompt erfolgreich",
    };
  } catch (error) {
    const message =
      error instanceof InferenceUrlBlockedError
        ? error.message
        : error instanceof AiProviderError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Testprompt fehlgeschlagen";

    return {
      ok: false,
      provider: config.providerId,
      model,
      text: "",
      latencyMs: Date.now() - started,
      message,
    };
  }
}

export async function listInferenceModels(options?: {
  useMock?: boolean;
  config?: InferenceConfig;
}): Promise<{ models: AiModel[]; health: AiHealthCheckResult }> {
  const config = options?.config ?? resolveInferenceConfig();
  assertInferenceConfigUsable(config);

  const provider = createProvider(config.providerId, createApiKeyStoreFromEnv(), {
    useMock: options?.useMock ?? false,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    apiKey: config.apiKey,
  });

  const [models, health] = await Promise.all([provider.listModels(), provider.healthCheck()]);
  return { models, health };
}
