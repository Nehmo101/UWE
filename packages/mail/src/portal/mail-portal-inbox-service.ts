import type { MailPriorityCategory, MailAuditAction, Prisma } from "@uwe/database/mail-prisma-types";
import type { PrismaClient } from "@uwe/database/client";
import { decryptSecret } from "@uwe/database/token-crypto";
import type { MailAccountService } from "@uwe/database/mail-account-service";

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

  async archiveMessage(messageId: string, actorUserId?: string | null) {
    await this.accountService().moveMessageToLocalFolder(messageId, "LOCAL:archived", "Archiv");
    const message = await this.db.mailInboxMessage.findUnique({ where: { id: messageId } });
    await this.logAudit({
      action: "cleanup",
      messageId,
      accountId: message?.accountId,
      userId: actorUserId,
      detail: "archiviert",
    });
  }

  async trashMessage(messageId: string, actorUserId?: string | null) {
    await this.accountService().moveMessageToLocalFolder(messageId, "LOCAL:trash", "Papierkorb");
    const message = await this.db.mailInboxMessage.findUnique({ where: { id: messageId } });
    await this.logAudit({
      action: "cleanup",
      messageId,
      accountId: message?.accountId,
      userId: actorUserId,
      detail: "in Papierkorb verschoben",
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
