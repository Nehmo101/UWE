import type { PrismaClient } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  aggregateAllHardwareErrorHistory,
  aggregateHomelabTodayAlerts,
  buildHomelabRunbooks,
  buildHomelabSecurityChecklist,
  buildHomelabServiceStatuses,
  buildHardwareDeviceCardView,
  detectHardwareUrlWarnings,
  getSecurityDashboardStatus,
  getAreaAccessCounts,
  type HomelabRunbook,
  type HomelabSecurityCheckItem,
  type HomelabServiceStatus,
  type HomelabTodayAlerts,
  type HardwareDeviceCardView,
} from "@uwe/database/server";
import { createLifeAdminService } from "@uwe/database/server";
import { getAdminDashboardStatus } from "./admin-status";

export interface HomelabCockpitData {
  timestamp: string;
  serviceStatuses: HomelabServiceStatus[];
  securityChecks: HomelabSecurityCheckItem[];
  runbooks: HomelabRunbook[];
  urlWarnings: ReturnType<typeof detectHardwareUrlWarnings>;
  deviceCards: HardwareDeviceCardView[];
  errorHistory: ReturnType<typeof aggregateAllHardwareErrorHistory>;
  alerts: HomelabTodayAlerts;
}

export async function probePortalHealth(env: NodeJS.ProcessEnv = process.env): Promise<{
  ok: boolean;
  message: string;
}> {
  const base = env.NEXT_PUBLIC_PORTAL_URL?.trim()?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, message: "NEXT_PUBLIC_PORTAL_URL nicht gesetzt" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${base}/api/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: `Portal Health HTTP ${response.status}` };
    }
    const payload = (await response.json()) as { ok?: boolean; message?: string };
    return {
      ok: payload.ok !== false,
      message: payload.ok !== false ? "Portal erreichbar" : payload.message ?? "Portal meldet Fehler",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal nicht erreichbar";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getHomelabCockpitData(
  db: PrismaClient,
  options: {
    useMockInference?: boolean;
    env?: NodeJS.ProcessEnv;
    /**
     * Pre-computed admin dashboard status. When provided it is reused instead of
     * re-running the (expensive) leak scan and AI/RTX probes. Falls back to an
     * internal computation for standalone callers.
     */
    adminStatus?: Awaited<ReturnType<typeof getAdminDashboardStatus>>;
    /**
     * Pre-computed life-admin today summary. When provided it is reused instead
     * of re-running the ~15-query summary. Falls back to an internal computation.
     */
    lifeSummary?: Awaited<ReturnType<ReturnType<typeof createLifeAdminService>["getTodaySummary"]>>;
  } = {},
): Promise<HomelabCockpitData> {
  const env = options.env ?? process.env;
  const lifeAdmin = createLifeAdminService(brainPrisma, db);
  const [adminStatus, securityStatus, accessCounts, totalUsers, devices, portalProbe] = await Promise.all([
    options.adminStatus ??
      getAdminDashboardStatus(db, { useMockInference: options.useMockInference }),
    getSecurityDashboardStatus(db, { env }),
    getAreaAccessCounts(db),
    db.user.count(),
    lifeAdmin.listHardwareDevices({ limit: 200 }),
    probePortalHealth(env),
  ]);

  const urlWarnings = detectHardwareUrlWarnings(devices);
  const timestamp = new Date().toISOString();

  const serviceStatuses = buildHomelabServiceStatuses({
    system: adminStatus.system,
    studioSecurity: adminStatus.studioSecurity,
    rtxExposure: adminStatus.rtxExposure,
    rtx: {
      ready: adminStatus.rtx.ready,
      online: adminStatus.rtx.online,
      message: adminStatus.rtx.message,
      urlAllowed: adminStatus.rtx.urlAllowed,
      source: adminStatus.rtx.source,
      connectorDegraded: adminStatus.rtx.connectorDegraded,
      connectorOnlineCount: adminStatus.rtx.connectorOnlineCount,
    },
    inference: {
      enabled: adminStatus.inference.enabled,
      online: adminStatus.inference.online,
      message: adminStatus.inference.message,
      provider: adminStatus.inference.provider,
    },
    backup: {
      writable: adminStatus.system.storage.backupsWritable,
      count: securityStatus.backup.backupCount,
      lastAt: securityStatus.backup.lastBackupAt,
      message: securityStatus.backup.message,
    },
    portalProbe,
    timestamp,
  });

  const securityChecks = buildHomelabSecurityChecklist({
    system: adminStatus.system,
    studioSecurity: adminStatus.studioSecurity,
    rtxExposure: adminStatus.rtxExposure,
    accessCounts,
    totalUsers,
    hardwareUrlWarnings: urlWarnings,
    env,
  });

  const lifeSummary = options.lifeSummary ?? (await lifeAdmin.getTodaySummary());
  const alerts = aggregateHomelabTodayAlerts({
    hardwareIssues: lifeSummary.hardwareIssues,
    hardwareUrlWarnings: urlWarnings,
    openSetupSteps: lifeSummary.openSetupSteps,
    serviceStatuses,
    securityChecks,
  });

  return {
    timestamp,
    serviceStatuses,
    securityChecks,
    runbooks: buildHomelabRunbooks(),
    urlWarnings,
    deviceCards: devices.map((device) => buildHardwareDeviceCardView(device, urlWarnings)),
    errorHistory: aggregateAllHardwareErrorHistory(devices),
    alerts,
  };
}
