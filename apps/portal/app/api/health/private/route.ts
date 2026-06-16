import { NextResponse } from "next/server";
import { buildDetailedHealthPayload, prisma } from "@uwe/database/server";
import { RATE_LIMITER_MODE } from "@/src/lib/rate-limit";
import { requirePortalOwnerAuth } from "@/src/lib/owner-auth";

/**
 * Private health with full operational details.
 * Requires authenticated Portal session with global role `owner`.
 */
export async function GET() {
  const authError = await requirePortalOwnerAuth();
  if (authError) {
    return authError;
  }

  const { payload, httpStatus } = await buildDetailedHealthPayload(prisma, {
    appName: "UWE Portal",
    rateLimiterMode: RATE_LIMITER_MODE,
    extraChecks: {
      portal: { status: "ok", message: "Portal is running" },
    },
  });

  return NextResponse.json(payload, { status: httpStatus });
}
