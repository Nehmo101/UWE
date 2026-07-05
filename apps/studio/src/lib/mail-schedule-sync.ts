import { writeMailScheduleConfig } from "@uwe/mail";
import type { MailSettings } from "@uwe/database/server";

/** Mirror DB mail auto-sync settings to host-readable schedule.json for systemd timer. */
export function syncMailScheduleFromSettings(
  mail: Pick<MailSettings, "autoSyncEnabled" | "autoSyncIntervalMinutes">,
): void {
  writeMailScheduleConfig({
    enabled: mail.autoSyncEnabled === true,
    intervalMinutes: mail.autoSyncIntervalMinutes,
  });
}
