import { createProvider, type CreateProviderOptions } from "../../providers/registry";
import {
  createApiKeyStoreFromEnv,
  isCloudProvider,
  resolveAiBrainSettings,
} from "../../settings";
import type { AiProvider, AiProviderId, ApiKeyStore } from "../../types";
import { AiRouterError } from "../types";

const CLOUD_PROVIDER_PRIORITY: AiProviderId[] = [
  ...(process.env.CLOUD_AI_PROVIDER?.trim()
    ? [process.env.CLOUD_AI_PROVIDER.trim() as AiProviderId]
    : []),
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
];

export interface CloudProviderOptions extends CreateProviderOptions {
  useMock?: boolean;
}

/**
 * Resolves which cloud provider to use and creates it via the shared registry.
 */
export function createCloudProvider(
  apiKeyStore: ApiKeyStore,
  preferredId?: AiProviderId,
  options?: CloudProviderOptions,
): AiProvider {
  const providerId = resolveCloudProviderId(apiKeyStore, preferredId);

  if (options?.useMock) {
    return createProvider(providerId, apiKeyStore, { useMock: true });
  }

  return createProvider(providerId, apiKeyStore, {
    baseUrl: options?.baseUrl,
    timeoutMs: options?.timeoutMs,
    apiKey: options?.apiKey,
  });
}

export function resolveCloudProviderId(
  apiKeyStore: ApiKeyStore = createApiKeyStoreFromEnv(),
  preferredId?: AiProviderId,
): AiProviderId {
  if (preferredId) {
    if (!isCloudProvider(preferredId)) {
      throw new AiRouterError(
        `Provider „${preferredId}“ ist kein Cloud-Provider. Nur Cloud-Provider sind für Cloud-Modus erlaubt.`,
      );
    }

    const settings = resolveAiBrainSettings(apiKeyStore);
    const def = settings.providers.find((p) => p.id === preferredId);
    if (!def?.hasApiKey && !apiKeyStore.has(preferredId)) {
      throw new AiRouterError(
        `Cloud-Provider „${preferredId}“ ist nicht konfiguriert (API-Schlüssel fehlt).`,
      );
    }

    return preferredId;
  }

  const cloudEnvProvider = process.env.CLOUD_AI_PROVIDER?.trim() as AiProviderId | undefined;
  if (
    cloudEnvProvider &&
    isCloudProvider(cloudEnvProvider) &&
    apiKeyStore.has(cloudEnvProvider)
  ) {
    return cloudEnvProvider;
  }

  const settings = resolveAiBrainSettings(apiKeyStore);

  for (const id of CLOUD_PROVIDER_PRIORITY) {
    const def = settings.providers.find((p) => p.id === id);
    if (def?.hasApiKey && !def.isLocal) {
      return id;
    }
  }

  const anyCloud = settings.providers.find((p) => !p.isLocal && p.hasApiKey);
  if (anyCloud) {
    return anyCloud.id;
  }

  throw new AiRouterError(
    "Kein Cloud-Provider konfiguriert. Bitte API-Schlüssel für OpenAI, Anthropic, Gemini oder OpenRouter hinterlegen.",
  );
}

export function listAvailableCloudProviders(
  apiKeyStore: ApiKeyStore = createApiKeyStoreFromEnv(),
): AiProviderId[] {
  const settings = resolveAiBrainSettings(apiKeyStore);
  return settings.providers.filter((p) => !p.isLocal && p.hasApiKey).map((p) => p.id);
}
