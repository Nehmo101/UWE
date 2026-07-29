import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { generateMailSummary } from "@uwe/mail/ai";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailAi, mailApiError } from "@/src/lib/mail-api";

export async function POST(request: Request) {
  const auth = await requireBrainMailAi(request);
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
    const message = await service.getMessageContent(body.messageId);
    if (!message) return mailApiError("Nachricht nicht gefunden.", 404);

    const ai = await generateMailSummary(
      {
        subject: message.subject,
        fromAddress: message.fromAddress,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
      },
      auth.user ? { userId: auth.user.id } : null,
    );

    const action = await service.summarizeMessage(body.messageId, auth.user?.id, {
      summary: ai.text,
      modelProvider: ai.provider,
      modelName: ai.model,
    });
    return NextResponse.json({ action });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Zusammenfassung fehlgeschlagen.";
    return mailApiError(msg, 400);
  }
}
