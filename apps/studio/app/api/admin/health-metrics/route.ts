import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createHealthMetricsService } from "@uwe/database/health-metrics";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { loadStudioEngineDisplayState } from "@/src/lib/engine-display-state";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const [metrics, engineDisplay] = await Promise.all([
    createHealthMetricsService(prisma).getMetrics(),
    loadStudioEngineDisplayState(prisma).catch(() => null),
  ]);

  return NextResponse.json({
    metrics,
    engineDisplay,
    checkedAt: new Date().toISOString(),
  });
}
