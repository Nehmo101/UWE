import { NextResponse } from "next/server";
import {
  auditRequestFromHeaders,
  createPrismaClient,
  createTwoFactorService,
  logAuditEvent,
} from "@uwe/database/server";
import { guardStudioMutation } from "@uwe/security";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";
import { checkRateLimit, clientIpFromHeaders } from "@/src/lib/rate-limit";

async function requireSessionUser(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "login" });
  if (authError) return { error: authError } as const;

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return {
      error: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }),
    } as const;
  }

  return { user } as const;
}

export async function handleTwoFactorStatus(request: Request) {
  const session = await requireSessionUser(request);
  if ("error" in session) return session.error;

  const db = createPrismaClient();
  const twoFactor = createTwoFactorService(db);
  try {
    return NextResponse.json({ enabled: await twoFactor.isEnabled(session.user.id) });
  } finally {
    await db.$disconnect();
  }
}

export async function handleTwoFactorSetup(request: Request) {
  const session = await requireSessionUser(request);
  if ("error" in session) return session.error;

  const db = createPrismaClient();
  const twoFactor = createTwoFactorService(db);
  try {
    if (await twoFactor.isEnabled(session.user.id)) {
      return NextResponse.json({ error: "2FA ist bereits aktiv." }, { status: 400 });
    }

    const setup = await twoFactor.beginSetup(
      session.user.id,
      session.user.email ?? session.user.displayName,
    );
    return NextResponse.json(setup);
  } finally {
    await db.$disconnect();
  }
}

export async function handleTwoFactorActivate(request: Request) {
  const session = await requireSessionUser(request);
  if ("error" in session) return session.error;

  const body = (await request.json()) as { code?: string };
  const code = body.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "Code ist erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `2fa-activate:${ip}:${session.user.id}`;
  const rate = checkRateLimit(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();
  const twoFactor = createTwoFactorService(db);
  try {
    const ok = await twoFactor.confirmSetup(session.user.id, code);
    if (!ok) {
      await logAuditEvent(db, {
        actorUserId: session.user.id,
        action: "mfa_challenge_failed",
        targetType: "user",
        targetId: session.user.id,
        request: auditRequestFromHeaders(request.headers),
      });
      return NextResponse.json({ error: "Ungültiger Code." }, { status: 400 });
    }

    await logAuditEvent(db, {
      actorUserId: session.user.id,
      action: "mfa_enabled",
      targetType: "user",
      targetId: session.user.id,
      request: auditRequestFromHeaders(request.headers),
    });

    return NextResponse.json({
      ok: true,
      message: "Zwei-Faktor-Authentifizierung wurde aktiviert.",
    });
  } finally {
    await db.$disconnect();
  }
}

export async function handleTwoFactorDisable(request: Request) {
  const session = await requireSessionUser(request);
  if ("error" in session) return session.error;

  const body = (await request.json()) as { code?: string };
  const code = body.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "Code ist erforderlich." }, { status: 400 });
  }

  const db = createPrismaClient();
  const twoFactor = createTwoFactorService(db);
  try {
    if (!(await twoFactor.isEnabled(session.user.id))) {
      return NextResponse.json({ error: "2FA ist nicht aktiv." }, { status: 400 });
    }

    const challenge = await twoFactor.createLoginChallenge(session.user.id);
    const verified = await twoFactor.verifyLoginChallenge(challenge.challengeToken, code);
    if (!verified || verified.userId !== session.user.id) {
      await logAuditEvent(db, {
        actorUserId: session.user.id,
        action: "mfa_challenge_failed",
        targetType: "user",
        targetId: session.user.id,
        request: auditRequestFromHeaders(request.headers),
      });
      return NextResponse.json({ error: "Ungültiger Code." }, { status: 400 });
    }

    await twoFactor.disable(session.user.id);
    await logAuditEvent(db, {
      actorUserId: session.user.id,
      action: "mfa_disabled",
      targetType: "user",
      targetId: session.user.id,
      request: auditRequestFromHeaders(request.headers),
    });

    return NextResponse.json({
      ok: true,
      message: "Zwei-Faktor-Authentifizierung wurde deaktiviert.",
    });
  } finally {
    await db.$disconnect();
  }
}
