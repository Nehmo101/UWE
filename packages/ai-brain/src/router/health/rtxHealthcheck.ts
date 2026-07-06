import { getInferenceStatus } from "../../inference";
import { resolveInferenceConfig } from "../../inference-config";
import { sanitizeInferenceEndpointLabel, type InferenceUrlKind } from "../../inference-url-guard";
import {
  evaluateRtxWorkerUrl,
  isRtxWorkerConfigured,
  type RtxWorkerStatus,
} from "../../rtx-worker-config";
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
  /** Worker status when RTX_BASE_URL is configured. */
  agentStatus?: RtxWorkerStatus;
  /** Whether health was read from direct inference or connector queue. */
  source: "inference" | "connector";
  urlAllowed: boolean;
  urlKind: InferenceUrlKind | string;
  publicExposureWarning?: string;
}

export async function checkRtxHealth(options?: {
  useMock?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<RtxHealthStatus> {
  const env = options?.env ?? process.env;
  const agentEvaluation = evaluateRtxWorkerUrl(env);

  if (agentEvaluation.configured && !agentEvaluation.urlAllowed) {
    return {
      online: false,
      ready: false,
      message: agentEvaluation.blockReason ?? "RTX-Worker-URL ist öffentlich und blockiert.",
      providerId: "ollama",
      endpoint: sanitizeInferenceEndpointLabel(agentEvaluation.url ?? ""),
      defaultModel: resolveInferenceConfig().defaultModel,
      agentStatus: "error",
      source: "inference",
      urlAllowed: false,
      urlKind: agentEvaluation.urlKind ?? "public",
      publicExposureWarning:
        "RTX Worker URL zeigt auf eine öffentliche Adresse — nur Heimnetz/private IP nutzen (RTX_BASE_URL).",
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

export { isRtxWorkerConfigured };
