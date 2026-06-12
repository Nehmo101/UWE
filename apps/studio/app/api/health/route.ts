import { NextResponse } from "next/server";
import {
  databaseHealthCheck,
  getSystemStatus,
  prisma,
  UWE_PRODUCT_NAME,
  UWE_VERSION,
} from "@uwe/database/server";

/**
 * Healthcheck: database, migrations, storage, seeds, version and trust mode.
 * Leaks no sensitive data — only booleans, counts and non-secret facts.
 */
export async function GET() {
  const db = await databaseHealthCheck();
  const system = await getSystemStatus(prisma, {
    rateLimiterMode: "none (Studio: vertrauenswürdiges Netz, kein Login by design)",
  });

  const status = db.status === "ok" && system.ok ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      app: "UWE Studio",
      product: UWE_PRODUCT_NAME,
      version: UWE_VERSION,
      commit: system.commit,
      timestamp: new Date().toISOString(),
      checks: {
        database: db,
        migrations: {
          ok: system.migrations.ok,
          appliedCount: system.migrations.appliedCount,
          pendingCount: system.migrations.pendingMigrations.length,
          failedCount: system.migrations.failedMigrations.length,
          message: system.migrations.message,
        },
        storage: system.storage,
        seeds: system.seeds,
      },
      trust: system.trust,
      rateLimiter: system.rateLimiter,
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
