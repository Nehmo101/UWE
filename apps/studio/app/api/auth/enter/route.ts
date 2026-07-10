import { cookies } from "next/headers";
import { jsonError } from "@/src/lib/api-response";
import {
  auditRequestFromHeaders,
  createAuthService,
  createPrismaClient,
  createTwoFactorService,
  logLoginAttempt,
  resolveLoginFailureReason,
} from "@uwe/database/server";
import {
  canAccessStudio,
  completeTwoFactorLogin,
  getSessionCookieOptionsForRequest,
  performLoginFlow,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
  verifyTurnstileToken,
  type AuthUser,
} from "@uwe/auth";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
  resetRateLimitAsync,
} from "@/src/lib/rate-limit";

/**
 * Unified sign-in endpoint for the uweanddragons.org landing page (served from
 * the Studio/apex origin). Unlike `/api/auth/login` (Studio-only, gates GMs),
 * this authenticates for a chosen target:
 *   - target "studio" → requires Studio access (owner/admin/dm)
 *   - target "portal" → any active user (matches the Portal login)
 * and sets the (optionally domain-wide) session cookie so the visitor is signed
 * in when redirected to studio./portal.uweanddragons.org. Reuses the same
 * hardened login state machine as the per-app logins (`@uwe/auth`): rate-limit,
 * Turnstile, 2FA, audit logging.
 */

type Target = "studio" | "portal";

function parseTarget(value: unknown): Target | null {
  return value === "studio" || value === "portal" ? value : null;
}

// Portal is open to any authenticated active user; Studio is role-gated.
function hasTargetAccess(target: Target, user: AuthUser): boolean {
  return target === "studio" ? canAccessStudio(user) : true;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    turnstileToken?: string;
    target?: string;
    challengeToken?: string;
    code?: string;
  };

  const target = parseTarget(body.target);
  if (!target) {
    return jsonError("Ungültiges Ziel.", 400);
  }

  const setSessionCookie = async (token: string): Promise<void> => {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      ...getSessionCookieOptionsForRequest(request),
      expires: sessionExpiresAt(),
    });
  };

  // ── Second step: verify a 2FA challenge started by an earlier submit ──
  if (body.challengeToken && body.code) {
    const auditRequest = auditRequestFromHeaders(request.headers);

    return completeTwoFactorLogin({
      request,
      challengeToken: body.challengeToken.trim(),
      code: body.code.trim(),
      responseTarget: target,
      rateKeyPrefix: "enter-2fa",
      createDb: createPrismaClient,
      createAuthService,
      createTwoFactorService,
      findUserById: (db, userId) => db.user.findUnique({ where: { id: userId } }),
      hasAccess: (user) => hasTargetAccess(target, user),
      clientIpFromHeaders,
      rateLimitOptions: RATE_LIMIT_PRESETS.login,
      checkRateLimitAsync,
      setSessionCookie,
      onSuccessAudit: async ({ db, user, session }) => {
        await logLoginAttempt({
          db,
          surface: target,
          request: auditRequest,
          email: user.email,
          actorUserId: user.id,
          sessionId: session.id,
          httpStatus: 200,
        });
      },
      handleServerError: async (db, error) => {
        await logLoginAttempt({
          db,
          surface: target,
          request: auditRequest,
          email: body.email,
          reason: "server_error",
          httpStatus: 500,
          errorMessage: "Anmeldung vorübergehend nicht möglich.",
          serverError: error,
        });
        console.error("[uwe] enter login failed:", error);
        return jsonError("Anmeldung vorübergehend nicht möglich.", 500);
      },
    });
  }

  // ── First step: email + password ──
  return performLoginFlow({
    request,
    email: body.email?.trim(),
    password: body.password,
    turnstileToken: body.turnstileToken,
    surface: target,
    responseTarget: target,
    serverErrorLogLabel: "enter login",
    createDb: createPrismaClient,
    createAuthService,
    createTwoFactorService,
    findExistingUser: (db, normalizedEmail) =>
      db.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, status: true },
      }),
    hasAccess: (user) => hasTargetAccess(target, user),
    clientIpFromHeaders,
    loginRateKey: (ip, normalizedEmail) => `enter:${ip}:${normalizedEmail}:${target}`,
    rateLimitOptions: RATE_LIMIT_PRESETS.login,
    checkRateLimitAsync,
    resetRateLimitAsync,
    verifyTurnstile: verifyTurnstileToken,
    setSessionCookie,
    auditRequestFromHeaders,
    logLoginAttempt,
    resolveLoginFailureReason,
  });
}
