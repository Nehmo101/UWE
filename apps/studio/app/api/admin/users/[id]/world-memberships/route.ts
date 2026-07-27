import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createUserService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const { id: userId } = await context.params;
  const body = (await request.json()) as {
    worldId?: string;
    characterName?: string | null;
  };

  if (!body.worldId?.trim()) {
    return jsonError("Welt-ID ist erforderlich.", 400);
  }

  const service = createUserService(prisma);
  const user = await service.getUserById(userId);
  if (!user) {
    return jsonError("Benutzer nicht gefunden.", 404);
  }

  const world = await prisma.world.findUnique({ where: { id: body.worldId } });
  if (!world) {
    return jsonError("Welt nicht gefunden.", 404);
  }

  const membership = await service.upsertWorldMembership({
    userId,
    worldId: body.worldId,
    characterName: body.characterName ?? null,
  });

  return NextResponse.json({
    membership: {
      id: membership.id,
      worldId: membership.worldId,
      characterName: membership.characterName,
      world: membership.world,
    },
  });
}
