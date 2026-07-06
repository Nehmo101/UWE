import {
  isCrossSiteBrowserRequest as authIsCrossSiteBrowserRequest,
  isSameOriginBrowserRequest as authIsSameOriginBrowserRequest,
} from "@uwe/auth";
import { csrfError } from "./errors";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** True when a browser request originates from a foreign site (CSRF vector). */
export function isCrossSiteBrowserRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return authIsCrossSiteBrowserRequest(request, env);
}

export function isSameOriginBrowserRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return authIsSameOriginBrowserRequest(request, env);
}

/** Rejects cross-origin mutating browser requests. Safe for cookie-based auth. */
export function requireSameOriginMutation(request: Request): Response | null {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  if (isCrossSiteBrowserRequest(request)) {
    return csrfError();
  }

  return null;
}

/** Rejects any cross-origin browser request (GET included) for protected read endpoints. */
export function requireSameOrigin(request: Request): Response | null {
  if (isCrossSiteBrowserRequest(request)) {
    return csrfError();
  }

  return null;
}
