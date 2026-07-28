import { NextResponse } from "next/server";
import {
  auditRequestFromHeaders,
  createPrismaClient,
  logAuditEvent,
} from "@uwe/database/server";
import { createAuthIdentityService } from "@uwe/database/auth-identities";
import { GOOGLE_IDENTITY_PROVIDER } from "@uwe/auth/server";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

/**
 * Removes the session user's Google link. Lockout guard: refused while the
 * account has neither a password nor a passkey — unlinking would strand it.
 */
export async function POST(request: Request) {
  const guardError = await requirePortalApiAuth(request);
  if (guardError) return guardError;

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const db = createPrismaClient();
  try {
    const identities = createAuthIdentityService(db);
    if (!(await identities.hasAlternativeLoginMethod(user.id))) {
      return NextResponse.json(
        {
          error:
            "Verknüpfung kann nicht entfernt werden: Richte zuerst ein Passwort oder einen Passkey ein.",
        },
        { status: 400 },
      );
    }

    const removed = await identities.unlinkForUser(user.id, GOOGLE_IDENTITY_PROVIDER);
    if (!removed) {
      return NextResponse.json({ error: "Keine Google-Verknüpfung vorhanden." }, { status: 404 });
    }

    await logAuditEvent(db, {
      actorUserId: user.id,
      action: "oauth_unlinked",
      targetType: "user",
      targetId: user.id,
      request: auditRequestFromHeaders(request.headers),
      metadata: { provider: GOOGLE_IDENTITY_PROVIDER },
    });

    return NextResponse.json({ ok: true });
  } finally {
    await db.$disconnect();
  }
}
