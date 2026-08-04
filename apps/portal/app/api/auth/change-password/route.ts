import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  auditRequestFromHeaders,
  createUserService,
  logAuditEvent,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { SESSION_COOKIE_NAME } from "@uwe/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!hasSession) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
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
    return NextResponse.json({ error: "Neues Passwort ist erforderlich." }, { status: 400 });
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

  if (!initialPasswordOnly && currentPassword === newPassword) {
    return NextResponse.json(
      { error: "Das neue Passwort muss sich vom aktuellen unterscheiden." },
      { status: 400 },
    );
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `portal-change-password:${ip}:${user.id}`;
  const rate = await checkRateLimitAsync(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
  if (!rate.allowed) {
    const db = getSharedPrismaClient();
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
      await disconnectPrismaClientIfOwned(db);
    }

    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  const db = getSharedPrismaClient();
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

    if (result === "invalid_current" || result === "no_password" || result === "not_found") {
      return NextResponse.json({ error: "Passwortänderung fehlgeschlagen." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      message: "Passwort wurde geändert. Andere aktive Sitzungen wurden beendet.",
    });
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}
