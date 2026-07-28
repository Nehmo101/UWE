import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { resolveOutboundAttachmentPath, deleteOutboundAttachment } from "@uwe/mail";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

interface OutboundAttachmentRef {
  key: string;
  filename: string;
  contentType?: string;
}

export async function POST(request: Request) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;

  let body: {
    draftId?: string;
    accountId?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    bodyText?: string;
    bodyHtml?: string | null;
    attachments?: OutboundAttachmentRef[];
    confirm?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  const service = createMailPortalService(brainPrisma);

  if (body.draftId) {
    if (body.confirm !== true) {
      return mailApiError("Versand erfordert confirm=true.", 400);
    }
    try {
      const result = await service.sendDraft(body.draftId, true, auth.user?.id);
      return NextResponse.json(
        { ok: result.ok, logId: result.log.id, error: result.error ?? null },
        { status: result.ok ? 200 : 502 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Versand fehlgeschlagen.";
      return mailApiError(message, 400);
    }
  }

  if (!body.accountId) return mailApiError("accountId erforderlich.");
  if (!body.to?.length) return mailApiError("Empfänger erforderlich.");
  if (!body.subject?.trim()) return mailApiError("Betreff erforderlich.");
  if (!body.bodyText?.trim()) return mailApiError("Nachrichtentext erforderlich.");
  if (body.confirm !== true) return mailApiError("Versand erfordert confirm=true.", 400);

  const attachmentRefs = Array.isArray(body.attachments) ? body.attachments.filter((a) => a?.key && a?.filename) : [];
  const attachments = attachmentRefs.map((ref) => ({
    filename: ref.filename,
    path: resolveOutboundAttachmentPath(ref.key, ref.filename),
    contentType: ref.contentType,
  }));

  try {
    const result = await service.sendDirect(
      {
        accountId: body.accountId,
        to: body.to,
        cc: Array.isArray(body.cc) ? body.cc.filter(Boolean) : undefined,
        bcc: Array.isArray(body.bcc) ? body.bcc.filter(Boolean) : undefined,
        subject: body.subject.trim(),
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      auth.user?.id,
    );
    // Clean up stored attachments once the send attempt is done (success or failure).
    if (result.ok) {
      await Promise.all(attachmentRefs.map((ref) => deleteOutboundAttachment(ref.key)));
    }
    return NextResponse.json(
      { ok: result.ok, logId: result.log.id, error: result.error ?? null },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Versand fehlgeschlagen.";
    return mailApiError(message, 400);
  }
}
