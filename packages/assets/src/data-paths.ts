import path from "node:path";

/** Resolved persistent paths for production/self-hosted deployments. */
export interface ResolvedDataPaths {
  dataDir: string;
  uploadsDir: string;
  backupsDir: string;
  exportsDir: string;
}

function resolveEnvPath(
  envKeys: readonly string[],
  fallback: string,
  baseDir?: string,
): string {
  const base = baseDir ?? process.cwd();

  for (const key of envKeys) {
    const raw = process.env[key]?.trim();
    if (raw) {
      return path.isAbsolute(raw) ? raw : path.resolve(base, raw);
    }
  }

  return fallback;
}

/**
 * Base directory for UWE persistent data.
 * Falls back to `<cwd>/data` when `UWE_DATA_DIR` is unset.
 */
export function resolveDataDir(baseDir?: string): string {
  const base = baseDir ?? process.cwd();
  return resolveEnvPath(["UWE_DATA_DIR"], path.join(base, "data"), baseDir);
}

/** Uploads directory — settings DB override handled separately in @uwe/database. */
export function resolveUploadsDirFromEnv(baseDir?: string): string {
  const dataDir = resolveDataDir(baseDir);
  return resolveEnvPath(
    ["UWE_UPLOADS_DIR", "UWE_UPLOADS_ROOT", "UPLOADS_DIR"],
    path.join(dataDir, "uploads"),
    baseDir,
  );
}

export function resolveBackupsDirFromEnv(baseDir?: string): string {
  const dataDir = resolveDataDir(baseDir);
  return resolveEnvPath(
    ["UWE_BACKUP_DIR", "BACKUPS_DIR"],
    path.join(dataDir, "backups"),
    baseDir,
  );
}

export function resolveExportsDirFromEnv(baseDir?: string): string {
  const base = baseDir ?? process.cwd();
  return resolveEnvPath(["UWE_EXPORT_DIR", "EXPORTS_DIR"], path.join(base, "exports"), baseDir);
}

export function resolveAllDataPaths(baseDir?: string): ResolvedDataPaths {
  return {
    dataDir: resolveDataDir(baseDir),
    uploadsDir: resolveUploadsDirFromEnv(baseDir),
    backupsDir: resolveBackupsDirFromEnv(baseDir),
    exportsDir: resolveExportsDirFromEnv(baseDir),
  };
}

/** Returns the SQLite file path when `DATABASE_URL` uses the `file:` scheme. */
export function resolveDatabaseFilePath(baseDir?: string): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url?.startsWith("file:")) {
    return null;
  }

  const filePath = url.slice("file:".length);
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(baseDir ?? process.cwd(), filePath);
}
