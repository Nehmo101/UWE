import { NextResponse } from "next/server";
import { buildDetailedHealthPayload, prisma } from "@uwe/database/server";
import { RATE_LIMITER_MODE } from "@/src/lib/rate-limit";
import { requireBrainOwnerAuth } from "@/src/lib/owner-auth";

/**
 * Private health with full operational details.
 * Requires an authenticated session with the global role `owner`.
 */
export async function GET() {
  const authError = await requireBrainOwnerAuth();
  if (authError) {
    return authError;
  }

  const { payload, httpStatus } = await buildDetailedHealthPayload(prisma, {
    appName: "UWE Brain",
    rateLimiterMode: RATE_LIMITER_MODE,
    extraChecks: {
      brain: { status: "ok", message: "Brain is running (local, owner-only)" },
    },
  });

  return NextResponse.json(payload, { status: httpStatus });
}
