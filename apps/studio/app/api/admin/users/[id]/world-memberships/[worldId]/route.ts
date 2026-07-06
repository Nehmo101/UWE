import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createUserService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

interface RouteContext {
  params: Promise<{ id: string; worldId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const { id: userId, worldId } = await context.params;
  const service = createUserService(prisma);

  try {
    await service.removeWorldMembership(userId, worldId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "MEMBERSHIP_NOT_FOUND") {
      return jsonError("Mitgliedschaft nicht gefunden.", 404);
    }
    return jsonError("Mitgliedschaft konnte nicht entfernt werden.", 400);
  }
}
