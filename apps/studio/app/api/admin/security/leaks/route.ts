import { guardStudioAdminApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { prisma, scanPublicContentLeaks } from "@uwe/database/server";

/** On-demand public content leak scan — no secret content in response. */
export async function GET(request: Request) {
  const { error: authError } = await guardStudioAdminApiRequest(request);
  if (authError) {
    return authError;
  }

  const result = await scanPublicContentLeaks(prisma);
  return NextResponse.json(result, {
    status: result.criticalCount > 0 ? 503 : 200,
  });
}
