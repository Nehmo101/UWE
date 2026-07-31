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
  canAccessFamily,
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
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
} from "@/src/lib/rate-limit";

/**
 * Family passkey (WebAuthn) route handlers. Der gemeinsame Anmelde- und
 * Registrierungs-Ablauf liegt in `@uwe/passkeys`; diese Datei reicht nur die
 * Family-Teile hinein.
 *
 * Zugang ist das Häkchen `Family` — dieselbe Prüfung wie im Passwort-Login
 * (`hasAccess: canAccessFamily`); ein Passkey umgeht das Häkchen nicht.
 *
 * Damit richtet jemand, der ausschliesslich Family nutzt, FaceID oder den
 * Fingerabdruck hier ein — ohne je Portal oder Studio zu öffnen.
 */
function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

const handlers = createPasskeyRouteHandlers({
  surface: "family",
  guard: (request) => requireFamilyApiAuth(request),
  requireAuthedUser: (request) => getUserFromRequestCookieHeader(request.headers.get("cookie")),
  errorResponse: jsonError,
  rateKeyPrefix: "family-passkey",
  clientIpFromHeaders,
  checkRateLimitAsync,
  loginRateLimitOptions: RATE_LIMIT_PRESETS.login,
  createDb: createPrismaClient,
  createStore: createPasskeyCredentialStore,
  createAuthService,
  hasAccess: canAccessFamily,
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
