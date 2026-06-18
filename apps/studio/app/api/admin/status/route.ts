import { NextResponse } from "next/server";
import { assertAdminStatusHasNoSecrets, prisma } from "@uwe/database/server";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { RATE_LIMITER_MODE, requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

/**
 * Admin status JSON — same data as /admin/status page.
 * No secrets; requires admin gate.
 */
export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) {
    return authError;
  }

  const useMockInference = process.env.AI_USE_MOCK === "true";
  const status = await getAdminDashboardStatus(prisma, {
    rateLimiterMode: RATE_LIMITER_MODE,
    useMockInference,
  });
  assertAdminStatusHasNoSecrets(status);

  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
  });
}
