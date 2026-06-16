import { NextResponse } from "next/server";
import { buildDetailedHealthPayload, prisma } from "@uwe/database/server";
import { requirePrivateHealthAuth } from "@/src/lib/private-health-auth";

/**
 * Private health with full operational details.
 * Requires STUDIO_API_TOKEN (Owner/Admin monitoring).
 */
export async function GET(request: Request) {
  const authError = requirePrivateHealthAuth(request);
  if (authError) {
    return authError;
  }

  const { payload, httpStatus } = await buildDetailedHealthPayload(prisma, {
    appName: "UWE Studio",
    rateLimiterMode: "none (Studio: vertrauenswürdiges Netz, kein Login by design)",
  });

  return NextResponse.json(payload, { status: httpStatus });
}
