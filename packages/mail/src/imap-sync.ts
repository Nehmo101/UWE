import { ImapFlow } from "imapflow";
import { parseListUnsubscribeHeader, supportsOneClickUnsubscribe } from "./unsubscribe";
import { parseRawMailSource, type ParsedMailAttachment } from "./mime-decode";
import { sanitizeMailHtml } from "./mail-portal-types";

export interface ImapCredentials {
  host: string;
  port?: number;
  username: string;
  password: string;
  secure?: boolean;
}

export interface FetchedInboxMessage {
  imapUid: string;
  messageId: string | null;
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: ParsedMailAttachment[];
  receivedAt: Date;
  isRead: boolean;
  listUnsubscribeHttpUrl: string | null;
  listUnsubscribeMailto: string | null;
  listUnsubscribePostSupported: boolean;
}

/** Unfolds RFC 5322 header continuation lines into one logical line per header. */
function parseRawHeaders(raw: string): Map<string, string> {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headerBlock = headerEnd === -1 ? raw : raw.slice(0, headerEnd);
  const logicalLines: string[] = [];
  for (const line of headerBlock.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && logicalLines.length > 0) {
      logicalLines[logicalLines.length - 1] += ` ${line.trim()}`;
    } else if (line.trim().length > 0) {
      logicalLines.push(line);
    }
  }

  const headers = new Map<string, string>();
  for (const line of logicalLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    if (!headers.has(name)) {
      headers.set(name, line.slice(separatorIndex + 1).trim());
    }
  }
  return headers;
}

function extractAddress(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => extractAddress(entry)).filter(Boolean).join(", ");
  }
  if (typeof value === "object" && value !== null && "address" in value) {
    const entry = value as { name?: string; address?: string };
    if (entry.name && entry.address) return `${entry.name} <${entry.address}>`;
    return entry.address ?? "";
  }
  return String(value);
}

function truncateSnippet(value: string | null | undefined, max = 240): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * imapflow throws a fixed "Command failed" Error on any NO/BAD server response;
 * the server's actual rejection reason lives in error.responseText, not error.message.
 */
export function describeImapError(error: unknown): string {
  if (error instanceof Error) {
    const responseText = (error as { responseText?: unknown }).responseText;
    if (typeof responseText === "string" && responseText.trim()) {
      const status = (error as { responseStatus?: unknown }).responseStatus;
      return typeof status === "string" ? `${status}: ${responseText.trim()}` : responseText.trim();
    }
    return error.message;
  }
  return String(error);
}

export interface ImapSyncProgress {
  processed: number;
  total: number;
  phase: string;
}

export interface FetchImapOptions {
  limit?: number;
  mailbox?: string;
  /** When true, fetch all UIDs in batches instead of only the most recent `limit`. */
  fullSync?: boolean;
  batchSize?: number;
  onProgress?: (progress: ImapSyncProgress) => void | Promise<void>;
}

async function fetchUidMessages(
  client: ImapFlow,
  uid: number,
): Promise<FetchedInboxMessage | null> {
  const message = await client.fetchOne(
    uid,
    {
      uid: true,
      envelope: true,
      source: true,
      flags: true,
      internalDate: true,
    },
    { uid: true },
  );

  if (!message || message.uid == null) return null;

  let bodyText: string | null = null;
  let bodyHtml: string | null = null;
  let attachments: ParsedMailAttachment[] = [];
  let listUnsubscribeHttpUrl: string | null = null;
  let listUnsubscribeMailto: string | null = null;
  let listUnsubscribePostSupported = false;
  if (message.source) {
    try {
      const parsed = await parseRawMailSource(message.source);
      bodyText = parsed.bodyText;
      bodyHtml = parsed.bodyHtml;
      attachments = parsed.attachments;
    } catch {
      bodyText = message.source.toString("utf8").slice(0, 8000);
    }

    const headers = parseRawHeaders(message.source.toString("utf8"));
    const unsubscribeTargets = parseListUnsubscribeHeader(headers.get("list-unsubscribe"));
    listUnsubscribeHttpUrl = unsubscribeTargets.httpUrl;
    listUnsubscribeMailto = unsubscribeTargets.mailto;
    listUnsubscribePostSupported = supportsOneClickUnsubscribe(headers.get("list-unsubscribe-post"));
  }

  const envelope = message.envelope;
  return {
    imapUid: String(message.uid),
    messageId: envelope?.messageId ?? null,
    subject: envelope?.subject ?? "",
    fromAddress: extractAddress(envelope?.from?.[0]),
    toAddresses: (envelope?.to ?? []).map((entry) => extractAddress(entry)).filter(Boolean),
    snippet: truncateSnippet(bodyText ?? (bodyHtml ? sanitizeMailHtml(bodyHtml) : null) ?? envelope?.subject ?? ""),
    bodyText,
    bodyHtml,
    attachments,
    receivedAt:
      message.internalDate instanceof Date
        ? message.internalDate
        : new Date(message.internalDate ?? Date.now()),
    isRead: Boolean(message.flags?.has("\\Seen")),
    listUnsubscribeHttpUrl,
    listUnsubscribeMailto,
    listUnsubscribePostSupported,
  };
}

export async function fetchImapAttachmentContent(
  credentials: ImapCredentials,
  options: { mailbox?: string; imapUid: string; attachmentId: string; filename: string; contentId?: string | null },
): Promise<{ content: Buffer; mimeType: string; filename: string } | null> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port ?? 993,
    secure: credentials.secure ?? true,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });

  const mailbox = options.mailbox ?? "INBOX";
  const uid = Number.parseInt(options.imapUid, 10);
  if (!Number.isFinite(uid)) return null;

  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const message = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!message || typeof message === "boolean" || !message.source) return null;
      const source = message.source;
      const parsed = await parseRawMailSource(source);
      const match = parsed.attachments.find(
        (entry) =>
          entry.filename === options.filename ||
          (options.contentId && entry.contentId === options.contentId),
      );
      if (!match) return null;
      const { simpleParser } = await import("mailparser");
      const parsedMail = await simpleParser(source);
      const part = (parsedMail.attachments ?? []).find(
        (entry) =>
          entry.filename === options.filename ||
          (options.contentId && entry.cid?.replace(/^<|>$/g, "") === options.contentId),
      );
      if (!part?.content) return null;
      return {
        content: part.content,
        mimeType: part.contentType || match.mimeType,
        filename: part.filename ?? options.filename,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function fetchImapInboxMessages(
  credentials: ImapCredentials,
  options?: FetchImapOptions,
): Promise<FetchedInboxMessage[]> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port ?? 993,
    secure: credentials.secure ?? true,
    auth: {
      user: credentials.username,
      pass: credentials.password,
    },
    logger: false,
  });

  const batchSize = options?.batchSize ?? 100;
  const limit = options?.limit ?? 50;
  const mailbox = options?.mailbox ?? "INBOX";
  const messages: FetchedInboxMessage[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const uids = await client.search({ all: true }, { uid: true });
      const uidList = Array.isArray(uids) ? uids : [];
      const selected = options?.fullSync
        ? [...uidList].reverse()
        : uidList.slice(-limit).reverse();
      const total = selected.length;

      await options?.onProgress?.({ processed: 0, total, phase: "IMAP Nachrichten abrufen" });

      for (let index = 0; index < selected.length; index += 1) {
        const uid = selected[index];
        const fetched = await fetchUidMessages(client, uid);
        if (fetched) messages.push(fetched);

        if ((index + 1) % batchSize === 0 || index === selected.length - 1) {
          await options?.onProgress?.({
            processed: index + 1,
            total,
            phase: `${index + 1} / ${total} Nachrichten abgeholt`,
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return messages;
}
