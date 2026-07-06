import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createUserService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const service = createUserService(prisma);
  const [users, worlds] = await Promise.all([
    service.listUsersForAdmin(),
    prisma.world.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return NextResponse.json({ users, worlds });
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const actor = context.user ?? (await requireAdminAccess());
  const body = (await request.json()) as {
    displayName?: string;
    email?: string | null;
    password?: string | null;
    role?: "owner" | "admin" | "dm" | "player" | "readonly" | "guest";
    status?: "invited" | "active" | "disabled";
    invite?: boolean;
  };

  const displayName = body.displayName?.trim();
  if (!displayName) {
    return jsonError("Anzeigename ist erforderlich.", 400);
  }

  const service = createUserService(prisma);

  if (body.invite) {
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return jsonError("E-Mail ist für Einladungen erforderlich.", 400);
    }

    const invited = await service.createInvite({
      displayName,
      email,
      role: body.role,
      actorUserId: actor.id,
    });

    return NextResponse.json({
      user: invited.user,
      inviteToken: invited.inviteToken,
      expiresAt: invited.expiresAt.toISOString(),
      warning:
        "Einladungslink wird nur einmal angezeigt. Speichere ihn sicher — er wird nicht erneut ausgegeben.",
    });
  }

  if (body.password && body.password.length < 8) {
    return NextResponse.json(
      { error: "Passwort muss mindestens 8 Zeichen haben." },
      { status: 400 },
    );
  }

  const user = await service.createUser({
    displayName,
    email: body.email ?? null,
    password: body.password ?? null,
    role: body.role,
    status: body.status,
    actorUserId: actor.id,
  });

  const users = await service.listUsersForAdmin();
  const created = users.find((entry) => entry.id === user.id);
  return NextResponse.json({ user: created ?? user }, { status: 201 });
}
