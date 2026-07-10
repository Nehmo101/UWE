import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { prisma } from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import type { MailReplyTone } from "@uwe/mail/portal-types";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { generateMailReplyDraft } from "@/src/lib/mail-portal-ai";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { messageId?: string; tone?: MailReplyTone };
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

    const ai = await generateMailReplyDraft(
      {
        subject: message.subject,
        fromAddress: message.fromAddress,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        tone: body.tone ?? "professional",
      },
      auth.user ? { userId: auth.user.id, role: auth.user.role } : null,
    );

    const draft = await service.createReplyDraft(
      body.messageId,
      body.tone ?? "professional",
      auth.user?.id,
      {
        draftText: ai.text,
        modelProvider: ai.provider,
        modelName: ai.model,
      },
    );

    return NextResponse.json({
      draft: {
        id: draft.id,
        subject: draft.subject,
        bodyText: draft.bodyText,
        status: draft.status,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Antwortentwurf fehlgeschlagen.";
    return jsonError(msg, 400);
  }
}
