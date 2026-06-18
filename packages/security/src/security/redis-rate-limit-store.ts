import Redis from "ioredis";
import type { AsyncRateLimitStore, RateLimitOptions, RateLimitResult } from "./rate-limit";

/**
 * Redis-backed rate limit store for multi-instance deployments.
 * Uses INCR + PEXPIRE sliding window per key.
 */
export class RedisRateLimitStore implements AsyncRateLimitStore {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  async check(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    const redisKey = `uwe:rate:${key}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.pexpire(redisKey, options.windowMs);
    }

    if (count > options.maxAttempts) {
      const ttlMs = await this.redis.pttl(redisKey);
      const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`uwe:rate:${key}`);
  }
}

export function createRedisRateLimitStore(redisUrl: string): AsyncRateLimitStore {
  return new RedisRateLimitStore(redisUrl);
}