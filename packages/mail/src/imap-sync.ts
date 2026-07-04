import { ImapFlow } from "imapflow";
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

export async function fetchImapInboxMessages(
  credentials: ImapCredentials,
  options?: { limit?: number; mailbox?: string },
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

  const limit = options?.limit ?? 50;
  const mailbox = options?.mailbox ?? "INBOX";
  const messages: FetchedInboxMessage[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const uids = await client.search({ all: true }, { uid: true });
      const uidList = Array.isArray(uids) ? uids : [];
      const selected = uidList.slice(-limit).reverse();

      for (const uid of selected) {
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

        if (!message || message.uid == null) continue;

        let bodyText: string | null = null;
        let bodyHtml: string | null = null;
        let attachments: ParsedMailAttachment[] = [];
        if (message.source) {
          try {
            const parsed = await parseRawMailSource(message.source);
            bodyText = parsed.bodyText;
            bodyHtml = parsed.bodyHtml;
            attachments = parsed.attachments;
          } catch {
            // Fall back to raw source truncation if MIME parsing fails outright.
            bodyText = message.source.toString("utf8").slice(0, 8000);
          }
        }

        const envelope = message.envelope;
        messages.push({
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
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return messages;
}
