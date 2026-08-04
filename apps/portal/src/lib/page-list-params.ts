/**
 * Query-String für die „Mehr laden"-Links der Portal-Listen (Wiki, NPCs,
 * Quests, Handouts): Der Cursor kommt aus `listPagesForViewerPaged`, alle
 * aktiven Filter bleiben erhalten, damit die Folgeseite dieselbe Sicht zeigt.
 */
export function buildPageListMoreParams(
  cursor: string,
  filters: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  params.set("cursor", cursor);
  return params.toString();
}
