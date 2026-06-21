import { NextResponse } from "next/server";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { cookies } from "next/headers";
import {
  auditRequestFromHeaders,
  createAuthService,
  createPrismaClient,
  createTwoFactorService,
  logAuditEvent,
} from "@uwe/database/server";
import { getSessionCookieOptionsForRequest, SESSION_COOKIE_NAME, sessionExpiresAt } from "@uwe/auth";
import { checkRateLimitAsync, clientIpFromHeaders, resetRateLimitAsync } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `login:${ip}:${email.toLowerCase()}`;
  const rate = await checkRateLimitAsync(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
  if (!rate.allowed) {
    const db = createPrismaClient();
    try {
      await logAuditEvent(db, {
        action: "rate_limit_hit",
        targetType: "session",
        request: auditRequestFromHeaders(request.headers),
        metadata: { endpoint: "login", email },
      });
    } finally {
      await db.$disconnect();
    }

    return NextResponse.json(
      { error: "Zu viele Anmeldeversuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const twoFactor = createTwoFactorService(db);
  const auditRequest = auditRequestFromHeaders(request.headers);

  try {
    const user = await auth.authenticate(email, password);
    if (!user) {
      await logAuditEvent(db, {
        action: "login_failed",
        targetType: "session",
        request: auditRequest,
        metadata: { email },
      });

      return NextResponse.json({ error: "Ungültige Anmeldedaten." }, { status: 401 });
    }

    await resetRateLimitAsync(rateKey);

    if (await twoFactor.isEnabled(user.id)) {
      const challenge = await twoFactor.createLoginChallenge(user.id);
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

    await logAuditEvent(db, {
      actorUserId: user.id,
      action: "login_success",
      targetType: "session",
      targetId: session.id,
      request: auditRequest,
      metadata: { email: user.email },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
      forcePasswordChange: user.forcePasswordChange ?? false,
    });
  } finally {
    await db.$disconnect();
  }
}
