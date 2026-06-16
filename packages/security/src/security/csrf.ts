import { originMatchesTrustedHost } from "@uwe/auth";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** True when a browser request originates from a foreign site (CSRF vector). */
export function isCrossSiteBrowserRequest(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    // Non-browser clients (curl, scripts) send no Origin header.
    return false;
  }

  return !originMatchesTrustedHost(origin, request.headers.get("host"));
}

export function isSameOriginBrowserRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    return originMatchesTrustedHost(origin, request.headers.get("host"));
  }

  return false;
}

/** Rejects cross-origin mutating browser requests. Safe for cookie-based auth. */
export function requireSameOriginMutation(request: Request): Response | null {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  if (isCrossSiteBrowserRequest(request)) {
    return new Response(JSON.stringify({ error: "Cross-Origin-Anfragen sind nicht erlaubt." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

/** Rejects any cross-origin browser request (GET included) for protected read endpoints. */
export function requireSameOrigin(request: Request): Response | null {
  if (isCrossSiteBrowserRequest(request)) {
    return new Response(JSON.stringify({ error: "Cross-Origin-Anfragen sind nicht erlaubt." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
