import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createCaptureTriageService,
  createLifeAdminService,
  prisma,
} from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: {
    action?:
      | "archive"
      | "trash"
      | "delete_by_sender"
      | "unsubscribe"
      | "capture"
      | "task"
      | "star"
      | "unstar"
      | "read"
      | "unread";
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
    if ((body.action === "star" || body.action === "unstar") && body.messageId) {
      await service.setMessageStarred(body.messageId, body.action === "star", auth.user?.id);
      return NextResponse.json({ ok: true, starred: body.action === "star" });
    }
    if ((body.action === "read" || body.action === "unread") && body.messageId) {
      await service.setMessageRead(body.messageId, body.action === "read", auth.user?.id);
      return NextResponse.json({ ok: true, read: body.action === "read" });
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
    if (body.action === "capture" && body.messageId) {
      const message = await service.getMessage(body.messageId, auth.user?.id);
      if (!message) {
        return mailApiError("Nachricht nicht gefunden.", 404);
      }
      const lifeAdmin = createLifeAdminService(prisma);
      const capture = await lifeAdmin.createCapture({
        title: message.subject?.trim() || "Mail-Capture",
        content: [
          `Von: ${message.fromAddress}`,
          `Datum: ${message.receivedAt.toISOString()}`,
          "",
          message.bodyText?.trim() || message.snippet?.trim() || "(Kein Textinhalt)",
        ].join("\n"),
        captureType: "quick_note",
        metadata: {
          source: "mail",
          mailMessageId: message.id,
          mailAccountId: message.accountId,
        },
      });
      await createCaptureTriageService(prisma).ensureAiProposal(capture.id);
      return NextResponse.json({ ok: true, captureId: capture.id });
    }
    if (body.action === "task" && body.messageId) {
      const message = await service.getMessage(body.messageId, auth.user?.id);
      if (!message) {
        return mailApiError("Nachricht nicht gefunden.", 404);
      }
      const lifeAdmin = createLifeAdminService(prisma);
      const snippet = message.bodyText?.trim() || message.snippet?.trim() || "";
      const project = await lifeAdmin.createPersonalProject({
        name: message.subject?.trim() || "Mail-Aufgabe",
        description: [
          `Von: ${message.fromAddress}`,
          `Datum: ${message.receivedAt.toISOString()}`,
          "",
          snippet || "(Kein Textinhalt)",
        ].join("\n"),
        status: "idea",
        category: "other",
        nextAction: `Mail beantworten: ${message.fromAddress}`,
        metadata: {
          source: "mail",
          mailMessageId: message.id,
          mailAccountId: message.accountId,
        },
      });
      return NextResponse.json({ ok: true, projectId: project.id });
    }
    return mailApiError("Unbekannte Aktion oder fehlende Parameter.", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen.";
    return jsonError(message, 400);
  }
}
