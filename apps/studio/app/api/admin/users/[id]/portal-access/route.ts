import { NextResponse } from "next/server";
import { createPrismaClient, evaluatePortalAccessForUser } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const { id: userId } = await params;
  const db = createPrismaClient();
  try {
    const evaluation = await evaluatePortalAccessForUser(db, userId);
    if (!evaluation) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden.", code: "USER_NOT_FOUND", userId },
        { status: 404 },
      );
    }
    return NextResponse.json({ evaluation });
  } finally {
    await db.$disconnect();
  }
}
