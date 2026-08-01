/**
 * Lesereihenfolge über einen Seitenbaum.
 *
 * Ein importiertes Kampagnenbuch ist ein Baum aus `Page`-Zeilen: `parentPageId`
 * sagt, wo eine Seite hängt, `sortIndex` sagt, an welcher Stelle unter ihren
 * Geschwistern. Am Spieltisch will man davon aber nur eines wissen: **was kommt
 * als Nächstes.** Genau das rechnet dieses Modul aus — eine Tiefensuche, Eltern
 * vor Kindern, so wie man ein Buch liest.
 *
 * Rein: hinein gehen flache Seitendaten, heraus kommt eine Liste. Keine
 * Datenbank, kein React.
 */

export interface ReadingPage {
  id: string;
  parentPageId: string | null;
  sortIndex: number | null;
  title: string;
  slug: string;
  type: string;
}

export interface ReadingEntry extends ReadingPage {
  /** Verschachtelungstiefe, Wurzeln stehen auf 0. */
  depth: number;
  /** Position in der Lesereihenfolge, ab 0. */
  position: number;
}

/**
 * Geschwister sortieren: `sortIndex` gewinnt, `null` steht hinten, bei
 * Gleichstand entscheidet der Titel.
 *
 * Der Nullwert ist Absicht — Bestandsseiten haben keinen Index und sollen sich
 * verhalten wie bisher, statt sich vor die importierten Kapitel zu drängen.
 */
function compareSiblings(a: ReadingPage, b: ReadingPage): number {
  const aIndex = a.sortIndex ?? Number.MAX_SAFE_INTEGER;
  const bIndex = b.sortIndex ?? Number.MAX_SAFE_INTEGER;
  if (aIndex !== bIndex) return aIndex - bIndex;
  return a.title.localeCompare(b.title, "de");
}

/**
 * Bringt die Seiten in Lesereihenfolge.
 *
 * `rootId` beschränkt das Ergebnis auf einen Teilbaum — im Runner ist das der
 * Band, in dem man gerade liest, nicht die ganze Welt.
 */
export function buildReadingOrder(pages: ReadingPage[], rootId?: string): ReadingEntry[] {
  const childrenByParent = new Map<string | null, ReadingPage[]>();
  const known = new Set(pages.map((page) => page.id));

  for (const page of pages) {
    // Zeigt ein Elternteil aus der Menge heraus, ist die Seite hier eine Wurzel.
    const parent = page.parentPageId && known.has(page.parentPageId) ? page.parentPageId : null;
    const siblings = childrenByParent.get(parent) ?? [];
    siblings.push(page);
    childrenByParent.set(parent, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(compareSiblings);
  }

  const entries: ReadingEntry[] = [];
  const visited = new Set<string>();

  const walk = (page: ReadingPage, depth: number) => {
    // Zyklenschutz: parentPageId ist ein freier Fremdschlüssel, kein Baum-Beweis.
    if (visited.has(page.id)) return;
    visited.add(page.id);

    entries.push({ ...page, depth, position: entries.length });
    for (const child of childrenByParent.get(page.id) ?? []) {
      walk(child, depth + 1);
    }
  };

  if (rootId) {
    const root = pages.find((page) => page.id === rootId);
    if (root) walk(root, 0);
    return entries;
  }

  for (const root of childrenByParent.get(null) ?? []) {
    walk(root, 0);
  }

  return entries;
}

export interface ReadingNeighbours {
  current: ReadingEntry | null;
  previous: ReadingEntry | null;
  next: ReadingEntry | null;
  total: number;
}

/** Was vor und nach der aktuellen Seite kommt. */
export function findReadingNeighbours(
  order: ReadingEntry[],
  pageId: string,
): ReadingNeighbours {
  const index = order.findIndex((entry) => entry.id === pageId);

  if (index === -1) {
    return { current: null, previous: null, next: null, total: order.length };
  }

  return {
    current: order[index],
    previous: index > 0 ? order[index - 1] : null,
    next: index < order.length - 1 ? order[index + 1] : null,
    total: order.length,
  };
}

/**
 * Die Elternkette von der Wurzel bis zur Seite selbst — die Brotkrumen im
 * Lesebereich. Bricht bei einem Zyklus ab, statt sich festzufressen.
 */
export function buildAncestorTrail(pages: ReadingPage[], pageId: string): ReadingPage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const trail: ReadingPage[] = [];
  const seen = new Set<string>();

  let current = byId.get(pageId) ?? null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    current = current.parentPageId ? (byId.get(current.parentPageId) ?? null) : null;
  }

  return trail;
}

/** Die Wurzel des Teilbaums, in dem eine Seite hängt. */
export function findReadingRoot(pages: ReadingPage[], pageId: string): ReadingPage | null {
  const trail = buildAncestorTrail(pages, pageId);
  return trail[0] ?? null;
}

/** Direkte Unterseiten in Lesereihenfolge. */
export function findChildren(pages: ReadingPage[], pageId: string): ReadingPage[] {
  return pages.filter((page) => page.parentPageId === pageId).sort(compareSiblings);
}
