import { NextResponse } from "next/server";
import { createUserService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

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

  const actor = authContext.user ?? (await requireAdminAccess());
  const { id } = await context.params;
  const service = createUserService(prisma);

  try {
    await service.enableUser(id, actor.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ error: "Reaktivierung fehlgeschlagen." }, { status: 400 });
  }
}
