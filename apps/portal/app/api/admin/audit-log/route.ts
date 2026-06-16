import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canViewAuditLog, SESSION_COOKIE_NAME } from "@uwe/auth";
import { buildAccessContext } from "@uwe/auth";
import {
  AUDIT_ACTION_LABELS,
  createAuditLogService,
  createAuthService,
  createPrismaClient,
  logAuditEvent,
  type AuditAction,
} from "@uwe/database/server";

function parseActions(value: string | null): AuditAction[] | undefined {
  if (!value?.trim()) return undefined;
  const actions = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as AuditAction[];
  return actions.length > 0 ? actions : undefined;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const session = token ? await auth.getSessionByToken(token) : null;
    const user = session?.user ? auth.toAuthUser(session.user) : null;

    const ctx = buildAccessContext({
      user,
      worldMembership: null,
      guestModeEnabled: false,
    });

    if (!canViewAuditLog(ctx)) {
      await logAuditEvent(db, {
        actorUserId: user?.id ?? null,
        action: "authz_denied",
        targetType: "system",
        metadata: { endpoint: "portal_audit_log", role: ctx.effectiveRole },
      });

      return NextResponse.json({ error: "Keine Berechtigung für Audit Log." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const audit = createAuditLogService(db);
    const entries = await audit.list({
      actions: parseActions(searchParams.get("action")),
      actorUserId: searchParams.get("actorUserId") ?? undefined,
      worldId: searchParams.get("worldId") ?? undefined,
      from: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
      to: searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined,
      limit: Number(searchParams.get("limit") ?? "50"),
      offset: Number(searchParams.get("offset") ?? "0"),
    });

    return NextResponse.json({
      entries: entries.map((entry) => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
        actionLabel: AUDIT_ACTION_LABELS[entry.action],
      })),
    });
  } finally {
    await db.$disconnect();
  }
}
