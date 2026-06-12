/**
 * In-memory sliding-window rate limiter for credential endpoints
 * (login, share-password verify). Self-hosted UWE runs as a single
 * process, so a process-local store is sufficient — no external
 * service required.
 */

/**
 * Reported by the healthcheck. Process-local: with multiple instances each
 * process counts separately — for multi-instance deployments the limiter
 * must move to an external store (e.g. Redis).
 */
export const RATE_LIMITER_MODE = "in-memory (prozesslokal, Single-Instance)";

interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const attemptLog = new Map<string, number[]>();

const MAX_TRACKED_KEYS = 10_000;

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  const attempts = (attemptLog.get(key) ?? []).filter((ts) => ts > windowStart);

  if (attempts.length >= options.maxAttempts) {
    const oldest = attempts[0]!;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
    attemptLog.set(key, attempts);
    return { allowed: false, retryAfterSeconds };
  }

  attempts.push(now);
  attemptLog.set(key, attempts);

  if (attemptLog.size > MAX_TRACKED_KEYS) {
    pruneExpired(windowStart);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clears recorded attempts for a key (e.g. after a successful login). */
export function resetRateLimit(key: string): void {
  attemptLog.delete(key);
}

function pruneExpired(windowStart: number): void {
  for (const [key, attempts] of attemptLog) {
    if (attempts.every((ts) => ts <= windowStart)) {
      attemptLog.delete(key);
    }
  }
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
