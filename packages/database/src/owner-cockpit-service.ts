import type { PrismaClient } from "./client";
import { getAdminStatus } from "./admin-status";
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
  source: "job" | "ai_run" | "mail";
  title: string;
  detail: string;
  timestamp: string;
  href: string;
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
  recentActivity: UnifiedActivityEntry[];
}

export async function getOwnerCockpitSnapshot(
  db: PrismaClient,
  options: { activityLimit?: number } = {},
): Promise<OwnerCockpitSnapshot> {
  const activityLimit = Math.min(Math.max(options.activityLimit ?? 12, 1), 30);

  const [worlds, pageCounts, membershipCounts, roleCounts, inactiveUsers, adminStatus, activity] =
    await Promise.all([
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
      getAdminStatus(db),
      listUnifiedActivity(db, { limit: activityLimit }),
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

  errors.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

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
    recentActivity: activity.entries,
  };
}
