import {
  createDefaultRateLimitStore,
  getAsyncRateLimitStore,
  setAsyncRateLimitStore,
  setRateLimitStore,
} from "./rate-limit";
import { createRedisRateLimitStore } from "./redis-rate-limit-store";

/**
 * Configures distributed rate limiting when UWE_REDIS_URL is set.
 * Falls back to file-backed or in-memory store otherwise.
 */
export function bootstrapRateLimitStore(env: NodeJS.ProcessEnv = process.env): void {
  const redisUrl = env.UWE_REDIS_URL?.trim();
  if (redisUrl) {
    setAsyncRateLimitStore(createRedisRateLimitStore(redisUrl));
    return;
  }

  setAsyncRateLimitStore(null);
  setRateLimitStore(createDefaultRateLimitStore());
}

export { getAsyncRateLimitStore };
