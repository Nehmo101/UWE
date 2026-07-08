import type { MailDraftStatus } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import { toPrismaJsonValue, jsonDbNull } from "./json-utils";
import {
  fetchImapMessages,
  resolveThreadId,
  type FetchedInboxMessage,
  type ImapSyncProgress,
} from "@uwe/mail";

export interface CreateMailAccountInput {
  label: string;
  smtpHost: string;
  smtpPort?: number | null;
  imapHost?: string | null;
  imapPort?: number | null;
  username: string;
  password: string;
  isDefault?: boolean;
  ownerId?: string | null;
}

export interface CreateMailDraftInput {
  accountId?: string | null;
  worldId?: string | null;
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  status?: MailDraftStatus;
  toAddresses?: string[] | null;
}

export interface UpdateMailDraftInput {
  accountId?: string | null;
  subject?: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  toAddresses?: string[] | null;
  status?: MailDraftStatus;
}

export class MailAccountService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  async listAccounts() {
    const rows = await this.db.mailAccount.findMany({ orderBy: { label: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      imapHost: row.imapHost,
      imapPort: row.imapPort,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      username: row.username,
      isDefault: row.isDefault,
      ownerId: row.ownerId,
      lastImapSyncAt: row.lastImapSyncAt,
      imapSyncError: row.imapSyncError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async getAccount(id: string) {
    return this.db.mailAccount.findUnique({ where: { id } });
  }

  async createAccount(input: CreateMailAccountInput) {
    return this.db.mailAccount.create({
      data: {
        label: input.label.trim(),
        smtpHost: input.smtpHost.trim(),
        smtpPort: input.smtpPort ?? null,
        imapHost: input.imapHost?.trim() || null,
        imapPort: input.imapPort ?? null,
        username: input.username.trim(),
        passwordEnc: encryptSecret(input.password, this.encryptionSecret),
        isDefault: input.isDefault ?? false,
        ownerId: input.ownerId ?? null,
      },
    });
  }

  async listDrafts(status?: MailDraftStatus) {
    return this.db.mailDraft.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async createDraft(input: CreateMailDraftInput) {
    return this.db.mailDraft.create({
      data: {
        accountId: input.accountId ?? null,
        worldId: input.worldId ?? null,
        subject: input.subject.trim(),
        bodyText: input.bodyText ?? null,
        bodyHtml: input.bodyHtml ?? null,
        toAddresses:
          input.toAddresses === undefined
            ? undefined
            : input.toAddresses === null
              ? jsonDbNull
              : toPrismaJsonValue(input.toAddresses),
        status: input.status ?? "draft",
      },
    });
  }

  async getDraft(id: string) {
    return this.db.mailDraft.findUnique({ where: { id } });
  }

  async updateDraft(id: string, input: UpdateMailDraftInput) {
    return this.db.mailDraft.update({
      where: { id },
      data: {
        ...(input.accountId !== undefined
          ? input.accountId
            ? { account: { connect: { id: input.accountId } } }
            : { account: { disconnect: true } }
          : {}),
        ...(input.subject !== undefined ? { subject: input.subject.trim() } : {}),
        ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
        ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
        ...(input.toAddresses !== undefined
          ? {
              toAddresses:
                input.toAddresses === null
                  ? jsonDbNull
                  : toPrismaJsonValue(input.toAddresses),
            }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
  }

  async listInbox(accountId?: string, limit = 50) {
    const rows = await this.db.mailInboxMessage.findMany({
      where: accountId ? { accountId } : undefined,
      orderBy: { receivedAt: "desc" },
      take: limit,
      include: {
        account: { select: { id: true, label: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      accountLabel: row.account.label,
      subject: row.subject,
      fromAddress: row.fromAddress,
      snippet: row.snippet,
      receivedAt: row.receivedAt,
      isRead: row.isRead,
    }));
  }

  async syncInbox(
    accountId: string,
    options?: {
      limit?: number;
      fullSync?: boolean;
      mailbox?: string;
      /** Role to tag the synced folder with (inbox|sent|archive|trash). Defaults by mailbox. */
      folderRole?: string;
      onProgress?: (progress: ImapSyncProgress) => void | Promise<void>;
    },
  ) {
    const account = await this.db.mailAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new Error("Mail-Account nicht gefunden.");
    }
    if (!account.imapHost) {
      throw new Error("IMAP-Host ist für diesen Account nicht konfiguriert.");
    }
    if (account.syncEnabled === false) {
      return { accountId, imported: 0, skipped: true as const };
    }

    const password = decryptSecret(account.passwordEnc, this.encryptionSecret);
    const mailbox = options?.mailbox ?? account.imapMailbox ?? "INBOX";
    const isPrimaryInbox = mailbox === (account.imapMailbox ?? "INBOX");
    const folderRole = options?.folderRole ?? (isPrimaryInbox ? "inbox" : undefined);

    // Read the folder watermark so we only fetch UIDs newer than the last sync.
    const folderBefore = await this.db.mailFolder.findUnique({
      where: { accountId_imapPath: { accountId, imapPath: mailbox } },
      select: { lastSeenUid: true, uidValidity: true },
    });

    const result = await fetchImapMessages(
      {
        host: account.imapHost,
        port: account.imapPort ?? undefined,
        username: account.username,
        password,
      },
      {
        limit: options?.limit ?? 50,
        mailbox,
        fullSync: options?.fullSync ?? false,
        batchSize: 50,
        sinceUid: folderBefore?.lastSeenUid ?? 0,
        storedUidValidity: folderBefore?.uidValidity ?? null,
        onProgress: options?.onProgress,
      },
    );

    let imported = 0;
    const createdIds: string[] = [];
    for (const message of result.messages) {
      const { saved, created } = await this.persistFetchedMessage(accountId, message, mailbox, {
        reconcileLocal: isPrimaryInbox,
        folderRole,
      });
      if (created) createdIds.push(saved.id);
      imported += 1;
    }

    // Persist the new watermark on the folder for the next incremental run.
    await this.db.mailFolder.update({
      where: { accountId_imapPath: { accountId, imapPath: mailbox } },
      data: { lastSeenUid: result.highestUid, uidValidity: result.uidValidity, syncedAt: new Date() },
    }).catch(() => undefined);

    await this.db.mailAccount.update({
      where: { id: accountId },
      data: {
        lastImapSyncAt: new Date(),
        imapSyncError: null,
      },
    });

    return { accountId, imported, total: result.messages.length, createdIds };
  }

  /**
   * Discovers the account's Sent mailbox (RFC 6154 \Sent or a common name) and
   * syncs it into a folderRole="sent" folder. Best-effort: returns imported:0
   * when no Sent mailbox is found. Kept small so INBOX sync stays independent.
   */
  async syncSentFolder(accountId: string, options?: { limit?: number }) {
    const account = await this.db.mailAccount.findUnique({ where: { id: accountId } });
    if (!account?.imapHost || account.syncEnabled === false) {
      return { accountId, imported: 0, skipped: true as const };
    }
    const password = decryptSecret(account.passwordEnc, this.encryptionSecret);
    const credentials = {
      host: account.imapHost,
      port: account.imapPort ?? undefined,
      username: account.username,
      password,
    };
    const { listImapMailboxes } = await import("@uwe/mail");
    const mailboxes = await listImapMailboxes(credentials);
    const sent =
      mailboxes.find((box) => box.specialUse === "\\Sent") ??
      mailboxes.find((box) => /^(sent|gesendet)/i.test(box.displayName) || /sent|gesendet/i.test(box.path));
    if (!sent) return { accountId, imported: 0, skipped: true as const };

    return this.syncInbox(accountId, {
      mailbox: sent.path,
      folderRole: "sent",
      limit: options?.limit ?? 50,
    });
  }

  /**
   * Upserts one IMAP-fetched message and rebuilds its attachment metadata rows.
   * Identity is (account, folder, uid) — UIDs are only unique per mailbox. When
   * `reconcileLocal` is set (primary inbox sync), a message previously moved to a
   * LOCAL:archived/LOCAL:trash pseudo-folder is matched there so it is not
   * duplicated back into the inbox. Returns `{ saved, created }`.
   */
  async persistFetchedMessage(
    accountId: string,
    message: FetchedInboxMessage,
    mailbox = "INBOX",
    options?: { reconcileLocal?: boolean; folderRole?: string },
  ) {
    const folder = await this.ensureFolder(accountId, mailbox, options?.folderRole);
    const hasAttachments = message.attachments.length > 0;

    // Find any existing row for this uid: first in the synced folder, then — for
    // the primary inbox — in a LOCAL pseudo-folder (locally archived/trashed).
    let existing = await this.db.mailInboxMessage.findUnique({
      where: { accountId_folderId_imapUid: { accountId, folderId: folder.id, imapUid: message.imapUid } },
      select: { id: true, isRead: true, threadId: true },
    });
    let keepLocalFolder = false;
    if (!existing && options?.reconcileLocal) {
      const local = await this.db.mailInboxMessage.findFirst({
        where: {
          accountId,
          imapUid: message.imapUid,
          folder: { imapPath: { startsWith: "LOCAL:" } },
        },
        select: { id: true, isRead: true, threadId: true },
      });
      if (local) {
        existing = local;
        keepLocalFolder = true;
      }
    }

    const isRead = message.isRead || existing?.isRead === true;
    const threadId =
      existing?.threadId ??
      (await resolveThreadId(
        {
          messageId: message.messageId,
          inReplyTo: message.inReplyTo,
          references: message.references,
          subject: message.subject,
        },
        {
          threadIdByMessageId: async (id) => {
            const row = await this.db.mailInboxMessage.findFirst({
              where: { accountId, messageId: id },
              select: { threadId: true },
            });
            return row?.threadId ?? null;
          },
        },
      ));

    const commonData = {
      messageId: message.messageId,
      inReplyTo: message.inReplyTo,
      references: message.references,
      threadId,
      subject: message.subject,
      fromAddress: message.fromAddress,
      toAddresses: toPrismaJsonValue(message.toAddresses),
      ccAddresses: toPrismaJsonValue(message.ccAddresses),
      snippet: message.snippet,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      hasAttachments,
      receivedAt: message.receivedAt,
      listUnsubscribeHttpUrl: message.listUnsubscribeHttpUrl,
      listUnsubscribeMailto: message.listUnsubscribeMailto,
      listUnsubscribePostSupported: message.listUnsubscribePostSupported,
    };

    let saved;
    let created = false;
    if (existing) {
      saved = await this.db.mailInboxMessage.update({
        where: { id: existing.id },
        data: {
          ...commonData,
          ...(keepLocalFolder ? {} : { folderId: folder.id }),
          isRead,
          syncedAt: new Date(),
        },
      });
    } else {
      created = true;
      saved = await this.db.mailInboxMessage.create({
        data: {
          accountId,
          folderId: folder.id,
          imapUid: message.imapUid,
          ...commonData,
          isRead: message.isRead,
        },
      });
    }

    // Re-synced messages get their attachment metadata rows rebuilt from scratch.
    await this.db.mailAttachment.deleteMany({ where: { messageId: saved.id } });
    if (hasAttachments) {
      await this.db.mailAttachment.createMany({
        data: message.attachments.map((attachment) => ({
          messageId: saved.id,
          filename: attachment.filename ?? "Anhang",
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          contentId: attachment.contentId,
        })),
      });
    }

    return { saved, created };
  }

  private async ensureFolder(accountId: string, imapPath: string, folderRole?: string) {
    return this.db.mailFolder.upsert({
      where: { accountId_imapPath: { accountId, imapPath } },
      create: {
        accountId,
        imapPath,
        displayName: imapPath,
        ...(folderRole ? { folderRole } : {}),
      },
      update: { syncedAt: new Date(), ...(folderRole ? { folderRole } : {}) },
    });
  }

  async ensureLocalFolder(accountId: string, localKey: "LOCAL:archived" | "LOCAL:trash", displayName: string) {
    return this.ensureFolder(accountId, localKey).then((folder) =>
      this.db.mailFolder.update({
        where: { id: folder.id },
        data: { displayName },
      }),
    );
  }

  async moveMessageToLocalFolder(messageId: string, localKey: "LOCAL:archived" | "LOCAL:trash", displayName: string) {
    const message = await this.db.mailInboxMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new Error("Nachricht nicht gefunden.");
    const folder = await this.ensureLocalFolder(message.accountId, localKey, displayName);
    return this.db.mailInboxMessage.update({
      where: { id: messageId },
      data: { folderId: folder.id },
    });
  }

  async deleteMessagesBySender(accountId: string | undefined, senderPattern: string) {
    const where = {
      fromAddress: { contains: senderPattern },
      ...(accountId ? { accountId } : {}),
    };
    const result = await this.db.mailInboxMessage.deleteMany({ where });
    return result.count;
  }

  async markImapSyncError(accountId: string, error: string) {
    await this.db.mailAccount.update({
      where: { id: accountId },
      data: {
        imapSyncError: error.slice(0, 500),
      },
    });
  }
}

export function createMailAccountService(db: PrismaClient): MailAccountService {
  return new MailAccountService(db);
}
