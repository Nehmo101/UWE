import type { MailAuditAction, MailPriorityCategory } from "@uwe/database/mail-prisma-types";
import type { PrismaClient } from "@uwe/database/client";
import {
  MAIL_PROVIDER_PRESETS,
  type MailProviderPreset,
  type MailReplyTone,
  sanitizeMailHtml,
} from "@uwe/mail-core";
import { describeImapError } from "@uwe/mail-core";
import { resolveTokenEncryptionSecret } from "@uwe/database/token-crypto";
import {
  createMailAccountService,
  type CreateMailAccountInput,
} from "@uwe/database/mail-account-service";
import {
  createMailUnsubscribeService,
  type UnsubscribeOutcome,
} from "@uwe/database/mail-unsubscribe-service";
import {
  MailPortalInboxService,
  type MailFolderKey,
  type MailInboxMessageSummary,
  type MailSearchQuery,
  type MailSearchCursor,
  type MailSearchResult,
} from "./mail-portal-inbox-service";
import { sendDirectMail } from "./mail-portal-send-service";
import { MailPortalAiActions } from "./mail-portal-ai-actions";

export interface CreateMailPortalAccountInput extends CreateMailAccountInput {
  providerPreset?: MailProviderPreset;
  imapMailbox?: string;
  ownerId?: string | null;
}

export type { MailFolderKey, MailInboxMessageSummary, MailSearchQuery, MailSearchCursor, MailSearchResult };

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
  private readonly inbox: MailPortalInboxService;
  private readonly aiActions: MailPortalAiActions;

  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {
    this.aiActions = new MailPortalAiActions(this.db, this.encryptionSecret, (input) =>
      this.logAudit(input),
    );
    this.inbox = new MailPortalInboxService(
      this.db,
      this.encryptionSecret,
      () => this.accountService(),
      (input) => this.logAudit(input),
      (row) => this.toMessageSummary(row),
    );
    this.searchMessages = this.inbox.searchMessages.bind(this.inbox);
    this.listSentMessages = this.inbox.listSentMessages.bind(this.inbox);
    this.fetchAttachmentContent = this.inbox.fetchAttachmentContent.bind(this.inbox);
    this.archiveMessage = this.inbox.archiveMessage.bind(this.inbox);
    this.trashMessage = this.inbox.trashMessage.bind(this.inbox);
    this.setMessageStarred = this.inbox.setMessageStarred.bind(this.inbox);
    this.setMessageRead = this.inbox.setMessageRead.bind(this.inbox);
    this.getThreadForMessage = this.inbox.getThreadForMessage.bind(this.inbox);
    this.deleteMessagesBySender = this.inbox.deleteMessagesBySender.bind(this.inbox);
  }

  searchMessages: MailPortalInboxService["searchMessages"];
  listSentMessages: MailPortalInboxService["listSentMessages"];
  fetchAttachmentContent: MailPortalInboxService["fetchAttachmentContent"];
  archiveMessage: MailPortalInboxService["archiveMessage"];
  trashMessage: MailPortalInboxService["trashMessage"];
  setMessageStarred: MailPortalInboxService["setMessageStarred"];
  setMessageRead: MailPortalInboxService["setMessageRead"];
  getThreadForMessage: MailPortalInboxService["getThreadForMessage"];
  deleteMessagesBySender: MailPortalInboxService["deleteMessagesBySender"];

  private accountService() {
    return createMailAccountService(this.db);
  }

  private unsubscribeService() {
    return createMailUnsubscribeService(this.db);
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

  async syncAccount(
    accountId: string,
    actorUserId?: string | null,
    limit = 50,
    options?: { fullSync?: boolean; mailbox?: string },
  ) {
    const result = await this.accountService().syncInbox(accountId, {
      limit,
      fullSync: options?.fullSync ?? false,
      mailbox: options?.mailbox,
    });
    await this.logAudit({
      action: "sync",
      accountId,
      userId: actorUserId,
      detail: `${result.imported} Nachrichten synchronisiert`,
    });
    return result;
  }

  async sendDirect(
    input: {
      accountId: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      bodyText: string;
      bodyHtml?: string | null;
      attachments?: Array<{ filename: string; path?: string; contentType?: string }>;
    },
    actorUserId?: string | null,
  ) {
    return sendDirectMail(this.db, this.encryptionSecret, (audit) => this.logAudit(audit), input, actorUserId);
  }

  /**
   * Meldet den Absender einer Nachricht per RFC-8058-One-Click oder mailto-Fallback ab
   * und markiert im selben Zug bereits vorhandene Nachrichten dieses Absenders als gelesen
   * ("Postfach aufräumen"). Erfordert eine explizite Nutzeraktion — läuft nicht automatisch.
   */
  async unsubscribeFromMessage(
    messageId: string,
    actorUserId?: string | null,
  ): Promise<UnsubscribeOutcome> {
    try {
      const outcome = await this.unsubscribeService().unsubscribeFromMessage(messageId, actorUserId);
      await this.logAudit({
        action: "unsubscribe",
        messageId,
        userId: actorUserId,
        detail: `${outcome.method} · ${outcome.senderAddress} · ${outcome.cleanedUpCount} Nachrichten aufgeräumt`,
      });
      return outcome;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Abmeldung fehlgeschlagen.";
      await this.logAudit({ action: "unsubscribe", messageId, userId: actorUserId, detail });
      throw error;
    }
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

    if (!row.isRead) {
      // Fire-and-forget: the reader must not wait for an IMAP roundtrip;
      // markMessageSeenOnServer catches and audit-logs its own failures.
      void this.inbox.markMessageSeenOnServer(id);
    }

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
      // Raw (unsanitized) HTML, kept separate from `bodyHtml` above so callers that
      // need to render markup safely can run their own display-sanitizer over it
      // (e.g. the Studio API route uses DOMPurify + tracking-pixel blocking) without
      // changing the tag-stripped `bodyHtml` contract other consumers already rely on.
      bodyHtmlRaw: row.bodyHtml,
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
    aiScore?: Parameters<MailPortalAiActions["prioritizeMessage"]>[3],
  ) {
    return this.aiActions.prioritizeMessage(messageId, actorUserId, vipSenders, aiScore);
  }

  async summarizeMessage(
    messageId: string,
    actorUserId?: string | null,
    options?: Parameters<MailPortalAiActions["summarizeMessage"]>[2],
  ) {
    return this.aiActions.summarizeMessage(messageId, actorUserId, options);
  }

  async createReplyDraft(
    messageId: string,
    tone: MailReplyTone = "professional",
    actorUserId?: string | null,
    options?: Parameters<MailPortalAiActions["createReplyDraft"]>[3],
  ) {
    return this.aiActions.createReplyDraft(messageId, tone, actorUserId, options);
  }

  async sendDraft(draftId: string, confirm: boolean, actorUserId?: string | null) {
    return this.aiActions.sendDraft(draftId, confirm, actorUserId);
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
    listUnsubscribeHttpUrl?: string | null;
    listUnsubscribeMailto?: string | null;
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
      hasUnsubscribeTarget: Boolean(row.listUnsubscribeHttpUrl || row.listUnsubscribeMailto),
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
