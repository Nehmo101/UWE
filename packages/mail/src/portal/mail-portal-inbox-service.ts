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

export interface MailSearchCursor {
  receivedAt: string;
  id: string;
}

export interface MailSearchQuery {
  accountId?: string;
  q?: string;
  category?: MailPriorityCategory;
  folder?: MailFolderKey;
  markedOnly?: boolean;
  limit?: number;
  /** Cursor for date-ordered folder views (inbox/archive/trash/sent). */
  cursor?: MailSearchCursor | null;
}

export interface MailSearchResult {
  items: MailInboxMessageSummary[];
  nextCursor: MailSearchCursor | null;
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

  /**
   * Folder-role-aware, FTS-backed, cursor-paginated message search.
   *
   * - inbox: server INBOX + role=inbox, excludes sent/archive/trash + LOCAL:*
   * - archive/trash: LOCAL pseudo-folder OR the matching server folder role
   * - sent: role=sent (real synced Sent mail; the log-based fallback lives in listSentMessages)
   * - marked: starred OR priority>=70 (priority-ordered, no cursor)
   * Date-ordered views (inbox/archive/trash/sent) support the (receivedAt,id) cursor.
   */
  async searchMessages(query: MailSearchQuery, actorUserId?: string | null): Promise<MailSearchResult> {
    const limit = query.limit ?? 50;
    const filters: Prisma.MailInboxMessageWhereInput[] = [];
    if (query.accountId) filters.push({ accountId: query.accountId });

    const folder = query.folder;
    if (folder === "archive") {
      filters.push({ OR: [{ folder: { imapPath: "LOCAL:archived" } }, { folder: { folderRole: "archive" } }] });
    } else if (folder === "trash") {
      filters.push({ OR: [{ folder: { imapPath: "LOCAL:trash" } }, { folder: { folderRole: "trash" } }] });
    } else if (folder === "sent") {
      filters.push({ folder: { folderRole: "sent" } });
    } else if (folder === "marked" || query.markedOnly) {
      filters.push({ OR: [{ isStarred: true }, { priority: { priority: { gte: 70 } } }] });
    } else {
      // inbox (default): INBOX / role=inbox / no folder, never sent/archive/trash/LOCAL:*
      filters.push({
        OR: [
          { folderId: null },
          { folder: { imapPath: { in: ["INBOX", "Inbox"] } } },
          { folder: { folderRole: "inbox" } },
        ],
      });
      filters.push({
        NOT: {
          folder: { OR: [{ imapPath: { startsWith: "LOCAL:" } }, { folderRole: { in: ["sent", "archive", "trash"] } }] },
        },
      });
    }

    if (query.category) filters.push({ priority: { category: query.category } });

    // Free-text: FTS5 first, contains-fallback when FTS is unavailable.
    const parsed = query.q?.trim() ? (await import("../search/query-parser")).parseMailQuery(query.q) : null;
    if (parsed?.from) filters.push({ fromAddress: { contains: parsed.from } });
    if (parsed?.hasAttachment) filters.push({ hasAttachments: true });
    if (parsed?.before) filters.push({ receivedAt: { lt: parsed.before } });
    if (parsed?.after) filters.push({ receivedAt: { gte: parsed.after } });
    if (parsed?.text) {
      const { ftsSearchMessageIds } = await import("../search/mail-search-service");
      const ids = await ftsSearchMessageIds(this.db, parsed.text, { limit: 500 });
      if (ids) {
        filters.push({ id: { in: ids } });
      } else {
        filters.push({
          OR: [
            { subject: { contains: parsed.text } },
            { fromAddress: { contains: parsed.text } },
            { snippet: { contains: parsed.text } },
            { bodyText: { contains: parsed.text } },
          ],
        });
      }
    }

    const priorityOrdered = folder === "marked" || query.markedOnly || Boolean(query.category);
    const where: Prisma.MailInboxMessageWhereInput = { AND: filters };

    // Cursor only applies to the stable date-ordered folder views.
    if (!priorityOrdered && query.cursor) {
      filters.push({
        OR: [
          { receivedAt: { lt: new Date(query.cursor.receivedAt) } },
          { receivedAt: new Date(query.cursor.receivedAt), id: { lt: query.cursor.id } },
        ],
      });
    }

    const rows = await this.db.mailInboxMessage.findMany({
      where,
      orderBy: priorityOrdered
        ? [{ priority: { priority: "desc" } }, { receivedAt: "desc" }]
        : [{ receivedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        account: { select: { id: true, label: true } },
        priority: true,
        folder: { select: { imapPath: true } },
      },
    });

    const hasMore = !priorityOrdered && rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor: MailSearchCursor | null =
      hasMore && last ? { receivedAt: last.receivedAt.toISOString(), id: last.id } : null;

    await this.logAudit({
      action: "search",
      userId: actorUserId,
      detail: query.q ? `Suche: ${query.q.slice(0, 80)}` : undefined,
    });

    return { items: page.map((row) => this.toMessageSummary(row)), nextCursor };
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

  /** Sets/clears the local star and mirrors the \Flagged flag to the server (best-effort). */
  async setMessageStarred(messageId: string, starred: boolean, actorUserId?: string | null) {
    await this.db.mailInboxMessage.update({ where: { id: messageId }, data: { isStarred: starred } });
    try {
      const context = await this.imapWritebackContext(messageId);
      if (context?.imap) {
        const { setImapMessageFlagged } = await import("../imap-writeback");
        await setImapMessageFlagged(context.imap.credentials, {
          mailbox: context.imap.mailbox,
          imapUid: context.imap.imapUid,
          flagged: starred,
        });
      }
    } catch (error) {
      await this.logAudit({
        action: "read",
        messageId,
        userId: actorUserId,
        detail: `IMAP-Flag-Writeback fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      }).catch(() => undefined);
    }
  }

  /** Returns the full conversation thread for a message, oldest first. */
  async getThreadForMessage(messageId: string) {
    const message = await this.db.mailInboxMessage.findUnique({
      where: { id: messageId },
      select: { accountId: true, threadId: true },
    });
    if (!message?.threadId) return [];
    const rows = await this.db.mailInboxMessage.findMany({
      where: { accountId: message.accountId, threadId: message.threadId },
      orderBy: { receivedAt: "asc" },
      select: {
        id: true,
        subject: true,
        fromAddress: true,
        snippet: true,
        receivedAt: true,
        isRead: true,
        folder: { select: { folderRole: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      fromAddress: row.fromAddress,
      snippet: row.snippet,
      receivedAt: row.receivedAt,
      isRead: row.isRead,
      folderRole: row.folder?.folderRole ?? null,
    }));
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
