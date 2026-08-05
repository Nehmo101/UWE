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
  findVolumeRoots,
  normalizeQuery,
  searchVolume,
  type ReadingPage,
  type SectionHit,
  type Volume,
  type VolumeSearchResult,
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

/** Kein HTML — für die Durchläufe, in denen nur der Umfang eines Bandes zählt. */
const NO_HTML = new Map<string, string>();

type WikiGraph = Awaited<ReturnType<typeof getWorldWikiGraph>>;

/** Die abgelegten Originaldateien einer Welt und die Regel, sie auszulassen. */
function sourceExclusion(graph: WikiGraph) {
  const sourceIds = new Set(
    graph.pageIndex.filter((page) => hasSourceTag(page.tags)).map((page) => page.id),
  );
  return { sourceIds, exclude: (page: ReadingPage) => sourceIds.has(page.id) };
}

/**
 * Rendert das HTML für genau die Seiten in `ids`.
 *
 * `renderPageContentHtml` baut den Lookup-Index bei jedem Aufruf neu. Für eine
 * einzelne Wiki-Seite ist das egal; für einen Band mit 55 Abschnitten wäre es
 * 55-mal derselbe Index über dieselbe Welt. Deshalb hier einmal, dann teilen —
 * die Schritte darunter sind exakt die von `renderPageContentHtml`.
 */
function renderPagesHtml(worldSlug: string, graph: WikiGraph, ids: Set<string>): Map<string, string> {
  const wikiIndex: WikiPageNode[] = graph.pages.map((page) => pageToWikiNode(worldSlug, page));
  const lookup = buildLookupIndex(wikiIndex);

  const htmlById = new Map<string, string>();
  for (const page of graph.pages) {
    if (!ids.has(page.id)) continue;
    const content = combineBlockContent(page.contentBlocks);
    htmlById.set(page.id, renderContentHtml(content, resolveLinksInContent(content, lookup)));
  }

  return htmlById;
}

/**
 * Die Bände einer Welt als Gliederung, ohne HTML.
 *
 * `buildVolume` ist ein reiner Baumdurchlauf und kostet fast nichts; erst das
 * Rendern ist teuer. Deshalb geht jeder Weg hier durch — Übersicht wie Suche
 * zählen damit **dieselben** Abschnitte wie der Lesetext, inklusive der
 * ausgelassenen Originaldateien samt ihrer Unterseiten.
 */
function listVolumeOutlines(graph: WikiGraph): Array<{ root: ReadingPage; outline: Volume }> {
  const pages = toReadingPages(graph.pageIndex);
  const { exclude } = sourceExclusion(graph);

  return findVolumeRoots(pages)
    .map((root) => ({ root, outline: buildVolume(pages, root.id, { htmlById: NO_HTML, exclude }) }))
    .filter((entry): entry is { root: ReadingPage; outline: Volume } => entry.outline !== null);
}

/** Alle Bände einer Welt — Seiten mit Unterseiten, die selbst keine sind. */
export async function listVolumes(worldSlug: string): Promise<VolumeSummary[]> {
  const graph = await getWorldWikiGraph(getAppRepository(), worldSlug);

  return listVolumeOutlines(graph).map(({ root, outline }) => ({
    id: root.id,
    title: root.title,
    slug: root.slug,
    type: root.type,
    pageCount: outline.sections.length,
  }));
}

export interface VolumeReaderView {
  volume: Volume;
  toc: VolumeTocEntry[];
  /** Wie viele Seiten die Originaldatei beigesteuert hätte — sie bleibt draußen. */
  sourcePages: Array<{ title: string; slug: string; type: string }>;
  /** Ergebnis der Suche im Band — `null`, wenn nicht gesucht wurde. */
  search: VolumeSearchResult | null;
}

/**
 * Baut den Lesetext für `rootSlug`, auf Wunsch mit Suche darin.
 *
 * Die abgelegte Originaldatei bleibt außen vor: Sie ist der Beleg, dass beim
 * Import nichts verloren ging, und im fortlaufenden Text wäre sie eine Mauer
 * aus Rohtext. Verlinkt wird sie trotzdem — wer sie sucht, findet sie. Für die
 * Suche gilt dasselbe: gefunden wird nur, was auch im Lesetext steht, sonst
 * zeigte die Trefferliste auf Abschnitte, die es hier nicht gibt.
 */
export async function buildVolumeReaderView(
  worldSlug: string,
  rootSlug: string,
  options: { query?: string | null } = {},
): Promise<VolumeReaderView | null> {
  const repo = getAppRepository();
  const graph = await getWorldWikiGraph(repo, worldSlug);

  const root = graph.pageIndex.find((page) => page.slug === rootSlug);
  if (!root) return null;

  const pages = toReadingPages(graph.pageIndex);
  const { sourceIds, exclude } = sourceExclusion(graph);

  // Erst den Band **ohne** HTML bestimmen: `buildVolume` ist ein reiner
  // Baumdurchlauf und kostet nichts. Erst danach wird gerendert — und zwar nur
  // für die Abschnitte, die wirklich im Band stehen. Über alle Seiten der Welt
  // zu rendern hieße bei 500 Seiten und einem 55-seitigen Band: 445-mal HTML,
  // das niemand ansieht.
  const outline = buildVolume(pages, root.id, { htmlById: NO_HTML, exclude });
  if (!outline) return null;

  const inVolume = new Set(outline.sections.map((section) => section.id));
  const htmlById = renderPagesHtml(worldSlug, graph, inVolume);

  const volume = buildVolume(pages, root.id, { htmlById, exclude });
  if (!volume) return null;

  const query = normalizeQuery(options.query);

  return {
    volume,
    toc: buildVolumeToc(volume, 3),
    sourcePages: graph.pageIndex
      .filter((page) => sourceIds.has(page.id) && page.parentPageId && inVolume.has(page.parentPageId))
      .map((page) => ({ title: page.title, slug: page.slug, type: page.type })),
    search: query ? searchVolume(volume, query) : null,
  };
}

export interface VolumeSearchGroup {
  volume: VolumeSummary;
  /** Textreffer im ganzen Band. */
  matches: number;
  hits: SectionHit[];
}

/**
 * Sucht über **alle** Bände einer Welt.
 *
 * Das ist die Frage, die die Browsersuche nicht beantworten kann: „in welchem
 * Buch stand das?". Gesucht wird nur in Bänden, nicht im ganzen Wiki — dafür
 * gibt es die globale Suche. Der Unterschied ist nicht kosmetisch: hier zeigt
 * ein Treffer auf die Stelle im Lesetext, nicht auf eine Seite.
 *
 * Gerendert wird deshalb einmal über alle Bandseiten (und nur die), bevor
 * gesucht wird — teurer als ein einzelner Band, aber nur wenn wirklich gesucht
 * wird, und immer noch aus dem zwischengespeicherten Welt-Graphen.
 */
export async function searchVolumes(
  worldSlug: string,
  rawQuery: string | null | undefined,
): Promise<VolumeSearchGroup[]> {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const graph = await getWorldWikiGraph(getAppRepository(), worldSlug);
  const pages = toReadingPages(graph.pageIndex);
  const { exclude } = sourceExclusion(graph);
  const outlines = listVolumeOutlines(graph);

  const inVolumes = new Set(
    outlines.flatMap((entry) => entry.outline.sections.map((section) => section.id)),
  );
  const htmlById = renderPagesHtml(worldSlug, graph, inVolumes);

  const groups: VolumeSearchGroup[] = [];
  for (const { root, outline } of outlines) {
    const volume = buildVolume(pages, root.id, { htmlById, exclude });
    if (!volume) continue;

    // Markiertes HTML braucht die Übersicht nicht — sie zeigt Ausschnitte.
    const result = searchVolume(volume, query, { snippetsPerSection: 2, highlight: false });
    if (result.hits.length === 0) continue;

    groups.push({
      volume: {
        id: root.id,
        title: root.title,
        slug: root.slug,
        type: root.type,
        pageCount: outline.sections.length,
      },
      matches: result.matches,
      hits: result.hits,
    });
  }

  return groups;
}
