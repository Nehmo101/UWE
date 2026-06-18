import { ImapFlow } from "imapflow";

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
        if (message.source) {
          const raw = message.source.toString("utf8");
          const plainMatch = raw.match(/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i);
          bodyText = plainMatch?.[1]?.trim() ?? null;
          if (!bodyText) {
            const stripped = raw.replace(/^[\s\S]*?\r?\n\r?\n/, "").trim();
            bodyText = stripped.length > 0 ? stripped.slice(0, 8000) : null;
          }
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
