import {
  auditRequestFromHeaders,
  createPrismaClient,
  logAuditEvent,
} from "@uwe/database/server";
import { createAuthIdentityService } from "@uwe/database/auth-identities";
import { GOOGLE_IDENTITY_PROVIDER } from "@uwe/auth/server";
import { guardStudioMutation } from "@uwe/security";
import { jsonError } from "@/src/lib/api-response";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";

/**
 * Removes the session user's Google link. Lockout guard: refused while the
 * account has neither a password nor a passkey — unlinking would strand it.
 */
export async function POST(request: Request) {
  const guardError = await guardStudioMutation(request, { rateLimit: "login" });
  if (guardError) return guardError;

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return jsonError("Anmeldung erforderlich.", 401);
  }

  const db = createPrismaClient();
  try {
    const identities = createAuthIdentityService(db);
    if (!(await identities.hasAlternativeLoginMethod(user.id))) {
      return jsonError(
        "Verknüpfung kann nicht entfernt werden: Richte zuerst ein Passwort oder einen Passkey ein.",
        400,
      );
    }

    const removed = await identities.unlinkForUser(user.id, GOOGLE_IDENTITY_PROVIDER);
    if (!removed) {
      return jsonError("Keine Google-Verknüpfung vorhanden.", 404);
    }

    await logAuditEvent(db, {
      actorUserId: user.id,
      action: "oauth_unlinked",
      targetType: "user",
      targetId: user.id,
      request: auditRequestFromHeaders(request.headers),
      metadata: { provider: GOOGLE_IDENTITY_PROVIDER },
    });

    return Response.json({ ok: true });
  } finally {
    await db.$disconnect();
  }
}
