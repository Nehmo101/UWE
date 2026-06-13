import type { PrismaClient } from "./client";
import type { MailMessageStatus } from "./generated/prisma/client";
import { truncateBodyPreview } from "@uwe/mail";

export interface MailLogEntry {
  id: string;
  worldId: string | null;
  status: MailMessageStatus;
  subject: string;
  toAddresses: string[];
  fromAddress: string;
  templateId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  errorMessage: string | null;
  bodyLogged: boolean;
  bodyPreview: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface CreateMailLogInput {
  worldId?: string | null;
  status?: MailMessageStatus;
  subject: string;
  toAddresses: string[];
  fromAddress: string;
  templateId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  errorMessage?: string | null;
  bodyLogged?: boolean;
  bodyText?: string | null;
  bodyHtml?: string | null;
  sentAt?: Date | null;
}

function parseToAddresses(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toView(record: {
  id: string;
  worldId: string | null;
  status: MailMessageStatus;
  subject: string;
  toAddresses: unknown;
  fromAddress: string;
  templateId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  errorMessage: string | null;
  bodyLogged: boolean;
  bodyPreview: string | null;
  sentAt: Date | null;
  createdAt: Date;
}): MailLogEntry {
  return {
    id: record.id,
    worldId: record.worldId,
    status: record.status,
    subject: record.subject,
    toAddresses: parseToAddresses(record.toAddresses),
    fromAddress: record.fromAddress,
    templateId: record.templateId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    errorMessage: record.errorMessage,
    bodyLogged: record.bodyLogged,
    bodyPreview: record.bodyPreview,
    sentAt: record.sentAt,
    createdAt: record.createdAt,
  };
}

export class MailLogService {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateMailLogInput): Promise<MailLogEntry> {
    const bodySource = input.bodyText ?? input.bodyHtml ?? "";
    const bodyPreview =
      input.bodyLogged && bodySource.trim()
        ? truncateBodyPreview(bodySource)
        : null;

    const record = await this.db.mailMessageLog.create({
      data: {
        worldId: input.worldId ?? null,
        status: input.status ?? "pending",
        subject: input.subject,
        toAddresses: input.toAddresses,
        fromAddress: input.fromAddress,
        templateId: input.templateId ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        errorMessage: input.errorMessage ?? null,
        bodyLogged: input.bodyLogged ?? false,
        bodyPreview,
        sentAt: input.sentAt ?? null,
      },
    });

    return toView(record);
  }

  async markSent(id: string, messageId?: string): Promise<MailLogEntry> {
    const record = await this.db.mailMessageLog.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
        errorMessage: messageId ? `messageId=${messageId}` : null,
      },
    });

    return toView(record);
  }

  async markFailed(id: string, errorMessage: string): Promise<MailLogEntry> {
    const record = await this.db.mailMessageLog.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    return toView(record);
  }

  async list(options?: {
    worldId?: string;
    limit?: number;
    status?: MailMessageStatus;
  }): Promise<MailLogEntry[]> {
    const records = await this.db.mailMessageLog.findMany({
      where: {
        ...(options?.worldId ? { worldId: options.worldId } : {}),
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 50,
    });

    return records.map(toView);
  }

  async getById(id: string): Promise<MailLogEntry | null> {
    const record = await this.db.mailMessageLog.findUnique({ where: { id } });
    return record ? toView(record) : null;
  }
}

export function createMailLogService(db: PrismaClient): MailLogService {
  return new MailLogService(db);
}
