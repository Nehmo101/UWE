import type { MailAuditAction, MailPriorityCategory } from "@uwe/database/mail-prisma-types";
import type { BrainPrismaClient as PrismaClient } from "@uwe/database/brain-client";
import { mailBodyForProcessing, type MailReplyTone } from "@uwe/mail-core";
import { createMailTransport } from "@uwe/mail-core";
import { decryptSecret } from "@uwe/database/token-crypto";
import { createMailLogService } from "@uwe/database/mail-log-service";
import { scoreMailPriority } from "@uwe/mail-core";

type LogAuditFn = (input: {
  action: MailAuditAction;
  accountId?: string | null;
  messageId?: string | null;
  userId?: string | null;
  detail?: string | null;
}) => Promise<unknown>;

export class MailPortalAiActions {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string,
    private readonly logAudit: LogAuditFn,
  ) {}

  async prioritizeMessage(
    messageId: string,
    actorUserId?: string | null,
    vipSenders?: string[],
    aiScore?: {
      priority: number;
      category: MailPriorityCategory;
      confidence: number;
      explanation: string;
      extractedActions: Array<{ type: string; label: string; value?: string }>;
      modelProvider: string;
      modelName: string;
    },
  ) {
    const message = await this.db.mailInboxMessage.findUnique({
      where: { id: messageId },
      include: { attachments: true },
    });
    if (!message) throw new Error("Nachricht nicht gefunden.");

    const scored = aiScore
      ? { ...aiScore, ruleSignals: ["llm"] }
      : {
          ...scoreMailPriority({
            subject: message.subject,
            fromAddress: message.fromAddress,
            bodyText: message.bodyText,
            bodyHtml: message.bodyHtml,
            hasAttachments: message.hasAttachments || message.attachments.length > 0,
            vipSenders,
          }),
          modelProvider: "rules",
          modelName: "uwe-mail-rules-v1",
        };

    const saved = await this.db.mailPriorityScore.upsert({
      where: { messageId },
      create: {
        messageId,
        priority: scored.priority,
        category: scored.category,
        confidence: scored.confidence,
        explanation: scored.explanation,
        ruleSignals: scored.ruleSignals,
        extractedActions: scored.extractedActions,
        modelProvider: scored.modelProvider,
        modelName: scored.modelName,
      },
      update: {
        priority: scored.priority,
        category: scored.category,
        confidence: scored.confidence,
        explanation: scored.explanation,
        ruleSignals: scored.ruleSignals,
        extractedActions: scored.extractedActions,
        scoredAt: new Date(),
        modelProvider: scored.modelProvider,
        modelName: scored.modelName,
      },
    });

    await this.db.mailAiAction.create({
      data: {
        messageId,
        kind: "prioritize",
        outputText: scored.explanation,
        modelProvider: scored.modelProvider,
        modelName: scored.modelName,
      },
    });

    await this.logAudit({
      action: "prioritize",
      accountId: message.accountId,
      messageId,
      userId: actorUserId,
      detail: `${scored.category} (${scored.priority})`,
    });

    return saved;
  }

  async summarizeMessage(
    messageId: string,
    actorUserId?: string | null,
    options?: { summary?: string; modelProvider?: string; modelName?: string },
  ) {
    const message = await this.db.mailInboxMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new Error("Nachricht nicht gefunden.");

    const body = mailBodyForProcessing(message.bodyText, message.bodyHtml).slice(0, 4000);
    const summary =
      options?.summary?.trim() || body.slice(0, 280) + (body.length > 280 ? "…" : "");
    const modelProvider = options?.modelProvider ?? "rules";
    const modelName = options?.modelName ?? "truncate-v1";

    const action = await this.db.mailAiAction.create({
      data: {
        messageId,
        kind: "summarize",
        outputText: summary,
        modelProvider,
        modelName,
      },
    });

    await this.logAudit({
      action: "ai_summarize",
      accountId: message.accountId,
      messageId,
      userId: actorUserId,
    });

    return action;
  }

  async createReplyDraft(
    messageId: string,
    tone: MailReplyTone = "professional",
    actorUserId?: string | null,
    options?: { draftText?: string; modelProvider?: string; modelName?: string },
  ) {
    const message = await this.db.mailInboxMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });
    if (!message) throw new Error("Nachricht nicht gefunden.");

    const draftText =
      options?.draftText?.trim() ||
      `Hallo,\n\nvielen Dank für Ihre Nachricht zu „${message.subject}“.\n\n[Ihre Antwort hier]\n\nFreundliche Grüße`;
    const modelProvider = options?.modelProvider ?? "template";
    const modelName = options?.modelName ?? "template-v1";

    const draft = await this.db.mailDraft.create({
      data: {
        accountId: message.accountId,
        replyToMessageId: messageId,
        subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
        bodyText: draftText,
        status: "pending_review",
        toAddresses: [message.fromAddress],
      },
    });

    await this.db.mailAiAction.create({
      data: {
        messageId,
        kind: "reply_draft",
        outputText: draftText,
        tone,
        modelProvider,
        modelName,
      },
    });

    await this.logAudit({
      action: "ai_reply_draft",
      accountId: message.accountId,
      messageId,
      userId: actorUserId,
      detail: `Ton: ${tone}`,
    });

    return draft;
  }

  async sendDraft(draftId: string, confirm: boolean, actorUserId?: string | null) {
    if (!confirm) {
      throw new Error("Versand erfordert explizite Bestätigung (confirm=true).");
    }

    const draft = await this.db.mailDraft.findUnique({
      where: { id: draftId },
      include: { account: true },
    });
    if (!draft) throw new Error("Entwurf nicht gefunden.");
    if (!draft.account) throw new Error("Kein Mail-Account für diesen Entwurf.");

    const toRaw = draft.toAddresses;
    const recipients = Array.isArray(toRaw)
      ? (toRaw as string[]).map((email) => ({ email: String(email) }))
      : [];
    if (recipients.length === 0) {
      throw new Error("Empfänger fehlt.");
    }

    const password = decryptSecret(draft.account.passwordEnc, this.encryptionSecret);
    const transport = createMailTransport({
      enabled: true,
      host: draft.account.smtpHost,
      port: draft.account.smtpPort ?? 587,
      user: draft.account.username,
      password,
      from: draft.account.username,
      secure: (draft.account.smtpPort ?? 587) === 465,
      logBody: false,
      useMock: false,
    });

    const logService = createMailLogService(this.db);
    const toAddresses = recipients.map((r) => r.email);
    const pendingLog = await logService.create({
      worldId: draft.worldId,
      status: "pending",
      subject: draft.subject,
      toAddresses,
      fromAddress: draft.account.username,
      sourceType: "mail_portal",
      sourceId: draft.id,
      bodyLogged: false,
      bodyText: draft.bodyText ?? "",
      bodyHtml: draft.bodyHtml,
    });

    const sendResult = await transport.send({
      to: recipients,
      subject: draft.subject,
      text: draft.bodyText ?? "",
      html: draft.bodyHtml ?? undefined,
    });

    const result = sendResult.ok
      ? { ok: true as const, log: await logService.markSent(pendingLog.id, sendResult.messageId) }
      : {
          ok: false as const,
          log: await logService.markFailed(pendingLog.id, sendResult.error ?? "Versand fehlgeschlagen"),
          error: sendResult.error,
        };

    await this.db.mailDraft.update({
      where: { id: draftId },
      data: { status: "sent" },
    });

    await this.logAudit({
      action: "send",
      accountId: draft.accountId,
      userId: actorUserId,
      detail: result.ok ? "Gesendet" : `Fehler: ${result.error ?? "unbekannt"}`,
    });

    return result;
  }
}
