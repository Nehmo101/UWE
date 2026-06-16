import { timingSafeEqual } from "node:crypto";
import { originMatchesTrustedHost } from "./runtime-config";

/**
 * Shared Studio access evaluation for API routes, middleware, and server actions.
 *
 * Studio has no user login — network-level protection (Cloudflare Access, VPN)
 * is required when publicly reachable. This module adds CSRF protection and
 * optional bearer-token auth for non-browser clients.
 */

export type StudioAccessDenialReason = "csrf" | "token_required" | "invalid_token";

export interface StudioAccessContext {
  secFetchSite: string | null;
  origin: string | null;
  host: string | null;
  authorization: string | null;
}

export interface StudioAccessResult {
  allowed: boolean;
  denial?: StudioAccessDenialReason;
  httpStatus: 403 | 401 | null;
}

export function studioAccessContextFromHeaders(headers: Headers): StudioAccessContext {
  return {
    secFetchSite: headers.get("sec-fetch-site"),
    origin: headers.get("origin"),
    host: headers.get("host"),
    authorization: headers.get("authorization"),
  };
}

export function studioAccessContextFromRequest(request: Request): StudioAccessContext {
  return studioAccessContextFromHeaders(request.headers);
}

export function checkStudioAccess(
  ctx: StudioAccessContext,
  env: NodeJS.ProcessEnv = process.env,
): StudioAccessResult {
  if (isCrossSiteBrowserRequest(ctx, env)) {
    return { allowed: false, denial: "csrf", httpStatus: 403 };
  }

  const requiredToken = env.STUDIO_API_TOKEN?.trim();
  if (!requiredToken) {
    return { allowed: true, httpStatus: null };
  }

  if (isSameOriginBrowserRequest(ctx, env) || hasValidBearerToken(ctx.authorization, requiredToken)) {
    return { allowed: true, httpStatus: null };
  }

  const denial: StudioAccessDenialReason = ctx.authorization?.startsWith("Bearer ")
    ? "invalid_token"
    : "token_required";

  return { allowed: false, denial, httpStatus: 401 };
}

export function studioAccessErrorMessage(denial: StudioAccessDenialReason): string {
  switch (denial) {
    case "csrf":
      return "Cross-Origin-Anfragen an die Studio-API sind nicht erlaubt.";
    case "token_required":
      return "Studio-API-Token erforderlich (Authorization: Bearer …).";
    case "invalid_token":
      return "Ungültiges Studio-API-Token.";
  }
}

function isCrossSiteBrowserRequest(ctx: StudioAccessContext, env: NodeJS.ProcessEnv): boolean {
  if (ctx.secFetchSite === "cross-site") {
    return true;
  }

  const origin = ctx.origin;
  if (!origin || origin === "null") {
    return false;
  }

  return !originMatchesTrustedHost(origin, ctx.host, env);
}

function isSameOriginBrowserRequest(ctx: StudioAccessContext, env: NodeJS.ProcessEnv): boolean {
  if (ctx.secFetchSite === "same-origin") {
    return true;
  }

  const origin = ctx.origin;
  if (origin && origin !== "null") {
    return originMatchesTrustedHost(origin, ctx.host, env);
  }

  return false;
}

function hasValidBearerToken(authorization: string | null, requiredToken: string): boolean {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(requiredToken);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
