import type { PrismaClient } from "@uwe/database/server";
import { resolveInferenceConfig } from "../../inference-config";
import { createProvider, type CreateProviderOptions } from "../../providers/registry";
import type { AiProvider, AiProviderId, ApiKeyStore } from "../../types";
import { checkEngineReadiness } from "../health/engineReadiness";
import { AiRouterError } from "../types";

export interface LocalEngineProviderOptions extends CreateProviderOptions {
  useMock?: boolean;
  prisma?: PrismaClient;
}

/**
 * Factory for the local Maschinenraum inference provider.
 *
 * Active path: direct Ollama/LM Studio via `AI_INFERENCE_BASE_URL` (and the
 * outbound Maschinenraum for queued jobs). The legacy inbound Maschinenraum-Agent
 * (`ENGINE_AGENT_URL` → `/api/chat`) has been removed; LLM inference no longer
 * routes through it. See `docs/removed-legacy-runtime.md`.
 */
export function createLocalEngineProvider(
  apiKeyStore: ApiKeyStore,
  options?: LocalEngineProviderOptions,
): AiProvider {
  const config = resolveInferenceConfig();

  if (!config.enabled && !options?.useMock) {
    throw new AiRouterError("Maschinenraum-Inference ist deaktiviert (AI_INFERENCE_ENABLED=false).");
  }

  return createProvider(config.providerId, apiKeyStore, {
    useMock: options?.useMock,
    baseUrl: options?.baseUrl ?? config.baseUrl,
    timeoutMs: options?.timeoutMs ?? config.timeoutMs,
    apiKey: options?.apiKey ?? config.apiKey,
    allowPublicUrl: options?.allowPublicUrl ?? config.allowPublicUrl,
  });
}

export function getLocalEngineProviderId(): AiProviderId {
  return resolveInferenceConfig().providerId;
}

export async function assertLocalEngineReady(options?: {
  useMock?: boolean;
  prisma?: PrismaClient;
}): Promise<void> {
  const health = await checkEngineReadiness({
    useMock: options?.useMock,
    prisma: options?.prisma,
  });
  if (!health.ready) {
    throw new AiRouterError(
      health.message || "Lokale Maschinenraum-Inference ist nicht bereit.",
    );
  }
}
