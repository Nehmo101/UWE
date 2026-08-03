/**
 * Conversation threading. Pure helpers that assign a stable thread id to a
 * message from its References / In-Reply-To headers, falling back to a
 * normalized subject. No I/O — the caller supplies a lookup for existing
 * messages so this stays unit-testable.
 */

export interface ThreadLookup {
  /** Returns the threadId of a previously stored message by its Message-ID, or null. */
  threadIdByMessageId(messageId: string): Promise<string | null> | string | null;
  /** Returns the threadId of an existing message with the same normalized subject, or null. */
  threadIdBySubject?(normalizedSubject: string): Promise<string | null> | string | null;
}

export interface ThreadResolveInput {
  /** This message's own Message-ID (used as the thread root when it starts one). */
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  subject: string;
}

/* Der Zähler ist als `(?:\[\d+\]\s*)?` geschrieben und nicht als `(\[\d+\])?\s*`.
   In der zweiten Fassung stehen zwei `\s*` nebeneinander, sobald die Klammer
   fehlt, und der Backtracker probiert bei einem Betreff aus vielen Leerzeichen
   jeden Aufteilungspunkt durch — quadratische Laufzeit, multipliziert mit den
   Durchläufen der Schleife unten. Betreffzeilen kommen von außen: jeder, der
   eine Mail an dieses Konto schicken kann, bestimmt sie. Beide Gruppen sind
   ausserdem nicht-einfangend, denn gebraucht wird hier nur der Ersetzungseffekt. */
const REPLY_PREFIX = /^\s*(?:re|aw|fwd|fw|wg|antwort|antw)\s*(?:\[\d+\]\s*)?:\s*/i;

/** Strips reply/forward prefixes (Re:/AW:/Fwd:/WG: …) and collapses whitespace. */
export function normalizeSubjectForThreading(subject: string): string {
  let current = (subject ?? "").trim();
  let previous: string;
  do {
    previous = current;
    current = current.replace(REPLY_PREFIX, "").trim();
  } while (current !== previous && current.length > 0);
  return current.replace(/\s+/g, " ").toLowerCase();
}

/** Extracts individual <message-id> tokens from a References/In-Reply-To value. */
export function parseMessageIdRefs(value: string | null): string[] {
  if (!value) return [];
  const ids = value.match(/<[^>]+>/g);
  if (ids && ids.length > 0) return ids;
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

/**
 * Resolves the thread id for a message. Precedence:
 *   1. threadId of any referenced ancestor (References then In-Reply-To), newest first;
 *   2. threadId of an existing message with the same normalized subject (if a lookup is given);
 *   3. the message's own Message-ID (it starts a new thread);
 *   4. a subject-derived synthetic key when there is no Message-ID.
 */
export async function resolveThreadId(
  input: ThreadResolveInput,
  lookup: ThreadLookup,
): Promise<string> {
  const refs = [
    ...parseMessageIdRefs(input.references),
    ...parseMessageIdRefs(input.inReplyTo),
  ];
  // Most recent ancestor first — the last id in References is the direct parent.
  for (const ref of refs.reverse()) {
    const existing = await lookup.threadIdByMessageId(ref);
    if (existing) return existing;
  }

  const normalizedSubject = normalizeSubjectForThreading(input.subject);
  if (lookup.threadIdBySubject && normalizedSubject) {
    const bySubject = await lookup.threadIdBySubject(normalizedSubject);
    if (bySubject) return bySubject;
  }

  if (input.messageId) return input.messageId;
  return normalizedSubject ? `subject:${normalizedSubject}` : `thread:${Math.abs(hashString(input.subject))}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
