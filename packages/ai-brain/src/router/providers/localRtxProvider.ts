import { resolveInferenceConfig } from "../../inference-config";
import { createProvider, type CreateProviderOptions } from "../../providers/registry";
import { createRtxAgentProvider } from "../../providers/rtx-agent-provider";
import { resolveRtxAgentConfig } from "../../rtx-agent-config";
import type { AiProvider, AiProviderId, ApiKeyStore } from "../../types";
import { checkRtxHealth } from "../health/rtxHealthcheck";
import { AiRouterError } from "../types";

export interface LocalRtxProviderOptions extends CreateProviderOptions {
  useMock?: boolean;
}

/**
 * Factory for the local RTX inference provider.
 * Prefers RTX Agent when RTX_AGENT_URL is configured; otherwise direct Ollama/LM Studio.
 */
export function createLocalRtxProvider(
  apiKeyStore: ApiKeyStore,
  options?: LocalRtxProviderOptions,
): AiProvider {
  const agentConfig = resolveRtxAgentConfig();

  if (agentConfig && !options?.useMock) {
    const agentProvider = createRtxAgentProvider(agentConfig);
    if (agentProvider) {
      return agentProvider;
    }
  }

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
  if (resolveRtxAgentConfig()) {
    return "ollama";
  }
  return resolveInferenceConfig().providerId;
}

export async function assertLocalRtxReady(options?: { useMock?: boolean }): Promise<void> {
  const health = await checkRtxHealth(options);
  if (!health.ready) {
    throw new AiRouterError(
      health.message || "Lokale RTX-Inference ist nicht bereit.",
    );
  }
}
