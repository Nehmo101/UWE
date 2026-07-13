/**
 * Shared types for the UWE host monitor. All data is read-only host telemetry
 * and carries no secrets — booleans, counts, sizes and non-sensitive config
 * facts only. The severity vocabulary mirrors the Homelab-Cockpit ampel so the
 * Command Center reads consistently with the rest of Studio.
 */

export type HostSeverity = "ok" | "warn" | "error" | "unknown";

export interface HostLoadAverage {
  one: number;
  five: number;
  fifteen: number;
}

export interface HostMetrics {
  hostname: string;
  platform: string;
  release: string;
  nodeVersion: string;
  /** Seconds the host OS has been running (os.uptime). */
  hostUptimeSeconds: number;
  hostBootTime: string;
  /** Seconds the UWE Node process has been running (process.uptime). */
  appUptimeSeconds: number;
  appStartTime: string;
  loadAverage: HostLoadAverage;
  cpu: {
    cores: number;
    model: string;
    /** loadAverage.one / cores * 100, or null when cores is unknown. */
    loadPercent: number | null;
    severity: HostSeverity;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
    severity: HostSeverity;
  };
  process: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
  };
  primaryIpv4: string | null;
}

export interface DiskUsage {
  label: string;
  path: string;
  totalBytes: number | null;
  freeBytes: number | null;
  usedBytes: number | null;
  usedPercent: number | null;
  severity: HostSeverity;
  message: string;
}

export type SystemdUnitKind = "service" | "timer";

export interface SystemdUnitStatus {
  unit: string;
  label: string;
  kind: SystemdUnitKind;
  /** Optional services do not degrade the overall host status when disabled. */
  optional?: boolean;
  loadState: string;
  activeState: string;
  subState: string;
  ok: boolean;
  severity: HostSeverity;
  /** ISO timestamp of the next timer elapse, when known. */
  nextElapse: string | null;
  message: string;
}

export interface HostSecurityCheck {
  id: string;
  label: string;
  ok: boolean;
  severity: HostSeverity;
  message: string;
  /** True when the value could not be read automatically and needs a human. */
  manual: boolean;
}

export interface NetworkInterfaceCounter {
  name: string;
  rxBytes: number;
  txBytes: number;
}

export interface NetworkCounters {
  /** ms since epoch when the cumulative counters were sampled. */
  sampledAtMs: number;
  rxBytes: number;
  txBytes: number;
  interfaces: NetworkInterfaceCounter[];
  available: boolean;
}

export interface OpenPort {
  proto: string;
  address: string;
  port: number;
  process: string | null;
}

export interface OpenPortsResult {
  available: boolean;
  ports: OpenPort[];
  message: string;
}

export interface RecentLogEntry {
  timestamp: string | null;
  message: string;
}

export interface RecentErrorsResult {
  available: boolean;
  entries: RecentLogEntry[];
  message: string;
}

export interface FailedLogin {
  user: string | null;
  from: string | null;
  when: string | null;
}

export interface FailedLoginsResult {
  available: boolean;
  recent: FailedLogin[];
  message: string;
}

export interface CommandCenterSnapshot {
  collectedAt: string;
  overall: HostSeverity;
  host: HostMetrics;
  disks: DiskUsage[];
  services: SystemdUnitStatus[];
  security: HostSecurityCheck[];
  network: NetworkCounters;
  openPorts: OpenPortsResult;
  recentErrors: RecentErrorsResult;
  failedLogins: FailedLoginsResult;
}

const SEVERITY_RANK: Record<HostSeverity, number> = {
  unknown: 0,
  ok: 1,
  warn: 2,
  error: 3,
};

/**
 * Aggregate many severities into one. `unknown` never dominates `ok` — a check
 * we could not read is not an alarm — but a real `warn`/`error` always wins.
 * An empty set is `ok`; an all-`unknown` set stays `unknown`.
 */
export function worstSeverity(severities: readonly HostSeverity[]): HostSeverity {
  if (severities.length === 0) return "ok";
  let worst: HostSeverity = severities[0];
  for (const severity of severities) {
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[worst]) {
      worst = severity;
    }
  }
  return worst;
}

/** Severity from a used-percentage against warn/crit thresholds. */
export function severityFromPercent(
  percent: number | null,
  warnAt: number,
  critAt: number,
): HostSeverity {
  if (percent == null || !Number.isFinite(percent)) return "unknown";
  if (percent >= critAt) return "error";
  if (percent >= warnAt) return "warn";
  return "ok";
}

/** Human-readable byte size (binary, German decimal comma). Mirrors health-metrics. */
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
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[unitIndex]}`;
}

/** Human-readable duration (e.g. "3d 04:12"), from a seconds count. */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return days > 0 ? `${days}d ${hh}:${mm}` : `${hh}:${mm}`;
}
