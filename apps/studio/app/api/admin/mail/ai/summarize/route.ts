import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { generateMailSummary } from "@/src/lib/mail-portal-ai";

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

  const service = createMailPortalService(prisma);
  try {
    const message = await service.getMessageContent(body.messageId);
    if (!message) return mailApiError("Nachricht nicht gefunden.", 404);

    const ai = await generateMailSummary({
      subject: message.subject,
      fromAddress: message.fromAddress,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
    });

    const action = await service.summarizeMessage(body.messageId, auth.user?.id, {
      summary: ai.text,
      modelProvider: ai.provider,
      modelName: ai.model,
    });
    return NextResponse.json({ action });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Zusammenfassung fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
