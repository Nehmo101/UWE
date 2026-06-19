import type { PrismaClient } from "@uwe/database/server";
import {
  createCalendarAggregationService,
  createLifeAdminService,
  createMailLogService,
  createWorldOverviewService,
  getAppRepository,
  getSystemSettings,
  type AggregatedCalendarItem,
} from "@uwe/database/server";
import { getAdminDashboardStatus } from "./admin-dashboard-status";

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
  systemOk: boolean;
  systemLabel: string;
  rtxReady: boolean;
  brainEnabled: boolean;
  mailOk: boolean;
  portalAuthRequired: boolean;
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

  const [lifeSummary, adminStatus, calendarSummary, failedLogs, pendingLogs] = await Promise.all([
    lifeAdmin.getTodaySummary(),
    getAdminDashboardStatus(db, { useMockInference: options.useMockInference }),
    calendarAggregation.getTodaySummary({
      worldId: preferredWorld?.id,
      worldSlug: preferredSlug ?? undefined,
    }),
    mailLog.list({ status: "failed", limit: 5 }),
    mailLog.list({ status: "pending", limit: 5 }),
  ]);

  const systemLabel = adminStatus.ok
    ? "System OK"
    : adminStatus.studioSecurity.severity === "critical"
      ? "Security prüfen"
      : "Einschränkungen";

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
    systemOk: adminStatus.ok,
    systemLabel,
    rtxReady: adminStatus.rtx.ready,
    brainEnabled: adminStatus.brain.enabled,
    mailOk: !adminStatus.mail.enabled || adminStatus.mail.ok,
    portalAuthRequired: adminStatus.auth.portalAuthRequired,
  };
}
