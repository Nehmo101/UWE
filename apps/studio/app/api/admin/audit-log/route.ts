import { NextResponse } from "next/server";
import {
  AUDIT_ACTION_LABELS,
  createAuditLogService,
  prisma,
  type AuditAction,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

function parseActions(value: string | null): AuditAction[] | undefined {
  if (!value?.trim()) return undefined;
  const actions = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as AuditAction[];
  return actions.length > 0 ? actions : undefined;
}

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const actions = parseActions(searchParams.get("action"));
  const actorUserId = searchParams.get("actorUserId") ?? undefined;
  const worldId = searchParams.get("worldId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const audit = createAuditLogService(prisma);
  const entries = await audit.list({
    actions,
    actorUserId,
    worldId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  const total = await audit.count({
    actions,
    actorUserId,
    worldId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  return NextResponse.json({
    entries: entries.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
      actionLabel: AUDIT_ACTION_LABELS[entry.action],
    })),
    total,
    actionLabels: AUDIT_ACTION_LABELS,
  });
}
