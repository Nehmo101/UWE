import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createAuthService,
  createPrismaClient,
  createTwoFactorService,
} from "@uwe/database/server";
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
} from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json()) as { challengeToken?: string; code?: string };
  const challengeToken = body.challengeToken?.trim();
  const code = body.code?.trim();

  if (!challengeToken || !code) {
    return NextResponse.json({ error: "Challenge-Token und Code sind erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-2fa:${ip}:${challengeToken.slice(0, 8)}`;
  const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.login);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const twoFactor = createTwoFactorService(db);

  try {
    const verified = await twoFactor.verifyLoginChallenge(challengeToken, code);
    if (!verified) {
      return NextResponse.json({ error: "Ungültiger oder abgelaufener 2FA-Code." }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: verified.userId } });
    if (!user || !canAccessStudio(auth.toAuthUser(user))) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten." }, { status: 401 });
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
