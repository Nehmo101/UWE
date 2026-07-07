import type { MailDraftStatus } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import { toPrismaJsonValue, jsonDbNull } from "./json-utils";
import { fetchImapInboxMessages, type FetchedInboxMessage, type ImapSyncProgress } from "@uwe/mail";

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
    const fetched = await fetchImapInboxMessages(
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
        batchSize: 100,
        onProgress: options?.onProgress,
      },
    );

    let imported = 0;
    for (const message of fetched) {
      await this.persistFetchedMessage(accountId, message, mailbox);
      imported += 1;
    }

    await this.db.mailAccount.update({
      where: { id: accountId },
      data: {
        lastImapSyncAt: new Date(),
        imapSyncError: null,
      },
    });

    return { accountId, imported, total: fetched.length };
  }

  /** Upserts one IMAP-fetched message and rebuilds its attachment metadata rows. */
  async persistFetchedMessage(accountId: string, message: FetchedInboxMessage, mailbox = "INBOX") {
    const folder = await this.ensureFolder(accountId, mailbox);
    const hasAttachments = message.attachments.length > 0;
    // Local state guards: a re-sync must not un-read a locally read message and
    // must not pull archived/trashed messages back into the inbox while the
    // IMAP writeback is pending or has failed (best-effort writeback).
    const existing = await this.db.mailInboxMessage.findUnique({
      where: { accountId_imapUid: { accountId, imapUid: message.imapUid } },
      select: { isRead: true, folder: { select: { imapPath: true } } },
    });
    const keepLocalFolder = existing?.folder?.imapPath.startsWith("LOCAL:") === true;
    const isRead = message.isRead || existing?.isRead === true;
    const saved = await this.db.mailInboxMessage.upsert({
      where: {
        accountId_imapUid: {
          accountId,
          imapUid: message.imapUid,
        },
      },
      create: {
        accountId,
        folderId: folder?.id ?? null,
        imapUid: message.imapUid,
        messageId: message.messageId,
        subject: message.subject,
        fromAddress: message.fromAddress,
        toAddresses: message.toAddresses,
        snippet: message.snippet,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        hasAttachments,
        receivedAt: message.receivedAt,
        isRead: message.isRead,
        listUnsubscribeHttpUrl: message.listUnsubscribeHttpUrl,
        listUnsubscribeMailto: message.listUnsubscribeMailto,
        listUnsubscribePostSupported: message.listUnsubscribePostSupported,
      },
      update: {
        ...(keepLocalFolder ? {} : { folderId: folder?.id ?? null }),
        messageId: message.messageId,
        subject: message.subject,
        fromAddress: message.fromAddress,
        toAddresses: message.toAddresses,
        snippet: message.snippet,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        hasAttachments,
        receivedAt: message.receivedAt,
        isRead,
        syncedAt: new Date(),
        listUnsubscribeHttpUrl: message.listUnsubscribeHttpUrl,
        listUnsubscribeMailto: message.listUnsubscribeMailto,
        listUnsubscribePostSupported: message.listUnsubscribePostSupported,
      },
    });

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

    return saved;
  }

  private async ensureFolder(accountId: string, imapPath: string) {
    return this.db.mailFolder.upsert({
      where: { accountId_imapPath: { accountId, imapPath } },
      create: {
        accountId,
        imapPath,
        displayName: imapPath,
      },
      update: { syncedAt: new Date() },
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
