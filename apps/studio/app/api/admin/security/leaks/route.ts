import { NextResponse } from "next/server";
import { prisma, scanPublicContentLeaks } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

/** On-demand public content leak scan — no secret content in response. */
export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) {
    return authError;
  }

  const result = await scanPublicContentLeaks(prisma);
  return NextResponse.json(result, {
    status: result.criticalCount > 0 ? 503 : 200,
  });
}
