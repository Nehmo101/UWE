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
import { checkRateLimitAsync, clientIpFromHeaders } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as { challengeToken?: string; code?: string };
  const challengeToken = body.challengeToken?.trim();
  const code = body.code?.trim();

  if (!challengeToken || !code) {
    return NextResponse.json({ error: "Challenge-Token und Code sind erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `portal-2fa:${ip}:${challengeToken.slice(0, 8)}`;
  const rate = await checkRateLimitAsync(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const twoFactor = createTwoFactorService(db);
  const auditRequest = auditRequestFromHeaders(request.headers);

  try {
    const verified = await twoFactor.verifyLoginChallenge(challengeToken, code);
    if (!verified) {
      return NextResponse.json({ error: "Ungültiger oder abgelaufener 2FA-Code." }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: verified.userId } });
    if (!user) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten." }, { status: 401 });
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
      metadata: { email: user.email, twoFactor: true },
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
