import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { SESSION_COOKIE_NAME, sessionExpiresAt } from "@uwe/auth";
import { checkRateLimit, clientIpFromHeaders, resetRateLimit } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `login:${ip}:${email.toLowerCase()}`;
  const rate = checkRateLimit(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anmeldeversuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const user = await auth.authenticate(email, password);
    if (!user) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten." }, { status: 401 });
    }

    resetRateLimit(rateKey);

    const session = await auth.createSession(user.id);
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: sessionExpiresAt(),
    });

    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    });
  } finally {
    await db.$disconnect();
  }
}
