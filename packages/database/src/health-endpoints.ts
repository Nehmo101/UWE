import type { PrismaClient } from "./client";
import { databaseHealthCheck } from "./health-server";
import { getSystemStatus, type SystemStatus } from "./system-status";
import { UWE_PRODUCT_NAME, UWE_VERSION } from "./version";

export type HealthAppName = "UWE Studio" | "UWE Portal";

export interface DetailedHealthPayload {
  status: "ok" | "degraded";
  app: {
    name: HealthAppName;
    product: string;
    version: string;
    runtime: SystemStatus["app"];
  };
  commit: string | null;
  timestamp: string;
  checks: Record<string, unknown>;
  trust?: SystemStatus["trust"];
  proxy: SystemStatus["proxy"];
  mail?: SystemStatus["mail"];
  rateLimiter: SystemStatus["rateLimiter"];
}

export interface BuildDetailedHealthOptions {
  appName: HealthAppName;
  rateLimiterMode?: string;
  extraChecks?: Record<string, unknown>;
}

/**
 * Minimal public health — no internals, paths, or configuration facts.
 * Returns plain text for tunnel uptime probes.
 */
export async function evaluatePublicHealth(db: PrismaClient): Promise<{
  ok: boolean;
  body: "ok" | "degraded";
}> {
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return { ok: true, body: "ok" };
  } catch {
    return { ok: false, body: "degraded" };
  }
}

export async function buildDetailedHealthPayload(
  db: PrismaClient,
  options: BuildDetailedHealthOptions,
): Promise<{ payload: DetailedHealthPayload; httpStatus: number }> {
  const dbCheck = await databaseHealthCheck();
  const system = await getSystemStatus(db, {
    rateLimiterMode: options.rateLimiterMode,
  });

  const status = dbCheck.status === "ok" && system.ok ? "ok" : "degraded";

  const payload: DetailedHealthPayload = {
    status,
    app: {
      name: options.appName,
      product: UWE_PRODUCT_NAME,
      version: UWE_VERSION,
      runtime: system.app,
    },
    commit: system.commit,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbCheck,
      migrations: {
        ok: system.migrations.ok,
        appliedCount: system.migrations.appliedCount,
        pendingCount: system.migrations.pendingMigrations.length,
        failedCount: system.migrations.failedMigrations.length,
        message: system.migrations.message,
      },
      storage: system.storage,
      seeds: system.seeds,
      ...options.extraChecks,
    },
    proxy: system.proxy,
    rateLimiter: system.rateLimiter,
  };

  if (options.appName === "UWE Studio") {
    payload.trust = system.trust;
    payload.mail = system.mail;
  }

  return {
    payload,
    httpStatus: status === "ok" ? 200 : 503,
  };
}
