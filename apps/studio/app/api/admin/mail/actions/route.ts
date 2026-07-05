import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: {
    action?: "archive" | "trash" | "delete_by_sender" | "unsubscribe";
    messageId?: string;
    senderPattern?: string;
    accountId?: string;
    confirm?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  const service = createMailPortalService(prisma);

  try {
    if (body.action === "archive" && body.messageId) {
      await service.archiveMessage(body.messageId, auth.user?.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "trash" && body.messageId) {
      await service.trashMessage(body.messageId, auth.user?.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete_by_sender" && body.senderPattern) {
      const count = await prisma.mailInboxMessage.count({
        where: {
          fromAddress: { contains: body.senderPattern },
          ...(body.accountId ? { accountId: body.accountId } : {}),
        },
      });
      if (body.confirm !== true) {
        return NextResponse.json({ ok: false, preview: true, count });
      }
      const deleted = await service.deleteMessagesBySender(
        body.senderPattern,
        body.accountId,
        auth.user?.id,
      );
      return NextResponse.json({ ok: true, deleted });
    }
    if (body.action === "unsubscribe" && body.messageId) {
      const outcome = await service.unsubscribeFromMessage(body.messageId, auth.user?.id);
      return NextResponse.json({ ok: true, outcome });
    }
    return mailApiError("Unbekannte Aktion oder fehlende Parameter.", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
