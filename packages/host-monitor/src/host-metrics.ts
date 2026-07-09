import os from "node:os";
import { severityFromPercent, type HostMetrics } from "./types";

/** Memory-pressure thresholds (used %). */
const MEM_WARN = 85;
const MEM_CRIT = 95;
/** Per-core load thresholds as a percentage (100 % = load == cores). */
const LOAD_WARN = 90;
const LOAD_CRIT = 150;

export interface HostMetricsOptions {
  /** Injected clock in ms since epoch — required (scripts have no Date.now). */
  nowMs: number;
  /** Test seam for os/process reads; defaults to the real runtime. */
  sources?: Partial<HostMetricsSources>;
}

export interface HostMetricsSources {
  hostname: () => string;
  platform: () => string;
  release: () => string;
  nodeVersion: string;
  osUptimeSeconds: () => number;
  processUptimeSeconds: () => number;
  loadAverage: () => number[];
  cpus: () => Array<{ model: string }>;
  totalMem: () => number;
  freeMem: () => number;
  memoryUsage: () => { rss: number; heapUsed: number; heapTotal: number };
  networkInterfaces: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>;
}

function defaultSources(): HostMetricsSources {
  return {
    hostname: () => os.hostname(),
    platform: () => os.platform(),
    release: () => os.release(),
    nodeVersion: process.version,
    osUptimeSeconds: () => os.uptime(),
    processUptimeSeconds: () => process.uptime(),
    loadAverage: () => os.loadavg(),
    cpus: () => os.cpus(),
    totalMem: () => os.totalmem(),
    freeMem: () => os.freemem(),
    memoryUsage: () => process.memoryUsage(),
    networkInterfaces: () => os.networkInterfaces(),
  };
}

/** First non-internal IPv4 address, or null when only loopback is present. */
export function resolvePrimaryIpv4(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>,
): string | null {
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

/**
 * Pure host telemetry from `node:os` and `process`. No external processes, so
 * this is fast and safe to call on every poll. `nowMs` is injected because UWE
 * scripts forbid `Date.now()`; callers pass a real timestamp.
 */
export function collectHostMetrics(options: HostMetricsOptions): HostMetrics {
  const src = { ...defaultSources(), ...options.sources };

  const hostUptimeSeconds = src.osUptimeSeconds();
  const appUptimeSeconds = src.processUptimeSeconds();
  const load = src.loadAverage();
  const cpus = src.cpus();
  const cores = cpus.length;
  const totalBytes = src.totalMem();
  const freeBytes = src.freeMem();
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

  const loadOne = load[0] ?? 0;
  const loadPercent = cores > 0 ? Math.round((loadOne / cores) * 1000) / 10 : null;
  const mem = src.memoryUsage();

  return {
    hostname: src.hostname(),
    platform: src.platform(),
    release: src.release(),
    nodeVersion: src.nodeVersion,
    hostUptimeSeconds,
    hostBootTime: new Date(options.nowMs - hostUptimeSeconds * 1000).toISOString(),
    appUptimeSeconds,
    appStartTime: new Date(options.nowMs - appUptimeSeconds * 1000).toISOString(),
    loadAverage: {
      one: loadOne,
      five: load[1] ?? 0,
      fifteen: load[2] ?? 0,
    },
    cpu: {
      cores,
      model: cpus[0]?.model?.trim() ?? "Unbekannt",
      loadPercent,
      severity: severityFromPercent(loadPercent, LOAD_WARN, LOAD_CRIT),
    },
    memory: {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent,
      severity: severityFromPercent(usedPercent, MEM_WARN, MEM_CRIT),
    },
    process: {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
    },
    primaryIpv4: resolvePrimaryIpv4(src.networkInterfaces()),
  };
}
