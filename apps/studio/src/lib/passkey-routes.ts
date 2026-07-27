import { cookies } from "next/headers";
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
  canAccessStudio,
  getSessionCookieOptionsForRequest,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "@uwe/auth";
import {
  createPasskeyRouteHandlers,
  deriveRequestOrigin,
  resolveWebAuthnRelyingParty,
} from "@uwe/passkeys";
import { guardStudioMutation } from "@uwe/security";
import { jsonError } from "@/src/lib/api-response";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
} from "@/src/lib/rate-limit";

/**
 * Studio passkey (WebAuthn) route handlers. The shared login/registration flow
 * lives in `@uwe/passkeys` (`createPasskeyRouteHandlers`); this file only
 * injects the Studio-specific pieces: the mutation guard for the session-gated
 * management endpoints, the Studio access predicate for login, the credential
 * store, and the (optionally domain-wide) session cookie writer.
 */
const handlers = createPasskeyRouteHandlers({
  surface: "studio",
  guard: (request) => guardStudioMutation(request, { rateLimit: "login" }),
  requireAuthedUser: (request) => getUserFromRequestCookieHeader(request.headers.get("cookie")),
  errorResponse: jsonError,
  rateKeyPrefix: "passkey",
  clientIpFromHeaders,
  checkRateLimitAsync,
  loginRateLimitOptions: RATE_LIMIT_PRESETS.login,
  createDb: createPrismaClient,
  createStore: createPasskeyCredentialStore,
  createAuthService,
  isPasskeysEnabled: async (db) =>
    (await createSettingsService(db).getSettings()).auth.passkeysEnabled,
  hasAccess: canAccessStudio,
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
