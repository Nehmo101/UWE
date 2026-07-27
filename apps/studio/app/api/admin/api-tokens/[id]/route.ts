import { NextResponse } from "next/server";
import { createApiTokenService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const user = authContext.user ?? (await requireAdminAccess());
  const { id } = await context.params;
  const service = createApiTokenService(prisma);
  await service.revoke(id, user.id);

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const user = authContext.user ?? (await requireAdminAccess());
  const { id } = await context.params;
  const service = createApiTokenService(prisma);
  const rotated = await service.rotate(id, user.id, user.isOwner);

  return NextResponse.json({
    token: rotated.token,
    plaintextToken: rotated.plaintextToken,
    warning: "Neuer Token — nur einmal sichtbar.",
  });
}
