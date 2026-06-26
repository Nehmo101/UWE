/**
 * UWE runtime roles.
 *
 *   host           → always-on instance (website, studio, portal, db, queue).
 *                    Source of truth. Must boot and serve without any connector.
 *   rtx-connector  → optional local worker on the RTX PC. Connects OUTBOUND to
 *                    the host, claims jobs, runs local AI / audio / spotify.
 *
 * The connector is never required for the host to be online.
 */

import { normalizeCapabilities, type ConnectorCapability } from "./capabilities";

export const UWE_RUNTIME_ROLES = ["host", "rtx-connector"] as const;
export type UweRuntimeRole = (typeof UWE_RUNTIME_ROLES)[number];

export const DEFAULT_RUNTIME_ROLE: UweRuntimeRole = "host";

export function resolveRuntimeRole(env: NodeJS.ProcessEnv = process.env): UweRuntimeRole {
  const raw = env.UWE_RUNTIME_ROLE?.trim().toLowerCase();
  if (raw === "rtx-connector" || raw === "connector" || raw === "rtx_connector") {
    return "rtx-connector";
  }
  return DEFAULT_RUNTIME_ROLE;
}

export function isHostRole(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveRuntimeRole(env) === "host";
}

export function isConnectorRole(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveRuntimeRole(env) === "rtx-connector";
}

export const DEFAULT_POLL_INTERVAL_MS = 2000;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

export interface ConnectorRuntimeConfig {
  hostUrl: string;
  token: string;
  name: string;
  queueEnabled: boolean;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  /** Capabilities forced via env. Empty → auto-detect at runtime. */
  forcedCapabilities: ConnectorCapability[];
}

export interface ConnectorRuntimeConfigError {
  ok: false;
  reason: string;
}

export interface ConnectorRuntimeConfigOk {
  ok: true;
  config: ConnectorRuntimeConfig;
}

export type ConnectorRuntimeConfigResult = ConnectorRuntimeConfigOk | ConnectorRuntimeConfigError;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Resolve the connector-side runtime config from the environment. Used by the
 * RTX Host Connector process; the host never calls this.
 */
export function resolveConnectorRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): ConnectorRuntimeConfigResult {
  const hostUrl = env.UWE_HOST_URL?.trim();
  if (!hostUrl) {
    return { ok: false, reason: "UWE_HOST_URL fehlt — die Adresse des UWE Hosts ist erforderlich." };
  }

  let parsedHost: URL;
  try {
    parsedHost = new URL(hostUrl);
  } catch {
    return { ok: false, reason: `UWE_HOST_URL ist keine gültige URL: ${hostUrl}` };
  }
  if (parsedHost.protocol !== "http:" && parsedHost.protocol !== "https:") {
    return { ok: false, reason: "UWE_HOST_URL muss http:// oder https:// verwenden." };
  }

  const token = env.UWE_CONNECTOR_TOKEN?.trim();
  if (!token) {
    return { ok: false, reason: "UWE_CONNECTOR_TOKEN fehlt — am Host erzeugen und hier eintragen." };
  }

  const name = env.UWE_CONNECTOR_NAME?.trim() || "RTX Host Connector";
  const queueEnabled = env.UWE_CONNECTOR_QUEUE_ENABLED?.trim().toLowerCase() !== "false";
  const forcedCapabilities = normalizeCapabilities(
    (env.UWE_CONNECTOR_CAPABILITIES?.trim() ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  return {
    ok: true,
    config: {
      hostUrl: hostUrl.replace(/\/$/, ""),
      token,
      name,
      queueEnabled,
      pollIntervalMs: parsePositiveInt(env.UWE_CONNECTOR_POLL_MS, DEFAULT_POLL_INTERVAL_MS),
      heartbeatIntervalMs: parsePositiveInt(
        env.UWE_CONNECTOR_HEARTBEAT_MS,
        DEFAULT_HEARTBEAT_INTERVAL_MS,
      ),
      forcedCapabilities,
    },
  };
}
