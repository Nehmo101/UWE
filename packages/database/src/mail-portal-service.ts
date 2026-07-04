import type {
  MailAuditAction,
  MailPriorityCategory,
  Prisma,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import {
  MAIL_PROVIDER_PRESETS,
  type MailProviderPreset,
  type MailReplyTone,
  mailBodyForProcessing,
  sanitizeMailHtml,
  createMailTransport,
} from "@uwe/mail";
import { decryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import { createMailAccountService, type CreateMailAccountInput } from "./mail-account-service";
import { scoreMailPriority } from "./mail-priority-service";
import { createMailLogService } from "./mail-log-service";
import { describeImapError } from "@uwe/mail";

export interface CreateMailPortalAccountInput extends CreateMailAccountInput {
  providerPreset?: MailProviderPreset;
  imapMailbox?: string;
  ownerId?: string | null;
}

export interface MailSearchQuery {
  accountId?: string;
  q?: string;
  category?: MailPriorityCategory;
  limit?: number;
}

export interface MailExtractedAction {
  type: string;
  label: string;
  value?: string;
}

export interface MailPrioritySummaryMessage {
  id: string;
  subject: string;
  fromAddress: string;
  accountLabel?: string;
  receivedAt: Date;
  category: MailPriorityCategory | null;
  priority: number;
  extractedActions: MailExtractedAction[];
}

/** Verdichtete Prioritäts-Sicht der Inbox fürs „Heute"-Cockpit. */
export interface MailInboxPrioritySummary {
  urgentCount: number;
  replyNeededCount: number;
  todayCount: number;
  /** Summe der handlungsrelevanten Kategorien (urgent + reply_needed + today). */
  actionableCount: number;
  unreadTotal: number;
  topMessages: MailPrioritySummaryMessage[];
}

/** `extractedActions` ist untypisiertes JSON — defensiv in eine feste Form bringen. */
function normalizeExtractedMailActions(raw: unknown): MailExtractedAction[] {
  if (!Array.isArray(raw)) return [];
  const actions: MailExtractedAction[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label : null;
    if (!label) continue;
    const type = typeof record.type === "string" ? record.type : "action";
    const value = typeof record.value === "string" ? record.value : undefined;
    actions.push(value ? { type, label, value } : { type, label });
  }
  return actions;
}

export class MailPortalService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  private accountService() {
    return createMailAccountService(this.db);
  }

  async logAudit(input: {
    action: MailAuditAction;
    accountId?: string | null;
    messageId?: string | null;
    userId?: string | null;
    detail?: string | null;
  }) {
    await this.db.mailAuditLog.create({
      data: {
        action: input.action,
        accountId: input.accountId ?? null,
        messageId: input.messageId ?? null,
        userId: input.userId ?? null,
        detail: input.detail?.slice(0, 500) ?? null,
      },
    });
  }

  resolveProviderPreset(preset: MailProviderPreset) {
    return MAIL_PROVIDER_PRESETS[preset] ?? MAIL_PROVIDER_PRESETS.generic;
  }

  async createAccount(input: CreateMailPortalAccountInput, actorUserId?: string | null) {
    const preset = input.providerPreset ?? "generic";
    const defaults = this.resolveProviderPreset(preset);

    if (!input.smtpHost?.trim() && !defaults.smtpHost) {
      throw new Error("SMTP-Host ist erforderlich.");
    }

    const account = await this.accountService().createAccount({
      ...input,
      imapHost: input.imapHost ?? (defaults.imapHost || null),
      imapPort: input.imapPort ?? defaults.imapPort,
      smtpHost: input.smtpHost?.trim() || defaults.smtpHost,
      smtpPort: input.smtpPort ?? defaults.smtpPort,
      ownerId: input.ownerId ?? actorUserId ?? null,
    });

    await this.db.mailAccount.update({
      where: { id: account.id },
      data: {
        providerPreset: preset,
        imapMailbox: input.imapMailbox ?? "INBOX",
      },
    });

    await this.logAudit({
      action: "account_create",
      accountId: account.id,
      userId: actorUserId,
      detail: `Konto "${account.label}" angelegt`,
    });

    return this.getAccountSafe(account.id);
  }

  async deleteAccount(accountId: string, actorUserId?: string | null) {
    await this.logAudit({
      action: "account_delete",
      accountId,
      userId: actorUserId,
    });
    await this.db.mailAccount.delete({ where: { id: accountId } });
  }

  async getAccountSafe(id: string) {
    const row = await this.db.mailAccount.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      label: row.label,
      providerPreset: row.providerPreset,
      imapHost: row.imapHost,
      imapPort: row.imapPort,
      imapMailbox: row.imapMailbox,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      username: row.username,
      isDefault: row.isDefault,
      ownerId: row.ownerId,
      lastImapSyncAt: row.lastImapSyncAt,
      imapSyncError: row.imapSyncError,
      syncEnabled: row.syncEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listAccounts() {
    const rows = await this.db.mailAccount.findMany({ orderBy: { label: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      providerPreset: row.providerPreset,
      username: row.username,
      imapHost: row.imapHost,
      smtpHost: row.smtpHost,
      lastImapSyncAt: row.lastImapSyncAt,
      imapSyncError: row.imapSyncError,
      syncEnabled: row.syncEnabled,
    }));
  }

  async testConnection(accountId: string) {
    const account = await this.db.mailAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Mail-Account nicht gefunden.");

    if (!account.imapHost) {
      return { ok: false, message: "IMAP-Host fehlt." };
    }

    try {
      await this.accountService().syncInbox(accountId, { limit: 1 });
      return { ok: true, message: "Verbindung und Sync erfolgreich." };
    } catch (error) {
      const message = describeImapError(error);
      await this.accountService().markImapSyncError(accountId, message);
      return { ok: false, message };
    }
  }

  async syncAccount(accountId: string, actorUserId?: string | null, limit = 50) {
    const result = await this.accountService().syncInbox(accountId, { limit });
    await this.logAudit({
      action: "sync",
      accountId,
      userId: actorUserId,
      detail: `${result.imported} Nachrichten synchronisiert`,
    });
    return result;
  }

  async searchMessages(query: MailSearchQuery, actorUserId?: string | null) {
    const limit = query.limit ?? 50;
    const where: Prisma.MailInboxMessageWhereInput = {};

    if (query.accountId) where.accountId = query.accountId;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { subject: { contains: q } },
        { fromAddress: { contains: q } },
        { snippet: { contains: q } },
        { bodyText: { contains: q } },
      ];
    }
    if (query.category) {
      where.priority = { category: query.category };
    }

    const rows = await this.db.mailInboxMessage.findMany({
      where,
      orderBy: [{ priority: { priority: "desc" } }, { receivedAt: "desc" }],
      take: limit,
      include: {
        account: { select: { id: true, label: true } },
        priority: true,
      },
    });

    await this.logAudit({
      action: "search",
      userId: actorUserId,
      detail: query.q ? `Suche: ${query.q.slice(0, 80)}` : undefined,
    });

    return rows.map((row) => this.toMessageSummary(row));
  }

  /**
   * Prioritäts-Zusammenfassung ungelesener Inbox-Mails fürs „Heute"-Cockpit:
   * Zähler je handlungsrelevanter Kategorie plus die Top-N Nachrichten nach
   * Prioritäts-Score. Nur gescorte Mails zählen — ohne Mail-Setup sind alle 0.
   */
  async getInboxPrioritySummary(
    options: { limit?: number } = {},
  ): Promise<MailInboxPrioritySummary> {
    const limit = options.limit ?? 5;
    const [urgentCount, replyNeededCount, todayCount, unreadTotal, rows] = await Promise.all([
      this.db.mailInboxMessage.count({ where: { isRead: false, priority: { category: "urgent" } } }),
      this.db.mailInboxMessage.count({
        where: { isRead: false, priority: { category: "reply_needed" } },
      }),
      this.db.mailInboxMessage.count({ where: { isRead: false, priority: { category: "today" } } }),
      this.db.mailInboxMessage.count({ where: { isRead: false } }),
      this.db.mailInboxMessage.findMany({
        where: {
          isRead: false,
          priority: { category: { in: ["urgent", "reply_needed", "today"] } },
        },
        orderBy: [{ priority: { priority: "desc" } }, { receivedAt: "desc" }],
        take: limit,
        include: { account: { select: { id: true, label: true } }, priority: true },
      }),
    ]);

    return {
      urgentCount,
      replyNeededCount,
      todayCount,
      actionableCount: urgentCount + replyNeededCount + todayCount,
      unreadTotal,
      topMessages: rows.map((row) => ({
        id: row.id,
        subject: row.subject,
        fromAddress: row.fromAddress,
        accountLabel: row.account?.label,
        receivedAt: row.receivedAt,
        category: row.priority?.category ?? null,
        priority: row.priority?.priority ?? 0,
        extractedActions: normalizeExtractedMailActions(row.priority?.extractedActions),
      })),
    };
  }

  async getMessageContent(id: string) {
    return this.db.mailInboxMessage.findUnique({ where: { id } });
  }

  async getMessage(id: string, actorUserId?: string | null) {
    const row = await this.db.mailInboxMessage.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, label: true, username: true } },
        priority: true,
        attachments: true,
        aiActions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!row) return null;

    await this.db.mailInboxMessage.update({
      where: { id },
      data: { isRead: true },
    });

    await this.logAudit({
      action: "read",
      accountId: row.accountId,
      messageId: row.id,
      userId: actorUserId,
    });

    return {
      ...this.toMessageSummary(row),
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml ? sanitizeMailHtml(row.bodyHtml) : null,
      toAddresses: row.toAddresses,
      ccAddresses: row.ccAddresses,
      attachments: row.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        downloaded: a.downloaded,
      })),
      aiActions: row.aiActions,
    };
  }

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

    // AI score (local LLM) wins when provided; the rule engine stays the fallback.
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
      options?.summary?.trim() ||
      body.slice(0, 280) + (body.length > 280 ? "…" : "");
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

  async listAuditLog(limit = 50) {
    return this.db.mailAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { account: { select: { label: true } } },
    });
  }

  private toMessageSummary(row: {
    id: string;
    accountId: string;
    subject: string;
    fromAddress: string;
    snippet: string | null;
    receivedAt: Date;
    isRead: boolean;
    hasAttachments: boolean;
    account?: { id: string; label: string };
    priority?: {
      priority: number;
      category: MailPriorityCategory;
      confidence: number;
      explanation: string;
    } | null;
  }) {
    return {
      id: row.id,
      accountId: row.accountId,
      accountLabel: row.account?.label,
      subject: row.subject,
      fromAddress: row.fromAddress,
      snippet: row.snippet,
      receivedAt: row.receivedAt,
      isRead: row.isRead,
      hasAttachments: row.hasAttachments,
      priority: row.priority
        ? {
            priority: row.priority.priority,
            category: row.priority.category,
            confidence: row.priority.confidence,
            explanation: row.priority.explanation,
          }
        : null,
    };
  }
}

export function createMailPortalService(db: PrismaClient): MailPortalService {
  return new MailPortalService(db);
}
