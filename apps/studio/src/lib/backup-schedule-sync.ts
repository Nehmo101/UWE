import { writeBackupScheduleConfig } from "@uwe/backup";
import type { BackupSettings } from "@uwe/database/server";

/** Mirror DB backup settings to host-readable schedule.json for systemd/cron scripts. */
export function syncBackupScheduleFromSettings(backup: Pick<BackupSettings, "autoBackupEnabled">): void {
  writeBackupScheduleConfig({
    enabled: backup.autoBackupEnabled,
    frequency: "daily",
  });
}
