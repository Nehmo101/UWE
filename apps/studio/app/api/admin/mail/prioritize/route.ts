import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { generateMailPriority } from "@/src/lib/mail-portal-ai";
import { brainPrisma } from "@uwe/database/brain-client";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { messageId?: string; vipSenders?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.messageId) return mailApiError("messageId erforderlich.");

  const service = createMailPortalService(brainPrisma);
  try {
    // LLM-Priorisierung (lokal-only via Gateway) mit Regel-Fallback.
    const message = await service.getMessageContent(body.messageId);
    if (!message) return mailApiError("Nachricht nicht gefunden.", 404);

    const aiScore = await generateMailPriority(
      {
        subject: message.subject,
        fromAddress: message.fromAddress,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        hasAttachments: message.hasAttachments,
        vipSenders: body.vipSenders,
      },
      auth.user ? { userId: auth.user.id } : null,
    );

    const score = await service.prioritizeMessage(
      body.messageId,
      auth.user?.id,
      body.vipSenders,
      aiScore ?? undefined,
    );
    return NextResponse.json({ score });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Priorisierung fehlgeschlagen.";
    return jsonError(message, 400);
  }
}
