import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient, createTwoFactorService } from "@uwe/database/server";
import {
  canAccessStudio,
  getSessionCookieOptionsForRequest,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "@uwe/auth";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
  resetRateLimitAsync,
} from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-login:${ip}:${email.toLowerCase()}`;
  const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.login);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anmeldeversuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const twoFactor = createTwoFactorService(db);

  try {
    const user = await auth.authenticate(email, password);
    if (!user || !canAccessStudio(auth.toAuthUser(user))) {
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

    return NextResponse.json({
      user: auth.toAuthUser(user),
      forcePasswordChange: user.forcePasswordChange ?? false,
    });
  } finally {
    await db.$disconnect();
  }
}
