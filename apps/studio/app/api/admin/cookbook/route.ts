import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@uwe/security";
import { getStudioCookbookDashboard } from "@/src/lib/cookbook-dashboard";

/** Admin Cookbook JSON — hardware fit, local models, diagnostics. No secrets. */
export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request, { rateLimit: "setup" });
  if (authError) {
    return authError;
  }

  const useMockInference = process.env.AI_USE_MOCK === "true";
  const dashboard = await getStudioCookbookDashboard(prisma, { useMockInference });

  return NextResponse.json(dashboard, {
    status: dashboard.runtime.ok ? 200 : 503,
  });
}
