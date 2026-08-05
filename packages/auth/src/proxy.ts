import { getUweRuntimeConfig } from "./runtime-config";

/**
 * Small IPv4/IPv6 sanity check. Not a full RFC parser — just enough to reject
 * attacker-supplied junk (arbitrary strings, oversized values) before it lands
 * in rate-limit keys, `Session.ipAddress` or audit logs. A forwarded header is
 * attacker-controlled, so an invalid value must degrade to `"unknown"` rather
 * than being stored verbatim.
 */
export function isValidIpAddress(value: string): boolean {
  if (!value || value.length > 45) {
    return false;
  }
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(value)) {
    return value.split(".").every((octet) => Number(octet) <= 255);
  }
  // IPv6: hex groups separated by ':' (tolerant of "::" compression and an
  // optional embedded IPv4 suffix). Must contain a colon to count as IPv6.
  return value.includes(":") && /^[0-9a-fA-F:.]+$/.test(value);
}

/**
 * Resolves the client IP for rate limiting and audit logs.
 *
 * Only trusts forwarded headers when TRUST_PROXY is enabled. The ordering is
 * deliberate for a Cloudflare-fronted deployment:
 *  1. `CF-Connecting-IP` — the only header Cloudflare guarantees to *overwrite*
 *     (not append), so an attacker cannot prepend a spoofed value. Preferred
 *     when CLOUDFLARE_TUNNEL is active.
 *  2. `X-Forwarded-For` read from the **right**: each proxy appends the address
 *     it received the connection from, so the real client is at the end. Taking
 *     `parts[len - trustedProxyHops]` (default 1 hop = Cloudflare) makes any
 *     attacker-supplied prefix irrelevant — the historic `parts[0]` was
 *     attacker-controlled.
 *  3. `X-Real-IP` as a last resort.
 *
 * Every candidate is validated; anything malformed falls through to `"unknown"`.
 */
export function resolveClientIp(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const { trustProxy, cloudflareTunnel, trustedProxyHops } = getUweRuntimeConfig(env);

  if (!trustProxy) {
    return "unknown";
  }

  if (cloudflareTunnel) {
    const cfIp = headers.get("cf-connecting-ip")?.trim();
    if (cfIp && isValidIpAddress(cfIp)) {
      return cfIp;
    }
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const hops = Math.min(Math.max(trustedProxyHops, 1), parts.length);
      const candidate = parts[parts.length - hops];
      if (candidate && isValidIpAddress(candidate)) {
        return candidate;
      }
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && isValidIpAddress(realIp)) {
    return realIp;
  }

  return "unknown";
}
