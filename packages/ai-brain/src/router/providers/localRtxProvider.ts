import type { PrismaClient } from "@uwe/database/server";
import { resolveInferenceConfig } from "../../inference-config";
import { createProvider, type CreateProviderOptions } from "../../providers/registry";
import type { AiProvider, AiProviderId, ApiKeyStore } from "../../types";
import { checkRtxReadiness } from "../health/rtxReadiness";
import { AiRouterError } from "../types";

export interface LocalRtxProviderOptions extends CreateProviderOptions {
  useMock?: boolean;
  prisma?: PrismaClient;
}

/**
 * Factory for the local RTX inference provider.
 *
 * Active path: direct Ollama/LM Studio via `AI_INFERENCE_BASE_URL` (and the
 * outbound RTX Host Connector for queued jobs). The legacy inbound RTX Agent
 * (`RTX_AGENT_URL` → `/api/chat`) has been removed; LLM inference no longer
 * routes through it. See `docs/removed-legacy-runtime.md`.
 */
export function createLocalRtxProvider(
  apiKeyStore: ApiKeyStore,
  options?: LocalRtxProviderOptions,
): AiProvider {
  const config = resolveInferenceConfig();

  if (!config.enabled && !options?.useMock) {
    throw new AiRouterError("RTX-Inference ist deaktiviert (AI_INFERENCE_ENABLED=false).");
  }

  return createProvider(config.providerId, apiKeyStore, {
    useMock: options?.useMock,
    baseUrl: options?.baseUrl ?? config.baseUrl,
    timeoutMs: options?.timeoutMs ?? config.timeoutMs,
    apiKey: options?.apiKey ?? config.apiKey,
    allowPublicUrl: options?.allowPublicUrl ?? config.allowPublicUrl,
  });
}

export function getLocalRtxProviderId(): AiProviderId {
  return resolveInferenceConfig().providerId;
}

export async function assertLocalRtxReady(options?: {
  useMock?: boolean;
  prisma?: PrismaClient;
}): Promise<void> {
  const health = await checkRtxReadiness({
    useMock: options?.useMock,
    prisma: options?.prisma,
  });
  if (!health.ready) {
    throw new AiRouterError(
      health.message || "Lokale RTX-Inference ist nicht bereit.",
    );
  }
}
