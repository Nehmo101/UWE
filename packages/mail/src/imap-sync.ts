import { ImapFlow } from "imapflow";
import { parseListUnsubscribeHeader, supportsOneClickUnsubscribe } from "./unsubscribe";

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
        let listUnsubscribeHttpUrl: string | null = null;
        let listUnsubscribeMailto: string | null = null;
        let listUnsubscribePostSupported = false;
        if (message.source) {
          const raw = message.source.toString("utf8");
          const plainMatch = raw.match(/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i);
          bodyText = plainMatch?.[1]?.trim() ?? null;
          if (!bodyText) {
            const stripped = raw.replace(/^[\s\S]*?\r?\n\r?\n/, "").trim();
            bodyText = stripped.length > 0 ? stripped.slice(0, 8000) : null;
          }

          const headers = parseRawHeaders(raw);
          const unsubscribeTargets = parseListUnsubscribeHeader(headers.get("list-unsubscribe"));
          listUnsubscribeHttpUrl = unsubscribeTargets.httpUrl;
          listUnsubscribeMailto = unsubscribeTargets.mailto;
          listUnsubscribePostSupported = supportsOneClickUnsubscribe(headers.get("list-unsubscribe-post"));
        }

        const envelope = message.envelope;
        messages.push({
          imapUid: String(message.uid),
          messageId: envelope?.messageId ?? null,
          subject: envelope?.subject ?? "",
          fromAddress: extractAddress(envelope?.from?.[0]),
          toAddresses: (envelope?.to ?? []).map((entry) => extractAddress(entry)).filter(Boolean),
          snippet: truncateSnippet(bodyText ?? envelope?.subject ?? ""),
          bodyText,
          receivedAt:
            message.internalDate instanceof Date
              ? message.internalDate
              : new Date(message.internalDate ?? Date.now()),
          isRead: Boolean(message.flags?.has("\\Seen")),
          listUnsubscribeHttpUrl,
          listUnsubscribeMailto,
          listUnsubscribePostSupported,
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
