import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  auditRequestFromHeaders,
  createAuthService,
  createPrismaClient,
  createSettingsService,
  logAuditEvent,
  logLoginAttempt,
} from "@uwe/database/server";
import { createPasskeyCredentialStore } from "@uwe/database/passkeys";
import {
  getSessionCookieOptionsForRequest,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "@uwe/auth";
import {
  createPasskeyRouteHandlers,
  deriveRequestOrigin,
  resolveWebAuthnRelyingParty,
} from "@uwe/passkeys";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
} from "@/src/lib/rate-limit";

/**
 * Portal passkey (WebAuthn) route handlers. The shared login/registration flow
 * lives in `@uwe/passkeys`; this file injects the Portal-specific pieces. The
 * Portal accepts any active user, so no `hasAccess` predicate is set (mirrors
 * the Portal password login).
 */
function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

const handlers = createPasskeyRouteHandlers({
  surface: "portal",
  guard: (request) => requirePortalApiAuth(request),
  requireAuthedUser: (request) => getUserFromRequestCookieHeader(request.headers.get("cookie")),
  errorResponse: jsonError,
  rateKeyPrefix: "portal-passkey",
  clientIpFromHeaders,
  checkRateLimitAsync,
  loginRateLimitOptions: RATE_LIMIT_PRESETS.login,
  createDb: createPrismaClient,
  createStore: createPasskeyCredentialStore,
  createAuthService,
  isPasskeysEnabled: async (db) =>
    (await createSettingsService(db).getSettings()).auth.passkeysEnabled,
  setSessionCookie: async (token, request) => {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      ...getSessionCookieOptionsForRequest(request),
      expires: sessionExpiresAt(),
    });
  },
  relyingPartyForRequest: (request) =>
    resolveWebAuthnRelyingParty({ requestOrigin: deriveRequestOrigin(request) }),
  auditRequestFromHeaders,
  logLoginAttempt,
  logAuditEvent,
});

export const {
  handlePasskeyLoginOptions,
  handlePasskeyLoginVerify,
  handlePasskeyRegisterOptions,
  handlePasskeyRegisterVerify,
  handlePasskeyList,
  handlePasskeyDelete,
} = handlers;
