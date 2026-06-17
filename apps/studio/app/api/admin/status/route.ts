import { NextResponse } from "next/server";
import { assertAdminStatusHasNoSecrets, prisma } from "@uwe/database/server";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { RATE_LIMITER_MODE, requireStudioApiAuth } from "@uwe/security";

/**
 * Admin status JSON — same data as /admin/status page.
 * No secrets; protected against cross-origin abuse via requireStudioApiAuth.
 */
export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request, { rateLimit: "setup" });
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
