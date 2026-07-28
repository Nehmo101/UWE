import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

export async function POST(request: Request) {
  const auth = await requireBrainMailMutation(request);
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
    return mailApiError(message, 400);
  }
}
