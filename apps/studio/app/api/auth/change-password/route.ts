import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { cookies } from "next/headers";
import {
  auditRequestFromHeaders,
  createPrismaClient,
  createUserService,
  logAuditEvent,
} from "@uwe/database/server";
import { SESSION_COOKIE_NAME } from "@uwe/auth";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "login" });
  if (authError) return authError;

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return jsonError("Anmeldung erforderlich.", 401);
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
    initialPasswordOnly?: boolean;
  };

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword?.trim() ?? "";
  const initialPasswordOnly = body.initialPasswordOnly === true;

  if (!newPassword) {
    return NextResponse.json(
      { error: "Neues Passwort ist erforderlich." },
      { status: 400 },
    );
  }

  if (!initialPasswordOnly && !currentPassword) {
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
  const rate = await checkRateLimitAsync(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
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
    const result = initialPasswordOnly
      ? await users.setInitialPassword({
          userId: user.id,
          newPassword,
          keepSessionToken: sessionToken,
        })
      : await users.changePassword({
          userId: user.id,
          currentPassword,
          newPassword,
          keepSessionToken: sessionToken,
        });

    if (result === "initial_password_required") {
      return NextResponse.json(
        { error: "Bitte nutze „Erstes Passwort setzen“ oder /forgot-password." },
        { status: 400 },
      );
    }

    if (result === "invalid_current" || result === "no_password") {
      return jsonError("Passwortänderung fehlgeschlagen.", 401);
    }

    if (result === "not_found") {
      return jsonError("Passwortänderung fehlgeschlagen.", 401);
    }

    return NextResponse.json({
      ok: true,
      message: "Passwort wurde geändert. Andere aktive Sitzungen wurden beendet.",
    });
  } finally {
    await db.$disconnect();
  }
}
