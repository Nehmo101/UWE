import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createPrismaClient,
  createWorldCreationService,
  logAuditEvent,
} from "@uwe/database/server";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { createWorldBodySchema, parseBody } from "@uwe/security";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "login" });
  if (authError) {
    return authError;
  }

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return jsonError("Anmeldung erforderlich.", 401);
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

  const parsed = await parseBody(request, createWorldBodySchema);
  if (!parsed.success) {
    return parsed.response;
  }

  const db = createPrismaClient();
  try {
    const service = createWorldCreationService(db);
    const world = await service.createWorldForUser(user.id, parsed.data);

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
