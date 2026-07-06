import { timingSafeEqual } from "node:crypto";
import type { ApiTokenScope, AuthUser } from "@uwe/auth";
import {
  evaluateAdminGate,
  getRequiredRolesForApiPath,
  hasAnyRole,
  isApiTokenFormat,
  parseBearerToken,
  type AdminGateResult,
} from "@uwe/auth";
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

export interface AdminGuardOptions extends StudioGuardOptions {
  requiredScopes?: readonly ApiTokenScope[];
}

export interface ApiAuthContext {
  user: AuthUser | null;
  apiTokenId: string | null;
  apiTokenScopes: ApiTokenScope[] | null;
  authMethod: "session" | "env_token" | "api_token" | "none";
}

/**
 * Request guard for sensitive Studio API routes.
 * CSRF (same-origin) is always enforced for mutating methods.
 * Optional STUDIO_API_TOKEN or DB API token for non-browser clients.
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

  const bearer = parseBearerToken(request.headers.get("authorization"));
  if (bearer && isApiTokenFormat(bearer)) {
    return null;
  }

  return unauthorized("Studio-API-Token erforderlich (Authorization: Bearer …).");
}

/**
 * Admin API guard: studio network guard + admin role or scoped API token.
 */
export function requireAdminApiAuth(
  request: Request,
  context: ApiAuthContext,
  options: AdminGuardOptions = {},
): Response | null {
  const base = requireStudioApiAuth(request, options);
  if (base) {
    return base;
  }

  if (context.authMethod === "env_token") {
    return null;
  }

  const gate = evaluateAdminGate({
    user: context.user,
    apiTokenScopes: context.apiTokenScopes,
    requiredScopes: options.requiredScopes ?? ["admin_read"],
  });

  return adminGateToResponse(gate);
}

/**
 * Studio API guard with CSRF + session/API-token role enforcement.
 * Every protected Studio API route must resolve auth context and call this.
 */
export function requireStudioRoleApiAuth(
  request: Request,
  context: ApiAuthContext,
  options: StudioGuardOptions & { pathname?: string } = {},
): Response | null {
  const base = requireStudioApiAuth(request, options);
  if (base) {
    return base;
  }

  const pathname =
    options.pathname ??
    (() => {
      try {
        return new URL(request.url).pathname;
      } catch {
        return "/";
      }
    })();

  const requiredRoles = getRequiredRolesForApiPath(pathname);
  if (!requiredRoles) {
    return null;
  }

  if (context.authMethod === "env_token") {
    return null;
  }

  if (!context.user) {
    return unauthorized("Anmeldung erforderlich.");
  }

  if (!hasAnyRole(context.user, requiredRoles)) {
    return forbidden("Kein Studio-Zugriff für diese Rolle.");
  }

  return null;
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

/**
 * Owner-only Studio API guard (session login required; API/env tokens rejected).
 */
export function requireOwnerApiAuth(
  request: Request,
  context: ApiAuthContext,
  options: StudioGuardOptions = {},
): Response | null {
  const base = requireStudioApiAuth(request, options);
  if (base) {
    return base;
  }

  if (context.authMethod === "env_token" || context.authMethod === "api_token") {
    return forbidden("Host-Update erfordert Owner-Session (kein API-Token).");
  }

  if (!context.user) {
    return unauthorized("Owner-Zugriff erfordert Anmeldung.");
  }

  if (context.user.role !== "owner") {
    return forbidden("Nur OWNER darf Host-Updates auslösen.");
  }

  return null;
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

function adminGateToResponse(gate: AdminGateResult): Response | null {
  if (!gate) {
    return null;
  }
  if (gate.status === 401) {
    return unauthorized(gate.error);
  }
  return forbidden(gate.error);
}
