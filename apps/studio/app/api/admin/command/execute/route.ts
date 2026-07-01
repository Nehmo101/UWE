import { NextResponse } from "next/server";
import {
  auditRequestFromHeaders,
  createNlCommandService,
  prisma,
  type NlCommandIntent,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

function isNlCommandIntent(value: unknown): value is NlCommandIntent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const intent = (value as { intent?: unknown }).intent;
  return (
    intent === "set_maintenance_mode" ||
    intent === "list_users" ||
    intent === "list_worlds" ||
    intent === "get_migration_status"
  );
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
    return NextResponse.json({ error: "Authentifizierung erforderlich." }, { status: 401 });
  }

  const body = (await request.json()) as {
    intent?: unknown;
    confirmationToken?: string | null;
    confirmationIssuedAt?: number | null;
  };

  if (!isNlCommandIntent(body.intent)) {
    return NextResponse.json({ error: "Unbekannter oder ungültiger Befehl." }, { status: 400 });
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
