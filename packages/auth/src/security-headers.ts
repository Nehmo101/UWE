import {
  getUweRuntimeConfig,
  isProductionEnv,
  isRequestSecure,
  type RequestLikeForCookieOptions,
} from "./runtime-config";

export interface SecurityHeaderOptions {
  /**
   * Allow YouTube soundboard embeds (Studio + Portal soundboard UI).
   * Restricted to youtube.com / youtube-nocookie.com — no wildcard hosts.
   */
  allowYouTubeEmbeds?: boolean;
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
 */
export function buildContentSecurityPolicy(
  options: SecurityHeaderOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  const scriptSrc = isProductionEnv(env)
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
  ];

  if (options.allowYouTubeEmbeds) {
    directives.push(
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    );
  } else {
    directives.push("frame-src 'none'");
  }

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

export function getUweSecurityHeaders(
  env: NodeJS.ProcessEnv = process.env,
  options: SecurityHeaderOptions = { allowYouTubeEmbeds: true },
  request?: RequestLikeForCookieOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildContentSecurityPolicy(options, env),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
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
