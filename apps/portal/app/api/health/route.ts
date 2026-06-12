import { NextResponse } from "next/server";
import {
  databaseHealthCheck,
  getSystemStatus,
  prisma,
  UWE_PRODUCT_NAME,
  UWE_VERSION,
} from "@uwe/database/server";
import { RATE_LIMITER_MODE } from "@/src/lib/rate-limit";

/**
 * Healthcheck: database, migrations, storage, version and rate limiter mode.
 * Leaks no sensitive data — only booleans, counts and non-secret facts.
 */
export async function GET() {
  const db = await databaseHealthCheck();
  const system = await getSystemStatus(prisma, { rateLimiterMode: RATE_LIMITER_MODE });

  const status = db.status === "ok" && system.ok ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      app: "UWE Portal",
      product: UWE_PRODUCT_NAME,
      version: UWE_VERSION,
      commit: system.commit,
      timestamp: new Date().toISOString(),
      checks: {
        portal: { status: "ok", message: "Portal is running" },
        database: db,
        migrations: {
          ok: system.migrations.ok,
          appliedCount: system.migrations.appliedCount,
          pendingCount: system.migrations.pendingMigrations.length,
          failedCount: system.migrations.failedMigrations.length,
          message: system.migrations.message,
        },
        storage: system.storage,
      },
      rateLimiter: system.rateLimiter,
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
