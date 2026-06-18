import type { MailDraftStatus } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
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
}

export function createMailAccountService(db: PrismaClient): MailAccountService {
  return new MailAccountService(db);
}
