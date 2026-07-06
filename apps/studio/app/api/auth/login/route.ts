import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { cookies } from "next/headers";
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
} from "@uwe/auth";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
  resetRateLimitAsync,
} from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const auditRequest = auditRequestFromHeaders(request.headers);
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    turnstileToken?: string;
  };
  const email = body.email?.trim();
  const password = body.password;
  const turnstileToken = body.turnstileToken;

  if (!email || !password) {
    const db = createPrismaClient();
    try {
      await logLoginAttempt({
        db,
        surface: "studio",
        request: auditRequest,
        email,
        reason: "missing_credentials",
        httpStatus: 400,
        errorMessage: "E-Mail und Passwort sind erforderlich.",
      });
    } finally {
      await db.$disconnect();
    }

    return jsonError("E-Mail und Passwort sind erforderlich.", 400);
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-login:${ip}:${email.toLowerCase()}`;
  const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.login);
  if (!rate.allowed) {
    const db = createPrismaClient();
    try {
      await logLoginAttempt({
        db,
        surface: "studio",
        request: auditRequest,
        email,
        reason: "rate_limited",
        httpStatus: 429,
        errorMessage: "Zu viele Anmeldeversuche. Bitte warte einen Moment.",
        extraMetadata: { retryAfterSeconds: rate.retryAfterSeconds },
      });
    } finally {
      await db.$disconnect();
    }

    return NextResponse.json(
      { error: "Zu viele Anmeldeversuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const turnstile = await verifyTurnstileToken(turnstileToken, { remoteIp: ip });
  if (!turnstile.success) {
    const db = createPrismaClient();
    try {
      await logLoginAttempt({
        db,
        surface: "studio",
        request: auditRequest,
        email,
        reason: "human_verification_failed",
        httpStatus: 403,
        errorMessage: "Bitte bestätige, dass du ein Mensch bist.",
        extraMetadata: { turnstileErrorCodes: turnstile.errorCodes },
      });
    } finally {
      await db.$disconnect();
    }

    return NextResponse.json(
      { error: "Bitte bestätige, dass du ein Mensch bist." },
      { status: 403 },
    );
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const twoFactor = createTwoFactorService(db);

  try {
    const normalizedEmail = email.toLowerCase();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, status: true, role: true },
    });

    const user = await auth.authenticate(email, password);
    if (!user || !canAccessStudio(auth.toAuthUser(user))) {
      const reason = resolveLoginFailureReason({
        surface: "studio",
        email: normalizedEmail,
        userFound: Boolean(existingUser),
        userActive: existingUser?.status === "active",
        passwordValid: Boolean(user),
        studioAccessGranted: user ? canAccessStudio(auth.toAuthUser(user)) : false,
      });

      await logLoginAttempt({
        db,
        surface: "studio",
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
        surface: "studio",
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
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      ...getSessionCookieOptionsForRequest(request),
      expires: sessionExpiresAt(),
    });

    await logLoginAttempt({
      db,
      surface: "studio",
      request: auditRequest,
      email: user.email,
      actorUserId: user.id,
      sessionId: session.id,
      httpStatus: 200,
    });

    return NextResponse.json({
      user: auth.toAuthUser(user),
      forcePasswordChange: user.forcePasswordChange ?? false,
    });
  } catch (error) {
    await logLoginAttempt({
      db,
      surface: "studio",
      request: auditRequest,
      email,
      reason: "server_error",
      httpStatus: 500,
      errorMessage: "Anmeldung vorübergehend nicht möglich.",
      serverError: error,
    });

    console.error("[uwe] studio login failed:", error);
    return NextResponse.json(
      { error: "Anmeldung vorübergehend nicht möglich." },
      { status: 500 },
    );
  } finally {
    await db.$disconnect();
  }
}
