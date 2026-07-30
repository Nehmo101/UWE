/**
 * Environment-driven configuration for the four UWE MCP servers.
 *
 * Every server is a thin HTTP client in front of a running UWE app, so all
 * existing route guards, RBAC checks and audit logging stay on the request path
 * (see docs/engineering/mcp-servers.md § Warum HTTP statt Direktzugriff).
 */

export type McpSurface = "studio" | "portal" | "brain" | "family";

export interface SurfaceEndpoint {
  /** Origin without trailing slash, e.g. `http://127.0.0.1:3000`. */
  baseUrl: string;
  /** `uwe_…` API token or STUDIO_API_TOKEN; null when unauthenticated. */
  token: string | null;
  /** Human label used in error messages — never contains the token. */
  label: string;
}

export interface McpConfig {
  surface: McpSurface;
  /** The app this server represents (health, liveness, app-owned routes). */
  primary: SurfaceEndpoint;
  /**
   * Where the *content* API for this surface lives. Studio serves its own.
   * Brain and Portal do not: `apps/brain` only exposes `/api/health`, and the
   * Portal's content routes are session-cookie-only. Both therefore read through
   * Studio — Brain via `/api/life-brain/*`, Portal via Studio's player-preview
   * parameters (`accessContext=portal`, `preview=player`), which run the same
   * `permissions.ts` filtering a player would get.
   */
  dataApi: SurfaceEndpoint;
  /** Mutating tools are registered only when true (UWE_MCP_ALLOW_WRITES). */
  allowWrites: boolean;
  /** Personal-brain *content* leaves the host only when true. Default: false. */
  brainAllowContent: boolean;
  timeoutMs: number;
  /** Tool output is truncated at this length to protect the context window. */
  maxResponseChars: number;
}

const DEFAULT_ORIGINS: Record<McpSurface, string> = {
  studio: "http://127.0.0.1:3000",
  portal: "http://127.0.0.1:3001",
  brain: "http://127.0.0.1:3002",
  family: "http://127.0.0.1:3004",
};

const SURFACE_LABELS: Record<McpSurface, string> = {
  studio: "UWE Studio",
  portal: "UWE Portal",
  brain: "UWE Brain",
  family: "UWE Family",
};

function firstValue(env: NodeJS.ProcessEnv, keys: string[]): string | null {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

/** Normalizes an origin and rejects anything that is not plain http(s). */
export function normalizeBaseUrl(value: string, fallback: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fallback;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fallback;
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function readBoolean(env: NodeJS.ProcessEnv, key: string): boolean {
  return env[key]?.trim().toLowerCase() === "true";
}

function readPositiveInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = Number.parseInt(env[key]?.trim() ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function resolveEndpoint(
  env: NodeJS.ProcessEnv,
  surface: McpSurface,
  urlKeys: string[],
  tokenKeys: string[],
): SurfaceEndpoint {
  const fallback = DEFAULT_ORIGINS[surface];
  const configured = firstValue(env, urlKeys);
  return {
    baseUrl: configured ? normalizeBaseUrl(configured, fallback) : fallback,
    token: firstValue(env, tokenKeys),
    label: SURFACE_LABELS[surface],
  };
}

function studioEndpoint(env: NodeJS.ProcessEnv): SurfaceEndpoint {
  return resolveEndpoint(
    env,
    "studio",
    ["UWE_STUDIO_URL", "NEXT_PUBLIC_STUDIO_URL"],
    ["UWE_STUDIO_TOKEN", "UWE_MCP_TOKEN", "STUDIO_API_TOKEN"],
  );
}

export function loadConfig(surface: McpSurface, env: NodeJS.ProcessEnv = process.env): McpConfig {
  const shared = {
    surface,
    allowWrites: readBoolean(env, "UWE_MCP_ALLOW_WRITES"),
    brainAllowContent: readBoolean(env, "UWE_MCP_BRAIN_ALLOW_CONTENT"),
    timeoutMs: readPositiveInt(env, "UWE_MCP_TIMEOUT_MS", 20_000),
    maxResponseChars: readPositiveInt(env, "UWE_MCP_MAX_RESPONSE_CHARS", 20_000),
  };

  if (surface === "studio") {
    const studio = studioEndpoint(env);
    return { ...shared, primary: studio, dataApi: studio };
  }

  if (surface === "portal") {
    const portal = resolveEndpoint(
      env,
      "portal",
      ["UWE_PORTAL_URL", "NEXT_PUBLIC_PORTAL_URL"],
      ["UWE_PORTAL_TOKEN", "UWE_MCP_TOKEN"],
    );
    return { ...shared, primary: portal, dataApi: studioEndpoint(env) };
  }

  if (surface === "family") {
    // Family serves its own `/api/v1/*`, deshalb ist `dataApi` derselbe Origin
    // wie `primary` — nicht Studio.
    const family = resolveEndpoint(
      env,
      "family",
      ["UWE_FAMILY_URL", "NEXT_PUBLIC_FAMILY_URL"],
      ["UWE_FAMILY_TOKEN", "UWE_MCP_TOKEN"],
    );
    return { ...shared, primary: family, dataApi: family };
  }

  // Brain serves its own `/api/life-brain/*` since Abschnitt H2 — `dataApi` is
  // the same origin as `primary`, not Studio's.
  const brain = resolveEndpoint(
    env,
    "brain",
    ["UWE_BRAIN_URL", "NEXT_PUBLIC_BRAIN_URL"],
    ["UWE_BRAIN_TOKEN", "UWE_MCP_TOKEN"],
  );
  return { ...shared, primary: brain, dataApi: brain };
}

/** True for loopback origins — used to warn about tokenless remote access. */
export function isLoopbackOrigin(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

/** Startup warnings written to stderr; never includes token material. */
export function configWarnings(config: McpConfig): string[] {
  const warnings: string[] = [];

  for (const endpoint of new Set([config.primary, config.dataApi])) {
    if (endpoint.token) {
      continue;
    }
    warnings.push(
      isLoopbackOrigin(endpoint.baseUrl)
        ? `${endpoint.label} (${endpoint.baseUrl}) ohne API-Token — geschützte Routen antworten 401, sobald AUTH_REQUIRED=true ist.`
        : `${endpoint.label} (${endpoint.baseUrl}) ist nicht loopback und es ist kein API-Token gesetzt — geschützte Routen werden 401 liefern.`,
    );
  }

  if (config.allowWrites) {
    warnings.push("UWE_MCP_ALLOW_WRITES=true — schreibende Tools sind aktiv.");
  }

  if (config.surface === "brain" && config.brainAllowContent) {
    warnings.push(
      "UWE_MCP_BRAIN_ALLOW_CONTENT=true — Personal-Brain-Inhalte verlassen den Host Richtung Cloud-AI.",
    );
  }

  return warnings;
}
