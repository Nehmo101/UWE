import { getUweRuntimeConfig } from "./runtime-config";

/**
 * Resolves the client IP for rate limiting and audit logs.
 * Only trusts X-Forwarded-For / X-Real-IP when TRUST_PROXY is enabled.
 */
export function resolveClientIp(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const { trustProxy } = getUweRuntimeConfig(env);

  if (trustProxy) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]!.trim();
    }

    const realIp = headers.get("x-real-ip");
    if (realIp?.trim()) {
      return realIp.trim();
    }
  }

  return "unknown";
}
