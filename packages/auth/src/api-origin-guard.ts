import { getAllowedCorsOrigins, originMatchesTrustedHost } from "./runtime-config";

export interface ApiOriginGuardResult {
  blocked: boolean;
  reason: "cross-site" | "foreign-origin" | null;
}

/**
 * Detects browser-originated cross-site requests.
 * Non-browser clients (curl, health probes) typically send no Origin header.
 */
export function assessApiOrigin(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): ApiOriginGuardResult {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return { blocked: true, reason: "cross-site" };
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return { blocked: false, reason: null };
  }

  const requestHost = request.headers.get("host");
  if (originMatchesTrustedHost(origin, requestHost, env)) {
    return { blocked: false, reason: null };
  }

  if (getAllowedCorsOrigins(env).has(origin)) {
    return { blocked: false, reason: null };
  }

  return { blocked: true, reason: "foreign-origin" };
}

export function isCrossSiteBrowserRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return assessApiOrigin(request, env).blocked;
}

export function isSameOriginBrowserRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return false;
  }

  const requestHost = request.headers.get("host");
  if (originMatchesTrustedHost(origin, requestHost, env)) {
    return true;
  }

  return getAllowedCorsOrigins(env).has(origin);
}
