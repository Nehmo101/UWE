import fs from "node:fs";
import path from "node:path";
import { resolveDataDir } from "@uwe/assets";

export type MailSyncIntervalMinutes = 5 | 15 | 30 | 60;

export interface MailScheduleConfig {
  enabled: boolean;
  /** Sync interval in minutes — host timer ticks more often and gates on this value. */
  intervalMinutes: MailSyncIntervalMinutes;
}

const VALID_INTERVALS: MailSyncIntervalMinutes[] = [5, 15, 30, 60];

export function resolveMailSchedulePath(baseDir?: string): string {
  const root =
    baseDir?.trim() ||
    process.env.UWE_MAIL_DIR?.trim() ||
    // Fall back to the persistent data dir (UWE_DATA_DIR), NOT process.cwd():
    // the standalone Next server runs with a cwd that is not the repo root, so a
    // cwd-relative path lands in a non-host-readable, sandbox-blocked location.
    // Mirrors the backup writer (resolveBackupsDirFromEnv → resolveDataDir).
    path.join(resolveDataDir(), "mail");
  return path.join(root, "schedule.json");
}

export function readMailScheduleConfig(baseDir?: string): MailScheduleConfig {
  const configPath = resolveMailSchedulePath(baseDir);
  if (!fs.existsSync(configPath)) {
    return { enabled: false, intervalMinutes: 15 };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Partial<MailScheduleConfig>;
    const interval = VALID_INTERVALS.includes(parsed.intervalMinutes as MailSyncIntervalMinutes)
      ? (parsed.intervalMinutes as MailSyncIntervalMinutes)
      : 15;
    return { enabled: parsed.enabled === true, intervalMinutes: interval };
  } catch {
    return { enabled: false, intervalMinutes: 15 };
  }
}

export function writeMailScheduleConfig(config: MailScheduleConfig, baseDir?: string): void {
  const configPath = resolveMailSchedulePath(baseDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const safe: MailScheduleConfig = {
    enabled: config.enabled === true,
    intervalMinutes: VALID_INTERVALS.includes(config.intervalMinutes) ? config.intervalMinutes : 15,
  };
  fs.writeFileSync(configPath, JSON.stringify(safe, null, 2), "utf-8");
}
