/**
 * Lesezeichen des Session-Runners.
 *
 * Wo die Spielleitung stehen geblieben ist, gehört nicht in ein neues Feld,
 * sondern in etwas, das es schon gibt: `SessionLiveEntry` hat die Art
 * `bookmark`, ein `refPageId` und ein freies `payload`. Damit übersteht die
 * Leseposition einen Reload, ohne dass das Schema wächst — und sie steht neben
 * den Notizen, wo sie am Spielabend ohnehin hingehört.
 */

export const SESSION_BOOKMARK_KIND = "bookmark" as const;

export interface SessionBookmark {
  /** Seite, auf der zuletzt gelesen wurde. */
  pageId: string;
  /** Überschriften-`id` innerhalb der Seite, falls bekannt. */
  anchor: string | null;
  /** Scrollposition in Prozent der Seitenhöhe, als Notnagel ohne Anker. */
  scrollRatio: number | null;
}

/** Baut das `payload`, das am Live-Eintrag hängt. */
export function encodeBookmarkPayload(bookmark: SessionBookmark): Record<string, unknown> {
  return {
    kind: SESSION_BOOKMARK_KIND,
    pageId: bookmark.pageId,
    anchor: bookmark.anchor,
    scrollRatio: bookmark.scrollRatio,
  };
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Liest ein Lesezeichen aus einem gespeicherten Eintrag.
 *
 * `refPageId` gewinnt über die `pageId` im Payload: die Spalte ist ein echter
 * Fremdschlüssel, das Payload nur Text. Ohne beides gibt es kein Lesezeichen.
 */
export function parseBookmarkPayload(
  payload: unknown,
  refPageId?: string | null,
): SessionBookmark | null {
  const source =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  const pageId = refPageId?.trim() || readString(source, "pageId");
  if (!pageId) return null;

  const ratio = source.scrollRatio;
  const scrollRatio =
    typeof ratio === "number" && Number.isFinite(ratio)
      ? Math.min(1, Math.max(0, ratio))
      : null;

  return { pageId, anchor: readString(source, "anchor"), scrollRatio };
}

export interface BookmarkCandidate {
  kind: string;
  refPageId: string | null;
  payload: unknown;
  createdAt: Date;
}

/**
 * Das jüngste Lesezeichen einer Sitzung.
 *
 * Es wird bewusst nicht das *einzige* geführt: jeder Sprung schreibt einen
 * neuen Eintrag, und die Liste im Live-Panel wird damit zur Spur durch den
 * Abend — „wir waren bei 7.4, dann bei Xarza, dann zurück".
 */
export function latestBookmark(entries: BookmarkCandidate[]): SessionBookmark | null {
  const bookmarks = entries
    .filter((entry) => entry.kind === SESSION_BOOKMARK_KIND)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  for (const entry of bookmarks) {
    const bookmark = parseBookmarkPayload(entry.payload, entry.refPageId);
    if (bookmark) return bookmark;
  }

  return null;
}
