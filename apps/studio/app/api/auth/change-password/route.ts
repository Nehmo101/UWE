import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  auditRequestFromHeaders,
  createPrismaClient,
  createUserService,
  logAuditEvent,
} from "@uwe/database/server";
import { SESSION_COOKIE_NAME } from "@uwe/auth";
import { guardStudioMutation } from "@uwe/security";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";
import { checkRateLimit, clientIpFromHeaders } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "login" });
  if (authError) return authError;

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword?.trim() ?? "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Aktuelles und neues Passwort sind erforderlich." },
      { status: 400 },
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Neues Passwort muss mindestens 8 Zeichen haben." },
      { status: 400 },
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "Das neue Passwort muss sich vom aktuellen unterscheiden." },
      { status: 400 },
    );
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-change-password:${ip}:${user.id}`;
  const rate = checkRateLimit(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
  if (!rate.allowed) {
    const db = createPrismaClient();
    try {
      await logAuditEvent(db, {
        actorUserId: user.id,
        action: "rate_limit_hit",
        targetType: "user",
        targetId: user.id,
        request: auditRequestFromHeaders(request.headers),
        metadata: { endpoint: "change-password" },
      });
    } finally {
      await db.$disconnect();
    }

    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  const db = createPrismaClient();
  const users = createUserService(db);

  try {
    const result = await users.changePassword({
      userId: user.id,
      currentPassword,
      newPassword,
      keepSessionToken: sessionToken,
    });

    if (result === "invalid_current" || result === "no_password") {
      return NextResponse.json({ error: "Passwortänderung fehlgeschlagen." }, { status: 401 });
    }

    if (result === "not_found") {
      return NextResponse.json({ error: "Passwortänderung fehlgeschlagen." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      message: "Passwort wurde geändert. Andere aktive Sitzungen wurden beendet.",
    });
  } finally {
    await db.$disconnect();
  }
}
