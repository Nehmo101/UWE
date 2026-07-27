/**
 * Brain exposure policy. Brain is gated on the `brain` checkbox — every route,
 * API and server action verifies it server-side (`canEnterBrain`). Reachability
 * is a separate, explicit choice: loopback by default, a chosen LAN interface,
 * a public origin served through the gated reverse proxy / Cloudflare Tunnel,
 * or off entirely.
 *
 * `public` describes the *origin* Brain is reached under, not the bind address:
 * the tunnel connector runs on the host itself, so Brain keeps binding to
 * loopback and is never bound to all interfaces.
 */
export type BrainExposure = "loopback" | "lan" | "public" | "off";

/** Reads BRAIN_EXPOSURE; anything unrecognised falls back to loopback. */
export function resolveBrainExposure(
  env: Record<string, string | undefined> = process.env,
): BrainExposure {
  const value = env.BRAIN_EXPOSURE?.trim().toLowerCase();
  return value === "lan" || value === "public" || value === "off" ? value : "loopback";
}

/**
 * The hostname Brain binds to. Loopback, public and off all stay on 127.0.0.1
 * — a public Brain is published by the host-local tunnel connector, not by
 * binding wider. Only an explicit LAN exposure with a concrete interface
 * address binds beyond loopback; it never returns 0.0.0.0 / an all-interfaces
 * address.
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
