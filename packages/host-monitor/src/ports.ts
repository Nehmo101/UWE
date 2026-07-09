import { resolveHostReadDeps, type HostReadDeps } from "./runner";
import type { OpenPort, OpenPortsResult } from "./types";

/**
 * Listening TCP/UDP sockets via `ss`. Process names appear only with
 * privileges; without them the ports still list (process = null). Degrades to
 * `available: false` when `ss` is missing.
 */

const MAX_PORTS = 40;

/** Split a `host:port` local address; handles IPv6 `[::]:port` and `*:port`. */
export function splitAddressPort(local: string): { address: string; port: number } | null {
  const lastColon = local.lastIndexOf(":");
  if (lastColon <= 0) return null;
  const address = local.slice(0, lastColon);
  const port = Number(local.slice(lastColon + 1));
  if (!Number.isInteger(port) || port <= 0) return null;
  return { address: address.replace(/^\[|\]$/g, ""), port };
}

/** Extract the first process name from an `ss` users:(("name",pid=…)) field. */
export function parseProcessName(line: string): string | null {
  const match = /users:\(\("([^"]+)"/.exec(line);
  return match ? match[1] : null;
}

/** Parse headerless `ss -tulnp` output into open-port records. */
export function parseSsOutput(stdout: string): OpenPort[] {
  const ports: OpenPort[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const columns = trimmed.split(/\s+/);
    // Netid State Recv-Q Send-Q Local-Address:Port Peer-Address:Port [Process]
    const netid = columns[0]?.toLowerCase();
    if (netid !== "tcp" && netid !== "udp") continue;
    const local = columns[4];
    if (!local) continue;
    const parsed = splitAddressPort(local);
    if (!parsed) continue;
    const key = `${netid}/${parsed.address}/${parsed.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ports.push({
      proto: netid,
      address: parsed.address,
      port: parsed.port,
      process: parseProcessName(trimmed),
    });
  }
  return ports.sort((a, b) => a.port - b.port).slice(0, MAX_PORTS);
}

export async function collectOpenPorts(
  deps: Partial<HostReadDeps> = {},
): Promise<OpenPortsResult> {
  const { run } = resolveHostReadDeps(deps);
  const result = await run("ss", ["-H", "-tulnp"]);
  if (result == null) {
    return { available: false, ports: [], message: "ss nicht verfügbar" };
  }
  const ports = parseSsOutput(result.stdout);
  return {
    available: true,
    ports,
    message: ports.length === 0 ? "Keine offenen Ports erkannt" : `${ports.length} lauschende Ports`,
  };
}
