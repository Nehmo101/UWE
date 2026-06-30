/**
 * Cloudflare Turnstile — the "Verify you are human" check shown before entering UWE.
 *
 * A Turnstile widget renders on the Studio and Portal login forms; the login API
 * routes verify the resulting token server-side (against Cloudflare's siteverify
 * endpoint) before authenticating. This is the application-level complement to a
 * Cloudflare edge Managed Challenge (see docs/cloudflare-current-setup.md) and
 * works regardless of whether UWE sits behind a Cloudflare Tunnel.
 *
 * The feature is fully opt-in: when no keys are configured every helper is a
 * no-op, so local development and self-hosters without Cloudflare keep working
 * unchanged. No secret value is ever exposed to the client — only the public
 * site key is surfaced.
 *
 * Cloudflare-provided test keys (safe for dev/tests, never use in production):
 *   site key   always passes      : 1x00000000000000000000AA
 *   site key   always blocks      : 2x00000000000000000000AB
 *   site key   forces challenge   : 3x00000000000000000000FF
 *   secret key always passes      : 1x0000000000000000000000000000000AA
 *   secret key always fails       : 2x0000000000000000000000000000000AA
 */

/** Origin that serves the Turnstile widget script and challenge iframe (for CSP). */
export const TURNSTILE_SCRIPT_ORIGIN = "https://challenges.cloudflare.com";

/** Explicit-render widget script URL. */
export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Server-side token verification endpoint. */
export const TURNSTILE_VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileConfig {
  /** True when the human-check should be enforced (keys present and not disabled). */
  enabled: boolean;
  /** Public site key for the browser widget — never a secret. */
  siteKey: string | null;
  /** Whether a secret key is configured for server-side verification. */
  secretConfigured: boolean;
}

export interface TurnstileVerifyResult {
  /** Whether the token is a valid, fresh human-verification proof. */
  success: boolean;
  /** Cloudflare error-codes (e.g. "invalid-input-response", "timeout-or-duplicate"). */
  errorCodes: string[];
  /** True when verification was skipped because the feature is disabled. */
  skipped: boolean;
}

export interface VerifyTurnstileOptions {
  /** Client IP for Cloudflare's optional remoteip check. */
  remoteIp?: string | null;
  env?: NodeJS.ProcessEnv;
  /** Injectable fetch for testing. */
  fetchImpl?: typeof fetch;
  /** Network timeout in ms (default 8000). */
  timeoutMs?: number;
}

interface TurnstileSiteVerifyResponse {
  success?: boolean;
  "error-codes"?: string[];
}

function parseBoolFlag(value: string | undefined): boolean | null {
  if (value === undefined) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "") {
    return null;
  }
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
}

/**
 * Resolves Turnstile configuration from the environment.
 *
 * Enabled when both keys are present, unless `TURNSTILE_ENABLED` is explicitly
 * falsy (kill-switch). Keys cannot be conjured from an explicit `true` — without
 * a site and secret key the check cannot run, so it stays disabled.
 */
export function getTurnstileConfig(env: NodeJS.ProcessEnv = process.env): TurnstileConfig {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim() || null;
  const secretConfigured = Boolean(env.TURNSTILE_SECRET_KEY?.trim());
  const explicit = parseBoolFlag(env.TURNSTILE_ENABLED);
  const hasKeys = Boolean(siteKey) && secretConfigured;

  return {
    enabled: explicit === false ? false : hasKeys,
    siteKey,
    secretConfigured,
  };
}

export function isTurnstileEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getTurnstileConfig(env).enabled;
}

/**
 * Verifies a Turnstile token against Cloudflare. Returns `{ success: true, skipped: true }`
 * when the feature is disabled so callers can use it unconditionally. A failed
 * verification (missing/invalid token, network/timeout error) returns
 * `success: false` and never throws.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  options: VerifyTurnstileOptions = {},
): Promise<TurnstileVerifyResult> {
  const env = options.env ?? process.env;
  const config = getTurnstileConfig(env);

  if (!config.enabled) {
    return { success: true, errorCodes: [], skipped: true };
  }

  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { success: false, errorCodes: ["missing-input-secret"], skipped: false };
  }

  const response = token?.trim();
  if (!response) {
    return { success: false, errorCodes: ["missing-input-response"], skipped: false };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { success: false, errorCodes: ["network-error"], skipped: false };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", response);
  const remoteIp = options.remoteIp?.trim();
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { success: false, errorCodes: [`http-${res.status}`], skipped: false };
    }

    const data = (await res.json()) as TurnstileSiteVerifyResponse;
    return {
      success: Boolean(data.success),
      errorCodes: Array.isArray(data["error-codes"]) ? data["error-codes"] : [],
      skipped: false,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      errorCodes: [aborted ? "timeout" : "network-error"],
      skipped: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}
