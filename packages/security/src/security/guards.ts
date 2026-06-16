import { timingSafeEqual } from "node:crypto";
import { isCrossSiteBrowserRequest, isSameOriginBrowserRequest } from "./csrf";
import { csrfError, forbidden, unauthorized } from "./errors";
import {
  enforceRateLimit,
  type RateLimitPreset,
} from "./rate-limit";

export interface StudioGuardOptions {
  rateLimit?: RateLimitPreset;
  rateLimitKey?: string;
}

/**
 * Request guard for sensitive Studio API routes.
 * CSRF (same-origin) is always enforced for mutating methods.
 * Optional STUDIO_API_TOKEN for non-browser clients.
 */
export function requireStudioApiAuth(request: Request, options: StudioGuardOptions = {}): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD" && isCrossSiteBrowserRequest(request)) {
    return csrfError();
  }

  if (options.rateLimit) {
    const limited = enforceRateLimit(
      request,
      `studio:${options.rateLimit}`,
      options.rateLimit,
      options.rateLimitKey,
    );
    if (limited) {
      return limited;
    }
  }

  const requiredToken = process.env.STUDIO_API_TOKEN;
  if (!requiredToken) {
    return null;
  }

  if (isSameOriginBrowserRequest(request) || hasValidBearerToken(request, requiredToken)) {
    return null;
  }

  return unauthorized("Studio-API-Token erforderlich (Authorization: Bearer …).");
}

/** Shorthand for mutating Studio routes with CSRF + optional rate limit. */
export function guardStudioMutation(
  request: Request,
  options: StudioGuardOptions = {},
): Response | null {
  return requireStudioApiAuth(request, options);
}

/** Stricter guard for restore execute — optional RESTORE_OWNER_TOKEN on top of studio auth. */
export function requireRestoreOwnerAuth(request: Request): Response | null {
  const base = requireStudioApiAuth(request);
  if (base) {
    return base;
  }

  const restoreToken = process.env.RESTORE_OWNER_TOKEN?.trim();
  if (!restoreToken) {
    return null;
  }

  if (isSameOriginBrowserRequest(request) || hasValidBearerToken(request, restoreToken)) {
    return null;
  }

  return forbidden("Restore erfordert Owner-Token (Authorization: Bearer …).");
}

export interface PortalGuardOptions {
  requireSession?: boolean;
  rateLimit?: RateLimitPreset;
  rateLimitKey?: string;
}

/**
 * CSRF guard for Portal cookie-auth API routes.
 * Mutating requests from foreign origins are rejected.
 */
export function requirePortalApiAuth(request: Request, options: PortalGuardOptions = {}): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD" && isCrossSiteBrowserRequest(request)) {
    return csrfError();
  }

  if (options.rateLimit) {
    const limited = enforceRateLimit(
      request,
      `portal:${options.rateLimit}`,
      options.rateLimit,
      options.rateLimitKey,
    );
    if (limited) {
      return limited;
    }
  }

  return null;
}

function hasValidBearerToken(request: Request, requiredToken: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(requiredToken);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/** Blocks cross-origin reads on protected Portal endpoints. */
export function requirePortalReadAuth(request: Request): Response | null {
  if (isCrossSiteBrowserRequest(request)) {
    return forbidden("Cross-Origin-Anfragen sind nicht erlaubt.");
  }
  return null;
}
