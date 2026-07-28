import { getUweRuntimeConfig, resolveUweAppUrls } from "@uwe/auth";

/** Relying-party identity used for every WebAuthn ceremony. */
export interface WebAuthnRelyingParty {
  /**
   * The RP ID a passkey is permanently bound to. In split-hostname
   * deployments this must be the registrable parent domain (e.g.
   * `uwe.example`) so one passkey works on the `studio.`, `portal.`
   * and `brain.` subdomains alike.
   */
  rpId: string;
  rpName: string;
  /** Origins accepted during verification (Studio/Portal/Brain public origins). */
  origins: string[];
}

const RP_NAME = "UWE";

function originOf(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** WebAuthn forbids IP-address RP IDs (Chrome rejects them outright). */
function isIpHostname(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

/**
 * Derives the browser-facing origin of a request: the `Origin` header when
 * present (all WebAuthn POSTs send it), else `Host` + forwarded proto. Needed
 * in the `local` deployment model, where no public URL is configured and the
 * RP ID must match whatever host the browser is actually using (`localhost`
 * vs `127.0.0.1` — Chrome rejects IP-address RP IDs, so the two differ).
 */
export function deriveRequestOrigin(request: Request): string | null {
  const originHeader = request.headers.get("origin");
  const fromHeader = originOf(originHeader);
  if (fromHeader) {
    return fromHeader;
  }

  const host = request.headers.get("host");
  if (!host) {
    return null;
  }
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return originOf(`${proto}://${host}`);
}

/**
 * Resolves the WebAuthn relying party from the deployment configuration:
 *
 * - `split-hostname`: RP ID = registrable parent domain from
 *   `SESSION_COOKIE_DOMAIN` (the existing cross-subdomain decision), falling
 *   back to the Studio hostname when unset.
 * - `unified-path`: RP ID = hostname of the public base URL.
 * - `local`: RP ID = hostname the request actually came in on.
 */
export function resolveWebAuthnRelyingParty(
  options: { requestOrigin?: string | null; env?: NodeJS.ProcessEnv } = {},
): WebAuthnRelyingParty {
  const env = options.env ?? process.env;
  const urls = resolveUweAppUrls(env);
  const requestOrigin = originOf(options.requestOrigin);

  const origins = new Set<string>();
  for (const candidate of [urls.publicBaseUrl, urls.studioUrl, urls.portalUrl, urls.brainUrl]) {
    const origin = originOf(candidate);
    if (origin) {
      origins.add(origin);
    }
  }

  if (urls.deploymentModel === "local") {
    if (requestOrigin) {
      origins.add(requestOrigin);
    }
    const hostname = requestOrigin ? new URL(requestOrigin).hostname : "localhost";
    return { rpId: hostname, rpName: RP_NAME, origins: [...origins] };
  }

  let rpId: string | null = null;
  if (urls.deploymentModel === "split-hostname") {
    const cookieDomain = getUweRuntimeConfig(env).sessionCookieDomain;
    if (cookieDomain) {
      rpId = cookieDomain.replace(/^\./, "");
    }
  }

  if (!rpId) {
    const primary = originOf(urls.studioUrl) ?? originOf(urls.publicBaseUrl) ?? requestOrigin;
    rpId = primary ? new URL(primary).hostname : "localhost";
  }

  // An IP address can never serve as an RP ID. When the configured URLs point
  // at an IP (dev/e2e setups on 127.0.0.1, LAN IPs) but the browser reached us
  // via a hostname (e.g. `localhost`), prefer that hostname.
  if (isIpHostname(rpId) && requestOrigin) {
    const requestHost = new URL(requestOrigin).hostname;
    if (!isIpHostname(requestHost)) {
      rpId = requestHost;
      origins.add(requestOrigin);
    }
  }

  return { rpId, rpName: RP_NAME, origins: [...origins] };
}
