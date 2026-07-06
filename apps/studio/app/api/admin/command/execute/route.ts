import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  auditRequestFromHeaders,
  createNlCommandService,
  isNlCommandIntentName,
  prisma,
  type NlCommandIntent,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

function isNlCommandIntent(value: unknown): value is NlCommandIntent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const intentName = record.intent;
  if (typeof intentName !== "string" || !isNlCommandIntentName(intentName)) {
    return false;
  }

  switch (intentName) {
    case "set_maintenance_mode":
    case "set_lock_portal":
    case "set_lock_studio":
      return typeof record.enabled === "boolean";
    case "assign_world_role":
      return (
        typeof record.userQuery === "string" &&
        typeof record.worldQuery === "string" &&
        typeof record.role === "string"
      );
    case "remove_world_membership":
      return typeof record.userQuery === "string" && typeof record.worldQuery === "string";
    case "disable_user":
    case "enable_user":
      return typeof record.userQuery === "string";
    case "invite_user":
      return typeof record.email === "string";
    case "create_world":
      return typeof record.name === "string";
    case "set_user_role":
      return typeof record.userQuery === "string" && typeof record.role === "string";
    default:
      return true;
  }
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const actor = context.user;
  if (!actor) {
    return jsonError("Authentifizierung erforderlich.", 401);
  }

  const body = (await request.json()) as {
    intent?: unknown;
    confirmationToken?: string | null;
    confirmationIssuedAt?: number | null;
  };

  if (!isNlCommandIntent(body.intent)) {
    return jsonError("Unbekannter oder ungültiger Befehl.", 400);
  }

  const service = createNlCommandService(prisma);
  const result = await service.execute(body.intent, {
    actorUserId: actor.id,
    request: auditRequestFromHeaders(request.headers),
  }, {
    confirmationToken: body.confirmationToken,
    confirmationIssuedAt: body.confirmationIssuedAt,
  });

  if (!result.ok) {
    const status =
      result.code === "confirmation_required" ||
      result.code === "confirmation_invalid" ||
      result.code === "confirmation_expired"
        ? 409
        : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
