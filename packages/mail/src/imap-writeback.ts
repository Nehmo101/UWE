import { ImapFlow } from "imapflow";
import type { ImapCredentials } from "./imap-sync";

/**
 * Best-effort IMAP writeback: local Mail-Center actions (gelesen, Archiv,
 * Papierkorb) are mirrored back to the mailbox so the state matches on every
 * other client. All operations throw on failure — callers decide whether the
 * local action stays valid without the writeback (best-effort pattern).
 */

export type ImapWritebackTarget = "archive" | "trash";

export interface ImapMailboxEntry {
  path: string;
  /** imapflow reports RFC 6154 special-use flags like "\\Archive" or "\\Trash". */
  specialUse?: string | null;
}

const ARCHIVE_NAME_CANDIDATES = ["archive", "archiv", "all mail", "alle nachrichten"];
const TRASH_NAME_CANDIDATES = [
  "trash",
  "papierkorb",
  "deleted items",
  "deleted messages",
  "gelöscht",
  "geloescht",
  "bin",
];

/**
 * Picks the writeback destination from the account's mailbox list:
 * special-use flag first (\Archive / \Trash), then common DE/EN folder names.
 * Returns null when the account has no matching mailbox.
 */
export function pickWritebackMailbox(
  entries: ImapMailboxEntry[],
  target: ImapWritebackTarget,
): string | null {
  const wantedFlag = target === "archive" ? "\\Archive" : "\\Trash";
  const bySpecialUse = entries.find((entry) => entry.specialUse === wantedFlag);
  if (bySpecialUse) return bySpecialUse.path;

  const candidates = target === "archive" ? ARCHIVE_NAME_CANDIDATES : TRASH_NAME_CANDIDATES;
  for (const candidate of candidates) {
    const byName = entries.find((entry) => {
      const path = entry.path.toLowerCase();
      const leaf = path.split(/[./]/).pop() ?? path;
      return path === candidate || leaf === candidate;
    });
    if (byName) return byName.path;
  }
  return null;
}

function createClient(credentials: ImapCredentials): ImapFlow {
  return new ImapFlow({
    host: credentials.host,
    port: credentials.port ?? 993,
    secure: credentials.secure ?? true,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });
}

/** Sets the \Seen flag on the message so other clients show it as read. */
export async function markImapMessageSeen(
  credentials: ImapCredentials,
  options: { mailbox?: string; imapUid: string },
): Promise<void> {
  const uid = Number.parseInt(options.imapUid, 10);
  if (!Number.isFinite(uid)) throw new Error("Ungültige IMAP-UID.");

  const client = createClient(credentials);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(options.mailbox ?? "INBOX");
    try {
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Adds or removes the \Flagged flag so a starred message shows flagged everywhere. */
export async function setImapMessageFlagged(
  credentials: ImapCredentials,
  options: { mailbox?: string; imapUid: string; flagged: boolean },
): Promise<void> {
  const uid = Number.parseInt(options.imapUid, 10);
  if (!Number.isFinite(uid)) throw new Error("Ungültige IMAP-UID.");

  const client = createClient(credentials);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(options.mailbox ?? "INBOX");
    try {
      if (options.flagged) {
        await client.messageFlagsAdd(String(uid), ["\\Flagged"], { uid: true });
      } else {
        await client.messageFlagsRemove(String(uid), ["\\Flagged"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/**
 * Moves the message into the account's archive/trash mailbox. A missing
 * archive mailbox is created ("Archive"); a missing trash mailbox falls back
 * to \Deleted + expunge, which every IMAP server supports.
 */
export async function moveImapMessage(
  credentials: ImapCredentials,
  options: { mailbox?: string; imapUid: string; target: ImapWritebackTarget },
): Promise<{ movedTo: string }> {
  const uid = Number.parseInt(options.imapUid, 10);
  if (!Number.isFinite(uid)) throw new Error("Ungültige IMAP-UID.");

  const client = createClient(credentials);
  await client.connect();
  try {
    const listed = await client.list();
    let destination = pickWritebackMailbox(
      listed.map((entry) => ({ path: entry.path, specialUse: entry.specialUse })),
      options.target,
    );

    if (!destination && options.target === "archive") {
      await client.mailboxCreate("Archive");
      destination = "Archive";
    }

    const lock = await client.getMailboxLock(options.mailbox ?? "INBOX");
    try {
      if (destination) {
        await client.messageMove(String(uid), destination, { uid: true });
        return { movedTo: destination };
      }
      // No trash mailbox found: messageDelete flags \Deleted and expunges.
      await client.messageDelete(String(uid), { uid: true });
      return { movedTo: "(\\Deleted + Expunge)" };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}
