/**
 * In-memory rate limiter for sensitive Studio API routes (backup, restore, import).
 * Same model as Portal — process-local, sufficient for single-instance self-hosting.
 */

import { resolveClientIp } from "@uwe/auth";

export const STUDIO_RATE_LIMITER_MODE =
  "in-memory (prozesslokal, Single-Instance — bei Multi-Instance am Reverse Proxy limitieren)";

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

export function checkStudioRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
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
    for (const [k, ts] of attemptLog) {
      if (ts.every((t) => t <= windowStart)) {
        attemptLog.delete(k);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function studioRateLimitKey(request: Request, scope: string): string {
  const ip = resolveClientIp(request.headers);
  return `${scope}:${ip}`;
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Zu viele Anfragen — bitte später erneut versuchen." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

/** Backup/restore/import: 10 requests per 5 minutes per IP. */
export const SENSITIVE_STUDIO_RATE_LIMIT = {
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000,
} as const;
