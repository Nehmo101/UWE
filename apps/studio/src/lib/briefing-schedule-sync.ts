import fs from "node:fs";
import path from "node:path";

/** Host-lesbare Konfiguration, die `deploy/scripts/uwe-briefing.sh` liest. */
export interface BriefingScheduleConfig {
  enabled: boolean;
}

/** Absoluter Pfad der host-lesbaren Briefing-Schedule-Datei. */
export function resolveBriefingSchedulePath(): string {
  const baseDir =
    process.env.UWE_BRIEFING_DIR?.trim() || path.join(process.cwd(), "data", "briefings");
  return path.join(baseDir, "schedule.json");
}

/**
 * Spiegelt den DB-Setting `autoBriefingEnabled` in eine host-lesbare
 * `schedule.json`, die der systemd-Timer über `uwe-briefing.sh` liest — damit
 * das Auto-Briefing in UWE selbst ein-/ausschaltbar ist, ohne Host-Eingriff.
 * Siehe docs/engineering/self-service-config.md.
 */
export function syncBriefingScheduleFromSettings(enabled: boolean): void {
  const configPath = resolveBriefingSchedulePath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const config: BriefingScheduleConfig = { enabled: enabled !== false };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
