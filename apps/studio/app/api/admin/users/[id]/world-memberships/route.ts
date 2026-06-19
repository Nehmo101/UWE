import { NextResponse } from "next/server";
import { createUserService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_WORLD_ROLES = ["owner", "dm", "co_dm", "player"] as const;

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
    role?: string;
    characterName?: string | null;
  };

  if (!body.worldId?.trim()) {
    return NextResponse.json({ error: "Welt-ID ist erforderlich." }, { status: 400 });
  }

  const role = VALID_WORLD_ROLES.includes(body.role as (typeof VALID_WORLD_ROLES)[number])
    ? (body.role as (typeof VALID_WORLD_ROLES)[number])
    : "player";

  const service = createUserService(prisma);
  const user = await service.getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const world = await prisma.world.findUnique({ where: { id: body.worldId } });
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const membership = await service.upsertWorldMembership({
    userId,
    worldId: body.worldId,
    role,
    characterName: body.characterName ?? null,
  });

  return NextResponse.json({
    membership: {
      id: membership.id,
      worldId: membership.worldId,
      role: membership.role,
      characterName: membership.characterName,
      world: membership.world,
    },
  });
}
