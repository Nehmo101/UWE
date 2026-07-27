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
} from "@uwe/security";

/**
 * Anmeldung der Startseite (uwe.example). Anders als `/api/auth/login`
 * der jeweiligen App authentifiziert dieser Endpunkt für ein gewähltes Ziel:
 *   - target "studio" → benötigt Studio-Zugriff (owner/admin/dm)
 *   - target "portal" → jeder aktive Benutzer (wie der Portal-Login)
 *   - target "brain"  → owner-only; hier rollen-gated wie Studio, die Brain-App
 *                       prüft die owner-Rolle zusätzlich auf jeder Route
 * und setzt das (domänenweite) Session-Cookie, damit der Besucher beim Sprung
 * auf studio./portal./brain.uwe.example angemeldet ist. Dafür muss
 * SESSION_COOKIE_DOMAIN=.uwe.example gesetzt sein — sonst gilt das Cookie
 * nur für den Apex und der Besucher landet auf der Ziel-Subdomain im Login.
 *
 * Nutzt dieselbe gehärtete Login-Zustandsmaschine wie die App-Logins
 * (`@uwe/auth`): Rate-Limit, Turnstile, 2FA, Audit-Log.
 */

type Target = "studio" | "portal" | "brain";
type AuditSurface = "studio" | "portal";

function parseTarget(value: unknown): Target | null {
  return value === "studio" || value === "portal" || value === "brain" ? value : null;
}

// Portal steht jedem authentifizierten aktiven Benutzer offen; Studio und Brain
// sind rollen-gated. Brain zusätzlich owner-only — das erzwingt die Brain-App
// selbst auf jeder Route.
function hasTargetAccess(target: Target, user: AuthUser): boolean {
  return target === "portal" ? true : canAccessStudio(user);
}

// Audit- und Login-Flow unterscheiden nur studio vs. portal; Brain wird als
// "studio" protokolliert. Das genaue Ziel geht über responseTarget zurück.
function auditSurfaceFor(target: Target): AuditSurface {
  return target === "portal" ? "portal" : "studio";
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
  const auditSurface = auditSurfaceFor(target);

  const setSessionCookie = async (token: string): Promise<void> => {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      ...getSessionCookieOptionsForRequest(request),
      expires: sessionExpiresAt(),
    });
  };

  // ── Zweiter Schritt: 2FA-Challenge eines früheren Submits prüfen ──
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
          surface: auditSurface,
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
          surface: auditSurface,
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

  // ── Erster Schritt: E-Mail + Passwort ──
  return performLoginFlow({
    request,
    email: body.email?.trim(),
    password: body.password,
    turnstileToken: body.turnstileToken,
    surface: auditSurface,
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
