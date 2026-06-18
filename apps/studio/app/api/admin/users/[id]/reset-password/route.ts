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
  const body = (await request.json()) as {
    newPassword?: string;
    forcePasswordChange?: boolean;
  };

  const newPassword = body.newPassword?.trim();
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Neues Passwort muss mindestens 8 Zeichen haben." },
      { status: 400 },
    );
  }

  const service = createUserService(prisma);
  const ok = await service.resetPassword({
    userId: id,
    newPassword,
    actorUserId: actor.id,
    forcePasswordChange: body.forcePasswordChange,
  });

  if (!ok) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: "Passwort wurde zurückgesetzt. Alle aktiven Sitzungen wurden beendet.",
  });
}
