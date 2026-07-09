import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { requireOwnerApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { getCommandCenterData } from "@/src/lib/command-center-data";

export const dynamic = "force-dynamic";

/**
 * Owner-only JSON snapshot for the Command Center client poll. Session-guarded
 * (no API token) because it is an interactive owner view. No secrets in the
 * payload — only host telemetry, counts and non-sensitive config facts.
 */
export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) {
    return authError;
  }

  const useMockInference = process.env.AI_USE_MOCK === "true";
  const data = await getCommandCenterData(prisma, { useMockInference });

  return NextResponse.json(data, {
    status: data.host.overall === "error" ? 503 : 200,
  });
}
