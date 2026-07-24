/**
 * Deployment / routing / security configuration that the owner can edit from the
 * website instead of hand-editing the host `.env`.
 *
 * The values are stored in the `system_settings` JSON row (the `deployment` group)
 * and layered on top of `process.env` — env stays the fallback, exactly like the
 * storage-path and SMTP settings. On save (and at server boot) the resolved overrides
 * are installed into `@uwe/auth` via {@link applyDeploymentRuntimeOverrides} so every
 * Node server context observes them immediately.
 *
 * Effectiveness caveat: the Next.js middleware runs in the Edge runtime and never loads
 * the database, so its checks (auth login-gate, cross-origin host allow-list, portal
 * sub-path passthrough) keep reading the raw `.env`. Those specific effects require an
 * actual env change on the host. Everything server-rendered — login/Turnstile, session
 * cookie flags, link generation, player-preview access — picks up the DB overrides live.
 */

import { setRuntimeEnvOverrides } from "@uwe/auth";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

/** Tri-state override: `env` = inherit from the host environment, otherwise force on/off. */
export type DeploymentOverride = "env" | "on" | "off";

/**
 * How the owner-only Brain surface may be reached. Brain always enforces the
 * global `owner` role server-side; this setting only decides the origin it is
 * served under.
 *   - `loopback` — only from the host itself (127.0.0.1). The safe default.
 *   - `lan`      — reachable from the local network after explicit owner opt-in.
 *   - `public`   — published under its own origin through the owner-gated
 *                  reverse proxy / Cloudflare tunnel. Brain still binds to
 *                  loopback; the connector runs on the host.
 *   - `off`      — Brain entry disabled entirely.
 */
export type BrainExposure = "loopback" | "lan" | "public" | "off";

export interface DeploymentSettings {
  /** PUBLIC_BASE_URL / PUBLIC_APP_URL — "" inherits from env. */
  publicAppUrl: string;
  /** NEXT_PUBLIC_STUDIO_URL — "" inherits from env. */
  studioUrl: string;
  /** NEXT_PUBLIC_PORTAL_URL — "" inherits from env. */
  portalUrl: string;
  /** STUDIO_PATH — "" inherits from env. */
  studioPath: string;
  /** PORTAL_PATH — "" inherits from env. */
  portalPath: string;
  /** TRUST_PROXY */
  trustProxy: DeploymentOverride;
  /** CLOUDFLARE_TUNNEL */
  cloudflareTunnel: DeploymentOverride;
  /** AUTH_REQUIRED — the login-gate is enforced by the Edge middleware from env. */
  authRequired: DeploymentOverride;
  /** SESSION_COOKIE_SECURE */
  sessionCookieSecure: DeploymentOverride;
  /** PLAYER_PREVIEW_PUBLIC */
  playerPreviewPublic: DeploymentOverride;
  /** TURNSTILE_ENABLED kill-switch (keys are still required to actually enforce). */
  turnstileEnabled: DeploymentOverride;
  /** TURNSTILE_SITE_KEY — public widget key (not a secret), "" inherits from env. */
  turnstileSiteKey: string;
  /** True when a Turnstile secret is stored in the database (never the value itself). */
  turnstileSecretConfigured: boolean;
  /** Encrypted Turnstile secret — server-only, stripped before reaching clients. */
  turnstileSecretEnc?: string | null;
  /** NEXT_PUBLIC_BRAIN_URL — owner-only Brain origin; "" = share the Studio origin. */
  brainUrl: string;
  /** BRAIN_PATH — entry path into the Brain surface; "" = default `/life-brain`. */
  brainPath: string;
  /** Brain reachability — see {@link BrainExposure}. Default `loopback`. */
  brainExposure: BrainExposure;
}

/** Form/API shape for a deployment settings change. */
export interface DeploymentSettingsInput {
  publicAppUrl?: string;
  studioUrl?: string;
  portalUrl?: string;
  studioPath?: string;
  portalPath?: string;
  trustProxy?: DeploymentOverride;
  cloudflareTunnel?: DeploymentOverride;
  authRequired?: DeploymentOverride;
  sessionCookieSecure?: DeploymentOverride;
  playerPreviewPublic?: DeploymentOverride;
  turnstileEnabled?: DeploymentOverride;
  turnstileSiteKey?: string;
  /** New plaintext Turnstile secret; empty/undefined keeps the existing stored secret. */
  turnstileSecret?: string;
  /** When true, removes the stored Turnstile secret (falls back to env). */
  clearTurnstileSecret?: boolean;
  brainUrl?: string;
  brainPath?: string;
  brainExposure?: BrainExposure;
}

export const DEFAULT_DEPLOYMENT_SETTINGS: DeploymentSettings = {
  publicAppUrl: "",
  studioUrl: "",
  portalUrl: "",
  studioPath: "",
  portalPath: "",
  trustProxy: "env",
  cloudflareTunnel: "env",
  authRequired: "env",
  sessionCookieSecure: "env",
  playerPreviewPublic: "env",
  turnstileEnabled: "env",
  turnstileSiteKey: "",
  turnstileSecretConfigured: false,
  turnstileSecretEnc: null,
  brainUrl: "",
  brainPath: "",
  brainExposure: "loopback",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOverride(value: unknown): DeploymentOverride {
  return value === "on" || value === "off" ? value : "env";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Coerces an untrusted value into a valid {@link BrainExposure}; default `loopback`.
 *  Anything unrecognised (e.g. a stray "on") collapses to `loopback`. */
function normalizeBrainExposure(value: unknown): BrainExposure {
  return value === "lan" || value === "public" || value === "off" ? value : "loopback";
}

/** Coerces an untrusted stored/merged value into a valid {@link DeploymentSettings}. */
export function normalizeDeploymentSettings(raw: unknown): DeploymentSettings {
  const stored = isRecord(raw) ? raw : {};
  const secretEnc = typeof stored.turnstileSecretEnc === "string" && stored.turnstileSecretEnc
    ? stored.turnstileSecretEnc
    : null;

  return {
    publicAppUrl: normalizeString(stored.publicAppUrl),
    studioUrl: normalizeString(stored.studioUrl),
    portalUrl: normalizeString(stored.portalUrl),
    studioPath: normalizeString(stored.studioPath),
    portalPath: normalizeString(stored.portalPath),
    trustProxy: normalizeOverride(stored.trustProxy),
    cloudflareTunnel: normalizeOverride(stored.cloudflareTunnel),
    authRequired: normalizeOverride(stored.authRequired),
    sessionCookieSecure: normalizeOverride(stored.sessionCookieSecure),
    playerPreviewPublic: normalizeOverride(stored.playerPreviewPublic),
    turnstileEnabled: normalizeOverride(stored.turnstileEnabled),
    turnstileSiteKey: normalizeString(stored.turnstileSiteKey),
    turnstileSecretConfigured: Boolean(secretEnc),
    turnstileSecretEnc: secretEnc,
    brainUrl: normalizeString(stored.brainUrl),
    brainPath: normalizeString(stored.brainPath),
    brainExposure: normalizeBrainExposure(stored.brainExposure),
  };
}

/** Removes the encrypted secret before the settings are sent to a browser client. */
export function sanitizeDeploymentSettingsForClient(settings: DeploymentSettings): DeploymentSettings {
  return { ...settings, turnstileSecretEnc: undefined };
}

/**
 * Merges a validated form input over the existing settings, encrypting a newly supplied
 * Turnstile secret and preserving the stored one when the field is left blank.
 */
export function buildDeploymentSettingsUpdate(
  input: DeploymentSettingsInput,
  existing: DeploymentSettings = DEFAULT_DEPLOYMENT_SETTINGS,
): DeploymentSettings {
  let turnstileSecretEnc = existing.turnstileSecretEnc ?? null;
  if (input.clearTurnstileSecret) {
    turnstileSecretEnc = null;
  } else {
    const secret = input.turnstileSecret?.trim();
    if (secret) {
      turnstileSecretEnc = encryptSecret(secret, resolveTokenEncryptionSecret());
    }
  }

  return normalizeDeploymentSettings({
    publicAppUrl: input.publicAppUrl ?? existing.publicAppUrl,
    studioUrl: input.studioUrl ?? existing.studioUrl,
    portalUrl: input.portalUrl ?? existing.portalUrl,
    studioPath: input.studioPath ?? existing.studioPath,
    portalPath: input.portalPath ?? existing.portalPath,
    trustProxy: input.trustProxy ?? existing.trustProxy,
    cloudflareTunnel: input.cloudflareTunnel ?? existing.cloudflareTunnel,
    authRequired: input.authRequired ?? existing.authRequired,
    sessionCookieSecure: input.sessionCookieSecure ?? existing.sessionCookieSecure,
    playerPreviewPublic: input.playerPreviewPublic ?? existing.playerPreviewPublic,
    turnstileEnabled: input.turnstileEnabled ?? existing.turnstileEnabled,
    turnstileSiteKey: input.turnstileSiteKey ?? existing.turnstileSiteKey,
    turnstileSecretEnc,
    brainUrl: input.brainUrl ?? existing.brainUrl,
    brainPath: input.brainPath ?? existing.brainPath,
    brainExposure: input.brainExposure ?? existing.brainExposure,
  });
}

function overrideToEnv(value: DeploymentOverride): string | undefined {
  if (value === "on") return "true";
  if (value === "off") return "false";
  return undefined;
}

/**
 * Resolves the stored settings into the effective `KEY=value` env overrides. Only keys
 * the owner has explicitly set are included, so anything left on `env`/"" transparently
 * falls through to the host environment.
 */
export function buildDeploymentEnvOverrides(settings: DeploymentSettings): Record<string, string> {
  const out: Record<string, string> = {};

  const setString = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  };
  const setBool = (key: string, value: DeploymentOverride) => {
    const resolved = overrideToEnv(value);
    if (resolved !== undefined) out[key] = resolved;
  };

  setString("PUBLIC_BASE_URL", settings.publicAppUrl);
  setString("NEXT_PUBLIC_STUDIO_URL", settings.studioUrl);
  setString("NEXT_PUBLIC_PORTAL_URL", settings.portalUrl);
  setString("STUDIO_PATH", settings.studioPath);
  setString("PORTAL_PATH", settings.portalPath);
  setBool("TRUST_PROXY", settings.trustProxy);
  setBool("CLOUDFLARE_TUNNEL", settings.cloudflareTunnel);
  setBool("AUTH_REQUIRED", settings.authRequired);
  setBool("SESSION_COOKIE_SECURE", settings.sessionCookieSecure);
  setBool("PLAYER_PREVIEW_PUBLIC", settings.playerPreviewPublic);
  setBool("TURNSTILE_ENABLED", settings.turnstileEnabled);
  setString("TURNSTILE_SITE_KEY", settings.turnstileSiteKey);

  // Brain is owner-only — see ADR 004/007. We surface the origin, entry path
  // and exposure for the Studio link + host scripts, but deliberately never
  // emit a tunnel key: publishing Brain stays a separate, deliberate proxy
  // decision. Only a deviation from the safe `loopback` default is emitted
  // (matching the "explicitly set keys only" contract, so defaults still fall
  // through to env).
  setString("NEXT_PUBLIC_BRAIN_URL", settings.brainUrl);
  setString("BRAIN_PATH", settings.brainPath);
  if (settings.brainExposure !== "loopback") {
    out.BRAIN_EXPOSURE = settings.brainExposure;
  }

  if (settings.turnstileSecretEnc) {
    try {
      const secret = decryptSecret(settings.turnstileSecretEnc, resolveTokenEncryptionSecret());
      if (secret) out.TURNSTILE_SECRET_KEY = secret;
    } catch {
      // A secret encrypted under a different key can't be recovered — fall back to env.
    }
  }

  return out;
}

/** Installs the resolved overrides into the shared `@uwe/auth` runtime-config layer. */
export function applyDeploymentRuntimeOverrides(settings: DeploymentSettings): void {
  setRuntimeEnvOverrides(buildDeploymentEnvOverrides(settings));
}
