import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { executeMailChat } from "@/src/lib/mail-chat";
import { brainPrisma } from "@uwe/database/brain-client";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;
  if (!auth.user) return mailApiError("Authentifizierung erforderlich.", 401);

  let body: {
    messageId?: string;
    subject?: string;
    fromAddress?: string;
    bodyText?: string | null;
    bodyHtml?: string | null;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.messageId) return mailApiError("messageId erforderlich.");
  if (!body.messages?.length) return mailApiError("messages erforderlich.");

  const stored = await createMailPortalService(brainPrisma).getMessageContent(body.messageId);
  if (!stored) return mailApiError("Nachricht nicht gefunden.", 404);

  try {
    const result = await executeMailChat(
      {
        messageId: body.messageId,
        subject: body.subject ?? stored.subject,
        fromAddress: body.fromAddress ?? stored.fromAddress,
        bodyText: body.bodyText ?? stored.bodyText,
        bodyHtml: body.bodyHtml ?? stored.bodyHtml,
        messages: body.messages,
      },
      { userId: auth.user.id, role: auth.user.role },
    );

    if (result.kind === "unavailable") {
      return NextResponse.json({ unavailable: result.message }, { status: 503 });
    }

    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      routedVia: result.routedVia,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat fehlgeschlagen.";
    return jsonError(message, 400);
  }
}
