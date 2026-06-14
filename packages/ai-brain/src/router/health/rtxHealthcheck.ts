import { getInferenceStatus } from "../../inference";
import { resolveInferenceConfig } from "../../inference-config";
import { sanitizeInferenceEndpointLabel, type InferenceUrlKind } from "../../inference-url-guard";
import { fetchRtxAgentHealth } from "../../rtx-agent-client";
import {
  evaluateRtxAgentUrl,
  isRtxAgentConfigured,
  resolveRtxAgentConfig,
  type RtxAgentStatus,
} from "../../rtx-agent-config";
import type { AiHealthCheckResult } from "../../types";

export interface RtxHealthStatus {
  online: boolean;
  ready: boolean;
  message: string;
  providerId: string;
  endpoint: string;
  defaultModel: string;
  health?: AiHealthCheckResult;
  modelCount?: number;
  /** Agent status when RTX_AGENT_URL is configured. */
  agentStatus?: RtxAgentStatus;
  /** Whether health was read from RTX agent vs direct inference. */
  source: "agent" | "inference";
  urlAllowed: boolean;
  urlKind: InferenceUrlKind | string;
  publicExposureWarning?: string;
}

export async function checkRtxHealth(options?: {
  useMock?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<RtxHealthStatus> {
  const env = options?.env ?? process.env;
  const agentEvaluation = evaluateRtxAgentUrl(env);
  const agentConfig = resolveRtxAgentConfig(env);

  if (agentEvaluation.configured && !agentEvaluation.urlAllowed) {
    return {
      online: false,
      ready: false,
      message: agentEvaluation.blockReason ?? "RTX-Agent-URL ist öffentlich und blockiert.",
      providerId: "ollama",
      endpoint: sanitizeInferenceEndpointLabel(agentEvaluation.url ?? ""),
      defaultModel: resolveInferenceConfig().defaultModel,
      agentStatus: "error",
      source: "agent",
      urlAllowed: false,
      urlKind: agentEvaluation.urlKind ?? "public",
      publicExposureWarning:
        "RTX_AGENT_URL zeigt auf eine öffentliche Adresse — nur Heimnetz/private IP nutzen.",
    };
  }

  if (agentConfig && !options?.useMock) {
    const agentHealth = await fetchRtxAgentHealth(agentConfig);
    const ready = agentHealth.status === "ready";
    const online = agentHealth.status === "ready" || agentHealth.status === "starting";

    return {
      online,
      ready,
      message: agentHealth.message,
      providerId: "ollama",
      endpoint: agentConfig.url,
      defaultModel:
        agentHealth.model ?? agentConfig.preferredModel ?? resolveInferenceConfig().defaultModel,
      agentStatus: agentHealth.status,
      source: "agent",
      urlAllowed: true,
      urlKind: agentEvaluation.urlKind ?? "private",
    };
  }

  const status = await getInferenceStatus({ useMock: options?.useMock });
  const config = resolveInferenceConfig();

  return {
    online: status.online,
    ready: status.online && status.urlAllowed && status.enabled,
    message: status.message,
    providerId: status.providerId,
    endpoint: status.endpoint,
    defaultModel: status.defaultModel || config.defaultModel,
    health: status.health,
    modelCount: status.modelCount,
    source: "inference",
    urlAllowed: status.urlAllowed,
    urlKind: status.urlKind,
    publicExposureWarning: status.urlAllowed
      ? undefined
      : "AI_INFERENCE_BASE_URL zeigt auf eine öffentliche Adresse — RTX nur im Heimnetz betreiben.",
  };
}

export async function isRtxReady(options?: { useMock?: boolean }): Promise<boolean> {
  const health = await checkRtxHealth(options);
  return health.ready;
}

export { isRtxAgentConfigured };
