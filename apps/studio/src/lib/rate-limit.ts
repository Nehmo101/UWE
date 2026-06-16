import { resolveClientIp } from "@uwe/auth";

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
    for (const [entryKey, entryAttempts] of attemptLog) {
      if (entryAttempts.every((ts) => ts <= windowStart)) {
        attemptLog.delete(entryKey);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string): void {
  attemptLog.delete(key);
}

export function clientIpFromHeaders(headers: Headers): string {
  return resolveClientIp(headers);
}
