import fs from "node:fs";
import path from "node:path";
import { resolveBackupsDir } from "./paths";

export type BackupScheduleFrequency = "daily" | "weekly" | "monthly";

export interface BackupScheduleConfig {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
}

const SCHEDULE_FILENAME = "schedule.json";

export function resolveScheduleConfigPath(baseDir?: string): string {
  return path.join(resolveBackupsDir(baseDir), SCHEDULE_FILENAME);
}

export function readBackupScheduleConfig(baseDir?: string): BackupScheduleConfig {
  const configPath = resolveScheduleConfigPath(baseDir);
  if (!fs.existsSync(configPath)) {
    return { enabled: true, frequency: "daily" };
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<BackupScheduleConfig>;
    const frequency = (["daily", "weekly", "monthly"] as const).includes(
      parsed.frequency as BackupScheduleFrequency,
    )
      ? (parsed.frequency as BackupScheduleFrequency)
      : "daily";
    return { enabled: parsed.enabled !== false, frequency };
  } catch {
    return { enabled: true, frequency: "daily" };
  }
}

export function writeBackupScheduleConfig(config: BackupScheduleConfig, baseDir?: string): void {
  const configPath = resolveScheduleConfigPath(baseDir);
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  const safe: BackupScheduleConfig = {
    enabled: config.enabled !== false,
    frequency: (["daily", "weekly", "monthly"] as const).includes(config.frequency)
      ? config.frequency
      : "daily",
  };
  fs.writeFileSync(configPath, JSON.stringify(safe, null, 2), "utf-8");
}
