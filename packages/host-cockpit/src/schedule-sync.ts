import fs from "node:fs";
import path from "node:path";
import { resolveDataDir } from "@uwe/assets";
import { writeBackupScheduleConfig } from "@uwe/backup";
import { writeMailScheduleConfig } from "@uwe/mail";
import type {
  BackupSettings,
  BriefingSettings,
  MailSettings,
  UweSystemSettings,
  UweSystemSettingsUpdate,
} from "@uwe/database/server";

/**
 * Self-Service-Konfig: DB-Setting → host-lesbare JSON → systemd liest sie.
 *
 * Die drei Timer (Backup, Briefing, Mail-Abruf) bleiben statisch; ob und wann
 * sie etwas tun, steht in diesen Dateien. Wer Einstellungen schreibt, muss sie
 * mitschreiben — sonst laufen die Timer weiter nach dem alten Stand.
 * Siehe docs/engineering/self-service-config.md.
 */

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
    process.env.UWE_BRIEFING_DIR?.trim() ||
    // Fall back to the persistent data dir (UWE_DATA_DIR), NOT process.cwd():
    // the standalone Next server's cwd is not the repo root, so a cwd-relative
    // path is not host-readable and is blocked by the systemd sandbox. Mirrors
    // the backup writer (resolveBackupsDirFromEnv → resolveDataDir).
    path.join(resolveDataDir(), "briefings");
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

/** Mirror DB backup settings to host-readable schedule.json for the systemd timer. */
export function syncBackupScheduleFromSettings(
  backup: Pick<BackupSettings, "autoBackupEnabled">,
): void {
  writeBackupScheduleConfig({
    enabled: backup.autoBackupEnabled,
    frequency: "daily",
  });
}

/** Mirror DB mail auto-sync settings to host-readable schedule.json for the systemd timer. */
export function syncMailScheduleFromSettings(
  mail: Pick<MailSettings, "autoSyncEnabled" | "autoSyncIntervalMinutes">,
): void {
  writeMailScheduleConfig({
    enabled: mail.autoSyncEnabled === true,
    intervalMinutes: mail.autoSyncIntervalMinutes,
  });
}

/**
 * Writes every host-readable schedule file a settings update touched.
 *
 * Takes the *saved* settings, not the update, because a partial update leaves
 * the other keys of a group at their stored value — writing the schedule from
 * the patch alone would clear whatever the patch did not mention.
 */
export function syncSchedulesForUpdate(
  update: UweSystemSettingsUpdate,
  saved: UweSystemSettings,
): void {
  if (update.backup) syncBackupScheduleFromSettings(saved.backup);
  if (update.briefing) syncBriefingScheduleFromSettings(saved.briefing);
  if (update.mail) syncMailScheduleFromSettings(saved.mail);
}
