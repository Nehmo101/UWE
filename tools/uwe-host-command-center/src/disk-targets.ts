import path from "node:path";
import type { DiskTarget } from "@uwe/host-monitor";

function resolveEnvPath(
  envKeys: readonly string[],
  fallback: string,
  baseDir: string,
): string {
  for (const key of envKeys) {
    const raw = process.env[key]?.trim();
    if (raw) {
      return path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
    }
  }
  return fallback;
}

function resolveDataDir(baseDir: string): string {
  return resolveEnvPath(["UWE_DATA_DIR"], path.join(baseDir, "data"), baseDir);
}

/** Data directories worth a disk tile — mirrors Studio command-center-data. */
export function resolveDiskTargets(baseDir?: string): DiskTarget[] {
  const base = baseDir ?? process.env.UWE_HOME ?? process.cwd();
  const dataDir = resolveDataDir(base);
  const candidates: DiskTarget[] = [
    { label: "Daten (DB & Uploads)", path: dataDir },
    {
      label: "Backups",
      path: resolveEnvPath(["UWE_BACKUP_DIR", "BACKUPS_DIR"], path.join(dataDir, "backups"), base),
    },
    {
      label: "Exporte",
      path: resolveEnvPath(["UWE_EXPORT_DIR", "EXPORTS_DIR"], path.join(base, "exports"), base),
    },
  ];
  const seen = new Set<string>();
  return candidates.filter((target) => {
    if (seen.has(target.path)) return false;
    seen.add(target.path);
    return true;
  });
}
