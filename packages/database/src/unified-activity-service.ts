import type { PrismaClient } from "./client";
import { ACTIVITY_ACTION_LABELS, createActivityLogService } from "./activity-log-service";
import { AUDIT_ACTION_LABELS, createAuditLogService } from "./audit-log-service";
import { createAiGatewayService } from "./ai-gateway-service";
import type { ActivityAction, AuditAction } from "./generated/prisma/client";

export type UnifiedActivitySource = "activity" | "audit" | "ai_usage";

export type UnifiedActivitySeverity = "info" | "warn" | "error";

export interface UnifiedActivityEntry {
  id: string;
  source: UnifiedActivitySource;
  timestamp: Date;
  action: string;
  actionLabel: string;
  summary: string;
  worldId: string | null;
  worldSlug: string | null;
  actorUserId: string | null;
  targetHref: string | null;
  severity: UnifiedActivitySeverity;
}

export interface ListUnifiedActivityOptions {
  limit?: number;
  offset?: number;
  source?: UnifiedActivitySource;
  worldId?: string;
  since?: Date;
}

function severityForActivity(action: ActivityAction): UnifiedActivitySeverity {
  if (action === "error") return "error";
  if (action === "warning") return "warn";
  return "info";
}

function severityForAudit(action: AuditAction): UnifiedActivitySeverity {
  if (action === "login_failed" || action === "authz_denied" || action === "rate_limit_hit") {
    return "warn";
  }
  if (action === "import_failed") return "error";
  return "info";
}

export async function listUnifiedActivity(
  db: PrismaClient,
  options: ListUnifiedActivityOptions = {},
): Promise<{ entries: UnifiedActivityEntry[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const fetchLimit = Math.min(limit + offset, 150);
  const source = options.source;

  const entries: UnifiedActivityEntry[] = [];

  if (!source || source === "activity") {
    const activity = createActivityLogService(db);
    const rows = await activity.list({
      worldId: options.worldId,
      limit: fetchLimit,
    });
    for (const row of rows) {
      if (options.since && row.createdAt < options.since) continue;
      entries.push({
        id: `activity:${row.id}`,
        source: "activity",
        timestamp: row.createdAt,
        action: row.action,
        actionLabel: ACTIVITY_ACTION_LABELS[row.action],
        summary: row.summary,
        worldId: row.worldId,
        worldSlug: row.worldSlug,
        actorUserId: null,
        targetHref: row.targetHref,
        severity: severityForActivity(row.action),
      });
    }
  }

  if (!source || source === "audit") {
    const audit = createAuditLogService(db);
    const rows = await audit.list({
      worldId: options.worldId,
      from: options.since,
      limit: fetchLimit,
    });
    for (const row of rows) {
      entries.push({
        id: `audit:${row.id}`,
        source: "audit",
        timestamp: row.timestamp,
        action: row.action,
        actionLabel: AUDIT_ACTION_LABELS[row.action],
        summary: `${AUDIT_ACTION_LABELS[row.action]}${row.targetId ? ` (${row.targetType})` : ""}`,
        worldId: row.worldId,
        worldSlug: null,
        actorUserId: row.actorUserId,
        targetHref: null,
        severity: severityForAudit(row.action),
      });
    }
  }

  if (!source || source === "ai_usage") {
    const gateway = createAiGatewayService(db);
    const rows = await gateway.listUsageLogs({
      since: options.since,
      limit: fetchLimit,
    });
    for (const row of rows) {
      entries.push({
        id: `ai:${row.id}`,
        source: "ai_usage",
        timestamp: row.createdAt,
        action: row.feature,
        actionLabel: row.success ? "KI-Anfrage" : "KI-Fehler",
        summary: row.success
          ? `${row.feature} · ${row.provider}/${row.model ?? "—"}`
          : `${row.feature}: ${row.errorMessage ?? "Fehler"}`,
        worldId: null,
        worldSlug: null,
        actorUserId: row.userId,
        targetHref: "/admin/ai-gateway",
        severity: row.success ? "info" : "error",
      });
    }
  }

  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    entries: entries.slice(offset, offset + limit),
    total: entries.length,
  };
}
