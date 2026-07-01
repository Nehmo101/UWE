import type { PrismaClient } from "./client";
import { ACTIVITY_ACTION_LABELS, createActivityLogService } from "./activity-log-service";
import { AUDIT_ACTION_LABELS, createAuditLogService } from "./audit-log-service";
import { createAiGatewayService } from "./ai-gateway-service";
import type { ActivityAction, AuditAction } from "./generated/prisma/client";

export type UnifiedActivitySource = "activity" | "audit" | "ai_usage";

export type UnifiedActivitySeverity = "info" | "warn" | "error";

export const UNIFIED_ACTIVITY_SOURCE_LABELS: Record<UnifiedActivitySource, string> = {
  activity: "Aktivität",
  audit: "Audit",
  ai_usage: "KI-Nutzung",
};

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
  actorDisplayName: string | null;
  targetHref: string | null;
  severity: UnifiedActivitySeverity;
}

export interface ListUnifiedActivityOptions {
  limit?: number;
  offset?: number;
  source?: UnifiedActivitySource;
  worldId?: string;
  worldSlug?: string;
  since?: Date;
  until?: Date;
  severity?: UnifiedActivitySeverity;
}

const MAX_FETCH_PER_SOURCE = 250;

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

async function resolveWorldId(
  db: PrismaClient,
  options: Pick<ListUnifiedActivityOptions, "worldId" | "worldSlug">,
): Promise<string | undefined> {
  if (options.worldId) {
    return options.worldId;
  }
  if (!options.worldSlug) {
    return undefined;
  }
  const world = await db.world.findUnique({
    where: { slug: options.worldSlug },
    select: { id: true },
  });
  return world?.id;
}

function formatAuditSummary(
  action: AuditAction,
  targetType: string | null,
  metadata: unknown,
): string {
  const base = AUDIT_ACTION_LABELS[action];
  const meta =
    metadata && typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)
      : null;
  const surface = typeof meta?.surface === "string" ? meta.surface : null;
  const parts = [base];
  if (targetType) {
    parts.push(`(${targetType})`);
  }
  if (surface) {
    parts.push(`· ${surface}`);
  }
  return parts.join(" ");
}

export async function listUnifiedActivity(
  db: PrismaClient,
  options: ListUnifiedActivityOptions = {},
): Promise<{ entries: UnifiedActivityEntry[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const source = options.source;
  const resolvedWorldId = await resolveWorldId(db, options);
  const fetchLimit = Math.min(limit + offset + 50, MAX_FETCH_PER_SOURCE);

  const entries: UnifiedActivityEntry[] = [];
  const actorIds = new Set<string>();

  if (!source || source === "activity") {
    const activity = createActivityLogService(db);
    const rows = await activity.list({
      worldId: resolvedWorldId,
      since: options.since,
      until: options.until,
      limit: fetchLimit,
    });
    for (const row of rows) {
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
        actorDisplayName: null,
        targetHref: row.targetHref,
        severity: severityForActivity(row.action),
      });
    }
  }

  if (!source || source === "audit") {
    const audit = createAuditLogService(db);
    const rows = await audit.list({
      worldId: resolvedWorldId,
      from: options.since,
      to: options.until,
      limit: fetchLimit,
    });
    for (const row of rows) {
      if (row.actorUserId) {
        actorIds.add(row.actorUserId);
      }
      entries.push({
        id: `audit:${row.id}`,
        source: "audit",
        timestamp: row.timestamp,
        action: row.action,
        actionLabel: AUDIT_ACTION_LABELS[row.action],
        summary: formatAuditSummary(row.action, row.targetType, row.metadataJson),
        worldId: row.worldId,
        worldSlug: null,
        actorUserId: row.actorUserId,
        actorDisplayName: null,
        targetHref: null,
        severity: severityForAudit(row.action),
      });
    }
  }

  if ((!source || source === "ai_usage") && !resolvedWorldId) {
    const gateway = createAiGatewayService(db);
    const rows = await gateway.listUsageLogs({
      since: options.since,
      limit: fetchLimit,
    });
    for (const row of rows) {
      if (row.userId) {
        actorIds.add(row.userId);
      }
      if (options.until && row.createdAt >= options.until) {
        continue;
      }
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
        actorDisplayName: row.userDisplayName,
        targetHref: "/admin/ai-gateway",
        severity: row.success ? "info" : "error",
      });
    }
  }

  if (actorIds.size > 0) {
    const users = await db.user.findMany({
      where: { id: { in: [...actorIds] } },
      select: { id: true, displayName: true },
    });
    const namesById = new Map(users.map((user) => [user.id, user.displayName]));
    for (const entry of entries) {
      if (entry.actorUserId && !entry.actorDisplayName) {
        entry.actorDisplayName = namesById.get(entry.actorUserId) ?? null;
      }
    }
  }

  const worldIds = [
    ...new Set(entries.map((entry) => entry.worldId).filter((id): id is string => Boolean(id))),
  ];
  if (worldIds.length > 0) {
    const worlds = await db.world.findMany({
      where: { id: { in: worldIds } },
      select: { id: true, slug: true },
    });
    const slugById = new Map(worlds.map((world) => [world.id, world.slug]));
    for (const entry of entries) {
      if (entry.worldId && !entry.worldSlug) {
        entry.worldSlug = slugById.get(entry.worldId) ?? null;
      }
    }
  }

  let filtered = entries;
  if (options.severity) {
    filtered = filtered.filter((entry) => entry.severity === options.severity);
  }

  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const total = await countUnifiedActivity(db, {
    ...options,
    worldId: resolvedWorldId,
  });

  return {
    entries: filtered.slice(offset, offset + limit),
    total,
  };
}

export async function countUnifiedActivity(
  db: PrismaClient,
  options: Omit<ListUnifiedActivityOptions, "limit" | "offset"> & { worldId?: string },
): Promise<number> {
  const source = options.source;
  const resolvedWorldId =
    options.worldId ?? (await resolveWorldId(db, options));

  const activityWhere = {
    ...(resolvedWorldId ? { worldId: resolvedWorldId } : {}),
    ...(options.since || options.until
      ? {
          createdAt: {
            ...(options.since ? { gte: options.since } : {}),
            ...(options.until ? { lt: options.until } : {}),
          },
        }
      : {}),
  };

  const auditWhere = {
    ...(resolvedWorldId ? { worldId: resolvedWorldId } : {}),
    ...(options.since || options.until
      ? {
          timestamp: {
            ...(options.since ? { gte: options.since } : {}),
            ...(options.until ? { lte: options.until } : {}),
          },
        }
      : {}),
  };

  const aiWhere = {
    ...(options.since || options.until
      ? {
          createdAt: {
            ...(options.since ? { gte: options.since } : {}),
            ...(options.until ? { lt: options.until } : {}),
          },
        }
      : {}),
  };

  const [activityCount, auditCount, aiCount] = await Promise.all([
    !source || source === "activity"
      ? db.activityLog.count({ where: activityWhere })
      : Promise.resolve(0),
    !source || source === "audit"
      ? db.auditLog.count({ where: auditWhere })
      : Promise.resolve(0),
    (!source || source === "ai_usage") && !resolvedWorldId
      ? db.aiUsageLog.count({ where: aiWhere })
      : Promise.resolve(0),
  ]);

  let total = activityCount + auditCount + aiCount;

  if (options.severity) {
    const { entries } = await listUnifiedActivity(db, {
      ...options,
      worldId: resolvedWorldId,
      limit: MAX_FETCH_PER_SOURCE,
      offset: 0,
      severity: undefined,
    });
    total = entries.filter((entry) => entry.severity === options.severity).length;
  }

  return total;
}
