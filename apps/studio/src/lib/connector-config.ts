import {
  CONNECTOR_CAPABILITIES,
  CONNECTOR_JOB_TYPES,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_POLL_INTERVAL_MS,
} from "@uwe/connector";

/**
 * Host-side connector policy. This is the only configuration a connector is
 * allowed to read — it contains no world, brain, user or admin data, just the
 * operating parameters for the worker loop.
 */
export interface HostConnectorConfig {
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  /** Host-wide kill switch. When false, connectors should stop claiming jobs. */
  queueEnabled: boolean;
  /** Host-wide kill switch for the process-local direct transport. */
  directEnabled: boolean;
  /** Whether the host permits cloud AI fallback when local LLMs are unavailable. */
  cloudFallbackAllowed: boolean;
  capabilities: readonly string[];
  jobTypes: readonly string[];
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveHostConnectorConfig(
  env: NodeJS.ProcessEnv = process.env,
): HostConnectorConfig {
  return {
    pollIntervalMs: parsePositiveInt(env.UWE_HOST_CONNECTOR_POLL_MS, DEFAULT_POLL_INTERVAL_MS),
    heartbeatIntervalMs: parsePositiveInt(
      env.UWE_HOST_CONNECTOR_HEARTBEAT_MS,
      DEFAULT_HEARTBEAT_INTERVAL_MS,
    ),
    queueEnabled: env.UWE_HOST_QUEUE_DISABLED?.trim().toLowerCase() !== "true",
    directEnabled: env.UWE_HOST_CONNECTOR_DIRECT_DISABLED?.trim().toLowerCase() !== "true",
    cloudFallbackAllowed: env.UWE_AI_CLOUD_FALLBACK?.trim().toLowerCase() === "true",
    capabilities: CONNECTOR_CAPABILITIES,
    jobTypes: CONNECTOR_JOB_TYPES,
  };
}
