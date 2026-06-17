import fs from "node:fs";
import type { StoredBackupInfo } from "./types";

export const DEFAULT_BACKUP_RETENTION = 14;
export const ALLOWED_RETENTION_COUNTS = [7, 14, 30] as const;
export type BackupRetentionCount = (typeof ALLOWED_RETENTION_COUNTS)[number];

export function normalizeRetentionCount(value: unknown): BackupRetentionCount {
  const parsed = typeof value === "number" ? value : Number(value);
  if (ALLOWED_RETENTION_COUNTS.includes(parsed as BackupRetentionCount)) {
    return parsed as BackupRetentionCount;
  }
  return DEFAULT_BACKUP_RETENTION;
}

export function applyBackupRetention(
  backups: StoredBackupInfo[],
  maxCount: number,
): { deleted: string[]; kept: StoredBackupInfo[] } {
  const normalizedMax = Math.max(1, Math.floor(maxCount));
  const sorted = [...backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const kept = sorted.slice(0, normalizedMax);
  const deleted: string[] = [];

  for (const backup of sorted.slice(normalizedMax)) {
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
      deleted.push(backup.filename);
    }
  }

  return { deleted, kept };
}
