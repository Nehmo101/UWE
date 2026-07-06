import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: {
    draftId?: string;
    accountId?: string;
    to?: string[];
    subject?: string;
    bodyText?: string;
    bodyHtml?: string | null;
    confirm?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  const service = createMailPortalService(prisma);

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
      return jsonError(message, 400);
    }
  }

  if (!body.accountId) return mailApiError("accountId erforderlich.");
  if (!body.to?.length) return mailApiError("Empfänger erforderlich.");
  if (!body.subject?.trim()) return mailApiError("Betreff erforderlich.");
  if (!body.bodyText?.trim()) return mailApiError("Nachrichtentext erforderlich.");
  if (body.confirm !== true) return mailApiError("Versand erfordert confirm=true.", 400);

  try {
    const result = await service.sendDirect(
      {
        accountId: body.accountId,
        to: body.to,
        subject: body.subject.trim(),
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
      },
      auth.user?.id,
    );
    return NextResponse.json(
      { ok: result.ok, logId: result.log.id, error: result.error ?? null },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Versand fehlgeschlagen.";
    return jsonError(message, 400);
  }
}
