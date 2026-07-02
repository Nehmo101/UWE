import { timingSafeEqual } from "node:crypto";
import { assessApiOrigin, isSameOriginBrowserRequest as isSameOriginBrowserRequestFromGuard } from "./api-origin-guard";

/**
 * Shared Studio access evaluation for API routes, middleware, and server actions.
 *
 * Studio access is gated by the UWE session login (e-mail sign-in) enforced via
 * middleware when AUTH_REQUIRED=true. This module adds CSRF protection and
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
  return assessApiOrigin(studioAccessContextToRequest(ctx), env).blocked;
}

function isSameOriginBrowserRequest(ctx: StudioAccessContext, env: NodeJS.ProcessEnv): boolean {
  return isSameOriginBrowserRequestFromGuard(studioAccessContextToRequest(ctx), env);
}

function studioAccessContextToRequest(ctx: StudioAccessContext): Request {
  const headers = new Headers();
  if (ctx.secFetchSite) {
    headers.set("sec-fetch-site", ctx.secFetchSite);
  }
  if (ctx.origin) {
    headers.set("origin", ctx.origin);
  }
  if (ctx.host) {
    headers.set("host", ctx.host);
  }
  if (ctx.authorization) {
    headers.set("authorization", ctx.authorization);
  }
  return new Request("http://studio.local/api/backup", { headers });
}

function hasValidBearerToken(authorization: string | null, requiredToken: string): boolean {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(requiredToken);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
