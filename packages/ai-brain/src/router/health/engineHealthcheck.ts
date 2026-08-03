import { getInferenceStatus } from "../../inference";
import { resolveInferenceConfig } from "../../inference-config";
import { sanitizeInferenceEndpointLabel, type InferenceUrlKind } from "../../inference-url-guard";
import {
  evaluateEngineWorkerUrl,
  isEngineWorkerConfigured,
  type EngineWorkerStatus,
} from "../../engine-worker-config";
import type { AiHealthCheckResult } from "../../types";

export interface EngineHealthStatus {
  online: boolean;
  ready: boolean;
  message: string;
  providerId: string;
  endpoint: string;
  defaultModel: string;
  health?: AiHealthCheckResult;
  modelCount?: number;
  /** Worker status when ENGINE_BASE_URL is configured. */
  agentStatus?: EngineWorkerStatus;
  /** Whether health was read from direct inference or connector queue. */
  source: "inference" | "connector";
  urlAllowed: boolean;
  urlKind: InferenceUrlKind | string;
  publicExposureWarning?: string;
}

export async function checkEngineHealth(options?: {
  useMock?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<EngineHealthStatus> {
  const env = options?.env ?? process.env;
  const agentEvaluation = evaluateEngineWorkerUrl(env);

  if (agentEvaluation.configured && !agentEvaluation.urlAllowed) {
    return {
      online: false,
      ready: false,
      message: agentEvaluation.blockReason ?? "Maschinenraum-Worker-URL ist öffentlich und blockiert.",
      providerId: "ollama",
      endpoint: sanitizeInferenceEndpointLabel(agentEvaluation.url ?? ""),
      defaultModel: resolveInferenceConfig().defaultModel,
      agentStatus: "error",
      source: "inference",
      urlAllowed: false,
      urlKind: agentEvaluation.urlKind ?? "public",
      publicExposureWarning:
        "Maschinenraum-Worker URL zeigt auf eine öffentliche Adresse — nur Heimnetz/private IP nutzen (ENGINE_BASE_URL).",
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
      : "AI_INFERENCE_BASE_URL zeigt auf eine öffentliche Adresse — Maschinenraum nur im Heimnetz betreiben.",
  };
}

export async function isEngineReady(options?: { useMock?: boolean }): Promise<boolean> {
  const health = await checkEngineHealth(options);
  return health.ready;
}

export { isEngineWorkerConfigured };
