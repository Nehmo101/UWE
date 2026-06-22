import { NextResponse } from "next/server";
import {
  createPrismaClient,
  createWorldCreationService,
  logAuditEvent,
} from "@uwe/database/server";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { guardStudioMutation } from "@uwe/security";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "login" });
  if (authError) {
    return authError;
  }

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  if (!hasAnyRole(user, ADMIN_ACCESS_ROLES)) {
    const db = createPrismaClient();
    try {
      await logAuditEvent(db, {
        actorUserId: user.id,
        action: "authz_denied",
        targetType: "world",
        metadata: { endpoint: "studio_create_world", role: user.role },
      });
    } finally {
      await db.$disconnect();
    }

    return NextResponse.json(
      { error: "Nur Owner/Admin dürfen Welten erstellen." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const payload = body as {
    name?: string;
    slug?: string;
    description?: string;
    guestModeEnabled?: boolean;
  };

  const db = createPrismaClient();
  try {
    const service = createWorldCreationService(db);
    const world = await service.createWorldForUser(user.id, {
      name: payload.name ?? "",
      slug: payload.slug,
      description: payload.description ?? null,
      guestModeEnabled: payload.guestModeEnabled,
    });

    return NextResponse.json({ world }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORLD_NAME_REQUIRED") {
      return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
    }
    return NextResponse.json({ error: "Welt konnte nicht erstellt werden." }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}
