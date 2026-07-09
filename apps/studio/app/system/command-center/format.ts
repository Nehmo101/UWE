/**
 * Pure client-safe formatters for the Command Center. Kept separate from the
 * @uwe/host-monitor package because that package pulls node builtins (os, fs,
 * child_process) which must never enter the browser bundle.
 */

export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${String(Math.round(value * 10) / 10).replace(".", ",")} ${units[unitIndex]}`;
}

export function formatRate(bytesPerSecond: number | null): string {
  if (bytesPerSecond == null || !Number.isFinite(bytesPerSecond)) return "—";
  return `${formatBytes(Math.round(bytesPerSecond))}/s`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = String(Math.floor((total % 86400) / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  return days > 0 ? `${days}d ${hours}:${minutes}` : `${hours}:${minutes}`;
}

export function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}
