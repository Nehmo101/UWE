import type {
  PrismaClient,
  HomelabServiceStatus,
  HomelabSecurityCheckItem,
  HomelabTodayAlerts,
} from "@uwe/database/server";
import { createHealthMetricsService, type HealthMetrics } from "@uwe/database/health-metrics";
import { resolveAllDataPaths } from "@uwe/assets";
import {
  collectCommandCenterSnapshot,
  type CommandCenterSnapshot,
  type DiskTarget,
} from "@uwe/host-monitor";
import { getHomelabCockpitData } from "./homelab-dashboard";

/**
 * Command Center data = new host telemetry (@uwe/host-monitor) plus the
 * existing UWE operations signals, aggregated in one place so the page and the
 * polling API return the identical shape. Business logic stays out of the route
 * handler (golden rule) — this lib is the single source.
 */

export interface CommandCenterOperations {
  health: HealthMetrics;
  services: HomelabServiceStatus[];
  securityChecks: HomelabSecurityCheckItem[];
  alerts: HomelabTodayAlerts;
}

export interface CommandCenterData {
  host: CommandCenterSnapshot;
  operations: CommandCenterOperations;
}

/** Distinct data directories worth a disk tile (dedupe identical mounts). */
export function resolveDiskTargets(): DiskTarget[] {
  const paths = resolveAllDataPaths();
  const candidates: DiskTarget[] = [
    { label: "Daten (DB & Uploads)", path: paths.dataDir },
    { label: "Backups", path: paths.backupsDir },
    { label: "Exporte", path: paths.exportsDir },
  ];
  const seen = new Set<string>();
  return candidates.filter((target) => {
    if (seen.has(target.path)) return false;
    seen.add(target.path);
    return true;
  });
}

export async function getCommandCenterData(
  db: PrismaClient,
  options: { useMockInference?: boolean } = {},
): Promise<CommandCenterData> {
  const [host, health, homelab] = await Promise.all([
    collectCommandCenterSnapshot({
      nowMs: Date.now(),
      diskTargets: resolveDiskTargets(),
    }),
    createHealthMetricsService(db).getMetrics(),
    getHomelabCockpitData(db, { useMockInference: options.useMockInference }),
  ]);

  return {
    host,
    operations: {
      health,
      services: homelab.serviceStatuses,
      securityChecks: homelab.securityChecks,
      alerts: homelab.alerts,
    },
  };
}
