import "server-only";

import {
  buildLookupIndex,
  combineBlockContent,
  getWorldWikiGraph,
  pageToWikiNode,
  renderContentHtml,
  resolveLinksInContent,
  type WikiPageNode,
} from "@uwe/database/page-service";
import { getAppRepository, type PageSummary } from "@uwe/database/server";
import { DOC_IMPORT_SOURCE_TAG } from "@uwe/doc-import";
import {
  buildVolume,
  buildVolumeToc,
  countVolumePages,
  findVolumeRoots,
  type ReadingPage,
  type Volume,
  type VolumeTocEntry,
} from "@uwe/session-runner";

/**
 * Der Lesetext eines Bandes.
 *
 * Nach dem Import besteht ein Kampagnenbuch aus Dutzenden Wiki-Seiten — richtig
 * zum Nachschlagen, unbrauchbar zum Vorbereiten. Diese Schicht setzt sie wieder
 * zu einem Text zusammen: **derselbe** Baum, **dieselbe** Reihenfolge wie im
 * Session-Runner, nur am Stück statt seitenweise.
 *
 * Gelesen wird aus dem zwischengespeicherten Welt-Graphen (`getWorldWikiGraph`).
 * Der lädt die Welt einmal pro Inhaltsstand und wird ohnehin von jeder
 * Wiki-Ansicht gebraucht — ein Band kostet damit keine zusätzliche Abfrage pro
 * Abschnitt, was bei 55 Abschnitten den Unterschied macht.
 */

/** Seiten mit diesem Tag sind die abgelegte Originaldatei — Beleg, kein Lesetext. */
export const SOURCE_TAG = DOC_IMPORT_SOURCE_TAG;

export interface VolumeSummary {
  id: string;
  title: string;
  slug: string;
  type: string;
  pageCount: number;
}

function toReadingPages(index: PageSummary[]): ReadingPage[] {
  return index.map((page) => ({
    id: page.id,
    parentPageId: page.parentPageId ?? null,
    sortIndex: page.sortIndex ?? null,
    title: page.title,
    slug: page.slug,
    type: page.type,
  }));
}

function hasSourceTag(tags: unknown): boolean {
  return Array.isArray(tags) && tags.some((tag) => tag === SOURCE_TAG);
}

/** Alle Bände einer Welt — Seiten mit Unterseiten, die selbst keine sind. */
export async function listVolumes(worldSlug: string): Promise<VolumeSummary[]> {
  const graph = await getWorldWikiGraph(getAppRepository(), worldSlug);
  const pages = toReadingPages(graph.pageIndex);

  return findVolumeRoots(pages).map((root) => ({
    id: root.id,
    title: root.title,
    slug: root.slug,
    type: root.type,
    pageCount: countVolumePages(pages, root.id),
  }));
}

export interface VolumeReaderView {
  volume: Volume;
  toc: VolumeTocEntry[];
  /** Wie viele Seiten die Originaldatei beigesteuert hätte — sie bleibt draußen. */
  sourcePages: Array<{ title: string; slug: string; type: string }>;
}

/**
 * Baut den Lesetext für `rootSlug`.
 *
 * Die abgelegte Originaldatei bleibt außen vor: Sie ist der Beleg, dass beim
 * Import nichts verloren ging, und im fortlaufenden Text wäre sie eine Mauer
 * aus Rohtext. Verlinkt wird sie trotzdem — wer sie sucht, findet sie.
 */
export async function buildVolumeReaderView(
  worldSlug: string,
  rootSlug: string,
): Promise<VolumeReaderView | null> {
  const repo = getAppRepository();
  const graph = await getWorldWikiGraph(repo, worldSlug);

  const root = graph.pageIndex.find((page) => page.slug === rootSlug);
  if (!root) return null;

  const pages = toReadingPages(graph.pageIndex);
  const sourceIds = new Set(
    graph.pageIndex.filter((page) => hasSourceTag(page.tags)).map((page) => page.id),
  );

  const wikiIndex: WikiPageNode[] = graph.pages.map((page) => pageToWikiNode(worldSlug, page));
  // `renderPageContentHtml` baut den Lookup-Index bei jedem Aufruf neu. Für eine
  // einzelne Wiki-Seite ist das egal; für einen Band mit 55 Abschnitten wäre es
  // 55-mal derselbe Index über dieselbe Welt. Deshalb hier einmal, dann teilen —
  // die Schritte darunter sind exakt die von `renderPageContentHtml`.
  const lookup = buildLookupIndex(wikiIndex);

  const htmlById = new Map<string, string>();
  for (const page of graph.pages) {
    if (sourceIds.has(page.id)) continue;
    const content = combineBlockContent(page.contentBlocks);
    htmlById.set(page.id, renderContentHtml(content, resolveLinksInContent(content, lookup)));
  }

  const volume = buildVolume(pages, root.id, {
    htmlById,
    exclude: (page) => sourceIds.has(page.id),
  });
  if (!volume) return null;

  const inVolume = new Set(volume.sections.map((section) => section.id));

  return {
    volume,
    toc: buildVolumeToc(volume, 3),
    sourcePages: graph.pageIndex
      .filter((page) => sourceIds.has(page.id) && page.parentPageId && inVolume.has(page.parentPageId))
      .map((page) => ({ title: page.title, slug: page.slug, type: page.type })),
  };
}
