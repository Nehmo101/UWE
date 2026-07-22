import type { PrismaClient } from "./client";
import { brainPrisma } from "./brain-client";
import { getAdminStatus } from "./admin-status";
import { createAiUsageRollupService } from "./ai-usage-rollup-service";
import { BUG_REPORT_SEVERITY_LABELS } from "./bug-report-service";
import { getUserRoleCounts } from "./security-dashboard";
import {
  listUnifiedActivity,
  type UnifiedActivityEntry,
} from "./unified-activity-service";

export interface OwnerCockpitWorldRow {
  id: string;
  name: string;
  slug: string;
  isSandbox: boolean;
  pageCount: number;
  memberCount: number;
  lastActivityAt: string | null;
}

export interface OwnerCockpitErrorItem {
  id: string;
  source: "job" | "ai_run" | "mail" | "bug";
  title: string;
  detail: string;
  timestamp: string;
  href: string;
}

export const OWNER_COCKPIT_ERROR_SOURCE_LABELS: Record<
  OwnerCockpitErrorItem["source"],
  string
> = {
  job: "Job",
  ai_run: "AI-Run",
  mail: "Mail",
  bug: "Bug",
};

export interface OwnerCockpitAiUsageSummary {
  todayRequests: number;
  todayCostUsd: number;
  last7DaysRequests: number;
  last7DaysCostUsd: number;
  topFeature: {
    feature: string;
    requestCount: number;
    estimatedCostUsd: number;
  } | null;
}

export interface OwnerCockpitSnapshot {
  timestamp: string;
  ok: boolean;
  worlds: OwnerCockpitWorldRow[];
  users: {
    total: number;
    inactive: number;
    byRole: Awaited<ReturnType<typeof getUserRoleCounts>>;
  };
  errors: OwnerCockpitErrorItem[];
  aiUsage: OwnerCockpitAiUsageSummary;
  recentActivity: UnifiedActivityEntry[];
}

const MS_PER_DAY = 86_400_000;

export async function getOwnerCockpitSnapshot(
  db: PrismaClient,
  options: { activityLimit?: number } = {},
): Promise<OwnerCockpitSnapshot> {
  const activityLimit = Math.min(Math.max(options.activityLimit ?? 12, 1), 30);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysStart = new Date(todayStart.getTime() - 6 * MS_PER_DAY);
  const aiUsageRollups = createAiUsageRollupService(db);

  const [
    worlds,
    pageCounts,
    membershipCounts,
    roleCounts,
    inactiveUsers,
    adminStatus,
    activity,
    openBugs,
    aiUsageToday,
    aiUsageLast7Days,
  ] = await Promise.all([
    db.world.findMany({
      select: { id: true, name: true, slug: true, isSandbox: true },
      orderBy: { name: "asc" },
    }),
    db.page.groupBy({
      by: ["worldId"],
      _count: { _all: true },
    }),
    db.worldMembership.groupBy({
      by: ["worldId"],
      _count: { _all: true },
    }),
    getUserRoleCounts(db),
    db.user.count({ where: { status: "disabled" } }),
    getAdminStatus(db, brainPrisma),
    listUnifiedActivity(db, { limit: activityLimit }),
    db.bugReport.findMany({
      where: { status: { in: ["open", "in_progress"] } },
      select: {
        id: true,
        title: true,
        severity: true,
        module: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    aiUsageRollups.getRollupSummary({ since: todayStart, until: now }),
    aiUsageRollups.getRollupSummary({ since: sevenDaysStart, until: now }),
  ]);

  const pageCountByWorld = new Map(pageCounts.map((row) => [row.worldId, row._count._all]));
  const memberCountByWorld = new Map(
    membershipCounts.map((row) => [row.worldId, row._count._all]),
  );

  const worldIds = worlds.map((world) => world.id);
  const lastActivityRows =
    worldIds.length === 0
      ? []
      : await db.activityLog.groupBy({
          by: ["worldId"],
          where: { worldId: { in: worldIds } },
          _max: { createdAt: true },
        });
  const lastActivityByWorld = new Map(
    lastActivityRows.map((row) => [row.worldId, row._max.createdAt]),
  );

  const errors: OwnerCockpitErrorItem[] = [];

  for (const failure of adminStatus.jobs.recentFailures) {
    errors.push({
      id: `job:${failure.id}`,
      source: "job",
      title: failure.title,
      detail: failure.errorMessage ?? failure.type,
      timestamp: failure.createdAt,
      href: "/jobs",
    });
  }

  for (const failure of adminStatus.aiRuns.recentFailures) {
    errors.push({
      id: `ai:${failure.id}`,
      source: "ai_run",
      title: failure.taskType,
      detail: failure.errorMessage ?? failure.status,
      timestamp: failure.createdAt,
      href: "/admin/ai-gateway",
    });
  }

  if (adminStatus.mail.lastFailure) {
    errors.push({
      id: "mail:last-failure",
      source: "mail",
      title: adminStatus.mail.lastFailure.subject,
      detail: adminStatus.mail.lastFailure.errorMessage ?? "Mail fehlgeschlagen",
      timestamp: adminStatus.mail.lastFailure.createdAt,
      href: "/admin/mail",
    });
  }

  for (const bug of openBugs) {
    errors.push({
      id: `bug:${bug.id}`,
      source: "bug",
      title: bug.title,
      detail: `${BUG_REPORT_SEVERITY_LABELS[bug.severity]}${bug.module ? ` · ${bug.module}` : ""}`,
      timestamp: bug.updatedAt.toISOString(),
      href: "/bugs",
    });
  }

  errors.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const topFeature = aiUsageLast7Days.byFeature.reduce<
    OwnerCockpitAiUsageSummary["topFeature"]
  >((best, row) => {
    if (
      !best ||
      row.estimatedCostUsd > best.estimatedCostUsd ||
      (row.estimatedCostUsd === best.estimatedCostUsd &&
        row.requestCount > best.requestCount)
    ) {
      return {
        feature: row.feature,
        requestCount: row.requestCount,
        estimatedCostUsd: row.estimatedCostUsd,
      };
    }
    return best;
  }, null);

  const totalUsers =
    roleCounts.owner + roleCounts.admin + roleCounts.dm + roleCounts.player;

  return {
    timestamp: new Date().toISOString(),
    ok: adminStatus.ok && errors.length === 0,
    worlds: worlds.map((world) => ({
      id: world.id,
      name: world.name,
      slug: world.slug,
      isSandbox: world.isSandbox,
      pageCount: pageCountByWorld.get(world.id) ?? 0,
      memberCount: memberCountByWorld.get(world.id) ?? 0,
      lastActivityAt: lastActivityByWorld.get(world.id)?.toISOString() ?? null,
    })),
    users: {
      total: totalUsers,
      inactive: inactiveUsers,
      byRole: roleCounts,
    },
    errors: errors.slice(0, 10),
    aiUsage: {
      todayRequests: aiUsageToday.requestCount,
      todayCostUsd: aiUsageToday.estimatedCostUsd,
      last7DaysRequests: aiUsageLast7Days.requestCount,
      last7DaysCostUsd: aiUsageLast7Days.estimatedCostUsd,
      topFeature,
    },
    recentActivity: activity.entries,
  };
}
