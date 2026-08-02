/**
 * Einen ganzen Band am Stück lesbar machen.
 *
 * Ein importiertes Kampagnenbuch besteht danach aus 55 Wiki-Seiten. Das ist die
 * richtige Form zum **Nachschlagen** — und die falsche zum **Lesen**. Wer ein
 * Abenteuer vorbereitet, will es einmal von vorn bis hinten durchgehen, nicht
 * fünfundfünfzigmal klicken.
 *
 * Dieses Modul rechnet aus der Lesereihenfolge einen fortlaufenden Text: eine
 * Abschnittsliste mit Sprungmarken und ein Inhaltsverzeichnis dazu. Die
 * Reihenfolge ist dieselbe wie im Runner (`buildReadingOrder`) — es gibt nicht
 * zwei Vorstellungen davon, was „als Nächstes" heißt.
 *
 * Rein: hinein gehen flache Seitendaten und fertiges HTML, heraus kommt eine
 * Liste. Keine Datenbank, kein React.
 */

import { buildReadingOrder, type ReadingEntry, type ReadingPage } from "./reading-order";

export interface VolumeSection {
  id: string;
  title: string;
  slug: string;
  type: string;
  /** Verschachtelungstiefe, die Wurzel steht auf 0. */
  depth: number;
  /** Sprungmarke im Dokument — der Slug, weil der pro Welt eindeutig ist. */
  anchor: string;
  html: string;
  /** Hat dieser Abschnitt eigenen Text, oder ist er nur Gliederung? */
  empty: boolean;
}

export interface Volume {
  root: VolumeSection;
  sections: VolumeSection[];
  /** Wie viele Abschnitte tatsächlich Text tragen — für „12 von 55 sind leer". */
  filled: number;
  /** Zeichen des ganzen Bandes, grob als Lesezeitmaß. */
  characters: number;
}

export interface BuildVolumeOptions {
  /** Fertiges HTML je Seiten-ID. Fehlt eine, gilt der Abschnitt als leer. */
  htmlById: Map<string, string>;
  /** Seiten, die nicht in den Lesetext gehören — etwa die abgelegte Originaldatei. */
  exclude?: (page: ReadingPage) => boolean;
  /** Tiefste Ebene, die noch ins Inhaltsverzeichnis kommt. Vorgabe: 3. */
  tocDepth?: number;
}

/** Grobe Zeichenzahl eines HTML-Abschnitts, ohne Tags. */
function textLength(html: string): number {
  let length = 0;
  let inTag = false;

  for (const char of html) {
    if (char === "<") inTag = true;
    else if (char === ">") inTag = false;
    else if (!inTag) length += 1;
  }

  return length;
}

function toSection(entry: ReadingEntry, html: string): VolumeSection {
  return {
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    type: entry.type,
    depth: entry.depth,
    anchor: `abschnitt-${entry.slug}`,
    html,
    empty: textLength(html) === 0,
  };
}

/**
 * Baut den Band ab `rootId`.
 *
 * Ausgeschlossene Seiten fallen samt ihrer Unterseiten weg — wer die
 * Originaldatei nicht im Lesetext haben will, will auch nichts, was daran
 * hängt. Gibt es die Wurzel nicht, ist das Ergebnis `null`; das ist der Fall
 * „Seite gelöscht, Lesezeichen zeigt noch darauf".
 */
export function buildVolume(
  pages: ReadingPage[],
  rootId: string,
  options: BuildVolumeOptions,
): Volume | null {
  const excluded = new Set<string>();

  if (options.exclude) {
    const byParent = new Map<string, ReadingPage[]>();
    for (const page of pages) {
      if (!page.parentPageId) continue;
      const siblings = byParent.get(page.parentPageId) ?? [];
      siblings.push(page);
      byParent.set(page.parentPageId, siblings);
    }

    const drop = (page: ReadingPage) => {
      if (excluded.has(page.id)) return;
      excluded.add(page.id);
      for (const child of byParent.get(page.id) ?? []) drop(child);
    };

    for (const page of pages) {
      if (options.exclude(page)) drop(page);
    }
  }

  if (excluded.has(rootId)) return null;

  const visible = excluded.size > 0 ? pages.filter((page) => !excluded.has(page.id)) : pages;
  const order = buildReadingOrder(visible, rootId);
  if (order.length === 0) return null;

  const sections = order.map((entry) => toSection(entry, options.htmlById.get(entry.id) ?? ""));

  return {
    root: sections[0],
    sections,
    filled: sections.filter((section) => !section.empty).length,
    characters: sections.reduce((total, section) => total + textLength(section.html), 0),
  };
}

export interface VolumeTocEntry {
  anchor: string;
  title: string;
  depth: number;
}

/** Das Inhaltsverzeichnis — die Wurzel steht nicht darin, sie ist der Titel. */
export function buildVolumeToc(volume: Volume, maxDepth = 3): VolumeTocEntry[] {
  return volume.sections
    .filter((section) => section.depth > 0 && section.depth <= maxDepth)
    .map((section) => ({ anchor: section.anchor, title: section.title, depth: section.depth }));
}

/**
 * Bände einer Welt: Seiten mit Unterseiten, die selbst keine Unterseite sind.
 *
 * Das trifft genau die importierten Dokumente und die von Hand gebauten
 * Hierarchien — und nichts sonst. Eine einzelne NSC-Seite ist kein Band.
 */
export function findVolumeRoots(pages: ReadingPage[]): ReadingPage[] {
  const known = new Set(pages.map((page) => page.id));
  const hasChildren = new Set(
    pages
      .map((page) => page.parentPageId)
      .filter((id): id is string => Boolean(id) && known.has(id as string)),
  );

  return pages
    .filter((page) => hasChildren.has(page.id))
    .filter((page) => !page.parentPageId || !known.has(page.parentPageId))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}

/** Wie viele Seiten der Band umfasst — inklusive der Wurzel. */
export function countVolumePages(pages: ReadingPage[], rootId: string): number {
  return buildReadingOrder(pages, rootId).length;
}
