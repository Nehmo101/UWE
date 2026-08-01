/**
 * Eine Seite so aufbereiten, wie der Session-Runner sie braucht.
 *
 * Setzt zwei vorhandene Teile zusammen: `buildPageView` liefert gerendertes
 * HTML, aufgelöste Wikilinks, Backlinks und verwandte Seiten; `@uwe/session-runner`
 * rechnet daraus die Lesereihenfolge im Seitenbaum. Beides gibt es schon —
 * hier entsteht nur die gemeinsame Antwort.
 */

import { cache } from "react";

import { buildPageView, getAppRepository, buildPageUrl } from "@uwe/database/server";
import {
  buildLookupIndex,
  buildWorldWikiIndex,
  renderContentHtml,
  resolveLinksInContent,
} from "@uwe/database/page-service";
import {
  buildAncestorTrail,
  buildReadingOrder,
  findChildren,
  findReadingNeighbours,
  findReadingRoot,
  type ReadingPage,
} from "@uwe/session-runner";

export interface ReaderPageRef {
  id: string;
  title: string;
  slug: string;
  type: string;
  href: string;
}

export interface ReaderPageView {
  page: ReaderPageRef;
  /** Gerendertes HTML mit aufgelösten Wikilinks (`a.wiki-link`). */
  html: string;
  /** Elternkette von der Wurzel bis zur Seite selbst. */
  trail: ReaderPageRef[];
  children: ReaderPageRef[];
  previous: ReaderPageRef | null;
  next: ReaderPageRef | null;
  /** Position in der Lesereihenfolge des Bandes, ab 1 — für „7 von 176". */
  position: number | null;
  total: number;
  backlinks: Array<{ title: string; href: string }>;
  outgoing: Array<{ displayText: string; href?: string; status: "resolved" | "broken" }>;
  related: Array<{ title: string; href: string; reasons: string[] }>;
  brokenLinkCount: number;
}

function toRef(worldSlug: string, page: ReadingPage): ReaderPageRef {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type,
    href: buildPageUrl(worldSlug, page.type as Parameters<typeof buildPageUrl>[1], page.slug),
  };
}

/**
 * Der Wikilink-Index einer Welt, einmal pro Anfrage.
 *
 * `buildWorldWikiIndex` liest alle Seiten der Welt. Die Sessionseite rendert
 * zwei Freitextfelder (Notizen und DM-Zusammenfassung), und ohne `cache` wäre
 * das derselbe Index zweimal aus der Datenbank. `cache` ist hier dasselbe
 * Muster wie in `auth.ts` — der Geltungsbereich ist die einzelne Anfrage, es
 * bleibt also nichts zwischen zwei Aufrufern stehen.
 */
const worldLookupIndex = cache(async (worldSlug: string) =>
  buildLookupIndex(await buildWorldWikiIndex(getAppRepository(), worldSlug)),
);

/**
 * Freitext einer Welt zu HTML rendern — Session-Notizen, Zusammenfassungen.
 *
 * Diese Felder sind bisher als `whitespace-pre-wrap` ausgegeben worden, also
 * blieb ein `[[Xarza]]` darin toter Text. Am Spieltisch ist das die Stelle, an
 * der man am ehesten springen will: „steht in meinen Notizen, wer war das noch".
 * Es ist derselbe Renderer wie für Seiteninhalte, inklusive Sanitisierung.
 */
export async function renderWorldTextToHtml(worldSlug: string, text: string): Promise<string> {
  if (!text?.trim()) return "";

  const index = await worldLookupIndex(worldSlug);

  return renderContentHtml(text, resolveLinksInContent(text, index));
}

/**
 * Baut die Leseansicht für `pageSlug`.
 *
 * Die Lesereihenfolge wird auf den Band beschränkt, in dem die Seite hängt —
 * „nächste Seite" soll ans Ende des Kapitels führen, nicht in ein fremdes Buch.
 * Seiten ohne Elternteil und ohne Kinder haben keine Reihenfolge; dann bleiben
 * `previous`/`next` leer, und der Runner blendet die Navigation aus.
 */
export async function buildReaderPageView(
  worldSlug: string,
  pageSlug: string,
): Promise<ReaderPageView | null> {
  const repo = getAppRepository();
  const view = await buildPageView(repo, worldSlug, pageSlug);
  if (!view) return null;

  const index = await repo.getWorldPageIndex(worldSlug);
  const pages: ReadingPage[] = index.map((page) => ({
    id: page.id,
    parentPageId: page.parentPageId ?? null,
    sortIndex: page.sortIndex ?? null,
    title: page.title,
    slug: page.slug,
    type: page.type,
  }));

  const current = pages.find((page) => page.id === view.page.id);
  const root = current ? findReadingRoot(pages, current.id) : null;
  const order = root ? buildReadingOrder(pages, root.id) : [];
  const neighbours = current
    ? findReadingNeighbours(order, current.id)
    : { current: null, previous: null, next: null, total: 0 };

  return {
    page: {
      id: view.page.id,
      title: view.page.title,
      slug: view.page.slug,
      type: view.page.type,
      href: view.page.href,
    },
    html: view.html,
    trail: current ? buildAncestorTrail(pages, current.id).map((page) => toRef(worldSlug, page)) : [],
    children: current ? findChildren(pages, current.id).map((page) => toRef(worldSlug, page)) : [],
    previous: neighbours.previous ? toRef(worldSlug, neighbours.previous) : null,
    next: neighbours.next ? toRef(worldSlug, neighbours.next) : null,
    position: neighbours.current ? neighbours.current.position + 1 : null,
    total: neighbours.total,
    backlinks: view.backlinks,
    outgoing: view.links,
    related: view.relatedPages,
    brokenLinkCount: view.links.filter((link) => link.status === "broken").length,
  };
}
