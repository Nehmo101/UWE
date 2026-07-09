import { NextResponse } from "next/server";
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
  getSessionCookieOptionsForRequest,
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
 * hardened building blocks as the per-app logins: rate-limit, Turnstile, 2FA,
 * audit logging.
 */

type Target = "studio" | "portal";

function parseTarget(value: unknown): Target | null {
  return value === "studio" || value === "portal" ? value : null;
}

// Portal is open to any authenticated active user; Studio is role-gated.
function hasTargetAccess(target: Target, user: AuthUser): boolean {
  return target === "studio" ? canAccessStudio(user) : true;
}

async function setSessionCookie(request: Request, token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...getSessionCookieOptionsForRequest(request),
    expires: sessionExpiresAt(),
  });
}

export async function POST(request: Request) {
  const auditRequest = auditRequestFromHeaders(request.headers);
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

  const ip = clientIpFromHeaders(request.headers);
  const db = createPrismaClient();
  const auth = createAuthService(db);
  const twoFactor = createTwoFactorService(db);

  try {
    // ── Second step: verify a 2FA challenge started by an earlier submit ──
    if (body.challengeToken && body.code) {
      const challengeToken = body.challengeToken.trim();
      const code = body.code.trim();

      const rateKey = `enter-2fa:${ip}:${challengeToken.slice(0, 8)}`;
      const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.login);
      if (!rate.allowed) {
        return NextResponse.json(
          { error: "Zu viele Versuche. Bitte warte einen Moment." },
          { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
        );
      }

      const verified = await twoFactor.verifyLoginChallenge(challengeToken, code);
      if (!verified) {
        return jsonError("Ungültiger oder abgelaufener 2FA-Code.", 401);
      }

      const user = await db.user.findUnique({ where: { id: verified.userId } });
      if (!user || !hasTargetAccess(target, auth.toAuthUser(user))) {
        return jsonError("Ungültige Anmeldedaten.", 401);
      }

      const session = await auth.createSession(user.id);
      await auth.recordSuccessfulLogin(user.id);
      await setSessionCookie(request, session.token);
      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        email: user.email,
        actorUserId: user.id,
        sessionId: session.id,
        httpStatus: 200,
      });

      return NextResponse.json({
        user: auth.toAuthUser(user),
        forcePasswordChange: user.forcePasswordChange ?? false,
        target,
      });
    }

    // ── First step: email + password ──
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        email,
        reason: "missing_credentials",
        httpStatus: 400,
        errorMessage: "E-Mail und Passwort sind erforderlich.",
      });
      return jsonError("E-Mail und Passwort sind erforderlich.", 400);
    }

    const rateKey = `enter:${ip}:${email.toLowerCase()}:${target}`;
    const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.login);
    if (!rate.allowed) {
      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        email,
        reason: "rate_limited",
        httpStatus: 429,
        errorMessage: "Zu viele Anmeldeversuche. Bitte warte einen Moment.",
        extraMetadata: { retryAfterSeconds: rate.retryAfterSeconds },
      });
      return NextResponse.json(
        { error: "Zu viele Anmeldeversuche. Bitte warte einen Moment." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const turnstile = await verifyTurnstileToken(body.turnstileToken, { remoteIp: ip });
    if (!turnstile.success) {
      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        email,
        reason: "human_verification_failed",
        httpStatus: 403,
        errorMessage: "Bitte bestätige, dass du ein Mensch bist.",
        extraMetadata: { turnstileErrorCodes: turnstile.errorCodes },
      });
      return NextResponse.json(
        { error: "Bitte bestätige, dass du ein Mensch bist." },
        { status: 403 },
      );
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, status: true, role: true },
    });

    const user = await auth.authenticate(email, password);
    const authUser = user ? auth.toAuthUser(user) : null;

    if (!user || !authUser || !hasTargetAccess(target, authUser)) {
      const reason = resolveLoginFailureReason({
        surface: target,
        email: normalizedEmail,
        userFound: Boolean(existingUser),
        userActive: existingUser?.status === "active",
        passwordValid: Boolean(user),
        studioAccessGranted:
          target === "studio" ? (authUser ? canAccessStudio(authUser) : false) : undefined,
      });

      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        email: normalizedEmail,
        actorUserId: existingUser?.id ?? null,
        reason,
        httpStatus: 401,
        errorMessage: "Ungültige Anmeldedaten.",
      });

      return jsonError("Ungültige Anmeldedaten.", 401);
    }

    await resetRateLimitAsync(rateKey);

    if (await twoFactor.isEnabled(user.id)) {
      const challenge = await twoFactor.createLoginChallenge(user.id);
      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        email: user.email,
        actorUserId: user.id,
        reason: "two_factor_required",
        httpStatus: 200,
        extraMetadata: { challengeExpiresAt: challenge.expiresAt.toISOString() },
      });

      return NextResponse.json({
        requiresTwoFactor: true,
        challengeToken: challenge.challengeToken,
        expiresAt: challenge.expiresAt.toISOString(),
      });
    }

    const session = await auth.createSession(user.id);
    await auth.recordSuccessfulLogin(user.id);
    await setSessionCookie(request, session.token);
    await logLoginAttempt({
      db,
      surface: target,
      request: auditRequest,
      email: user.email,
      actorUserId: user.id,
      sessionId: session.id,
      httpStatus: 200,
    });

    return NextResponse.json({
      user: authUser,
      forcePasswordChange: user.forcePasswordChange ?? false,
      target,
    });
  } catch (error) {
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
  } finally {
    await db.$disconnect();
  }
}
