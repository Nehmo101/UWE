import { NextResponse } from "next/server";
import {
  createAuthService,
  createPrismaClient,
  createWorldCreationService,
  logAuditEvent,
} from "@uwe/database/server";
import { canAccessStudio, SESSION_COOKIE_NAME } from "@uwe/auth";
import { createWorldBodySchema, parseBody } from "@uwe/security";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const session = await auth.getSessionByToken(token);
    const user = session?.user ? auth.toAuthUser(session.user) : null;
    if (!user) {
      return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
    }

    if (!canAccessStudio(user)) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        action: "authz_denied",
        targetType: "world",
        metadata: { endpoint: "portal_create_world", access: user.access },
      });

      return NextResponse.json(
        { error: "Nur Owner/Admin dürfen Welten erstellen." },
        { status: 403 },
      );
    }

    const parsed = await parseBody(request, createWorldBodySchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const service = createWorldCreationService(db);
    const world = await service.createWorldForUser(user.id, parsed.data);

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
