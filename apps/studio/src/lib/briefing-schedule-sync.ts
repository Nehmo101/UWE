import fs from "node:fs";
import path from "node:path";
import type { BriefingSettings } from "@uwe/database/server";

/** Host-lesbare Konfiguration, die `deploy/scripts/uwe-briefing.sh` liest. */
export interface BriefingScheduleConfig {
  enabled: boolean;
  /** Uhrzeit "HH:MM", zu der das Briefing täglich laufen soll. */
  time: string;
}

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Absoluter Pfad der host-lesbaren Briefing-Schedule-Datei. */
export function resolveBriefingSchedulePath(): string {
  const baseDir =
    process.env.UWE_BRIEFING_DIR?.trim() || path.join(process.cwd(), "data", "briefings");
  return path.join(baseDir, "schedule.json");
}

function normalizeTime(time: string | undefined): string {
  return typeof time === "string" && TIME_HHMM.test(time) ? time : "07:00";
}

/**
 * Spiegelt die DB-Briefing-Settings (an/aus + Uhrzeit) in eine host-lesbare
 * `schedule.json`, die der systemd-Timer über `uwe-briefing.sh` liest — damit
 * das Auto-Briefing in UWE selbst konfigurierbar ist, ohne Host-Eingriff.
 * Siehe docs/engineering/self-service-config.md.
 */
export function syncBriefingScheduleFromSettings(
  briefing: Pick<BriefingSettings, "autoBriefingEnabled" | "time">,
): void {
  const configPath = resolveBriefingSchedulePath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const config: BriefingScheduleConfig = {
    enabled: briefing.autoBriefingEnabled !== false,
    time: normalizeTime(briefing.time),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
