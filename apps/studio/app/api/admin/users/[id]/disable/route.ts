import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
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
    await service.disableUser(id, actor.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    switch (code) {
      case "USER_NOT_FOUND":
        return jsonError("Benutzer nicht gefunden.", 404);
      case "LAST_OWNER":
        return NextResponse.json(
          { error: "Der letzte aktive Owner kann nicht deaktiviert werden." },
          { status: 400 },
        );
      case "CANNOT_DISABLE_SELF":
        return NextResponse.json(
          { error: "Du kannst dein eigenes Konto nicht deaktivieren." },
          { status: 400 },
        );
      default:
        return jsonError("Deaktivierung fehlgeschlagen.", 400);
    }
  }
}
