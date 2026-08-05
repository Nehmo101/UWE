import { NextResponse } from "next/server";
import {
  databaseHealthCheck,
  getSystemStatus,
  prisma,
  UWE_PRODUCT_NAME,
  UWE_VERSION,
} from "@uwe/database/server";
import { requirePrivateHealthAuth } from "@/src/lib/private-health-auth";

/**
 * Healthcheck. The operational detail — commit, migration state, storage paths,
 * trust/proxy/mail config, version — is confidential (fingerprinting +
 * infrastructure disclosure) and now requires the STUDIO_API_TOKEN bearer, the
 * same gate as /api/health/private. Anonymous callers (liveness probes, the
 * Command Center's process-identity check) still get an accurate status and the
 * app name, so nothing that only needs "is this UWE and is it up?" breaks.
 */
export async function GET(request: Request) {
  const authorized = requirePrivateHealthAuth(request) === null;
  const db = await databaseHealthCheck();

  if (!authorized) {
    // Slim, non-sensitive response: liveness + identity only.
    return NextResponse.json(
      {
        status: db.status === "ok" ? "ok" : "degraded",
        app: { name: "UWE Studio", product: UWE_PRODUCT_NAME },
        timestamp: new Date().toISOString(),
      },
      { status: db.status === "ok" ? 200 : 503 },
    );
  }

  const system = await getSystemStatus(prisma, {
    rateLimiterMode: "none (Studio: Session-Login via AUTH_REQUIRED, vertrauenswürdiges Netz)",
  });

  const status = db.status === "ok" && system.ok ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      app: {
        name: "UWE Studio",
        product: UWE_PRODUCT_NAME,
        version: UWE_VERSION,
        runtime: system.app,
      },
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
      proxy: system.proxy,
      mail: system.mail,
      rateLimiter: system.rateLimiter,
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
