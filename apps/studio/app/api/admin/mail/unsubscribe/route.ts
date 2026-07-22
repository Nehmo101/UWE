import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { brainPrisma } from "@uwe/database/brain-client";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { messageId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.messageId) return mailApiError("messageId erforderlich.");

  const service = createMailPortalService(brainPrisma);
  try {
    const outcome = await service.unsubscribeFromMessage(body.messageId, auth.user?.id);
    return NextResponse.json({ outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Abmeldung fehlgeschlagen.";
    return jsonError(message, 400);
  }
}
