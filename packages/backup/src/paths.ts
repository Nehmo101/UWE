import fs from "node:fs";
import path from "node:path";

import { resolveBackupsDirFromEnv } from "@uwe/assets";

export const BACKUP_MANIFEST_FILE = "manifest.json";
export const BACKUP_DATA_FILE = "data.json";
export const BACKUP_ASSETS_DIR = "assets";

export function resolveBackupsDir(baseDir?: string): string {
  return resolveBackupsDirFromEnv(baseDir);
}

export function ensureBackupsDir(baseDir?: string): string {
  const dir = resolveBackupsDir(baseDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveSchemaVersion(): string {
  const migrationsDir = path.resolve(
    import.meta.dirname,
    "../../database/prisma/migrations",
  );

  if (!fs.existsSync(migrationsDir)) {
    return "unknown";
  }

  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return migrations.at(-1) ?? "unknown";
}

export function buildBackupFilename(manifest: {
  type: string;
  worldSlug?: string;
  campaignSlug?: string;
  createdAt: string;
}): string {
  const timestamp = manifest.createdAt.replace(/[:.]/g, "-");
  if (manifest.type === "world" && manifest.worldSlug) {
    return `uwe-backup-world-${manifest.worldSlug}-${timestamp}.zip`;
  }
  if (manifest.type === "campaign" && manifest.worldSlug && manifest.campaignSlug) {
    return `uwe-backup-campaign-${manifest.worldSlug}-${manifest.campaignSlug}-${timestamp}.zip`;
  }
  return `uwe-backup-full-${timestamp}.zip`;
}

export function assetZipPath(storageKey: string): string {
  return path.posix.join(BACKUP_ASSETS_DIR, storageKey.replace(/\\/g, "/"));
}
