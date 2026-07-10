import path from "node:path";
import {
  resolveBackupsDirFromEnv,
  resolveDataDir,
  resolveDatabaseFilePath,
  resolveExportsDirFromEnv,
  resolveUploadsDirFromEnv,
} from "@uwe/assets";
import type { UweSystemSettings } from "./settings-service";

// Effektive persistente Pfade (Uploads/Backups/Exports) für Studio-Settings-UI
// und Diagnostik. Aus `settings-service.ts` herausgezogen (Modul-Disziplin) —
// Verhalten unverändert. Re-Export erfolgt über `settings-service.ts`.

export function resolveEffectiveUploadsPath(
  settings: UweSystemSettings,
  baseDir?: string,
): string {
  const configured = settings.storage.uploadsPath.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(baseDir ?? process.cwd(), configured);
  }

  if (process.env.UWE_UPLOADS_ROOT) {
    return process.env.UWE_UPLOADS_ROOT;
  }

  return resolveUploadsDirFromEnv(baseDir);
}

export function resolveEffectiveBackupsPath(
  settings: UweSystemSettings,
  baseDir?: string,
): string {
  const configured = settings.backup.backupsPath.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(baseDir ?? process.cwd(), configured);
  }

  return resolveBackupsDirFromEnv(baseDir);
}

export function resolveEffectiveExportsPath(
  settings: UweSystemSettings,
  baseDir?: string,
): string {
  const configured = settings.storage.exportsPath.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(baseDir ?? process.cwd(), configured);
  }

  return resolveExportsDirFromEnv(baseDir);
}

export type PersistentPathSource = "settings" | "env" | "default";

export interface PersistentPathEntry {
  effectivePath: string;
  source: PersistentPathSource;
  settingsValue: string;
}

export interface PersistentPathConfiguration {
  dataDir: string;
  databaseFile: string | null;
  uploads: PersistentPathEntry;
  backups: PersistentPathEntry;
  exports: PersistentPathEntry;
}

function resolvePathSource(settingsValue: string, envKeys: readonly string[]): PersistentPathSource {
  if (settingsValue.trim()) {
    return "settings";
  }

  for (const key of envKeys) {
    if (process.env[key]?.trim()) {
      return "env";
    }
  }

  return "default";
}

/** Effective persistent paths for Studio settings UI and diagnostics. */
export function getPersistentPathConfiguration(
  settings: UweSystemSettings,
  baseDir?: string,
): PersistentPathConfiguration {
  const base = baseDir ?? process.cwd();

  return {
    dataDir: resolveDataDir(base),
    databaseFile: resolveDatabaseFilePath(base),
    uploads: {
      settingsValue: settings.storage.uploadsPath,
      effectivePath: resolveEffectiveUploadsPath(settings, base),
      source: resolvePathSource(settings.storage.uploadsPath, [
        "UWE_UPLOADS_DIR",
        "UWE_UPLOADS_ROOT",
        "UPLOADS_DIR",
      ]),
    },
    backups: {
      settingsValue: settings.backup.backupsPath,
      effectivePath: resolveEffectiveBackupsPath(settings, base),
      source: resolvePathSource(settings.backup.backupsPath, ["UWE_BACKUP_DIR", "BACKUPS_DIR"]),
    },
    exports: {
      settingsValue: settings.storage.exportsPath,
      effectivePath: resolveEffectiveExportsPath(settings, base),
      source: resolvePathSource(settings.storage.exportsPath, ["UWE_EXPORT_DIR", "EXPORTS_DIR"]),
    },
  };
}
