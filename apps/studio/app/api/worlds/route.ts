import { NextResponse } from "next/server";
import { canAccessStudio } from "@uwe/auth";
import { jsonError } from "@/src/lib/api-response";
import {
  createPrismaClient,
  createWorldCreationService,
  logAuditEvent,
} from "@uwe/database/server";

import { createWorldBodySchema, parseBody } from "@uwe/security";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";
import { revalidateStudioWorldList } from "@/src/lib/world-list-cache";

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "login" });
  if (authError) {
    return authError;
  }

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return jsonError("Anmeldung erforderlich.", 401);
  }

  if (!canAccessStudio(user)) {
    const db = createPrismaClient();
    try {
      await logAuditEvent(db, {
        actorUserId: user.id,
        action: "authz_denied",
        targetType: "world",
        metadata: { endpoint: "studio_create_world", access: user.access },
      });
    } finally {
      await db.$disconnect();
    }

    return NextResponse.json(
      { error: "Nur Owner/Admin dürfen Welten erstellen." },
      { status: 403 },
    );
  }

  const parsed = await parseBody(request, createWorldBodySchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const db = createPrismaClient();
  try {
    const service = createWorldCreationService(db);
    const world = await service.createWorldForUser(user.id, parsed.data);

    // A new world changes the cached studio world list.
    revalidateStudioWorldList();

    return NextResponse.json({ world }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORLD_NAME_REQUIRED") {
      return jsonError("Name ist erforderlich.", 400);
    }
    return jsonError("Welt konnte nicht erstellt werden.", 500);
  } finally {
    await db.$disconnect();
  }
}
