import type { MailDraftStatus } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import { fetchImapInboxMessages, type FetchedInboxMessage } from "@uwe/mail";

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
        status: input.status ?? "draft",
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

  async syncInbox(accountId: string, options?: { limit?: number }) {
    const account = await this.db.mailAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new Error("Mail-Account nicht gefunden.");
    }
    if (!account.imapHost) {
      throw new Error("IMAP-Host ist für diesen Account nicht konfiguriert.");
    }

    const password = decryptSecret(account.passwordEnc, this.encryptionSecret);
    const fetched = await fetchImapInboxMessages(
      {
        host: account.imapHost,
        port: account.imapPort ?? undefined,
        username: account.username,
        password,
      },
      { limit: options?.limit ?? 50 },
    );

    let imported = 0;
    for (const message of fetched) {
      await this.persistFetchedMessage(accountId, message);
      imported += 1;
    }

    await this.db.mailAccount.update({
      where: { id: accountId },
      data: {
        lastImapSyncAt: new Date(),
        imapSyncError: null,
      },
    });

    return { accountId, imported };
  }

  /** Upserts one IMAP-fetched message and rebuilds its attachment metadata rows. */
  async persistFetchedMessage(accountId: string, message: FetchedInboxMessage) {
    const hasAttachments = message.attachments.length > 0;
    const saved = await this.db.mailInboxMessage.upsert({
      where: {
        accountId_imapUid: {
          accountId,
          imapUid: message.imapUid,
        },
      },
      create: {
        accountId,
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
