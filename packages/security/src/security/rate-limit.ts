/**
 * Rate limiter abstraction — in-memory by default; file-backed when UWE_RATE_LIMIT_DIR is set.
 * Swap `setRateLimitStore()` for Redis/Upstash when scaling horizontally.
 */

import { resolveClientIp } from "@uwe/auth";
import { FileRateLimitStore } from "./file-rate-limit-store";

function resolveRateLimiterMode(): string {
  if (process.env.UWE_RATE_LIMIT_DIR?.trim()) {
    return `file-backed (${process.env.UWE_RATE_LIMIT_DIR.trim()})`;
  }
  return "in-memory (prozesslokal, Single-Instance)";
}

export const RATE_LIMITER_MODE = resolveRateLimiterMode();

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  check(key: string, options: RateLimitOptions): RateLimitResult;
  reset(key: string): void;
}

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly attemptLog = new Map<string, number[]>();
  private readonly maxTrackedKeys = 10_000;

  check(key: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const windowStart = now - options.windowMs;

    const attempts = (this.attemptLog.get(key) ?? []).filter((ts) => ts > windowStart);

    if (attempts.length >= options.maxAttempts) {
      const oldest = attempts[0]!;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
      this.attemptLog.set(key, attempts);
      return { allowed: false, retryAfterSeconds };
    }

    attempts.push(now);
    this.attemptLog.set(key, attempts);

    if (this.attemptLog.size > this.maxTrackedKeys) {
      this.pruneExpired(windowStart);
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key: string): void {
    this.attemptLog.delete(key);
  }

  private pruneExpired(windowStart: number): void {
    for (const [key, attempts] of this.attemptLog) {
      if (attempts.every((ts) => ts <= windowStart)) {
        this.attemptLog.delete(key);
      }
    }
  }
}

let store: RateLimitStore = createDefaultStore();

function createDefaultStore(): RateLimitStore {
  const dir = process.env.UWE_RATE_LIMIT_DIR?.trim();
  if (dir) {
    return new FileRateLimitStore(dir);
  }
  return new InMemoryRateLimitStore();
}

/** Reset to the default store (for tests). */
export function resetRateLimitStore(): void {
  store = createDefaultStore();
}

export function getRateLimitStore(): RateLimitStore {
  return store;
}

/** Inject a distributed store (e.g. Redis) for multi-instance deployments. */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  return store.check(key, options);
}

export function resetRateLimit(key: string): void {
  store.reset(key);
}

export function clientIpFromHeaders(headers: Headers): string {
  return resolveClientIp(headers);
}

export const RATE_LIMIT_PRESETS = {
  login: { maxAttempts: 8, windowMs: 5 * 60_000 },
  passwordReset: { maxAttempts: 5, windowMs: 15 * 60_000 },
  setup: { maxAttempts: 20, windowMs: 60_000 },
  ai: { maxAttempts: 30, windowMs: 60_000 },
  import: { maxAttempts: 10, windowMs: 60_000 },
  upload: { maxAttempts: 20, windowMs: 60_000 },
  search: { maxAttempts: 60, windowMs: 60_000 },
  shareVerify: { maxAttempts: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitOptions>;

export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

export function enforceRateLimit(
  request: Request,
  bucket: string,
  preset: RateLimitPreset,
  keySuffix = "",
): Response | null {
  const ip = clientIpFromHeaders(request.headers);
  const key = keySuffix ? `${bucket}:${ip}:${keySuffix}` : `${bucket}:${ip}`;
  const options = RATE_LIMIT_PRESETS[preset];
  const result = checkRateLimit(key, options);

  if (!result.allowed) {
    return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte warte einen Moment." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
      },
    });
  }

  return null;
}
