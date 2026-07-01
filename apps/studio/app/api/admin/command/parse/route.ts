import { NextResponse } from "next/server";
import { createNlCommandService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const actor = context.user;
  if (!actor) {
    return NextResponse.json({ error: "Authentifizierung erforderlich." }, { status: 401 });
  }

  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Bitte einen Befehl eingeben." }, { status: 400 });
  }

  const service = createNlCommandService(prisma);
  const parsed = service.parse(text);
  if (!parsed.ok) {
    return NextResponse.json(parsed, { status: 400 });
  }

  const confirmation = service.createConfirmation(parsed.intent, actor.id);
  return NextResponse.json({
    ok: true,
    intent: parsed.intent,
    requiresConfirmation: parsed.requiresConfirmation,
    confirmationMessage: confirmation.message,
    confirmationToken: confirmation.confirmationToken,
    confirmationIssuedAt: confirmation.issuedAt,
  });
}
