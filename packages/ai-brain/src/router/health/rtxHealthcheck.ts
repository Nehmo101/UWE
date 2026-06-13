import { getInferenceStatus } from "../../inference";
import { resolveInferenceConfig } from "../../inference-config";
import { fetchRtxAgentHealth } from "../../rtx-agent-client";
import {
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
}

export async function checkRtxHealth(options?: {
  useMock?: boolean;
}): Promise<RtxHealthStatus> {
  const agentConfig = resolveRtxAgentConfig();

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
  };
}

export async function isRtxReady(options?: { useMock?: boolean }): Promise<boolean> {
  const health = await checkRtxHealth(options);
  return health.ready;
}

export { isRtxAgentConfigured };
