import type { MailPriorityCategory, MailAuditAction, Prisma } from "@uwe/database/mail-prisma-types";
import type { PrismaClient } from "@uwe/database/client";
import { decryptSecret } from "@uwe/database/token-crypto";
import type { MailAccountService } from "@uwe/database/mail-account-service";
import type { ImapCredentials } from "../imap-sync";
import { markImapMessageSeen, moveImapMessage, type ImapWritebackTarget } from "../imap-writeback";

export type MailFolderKey = "inbox" | "marked" | "drafts" | "sent" | "archive" | "trash";

export interface MailInboxMessageSummary {
  id: string;
  accountId: string;
  accountLabel?: string;
  subject: string;
  fromAddress: string;
  snippet: string | null;
  receivedAt: Date;
  isRead: boolean;
  hasAttachments: boolean;
  hasUnsubscribeTarget: boolean;
  priority: {
    priority: number;
    category: MailPriorityCategory;
    confidence: number;
    explanation: string;
  } | null;
}

export interface MailSearchQuery {
  accountId?: string;
  q?: string;
  category?: MailPriorityCategory;
  folder?: MailFolderKey;
  markedOnly?: boolean;
  limit?: number;
}

type AuditFn = (input: {
  action: MailAuditAction;
  accountId?: string | null;
  messageId?: string | null;
  userId?: string | null;
  detail?: string | null;
}) => Promise<void>;

type SummaryFn = (row: {
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
}) => MailInboxMessageSummary;

export class MailPortalInboxService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string,
    private readonly accountService: () => MailAccountService,
    private readonly logAudit: AuditFn,
    private readonly toMessageSummary: SummaryFn,
  ) {}

  async searchMessages(query: MailSearchQuery, actorUserId?: string | null) {
    const limit = query.limit ?? 50;
    const where: Prisma.MailInboxMessageWhereInput = {};
    if (query.accountId) where.accountId = query.accountId;

    if (query.folder === "archive") {
      where.folder = { imapPath: "LOCAL:archived" };
    } else if (query.folder === "trash") {
      where.folder = { imapPath: "LOCAL:trash" };
    } else if (query.folder === "inbox" || !query.folder) {
      where.OR = [
        { folderId: null },
        { folder: { imapPath: { in: ["INBOX", "Inbox"] } } },
        { folder: { imapPath: { not: { startsWith: "LOCAL:" } } } },
      ];
    }
    if (query.folder === "marked" || query.markedOnly) {
      where.priority = { priority: { gte: 70 } };
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { subject: { contains: q } },
            { fromAddress: { contains: q } },
            { snippet: { contains: q } },
            { bodyText: { contains: q } },
          ],
        },
      ];
    }
    if (query.category) where.priority = { category: query.category };

    const rows = await this.db.mailInboxMessage.findMany({
      where,
      orderBy: [{ priority: { priority: "desc" } }, { receivedAt: "desc" }],
      take: limit,
      include: {
        account: { select: { id: true, label: true } },
        priority: true,
        folder: { select: { imapPath: true } },
      },
    });

    const filtered =
      query.folder === "inbox" || !query.folder
        ? rows.filter(
            (row) =>
              !row.folder ||
              row.folder.imapPath === "INBOX" ||
              row.folder.imapPath === "Inbox" ||
              (!row.folder.imapPath.startsWith("LOCAL:") &&
                row.folder.imapPath !== "LOCAL:archived" &&
                row.folder.imapPath !== "LOCAL:trash"),
          )
        : rows;

    await this.logAudit({
      action: "search",
      userId: actorUserId,
      detail: query.q ? `Suche: ${query.q.slice(0, 80)}` : undefined,
    });

    return filtered.map((row) => this.toMessageSummary(row));
  }

  async listSentMessages(query: { accountId?: string; limit?: number } = {}) {
    const logs = await this.db.mailMessageLog.findMany({
      where: { status: "sent" },
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 100,
    });
    return logs.map((log) => ({
      id: log.id,
      accountId: query.accountId ?? "",
      accountLabel: null,
      subject: log.subject,
      fromAddress: log.fromAddress ?? "",
      snippet: log.subject?.slice(0, 240) ?? null,
      receivedAt: log.createdAt,
      isRead: true,
      hasAttachments: false,
      hasUnsubscribeTarget: false,
      priority: null,
      toAddresses: log.toAddresses,
    }));
  }

  /**
   * IMAP context (credentials + source mailbox + UID) for a message writeback.
   * Must be captured BEFORE the local folder move — afterwards the message
   * points at a LOCAL:* folder instead of its server mailbox. Returns null
   * when the account has no IMAP host or the message is already local-only.
   */
  private async imapWritebackContext(messageId: string): Promise<{
    accountId: string;
    imap: { credentials: ImapCredentials; mailbox: string; imapUid: string } | null;
  } | null> {
    const message = await this.db.mailInboxMessage.findUnique({
      where: { id: messageId },
      include: { account: true, folder: { select: { imapPath: true } } },
    });
    if (!message) return null;
    const mailbox = message.folder?.imapPath ?? message.account?.imapMailbox ?? "INBOX";
    if (!message.account?.imapHost || !message.imapUid || mailbox.startsWith("LOCAL:")) {
      return { accountId: message.accountId, imap: null };
    }
    return {
      accountId: message.accountId,
      imap: {
        credentials: {
          host: message.account.imapHost,
          port: message.account.imapPort ?? undefined,
          username: message.account.username,
          password: decryptSecret(message.account.passwordEnc, this.encryptionSecret),
        },
        mailbox,
        imapUid: message.imapUid,
      },
    };
  }

  /** Mirrors the local read state to the mailbox (best-effort, never throws). */
  async markMessageSeenOnServer(messageId: string): Promise<void> {
    try {
      const context = await this.imapWritebackContext(messageId);
      if (!context?.imap) return;
      await markImapMessageSeen(context.imap.credentials, {
        mailbox: context.imap.mailbox,
        imapUid: context.imap.imapUid,
      });
    } catch (error) {
      await this.logAudit({
        action: "read",
        messageId,
        detail: `IMAP-Writeback (gelesen) fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => undefined);
    }
  }

  /**
   * Best-effort server-side move for archive/trash. Without it the message
   * stays in the server INBOX and the next full sync would pull it straight
   * back into the local Posteingang.
   */
  private async writebackMove(
    target: ImapWritebackTarget,
    context: Awaited<ReturnType<MailPortalInboxService["imapWritebackContext"]>>,
  ): Promise<string> {
    if (!context?.imap) return "nur lokal (kein IMAP)";
    try {
      const result = await moveImapMessage(context.imap.credentials, {
        mailbox: context.imap.mailbox,
        imapUid: context.imap.imapUid,
        target,
      });
      return `IMAP → ${result.movedTo}`;
    } catch (error) {
      return `IMAP-Writeback fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async archiveMessage(messageId: string, actorUserId?: string | null) {
    const context = await this.imapWritebackContext(messageId);
    await this.accountService().moveMessageToLocalFolder(messageId, "LOCAL:archived", "Archiv");
    const writeback = await this.writebackMove("archive", context);
    await this.logAudit({
      action: "cleanup",
      messageId,
      accountId: context?.accountId,
      userId: actorUserId,
      detail: `archiviert · ${writeback}`,
    });
  }

  async trashMessage(messageId: string, actorUserId?: string | null) {
    const context = await this.imapWritebackContext(messageId);
    await this.accountService().moveMessageToLocalFolder(messageId, "LOCAL:trash", "Papierkorb");
    const writeback = await this.writebackMove("trash", context);
    await this.logAudit({
      action: "cleanup",
      messageId,
      accountId: context?.accountId,
      userId: actorUserId,
      detail: `in Papierkorb verschoben · ${writeback}`,
    });
  }

  async deleteMessagesBySender(senderPattern: string, accountId?: string, actorUserId?: string | null) {
    const count = await this.accountService().deleteMessagesBySender(accountId, senderPattern);
    await this.logAudit({
      action: "cleanup",
      userId: actorUserId,
      detail: `${count} Nachrichten von "${senderPattern}" gelöscht`,
    });
    return count;
  }

  async fetchAttachmentContent(messageId: string, attachmentId: string) {
    const attachment = await this.db.mailAttachment.findFirst({
      where: { id: attachmentId, messageId },
      include: { message: { include: { account: true, folder: true } } },
    });
    if (!attachment?.message.account?.imapHost) {
      throw new Error("Anhang oder IMAP-Konto nicht gefunden.");
    }

    const account = attachment.message.account;
    const imapHost = account.imapHost;
    if (!imapHost) throw new Error("IMAP-Host fehlt.");
    const password = decryptSecret(account.passwordEnc, this.encryptionSecret);
    const mailbox = attachment.message.folder?.imapPath ?? account.imapMailbox ?? "INBOX";
    const { fetchImapAttachmentContent } = await import("../imap-sync");
    const fetched = await fetchImapAttachmentContent(
      {
        host: imapHost,
        port: account.imapPort ?? undefined,
        username: account.username,
        password,
      },
      {
        mailbox,
        imapUid: attachment.message.imapUid,
        attachmentId: attachment.id,
        filename: attachment.filename,
        contentId: attachment.contentId,
      },
    );
    if (!fetched) throw new Error("Anhang konnte nicht geladen werden.");
    await this.db.mailAttachment.update({
      where: { id: attachment.id },
      data: { downloaded: true },
    });
    return fetched;
  }
}
