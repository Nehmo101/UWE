import { getUweRuntimeConfig, isProductionEnv } from "./runtime-config";

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
): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline'",
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

function shouldSendStrictTransportSecurity(env: NodeJS.ProcessEnv): boolean {
  if (!isProductionEnv(env)) {
    return false;
  }

  const config = getUweRuntimeConfig(env);
  return config.sessionCookieSecure || (config.publicAppUrl?.startsWith("https://") ?? false);
}

export function getUweSecurityHeaders(
  env: NodeJS.ProcessEnv = process.env,
  options: SecurityHeaderOptions = { allowYouTubeEmbeds: true },
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildContentSecurityPolicy(options),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  if (shouldSendStrictTransportSecurity(env)) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
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
): T {
  for (const [key, value] of Object.entries(getUweSecurityHeaders(env, options))) {
    response.headers.set(key, value);
  }
  return response;
}
