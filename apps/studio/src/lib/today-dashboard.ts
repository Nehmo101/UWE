import type { PrismaClient } from "@uwe/database/server";
import {
  createCalendarAggregationService,
  createLifeAdminService,
  createMailLogService,
  createMailPortalService,
  createWorldOverviewService,
  getAppRepository,
  getSystemSettings,
  type AggregatedCalendarItem,
} from "@uwe/database/server";
import { createMaintenanceService } from "@uwe/database/maintenance";
import { createPantryService } from "@uwe/kitchen";
import { getAdminDashboardStatus } from "./admin-dashboard-status";
import { getHomelabCockpitData } from "./homelab-dashboard";

export interface TodayMailSummary {
  recentFailed: number;
  pendingCount: number;
  latestFailedSubject: string | null;
}

export interface TodayDashboardData {
  preferredWorld: {
    slug: string;
    name: string;
    id: string;
  } | null;
  nextSession: {
    title: string;
    sessionNumber: number;
    date: Date | null;
    worldSlug: string;
    id: string;
  } | null;
  calendarToday: AggregatedCalendarItem[];
  calendarThisWeek: AggregatedCalendarItem[];
  mailSummary: TodayMailSummary;
  lifeAdmin: Awaited<ReturnType<ReturnType<typeof createLifeAdminService>["getTodaySummary"]>>;
  homelab: Awaited<ReturnType<typeof getHomelabCockpitData>>;
  jobs: Awaited<ReturnType<typeof getAdminDashboardStatus>>["jobs"];
  household: {
    overdueCount: number;
    soonCount: number;
    upcoming: Awaited<ReturnType<ReturnType<typeof createMaintenanceService>["getUpcoming"]>>;
    expiringPantry: Awaited<ReturnType<ReturnType<typeof createPantryService>["getExpiring"]>>;
    expiredPantryCount: number;
  };
  prioritizedMail: Awaited<
    ReturnType<ReturnType<typeof createMailPortalService>["getInboxPrioritySummary"]>
  >;
  systemOk: boolean;
  systemLabel: string;
  rtxReady: boolean;
  brainEnabled: boolean;
  mailOk: boolean;
  portalAuthRequired: boolean;
  dbOk: boolean;
  backupOk: boolean;
  cloudflareOk: boolean;
}

export function resolvePreferredWorldSlug(
  worlds: Array<{ slug: string }>,
  options: {
    env?: NodeJS.ProcessEnv;
    favoriteWorldSlug?: string | null;
  } = {},
): string | null {
  if (worlds.length === 0) {
    return null;
  }

  const env = options.env ?? process.env;
  const settingsSlug = options.favoriteWorldSlug?.trim();
  if (settingsSlug && worlds.some((world) => world.slug === settingsSlug)) {
    return settingsSlug;
  }

  const configured = env.PREFERRED_WORLD_SLUG?.trim();
  if (configured && worlds.some((world) => world.slug === configured)) {
    return configured;
  }

  const terra = worlds.find((world) => world.slug === "terra");
  if (terra) {
    return terra.slug;
  }

  return worlds[0]?.slug ?? null;
}

export async function getTodayDashboardData(
  db: PrismaClient,
  options: { useMockInference?: boolean } = {},
): Promise<TodayDashboardData> {
  const repo = getAppRepository();
  const lifeAdmin = createLifeAdminService(db);
  const calendarAggregation = createCalendarAggregationService(db);
  const mailLog = createMailLogService(db);
  const mailPortal = createMailPortalService(db);
  const maintenance = createMaintenanceService(db);
  const pantry = createPantryService(db);

  const [worlds, settings] = await Promise.all([repo.listWorlds(), getSystemSettings(db)]);
  const preferredSlug = resolvePreferredWorldSlug(worlds, {
    favoriteWorldSlug: settings.app.favoriteWorldSlug,
  });
  const preferredWorld = preferredSlug
    ? worlds.find((world) => world.slug === preferredSlug) ?? null
    : null;

  let nextSession: TodayDashboardData["nextSession"] = null;
  if (preferredSlug) {
    const overview = await createWorldOverviewService(db).getWorldOverview(preferredSlug);
    if (overview?.nextSession) {
      nextSession = {
        id: overview.nextSession.id,
        title: overview.nextSession.title,
        sessionNumber: overview.nextSession.sessionNumber,
        date: overview.nextSession.date,
        worldSlug: preferredSlug,
      };
    }
  }

  const [
    lifeSummary,
    adminStatus,
    homelab,
    calendarSummary,
    failedLogs,
    pendingLogs,
    upcomingMaintenance,
    expiringPantry,
    prioritizedMail,
  ] = await Promise.all([
    lifeAdmin.getTodaySummary(),
    getAdminDashboardStatus(db, { useMockInference: options.useMockInference }),
    getHomelabCockpitData(db, { useMockInference: options.useMockInference }),
    calendarAggregation.getTodaySummary({
      worldId: preferredWorld?.id,
      worldSlug: preferredSlug ?? undefined,
    }),
    mailLog.list({ status: "failed", limit: 5 }),
    mailLog.list({ status: "pending", limit: 5 }),
    maintenance.getUpcoming(),
    pantry.getExpiring(30),
    mailPortal.getInboxPrioritySummary({ limit: 5 }),
  ]);

  const systemLabel = adminStatus.ok
    ? "System OK"
    : adminStatus.studioSecurity.severity === "critical"
      ? "Security prüfen"
      : "Einschränkungen";

  const dbStatus = homelab.serviceStatuses.find((status) => status.id === "database");
  const backupStatus = homelab.serviceStatuses.find((status) => status.id === "backup");
  const tunnelStatus = homelab.serviceStatuses.find((status) => status.id === "cloudflare_tunnel");

  const overdueCount = upcomingMaintenance.filter((task) => task.overdue).length;
  const soonCount = upcomingMaintenance.filter((task) => task.dueClass === "soon").length;
  const nowMs = Date.now();
  const expiredPantryCount = expiringPantry.filter(
    (item) => item.expiresAt != null && item.expiresAt.getTime() < nowMs,
  ).length;

  return {
    preferredWorld: preferredWorld
      ? { slug: preferredWorld.slug, name: preferredWorld.name, id: preferredWorld.id }
      : null,
    nextSession,
    calendarToday: calendarSummary.today,
    calendarThisWeek: calendarSummary.thisWeek,
    mailSummary: {
      recentFailed: failedLogs.length,
      pendingCount: pendingLogs.length,
      latestFailedSubject: failedLogs[0]?.subject ?? null,
    },
    lifeAdmin: lifeSummary,
    homelab,
    systemOk: adminStatus.ok && homelab.alerts.criticalCount === 0,
    systemLabel,
    rtxReady: adminStatus.rtx.ready,
    brainEnabled: adminStatus.brain.enabled,
    mailOk: !adminStatus.mail.enabled || adminStatus.mail.ok,
    portalAuthRequired: adminStatus.auth.portalAuthRequired,
    dbOk: dbStatus?.ok ?? false,
    backupOk: backupStatus?.ok ?? false,
    cloudflareOk: tunnelStatus?.ok ?? true,
    jobs: adminStatus.jobs,
    household: {
      overdueCount,
      soonCount,
      upcoming: upcomingMaintenance,
      expiringPantry,
      expiredPantryCount,
    },
    prioritizedMail,
  };
}
