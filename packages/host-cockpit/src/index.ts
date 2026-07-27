/**
 * Operations cockpit: the admin status roll-up, the homelab overview and the
 * host schedule files.
 *
 * All of this used to live in `apps/studio/src/lib`. The Studio System hub moved
 * to Brain (Abschnitt D1) and settings moved to the Command Center (D33), so the
 * shared pieces moved out of the app and into a package.
 *
 * The re-exports are named on purpose, not `export *`: the Command Center runs
 * this package through tsx as ESM, and a star re-export is invisible to the CJS
 * export lexer — the import resolves to `default` and blows up at load time.
 * `@uwe/database/server` is explicit for the same reason.
 */
export { getAdminDashboardStatus, type AdminDashboardStatus } from "./admin-status";
export type { InferenceStatus, RtxHealthStatus } from "./admin-status";
export { getHomelabCockpitData, probePortalHealth, type HomelabCockpitData } from "./homelab";
export {
  resolveBriefingSchedulePath,
  syncBackupScheduleFromSettings,
  syncBriefingScheduleFromSettings,
  syncMailScheduleFromSettings,
  syncSchedulesForUpdate,
  type BriefingScheduleConfig,
} from "./schedule-sync";
