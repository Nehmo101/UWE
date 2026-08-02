import { splitDmSegments } from "@uwe/auth/dm-section";
import type { ContentBlock, Page, PageType } from "./generated/prisma/client";
import { buildPageUrl } from "./page-types";
import { parseStringArray } from "./json-utils";
import { normalizeLookupKey } from "./queries";
import { parseWikiLinks } from "./wikilink-utils";
import { sanitizeWikiHtml } from "./html-sanitize";
import type { PageSummary, PageWithBlocks, UweRepository } from "./repository";

export interface WikiPageNode {
  id: string;
  worldId: string;
  title: string;
  slug: string;
  type: Page["type"];
  tags: string[];
  aliases: string[];
  content: string;
  href: string;
}

export { parseWikiLinks, type ParsedWikiLink } from "./wikilink-utils";
export { normalizeLookupKey } from "./queries";

export function combineBlockContent(blocks: ContentBlock[]): string {
  return [...blocks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function pageToWikiNode(
  worldSlug: string,
  page: PageSummary | PageWithBlocks,
): WikiPageNode {
  const blocks = "contentBlocks" in page ? page.contentBlocks : [];
  const href = buildPageUrl(worldSlug, page.type, page.slug);

  return {
    id: page.id,
    worldId: page.worldId,
    title: page.title,
    slug: page.slug,
    type: page.type,
    tags: parseStringArray(page.tags),
    aliases: parseStringArray(page.aliases),
    content: combineBlockContent(blocks),
    href,
  };
}

export async function buildWorldWikiIndex(
  repo: UweRepository,
  worldSlug: string,
): Promise<WikiPageNode[]> {
  const pages = await repo.getWorldPageIndex(worldSlug);
  return pages.map((page) => pageToWikiNode(worldSlug, page));
}

export function buildLookupIndex(nodes: WikiPageNode[]): Map<string, WikiPageNode> {
  const index = new Map<string, WikiPageNode>();

  for (const node of nodes) {
    index.set(normalizeLookupKey(node.title), node);
    index.set(normalizeLookupKey(node.slug), node);
    for (const alias of node.aliases) {
      index.set(normalizeLookupKey(alias), node);
    }
  }

  return index;
}

export interface PageViewLink {
  displayText: string;
  href?: string;
  status: "resolved" | "broken";
}

export interface PageViewBacklink {
  title: string;
  href: string;
}

export interface PageViewRelated {
  title: string;
  href: string;
  reasons: string[];
}

export interface PageViewData {
  page: WikiPageNode;
  links: PageViewLink[];
  backlinks: PageViewBacklink[];
  relatedPages: PageViewRelated[];
  html: string;
}

export function resolveLinksInContent(
  content: string,
  index: Map<string, WikiPageNode>,
): PageViewLink[] {
  return parseWikiLinks(content).map((raw) => {
    const displayText = raw.label ?? raw.target;
    const node = index.get(normalizeLookupKey(raw.target));

    if (!node?.href) {
      return { displayText, status: "broken" as const };
    }

    return {
      displayText,
      href: node.href,
      status: "resolved" as const,
    };
  });
}

function renderWikiLinkHtml(link: PageViewLink): string {
  if (link.status === "resolved" && link.href) {
    return `<a href="${escapeAttr(link.href)}" class="wiki-link">${escapeHtml(link.displayText)}</a>`;
  }
  return `<span class="wiki-link-broken" title="Seite nicht gefunden">${escapeHtml(link.displayText)}</span>`;
}

/**
 * Rendert Wikitext-Inhalt zu sicherem HTML: escapt allen Klartext, ersetzt
 * [[Wikilinks]] durch klickbare Anker und übersetzt die Markdown-Grundstruktur
 * (Überschriften, Aufzählungen, Absätze mit weichen Zeilenumbrüchen) in Blöcke —
 * damit konvertierte Seiten nicht mehr als ein einziger Fließtext erscheinen.
 */
/**
 * Heuristik: Enthält der Inhalt bereits HTML-Markup (z. B. aus dem TipTap-Rich-
 * Text-Editor oder einem Import)? Solcher Inhalt darf nicht wie Klartext
 * escapt werden, sonst erscheinen die rohen `<p>`/`<br>`-Tags im Portal.
 */
const HTML_MARKUP_PATTERN =
  /<(?:p|br|div|span|ul|ol|li|h[1-6]|strong|em|b|i|u|s|a|blockquote|pre|code|img|hr|figure|figcaption|table|thead|tbody|tr|td|th)\b[^>]*>|<\/(?:p|div|span|ul|ol|li|h[1-6]|strong|em|blockquote|pre|figure|figcaption|table|thead|tbody|tr|td|th)>/i;

function looksLikeHtml(content: string): boolean {
  return HTML_MARKUP_PATTERN.test(content);
}

/**
 * Rendert bereits als HTML vorliegenden Inhalt: die [[Wikilinks]] werden an
 * ihren Positionen durch aufgelöste Anker ersetzt, der umgebende HTML-Text
 * bleibt unangetastet (nicht escapt). Das Ergebnis wird sanitisiert, damit
 * gefährliche Tags/Attribute (script, style, event-handler, javascript:-URLs)
 * nicht ins Portal gelangen.
 */
function renderRichHtml(content: string, links: PageViewLink[]): string {
  const wikilinks = parseWikiLinks(content);

  let out = "";
  let cursor = 0;
  for (let i = 0; i < wikilinks.length; i += 1) {
    const raw = wikilinks[i];
    if (raw.start < cursor) continue;
    out += content.slice(cursor, raw.start);
    const link = links[i];
    out += link
      ? renderWikiLinkHtml(link)
      : escapeHtml(content.slice(raw.start, raw.end));
    cursor = raw.end;
  }
  out += content.slice(cursor);

  return sanitizeWikiHtml(out);
}

/**
 * Rendert einen DM-Bereich als sichtbaren Kasten.
 *
 * Sicherheit passiert hier keine: Wer den Bereich nicht lesen darf, hat ihn
 * schon vorher verloren — `filterBlocksForViewer` schneidet ihn aus den Blöcken,
 * `renderBlockContentForViewer` noch einmal aus dem Inhalt. Was hier ankommt,
 * darf gesehen werden; der Kasten sagt dem DM nur, was die Spieler NICHT sehen.
 */
function renderDmSectionHtml(inner: string, title: string | null): string {
  const label = title ? `Nur für den DM — ${escapeHtml(title)}` : "Nur für den DM";
  return (
    `<section class="wiki-dm-section" data-uwe-dm="1" aria-label="${escapeAttr(
      title ? `DM-Bereich: ${title}` : "DM-Bereich",
    )}">` +
    `<p class="wiki-dm-section-label">${label}</p>${inner}</section>`
  );
}

export function renderContentHtml(content: string, links: PageViewLink[]): string {
  if (!content) return "";

  // DM-Bereiche werden abschnittsweise gesetzt: jeder Teil geht einzeln durch
  // denselben Renderer, nur die DM-Teile bekommen den Kasten. Die `links` sind
  // in Dokumentreihenfolge zu `parseWikiLinks(content)` sortiert, also lassen
  // sie sich über die Fundstellen sauber auf die Abschnitte aufteilen.
  const segments = splitDmSegments(content);
  if (segments.some((segment) => segment.dm)) {
    const wikilinks = parseWikiLinks(content);
    let out = "";

    for (const segment of segments) {
      const from = wikilinks.findIndex((raw) => raw.start >= segment.start);
      let take = 0;
      if (from >= 0) {
        while (from + take < wikilinks.length && wikilinks[from + take].start < segment.end) {
          take += 1;
        }
      }
      const segmentLinks = from >= 0 ? links.slice(from, from + take) : [];

      const rendered = renderSegmentHtml(segment.text, segmentLinks);
      out += segment.dm ? renderDmSectionHtml(rendered, segment.title) : rendered;
    }

    return out;
  }

  return renderSegmentHtml(content, links);
}

function renderSegmentHtml(content: string, links: PageViewLink[]): string {
  if (!content) return "";

  if (looksLikeHtml(content)) {
    return renderRichHtml(content, links);
  }

  const wikilinks = parseWikiLinks(content);

  // Wikilinks werden zeilenübergreifend in Dokumentreihenfolge konsumiert; die
  // `links`-Einträge sind identisch sortiert wie `parseWikiLinks(content)`.
  let lineStart = 0;
  let linkIdx = 0;
  const renderInline = (line: string): string => {
    const lineEnd = lineStart + line.length;
    let out = "";
    let cursor = lineStart;
    while (linkIdx < wikilinks.length && wikilinks[linkIdx].start < lineEnd) {
      const raw = wikilinks[linkIdx];
      if (raw.start < cursor) {
        linkIdx += 1;
        continue;
      }
      out += escapeHtml(content.slice(cursor, raw.start));
      out += renderWikiLinkHtml(links[linkIdx]);
      cursor = raw.end;
      linkIdx += 1;
    }
    if (cursor < lineEnd) out += escapeHtml(content.slice(cursor, lineEnd));
    return out;
  };

  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${paragraph.join("<br />")}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      listItems = [];
    }
  };

  for (const line of content.split("\n")) {
    const rendered = renderInline(line);
    lineStart += line.length + 1; // +1 für das entfernte "\n"

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level} class="wiki-heading">${rendered.replace(/^#{1,6}\s+/, "")}</h${level}>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      listItems.push(rendered.replace(/^\s*[-*+]\s+/, ""));
      continue;
    }

    flushList();
    paragraph.push(rendered);
  }

  flushParagraph();
  flushList();

  return blocks.join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

export async function buildPageView(
  repo: UweRepository,
  worldSlug: string,
  pageSlug: string,
): Promise<PageViewData | null> {
  const page = await repo.getPageBySlug(worldSlug, pageSlug);
  if (!page) return null;

  const node = pageToWikiNode(worldSlug, page);
  const visibleNodes = await buildWorldWikiIndex(repo, worldSlug);
  const index = buildLookupIndex(visibleNodes);

  const links = resolveLinksInContent(node.content, index);
  const html = renderContentHtml(node.content, links);

  const backlinks: PageViewBacklink[] = [];
  for (const candidate of visibleNodes) {
    if (candidate.id === node.id) continue;

    const candidateLinks = resolveLinksInContent(candidate.content, index);
    const parsed = parseWikiLinks(candidate.content);

    const linksToTarget = parsed.some((raw, i) => {
      const resolved = candidateLinks[i];
      return resolved.status === "resolved" && resolved.href === node.href;
    });

    if (linksToTarget) {
      backlinks.push({
        title: candidate.title,
        href: candidate.href,
      });
    }
  }

  backlinks.sort((a, b) => a.title.localeCompare(b.title));

  const relatedScores = new Map<
    string,
    { title: string; href: string; reasons: Set<string>; score: number }
  >();

  function addRelated(target: WikiPageNode, reason: string, score: number) {
    if (target.id === node.id) return;

    const existing = relatedScores.get(target.id);
    if (existing) {
      existing.reasons.add(reason);
      existing.score += score;
    } else {
      relatedScores.set(target.id, {
        title: target.title,
        href: target.href,
        reasons: new Set([reason]),
        score,
      });
    }
  }

  for (const link of links) {
    if (link.status === "resolved" && link.href) {
      const target = visibleNodes.find((item) => item.href === link.href);
      if (target) addRelated(target, "direct_link", 3);
    }
  }

  for (const backlink of backlinks) {
    const target = visibleNodes.find((item) => item.href === backlink.href);
    if (target) addRelated(target, "backlink", 2);
  }

  for (const other of visibleNodes) {
    if (other.id === node.id) continue;
    const shared = other.tags.filter((tag) => node.tags.includes(tag));
    if (shared.length > 0) {
      addRelated(other, `shared_tag:${shared.join(",")}`, shared.length);
    }
  }

  const relatedPages = [...relatedScores.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      href: item.href,
      reasons: [...item.reasons],
    }));

  return {
    page: node,
    links,
    backlinks,
    relatedPages,
    html,
  };
}

export function renderPageContentHtml(
  page: PageWithBlocks,
  wikiIndex: WikiPageNode[],
): string {
  const content = combineBlockContent(page.contentBlocks);
  const index = buildLookupIndex(wikiIndex);
  const links = resolveLinksInContent(content, index);
  return renderContentHtml(content, links);
}

// ---------------------------------------------------------------------------
// World wiki-link graph cache (H2)
//
// Wiki page views used to load the ENTIRE world (all pages + all content
// blocks) and regex-parse every page on every request, just to compute
// backlinks and the neighbour graph. PageLink rows are NOT a mirror of content
// wikilinks (they hold manually curated DM relations only), so the parsed
// content stays the source of truth. Instead we cache the loaded world plus the
// parsed+resolved wikilink graph per world, keyed on a cheap content-version
// stamp, so repeated views reuse it without re-loading or re-parsing.
// ---------------------------------------------------------------------------

export interface WorldWikiGraph {
  /** All pages of the world with all content blocks (unfiltered, title-sorted). */
  pages: PageWithBlocks[];
  /** Page summaries used for wikilink target resolution (first-match order). */
  pageIndex: PageSummary[];
  /**
   * blockId → resolved wikilink target page ids for that block's raw content,
   * resolved by first match over {@link pageIndex} exactly like
   * `resolveViewerLinks`/`resolveLinksInContent`. Block filtering only
   * includes/excludes whole blocks (never rewrites content), so a per-block
   * lookup reproduces parsing the combined visible content.
   */
  blockTargets: Map<string, string[]>;
}

interface WorldWikiGraphCacheEntry {
  version: string;
  graph: WorldWikiGraph;
}

const WORLD_WIKI_GRAPH_CACHE_MAX = 16;
const worldWikiGraphCache = new Map<string, WorldWikiGraphCacheEntry>();

function resolveWikiTargetId(
  target: string,
  pageIndex: PageSummary[],
): string | undefined {
  const key = normalizeLookupKey(target);
  const match = pageIndex.find(
    (page) =>
      normalizeLookupKey(page.title) === key ||
      normalizeLookupKey(page.slug) === key ||
      parseStringArray(page.aliases).some((alias) => normalizeLookupKey(alias) === key),
  );
  return match?.id;
}

function buildBlockTargets(
  pages: PageWithBlocks[],
  pageIndex: PageSummary[],
): Map<string, string[]> {
  const blockTargets = new Map<string, string[]>();
  for (const page of pages) {
    for (const block of page.contentBlocks) {
      const targets: string[] = [];
      for (const raw of parseWikiLinks(block.content)) {
        const id = resolveWikiTargetId(raw.target, pageIndex);
        if (id) targets.push(id);
      }
      blockTargets.set(block.id, targets);
    }
  }
  return blockTargets;
}

/**
 * Load the world's pages + parsed wikilink graph, reusing a cached snapshot when
 * the content has not changed. The version stamp folds in page AND content-block
 * counts + max updatedAt (content-block edits do not bump page.updatedAt), so any
 * content edit invalidates the cache and the returned graph is always consistent
 * with the current DB state.
 */
export async function getWorldWikiGraph(
  repo: UweRepository,
  worldSlug: string,
): Promise<WorldWikiGraph> {
  const version = await repo.getWorldGraphVersion(worldSlug);
  const cached = worldWikiGraphCache.get(worldSlug);
  if (cached && cached.version === version) {
    // Refresh LRU recency.
    worldWikiGraphCache.delete(worldSlug);
    worldWikiGraphCache.set(worldSlug, cached);
    return cached.graph;
  }

  const [pages, pageIndex] = await Promise.all([
    repo.listPagesWithBlocksForGraphUnfiltered(worldSlug, {}),
    repo.getWorldPageIndex(worldSlug),
  ]);
  const graph: WorldWikiGraph = {
    pages,
    pageIndex,
    blockTargets: buildBlockTargets(pages, pageIndex),
  };

  worldWikiGraphCache.set(worldSlug, { version, graph });
  if (worldWikiGraphCache.size > WORLD_WIKI_GRAPH_CACHE_MAX) {
    const oldest = worldWikiGraphCache.keys().next().value;
    if (oldest !== undefined) worldWikiGraphCache.delete(oldest);
  }
  return graph;
}

/**
 * Apply the campaign/type narrowing identically to the WHERE clause of
 * `listPagesWithBlocksForGraphUnfiltered`, so a cached full-world snapshot can
 * stand in for the DB-filtered query without changing which pages are returned
 * or their (title-asc) order.
 */
export function filterGraphPages(
  pages: PageWithBlocks[],
  options: { campaignId?: string | null; types?: PageType[] },
): PageWithBlocks[] {
  const { campaignId, types } = options;
  if (!campaignId && !(types && types.length > 0)) {
    return pages;
  }
  return pages.filter(
    (page) =>
      (!campaignId || page.campaignId === campaignId) &&
      (!types || types.length === 0 || types.includes(page.type)),
  );
}
