import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canViewAuditLog, SESSION_COOKIE_NAME } from "@uwe/auth";
import { buildAccessContext } from "@uwe/auth";
import {
  AUDIT_ACTION_LABELS,
  createAuditLogService,
  createAuthService,
  logAuditEvent,
  type AuditAction,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { auditLogQuerySchema, parseQuery } from "@uwe/security";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";

function parseActions(value: string | undefined): AuditAction[] | undefined {
  if (!value?.trim()) return undefined;
  const actions = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as AuditAction[];
  return actions.length > 0 ? actions : undefined;
}

export async function GET(request: Request) {
  // Zentraler Guard ZUERST: er prüft CSRF, Session-Pflicht und den globalen
  // Portal-Schalter. Die RBAC-Prüfung (canViewAuditLog) bleibt danach — sie
  // beantwortet eine andere Frage (wer darf den Log lesen), nicht ob die
  // Anfrage überhaupt ins Portal darf.
  const authError = await requirePortalApiAuth(request);
  if (authError) {
    return authError;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const db = getSharedPrismaClient();
  const auth = createAuthService(db);

  try {
    const session = token ? await auth.getSessionByToken(token) : null;
    const user = session?.user ? auth.toAuthUser(session.user) : null;

    const ctx = buildAccessContext({
      user,
      worldMembership: null,
    });

    if (!canViewAuditLog(ctx)) {
      await logAuditEvent(db, {
        actorUserId: user?.id ?? null,
        action: "authz_denied",
        targetType: "system",
        metadata: { endpoint: "portal_audit_log", access: ctx.user?.access ?? null },
      });

      return NextResponse.json({ error: "Keine Berechtigung für Audit Log." }, { status: 403 });
    }

    // Geklemmt statt `Number(...)`: `?limit=abc` ergab NaN, und `take: NaN`
    // lässt Prisma die gesamte Tabelle liefern (Vollscan).
    const parsed = parseQuery(request.url, auditLogQuerySchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const audit = createAuditLogService(db);
    const entries = await audit.list({
      actions: parseActions(parsed.data.action),
      actorUserId: parsed.data.actorUserId,
      worldId: parsed.data.worldId,
      from: parsed.data.from ?? undefined,
      to: parsed.data.to ?? undefined,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    return NextResponse.json({
      entries: entries.map((entry) => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
        actionLabel: AUDIT_ACTION_LABELS[entry.action],
      })),
    });
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}
