import fs from "node:fs";
import { severityFromPercent, type DiskUsage } from "./types";

/** Disk-fill thresholds (used %). */
const DISK_WARN = 85;
const DISK_CRIT = 95;

export interface DiskTarget {
  label: string;
  path: string;
}

/** Test seam: a statfs reader that may throw (missing path / unsupported fs). */
export type StatfsReader = (path: string) => {
  blocks: number;
  bsize: number;
  bavail: number;
};

function defaultStatfs(): StatfsReader {
  return (path: string) => {
    const stats = fs.statfsSync(path);
    return {
      blocks: Number(stats.blocks),
      bsize: Number(stats.bsize),
      bavail: Number(stats.bavail),
    };
  };
}

/**
 * Free-space per data directory via statfs. Unreadable paths degrade to an
 * `unknown` tile instead of throwing, so one missing mount never breaks the
 * Command Center. Duplicate filesystems are not de-duplicated here — the caller
 * chooses which directories are meaningful to show.
 */
export function collectDiskUsage(
  targets: readonly DiskTarget[],
  statfs: StatfsReader = defaultStatfs(),
): DiskUsage[] {
  return targets.map((target) => {
    try {
      const { blocks, bsize, bavail } = statfs(target.path);
      const totalBytes = blocks * bsize;
      const freeBytes = bavail * bsize;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent =
        totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : null;
      const severity = severityFromPercent(usedPercent, DISK_WARN, DISK_CRIT);
      return {
        label: target.label,
        path: target.path,
        totalBytes,
        freeBytes,
        usedBytes,
        usedPercent,
        severity,
        message:
          usedPercent == null
            ? "Größe unbekannt"
            : `${usedPercent}% belegt`,
      };
    } catch (error) {
      return {
        label: target.label,
        path: target.path,
        totalBytes: null,
        freeBytes: null,
        usedBytes: null,
        usedPercent: null,
        severity: "unknown",
        message: error instanceof Error ? error.message : "Nicht lesbar",
      };
    }
  });
}
