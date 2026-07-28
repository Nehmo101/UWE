import {
  getUweRuntimeConfig,
  isProductionEnv,
  isRequestSecure,
  type RequestLikeForCookieOptions,
} from "./runtime-config";
import { TURNSTILE_SCRIPT_ORIGIN, isTurnstileEnabled } from "./turnstile";

export interface SecurityHeaderOptions {
  /**
   * Allow YouTube soundboard embeds (Studio + Portal soundboard UI).
   * Restricted to youtube.com / youtube-nocookie.com — no wildcard hosts.
   */
  allowYouTubeEmbeds?: boolean;
  /**
   * Allow same-origin microphone access (Brain assistant dictation only).
   * Without this the default `microphone=()` blocks both `getUserMedia({audio})`
   * and the Web Speech API. Scoped to `'self'` — never a wildcard, and `camera`
   * stays denied on every surface.
   */
  allowMicrophone?: boolean;
}

export interface SecurityHeader {
  key: string;
  value: string;
}

const STRICT_TRANSPORT_SECURITY_VALUE = "max-age=31536000; includeSubDomains";

/**
 * Builds a strict Content-Security-Policy for UWE.
 *
 * Next.js App Router may inject inline scripts/styles for hydration and HMR.
 * We allow `'unsafe-inline'` only for script-src and style-src in production
 * because UWE does not use a nonce pipeline yet. All other directives stay
 * tight; external script CDNs are not used.
 *
 * When the Cloudflare Turnstile human-check is enabled, the Cloudflare
 * `challenges.cloudflare.com` origin is added to `script-src`, `connect-src`
 * and `frame-src` so the widget can load and render. Without it the strict CSP
 * would block the "Verify you are human" box on the login form.
 */
export function buildContentSecurityPolicy(
  options: SecurityHeaderOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  const turnstileEnabled = isTurnstileEnabled(env);

  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (!isProductionEnv(env)) {
    scriptSrc.push("'unsafe-eval'");
  }
  if (turnstileEnabled) {
    scriptSrc.push(TURNSTILE_SCRIPT_ORIGIN);
  }

  const connectSrc = ["'self'"];
  if (turnstileEnabled) {
    connectSrc.push(TURNSTILE_SCRIPT_ORIGIN);
  }

  // 'self' permits Studio and Portal to embed the same-origin Terra map editor
  // (/terra/index.html) in an <iframe>. Load-bearing, not decorative: removing
  // it leaves the Terra frame blank. Same-origin only — no external hosts
  // beyond the explicit YouTube/Turnstile opt-ins below.
  const frameSrc: string[] = ["'self'"];
  if (options.allowYouTubeEmbeds) {
    frameSrc.push("https://www.youtube.com", "https://www.youtube-nocookie.com");
  }
  if (turnstileEnabled) {
    frameSrc.push(TURNSTILE_SCRIPT_ORIGIN);
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // 'self' allows same-origin framing (Studio/Portal → /terra/index.html);
    // still blocks cross-origin clickjacking. Paired with X-Frame-Options:
    // SAMEORIGIN. Required by the Terra editor frame — do not tighten to 'none'.
    "frame-ancestors 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    frameSrc.length > 0 ? `frame-src ${frameSrc.join(" ")}` : "frame-src 'none'",
  ];

  return directives.join("; ");
}

/**
 * Whether the deployment is configured for HTTPS (public URL or secure cookies).
 * HSTS must still only be sent on actually secure requests — see
 * shouldSendStrictTransportSecurityForRequest.
 */
export function wantsStrictTransportSecurity(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isProductionEnv(env)) {
    return false;
  }

  const config = getUweRuntimeConfig(env);
  return config.sessionCookieSecure || (config.publicAppUrl?.startsWith("https://") ?? false);
}

/**
 * Send HSTS only when the incoming request is HTTPS (directly or via trusted proxy).
 * Without this, production hosts with PUBLIC_APP_URL=https://… still serve plain HTTP
 * on LAN IPs; browsers cache HSTS for that host and upgrade login POSTs to HTTPS,
 * which fails on self-hosted HTTP and surfaces as "Verbindung zum Server fehlgeschlagen".
 */
export function shouldSendStrictTransportSecurityForRequest(
  request: RequestLikeForCookieOptions,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return wantsStrictTransportSecurity(env) && isRequestSecure(request, env);
}

/**
 * Permissions-Policy value. Everything stays denied by default; only the Brain
 * assistant opts into same-origin microphone access for local dictation.
 */
export function buildPermissionsPolicy(options: SecurityHeaderOptions = {}): string {
  const microphone = options.allowMicrophone ? "microphone=(self)" : "microphone=()";
  return [
    "camera=()",
    microphone,
    "geolocation=()",
    "payment=()",
    "usb=()",
    "interest-cohort=()",
  ].join(", ");
}

export function getUweSecurityHeaders(
  env: NodeJS.ProcessEnv = process.env,
  options: SecurityHeaderOptions = { allowYouTubeEmbeds: true },
  request?: RequestLikeForCookieOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildContentSecurityPolicy(options, env),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // SAMEORIGIN (not DENY) so Studio and Portal can iframe the same-origin
    // Terra map editor (/terra/index.html); cross-origin framing stays blocked
    // (mirrors frame-ancestors 'self'). DENY would blank the frame.
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": buildPermissionsPolicy(options),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  if (request && shouldSendStrictTransportSecurityForRequest(request, env)) {
    headers["Strict-Transport-Security"] = STRICT_TRANSPORT_SECURITY_VALUE;
  }

  return headers;
}

export function getUweSecurityHeaderEntries(
  env: NodeJS.ProcessEnv = process.env,
  options: SecurityHeaderOptions = { allowYouTubeEmbeds: true },
): SecurityHeader[] {
  return Object.entries(getUweSecurityHeaders(env, options)).map(([key, value]) => ({
    key,
    value,
  }));
}

export function applySecurityHeaders<T extends Response>(
  response: T,
  env: NodeJS.ProcessEnv = process.env,
  options: SecurityHeaderOptions = { allowYouTubeEmbeds: true },
  request?: RequestLikeForCookieOptions,
): T {
  for (const [key, value] of Object.entries(getUweSecurityHeaders(env, options, request))) {
    response.headers.set(key, value);
  }
  return response;
}
