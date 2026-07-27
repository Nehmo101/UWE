import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  auditRequestFromHeaders,
  createAuthService,
  createPrismaClient,
  createSettingsService,
  createTwoFactorService,
  logAuditEvent,
  logLoginAttempt,
} from "@uwe/database/server";
import { createAuthIdentityService } from "@uwe/database/auth-identities";
import { resolveGoogleOAuthConfig } from "@uwe/database/login-methods-settings";
import {
  canAccessStudio,
  getOAuthStateCookieOptions,
  getSessionCookieOptionsForRequest,
  resolvePortalPublicBaseUrl,
  resolvePortalSessionHref,
  resolveStudioPublicBaseUrl,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
  STUDIO_SESSION_ENTRY_PATH,
} from "@uwe/auth";
import {
  createGoogleLoginRouteHandlers,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "@uwe/auth/server";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
} from "@/src/lib/rate-limit";

/**
 * Studio adapter for "Mit Google anmelden". There is exactly ONE Google
 * callback in UWE — on the Studio origin — so only one redirect URI has to be
 * registered in the Google console; the target app (`studio` | `portal`)
 * travels in the signed OAuth state, and the session cookie is domain-wide
 * when `SESSION_COOKIE_DOMAIN` is configured (same mechanism as landing SSO).
 * The flow itself lives in `@uwe/auth`'s `createGoogleLoginRouteHandlers`.
 */

const STATE_COOKIE_PATH = "/api/auth/google";
/** Ten minutes — the state cookie only needs to survive the Google round-trip. */
const STATE_COOKIE_MAX_AGE_SECONDS = 600;

function studioBase(): string {
  return resolveStudioPublicBaseUrl();
}

const handlers = createGoogleLoginRouteHandlers({
  createDb: createPrismaClient,
  getGoogleConfig: async (db) =>
    resolveGoogleOAuthConfig((await createSettingsService(db).getSettings()).auth),
  resolveRedirectUri: () => `${studioBase()}/api/auth/google/callback`,
  resolveLoginUrl: (target) =>
    target === "portal" ? `${resolvePortalPublicBaseUrl()}/login` : `${studioBase()}/login`,
  resolveSessionUrl: (target) =>
    target === "portal"
      ? resolvePortalSessionHref(undefined, { currentApp: "studio" })
      : `${studioBase()}${STUDIO_SESSION_ENTRY_PATH}`,
  resolveSecurityUrl: (target) =>
    target === "portal"
      ? `${resolvePortalPublicBaseUrl()}/auth/account/security`
      : `${studioBase()}/account/security`,
  identityService: createAuthIdentityService,
  createAuthService,
  createTwoFactorService,
  getSessionUserId: async (request) =>
    (await getUserFromRequestCookieHeader(request.headers.get("cookie")))?.id ?? null,
  hasTargetAccess: (target, user) => (target === "portal" ? true : canAccessStudio(user)),
  clientIpFromHeaders,
  checkRateLimitAsync,
  rateLimitOptions: RATE_LIMIT_PRESETS.login,
  setSessionCookie: async (token, request) => {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      ...getSessionCookieOptionsForRequest(request),
      expires: sessionExpiresAt(),
    });
  },
  buildRedirect: (url, redirectCookies) => {
    const response = NextResponse.redirect(url);
    for (const cookie of redirectCookies ?? []) {
      response.cookies.set(cookie.name, cookie.value, {
        ...getOAuthStateCookieOptions(STATE_COOKIE_PATH),
        maxAge: cookie.clear ? 0 : STATE_COOKIE_MAX_AGE_SECONDS,
      });
    }
    return response;
  },
  readStateCookie: async () => (await cookies()).get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null,
  auditRequestFromHeaders,
  logLoginAttempt,
  logAuditEvent,
  stateCookieName: GOOGLE_OAUTH_STATE_COOKIE,
});

export const { handleGoogleStart, handleGoogleCallback } = handlers;
