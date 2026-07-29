/**
 * UWE runtime roles.
 *
 *   host           -> always-on instance (website, studio, portal, db, queue).
 *                    Source of truth. Must boot and serve without any connector.
 *   rtx-connector  -> optional local worker on the RTX PC. Connects OUTBOUND to
 *                    the host and claims jobs for executable local backends.
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

export const CONNECTOR_TRANSPORT_MODES = ["queue", "direct", "hybrid"] as const;
export type ConnectorTransportMode = (typeof CONNECTOR_TRANSPORT_MODES)[number];

const CONNECTOR_TRANSPORT_MODE_SET = new Set<string>(CONNECTOR_TRANSPORT_MODES);

export function isConnectorTransportMode(value: unknown): value is ConnectorTransportMode {
  return typeof value === "string" && CONNECTOR_TRANSPORT_MODE_SET.has(value);
}

function isLoopbackHost(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname === "::1") {
    return true;
  }

  const octets = hostname.split(".");
  return (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.slice(1).every((octet) => /^(?:0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255)
  );
}

export interface ConnectorRuntimeConfig {
  hostUrl: string;
  token: string;
  name: string;
  transportMode: ConnectorTransportMode;
  /** Compatibility projection. Prefer `transportMode` in new code. */
  queueEnabled: boolean;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  /** Capability requests from env. Empty -> auto-detect; executable filters still apply. */
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
 * Maschinenraum process; the host never calls this.
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

  const name = env.UWE_CONNECTOR_NAME?.trim() || "UWE Maschinenraum";
  const rawTransportMode = env.UWE_CONNECTOR_TRANSPORT?.trim().toLowerCase();
  const legacyQueueDisabled = env.UWE_CONNECTOR_QUEUE_ENABLED?.trim().toLowerCase() === "false";
  const transportMode: ConnectorTransportMode = isConnectorTransportMode(rawTransportMode)
    ? rawTransportMode
    : "queue";
  const queueEnabled = rawTransportMode
    ? transportMode !== "direct"
    : !legacyQueueDisabled;
  if (parsedHost.protocol === "http:" && !isLoopbackHost(parsedHost)) {
    return {
      ok: false,
      reason: "Remote Host-URLs must use https://; http:// is allowed only for loopback.",
    };
  }
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
      transportMode,
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
