import { resolveHostReadDeps, type HostReadDeps } from "./runner";
import type { NetworkCounters, NetworkInterfaceCounter } from "./types";

/**
 * Cumulative RX/TX byte counters from /proc/net/dev. Throughput is a rate, so we
 * deliberately return the raw monotonic counters plus a sample timestamp — the
 * client computes bytes/s as the delta between two consecutive polls. Loopback
 * is excluded from the aggregate.
 */

/** Parse /proc/net/dev into per-interface RX/TX byte counters (loopback dropped). */
export function parseProcNetDev(content: string): NetworkInterfaceCounter[] {
  const interfaces: NetworkInterfaceCounter[] = [];
  const lines = content.split("\n");
  // First two lines are headers.
  for (const line of lines.slice(2)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim();
    if (!name || name === "lo") continue;
    const fields = line
      .slice(separator + 1)
      .trim()
      .split(/\s+/)
      .map((value) => Number(value));
    if (fields.length < 9) continue;
    const rxBytes = fields[0];
    const txBytes = fields[8];
    if (!Number.isFinite(rxBytes) || !Number.isFinite(txBytes)) continue;
    interfaces.push({ name, rxBytes, txBytes });
  }
  return interfaces;
}

export async function collectNetworkCounters(
  options: { nowMs: number; deps?: Partial<HostReadDeps> },
): Promise<NetworkCounters> {
  const { readFile } = resolveHostReadDeps(options.deps);
  const content = await readFile("/proc/net/dev");
  if (content == null) {
    return {
      sampledAtMs: options.nowMs,
      rxBytes: 0,
      txBytes: 0,
      interfaces: [],
      available: false,
    };
  }

  const interfaces = parseProcNetDev(content);
  const rxBytes = interfaces.reduce((sum, iface) => sum + iface.rxBytes, 0);
  const txBytes = interfaces.reduce((sum, iface) => sum + iface.txBytes, 0);
  return {
    sampledAtMs: options.nowMs,
    rxBytes,
    txBytes,
    interfaces,
    available: true,
  };
}
