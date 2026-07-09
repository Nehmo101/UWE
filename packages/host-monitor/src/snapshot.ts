import { collectHostMetrics } from "./host-metrics";
import { collectDiskUsage, type DiskTarget } from "./disk";
import { collectServiceStatus, type SystemdUnitSpec } from "./systemd";
import { collectHostSecurity } from "./host-security";
import { collectNetworkCounters } from "./network";
import { collectOpenPorts } from "./ports";
import { collectRecentErrors, collectFailedLogins } from "./logs";
import type { HostReadDeps } from "./runner";
import { worstSeverity, type CommandCenterSnapshot } from "./types";

export interface CommandCenterSnapshotOptions {
  /** ms since epoch — injected (UWE scripts forbid Date.now()). */
  nowMs: number;
  diskTargets: readonly DiskTarget[];
  units?: SystemdUnitSpec[];
  /** Injected side-effects for tests; defaults to real read-only host access. */
  deps?: Partial<HostReadDeps>;
}

/**
 * Assemble the full Command Center host snapshot: metrics + disks (sync) run
 * alongside the async systemd + security probes. The overall ampel is the worst
 * severity across every signal — `unknown` never raises it on its own.
 */
export async function collectCommandCenterSnapshot(
  options: CommandCenterSnapshotOptions,
): Promise<CommandCenterSnapshot> {
  const host = collectHostMetrics({ nowMs: options.nowMs });
  const disks = collectDiskUsage(options.diskTargets);
  const [services, security, network, openPorts, recentErrors, failedLogins] = await Promise.all([
    collectServiceStatus({ units: options.units, deps: options.deps }),
    collectHostSecurity(options.deps),
    collectNetworkCounters({ nowMs: options.nowMs, deps: options.deps }),
    collectOpenPorts(options.deps),
    collectRecentErrors(options.deps),
    collectFailedLogins(options.deps),
  ]);

  // Diagnostic panels (network, ports, logs, logins) are informational and do
  // NOT drive the overall ampel — on a real host, background SSH probes and
  // transient journal errors would otherwise keep it permanently amber.
  const overall = worstSeverity([
    host.cpu.severity,
    host.memory.severity,
    ...disks.map((d) => d.severity),
    ...services.map((s) => s.severity),
    ...security.map((s) => s.severity),
  ]);

  return {
    collectedAt: new Date(options.nowMs).toISOString(),
    overall,
    host,
    disks,
    services,
    security,
    network,
    openPorts,
    recentErrors,
    failedLogins,
  };
}
