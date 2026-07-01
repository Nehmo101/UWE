import { listStoredBackups, type StoredBackupInfo } from "@uwe/backup";
import { getSystemSettingsSnapshot, resolveEffectiveBackupsPath } from "@uwe/database/server";

export async function resolveStudioBackupsDir(): Promise<string> {
  const { settings } = await getSystemSettingsSnapshot();
  return resolveEffectiveBackupsPath(settings);
}

export async function listStudioBackups(): Promise<StoredBackupInfo[]> {
  const backupsDir = await resolveStudioBackupsDir();
  return listStoredBackups(backupsDir);
}
