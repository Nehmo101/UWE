/**
 * Brain exposure policy (ADR 004/007). Brain is owner-only and local: it binds
 * to loopback by default, may bind to a chosen LAN interface after an explicit
 * owner opt-in, and can be turned off entirely. There is deliberately NO public
 * value — Brain is never bound to all interfaces and never added to the tunnel.
 */
export type BrainExposure = "loopback" | "lan" | "off";

/** Reads BRAIN_EXPOSURE; anything unrecognised (incl. a stray "public") is loopback. */
export function resolveBrainExposure(
  env: Record<string, string | undefined> = process.env,
): BrainExposure {
  const value = env.BRAIN_EXPOSURE?.trim().toLowerCase();
  return value === "lan" || value === "off" ? value : "loopback";
}

/**
 * The hostname Brain binds to. Loopback and off both stay on 127.0.0.1; only an
 * explicit LAN exposure with a concrete interface address binds beyond loopback.
 * It never returns 0.0.0.0 / a public bind — that is the point of the policy.
 */
export function resolveBrainBindHostname(exposure: BrainExposure, lanHost?: string): string {
  const trimmed = lanHost?.trim();
  if (exposure === "lan" && trimmed && trimmed !== "0.0.0.0" && trimmed !== "::") {
    return trimmed;
  }
  return "127.0.0.1";
}

/** Whether the Brain entry is served at all. `off` disables it (in-app 503). */
export function isBrainEntryEnabled(exposure: BrainExposure): boolean {
  return exposure !== "off";
}
