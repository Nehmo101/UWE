import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";

/**
 * Admin status JSON — same data as /admin/status page.
 * No secrets; protected against cross-origin abuse via requireStudioApiAuth.
 */
export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) {
    return authError;
  }

  const useMockInference = process.env.AI_USE_MOCK === "true";
  const status = await getAdminDashboardStatus(prisma, {
    rateLimiterMode: "none (Studio: vertrauenswürdiges Netz)",
    useMockInference,
  });

  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
  });
}
