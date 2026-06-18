import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  getSessionCookieOptions,
  getUweRuntimeConfig,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "@uwe/auth";
import {
  checkRateLimit,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
} from "@/src/lib/rate-limit";

function tokensMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET() {
  const db = createPrismaClient();
  const auth = createAuthService(db);
  try {
    const setupAvailable = await auth.isSetupAvailable();
    if (!setupAvailable) {
      return NextResponse.json({ setupAvailable: false });
    }

    const config = getUweRuntimeConfig();
    return NextResponse.json({
      setupAvailable: true,
      setupConfigured: Boolean(config.setupToken),
    });
  } finally {
    await db.$disconnect();
  }
}

export async function POST(request: Request) {
  const config = getUweRuntimeConfig();
  if (!config.setupToken) {
    return NextResponse.json({ error: "Setup ist nicht konfiguriert." }, { status: 503 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-setup:${ip}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT_PRESETS.setup);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Setup-Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = (await request.json()) as {
    setupToken?: string;
    displayName?: string;
    email?: string;
    password?: string;
  };

  const setupToken = body.setupToken?.trim() ?? "";
  if (!tokensMatch(setupToken, config.setupToken)) {
    return NextResponse.json({ error: "Ungültiges Setup-Token." }, { status: 403 });
  }

  const displayName = body.displayName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!displayName || !email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Name, E-Mail und Passwort (min. 8 Zeichen) sind erforderlich." },
      { status: 400 },
    );
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    if (!(await auth.isSetupAvailable())) {
      return NextResponse.json({ error: "Setup ist nicht mehr verfügbar." }, { status: 403 });
    }

    const owner = await auth.createOwnerViaSetup({ displayName, email, password });
    const session = await auth.createSession(owner.id);
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      ...getSessionCookieOptions(),
      expires: sessionExpiresAt(),
    });

    return NextResponse.json({
      user: auth.toAuthUser(owner),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_DISABLED") {
      return NextResponse.json({ error: "Setup ist nicht mehr verfügbar." }, { status: 403 });
    }
    throw error;
  } finally {
    await db.$disconnect();
  }
}
