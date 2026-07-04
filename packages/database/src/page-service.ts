import type { ContentBlock, Page } from "./generated/prisma/client";
import {
  detectPrivateReferences,
  formatPrivateReferenceWarning,
} from "./content-access";
import { buildPageUrl } from "./page-types";
import { parseStringArray } from "./json-utils";
import { normalizeLookupKey } from "./queries";
import { parseWikiLinks } from "./wikilink-utils";
import {
  filterBlocksForContext,
  isPageAccessible,
  shouldHidePageTitle,
  type AccessContext,
  type PageAccessOptions,
  type ShareAccessGrant,
} from "./permissions";
import type { PageSummary, PageWithBlocks, UweRepository } from "./repository";

export interface WikiPageNode {
  id: string;
  worldId: string;
  title: string;
  slug: string;
  type: Page["type"];
  visibility: Page["visibility"];
  publishStatus: Page["publishStatus"];
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

function shareAccessOptions(shareGrant?: ShareAccessGrant): PageAccessOptions | undefined {
  return shareGrant ? { shareGrant } : undefined;
}

export function pageToWikiNode(
  worldSlug: string,
  page: PageSummary | PageWithBlocks,
  context: AccessContext,
  options?: { shareToken?: string; shareGrant?: ShareAccessGrant },
): WikiPageNode {
  const blocks =
    "contentBlocks" in page
      ? filterBlocksForContext(page.contentBlocks, context, {
          shareGrant: options?.shareGrant,
          pageId: page.id,
        })
      : [];

  const href = options?.shareToken
    ? `/share/${options.shareToken}/pages/${page.slug}`
    : buildPageUrl(worldSlug, page.type, page.slug);

  return {
    id: page.id,
    worldId: page.worldId,
    title: page.title,
    slug: page.slug,
    type: page.type,
    visibility: page.visibility,
    publishStatus: page.publishStatus,
    tags: parseStringArray(page.tags),
    aliases: parseStringArray(page.aliases),
    content: combineBlockContent(blocks),
    href,
  };
}

export async function buildWorldWikiIndex(
  repo: UweRepository,
  worldSlug: string,
  context: AccessContext,
  options?: { shareGrant?: ShareAccessGrant; shareToken?: string },
): Promise<WikiPageNode[]> {
  const pages =
    context === "share" && options?.shareGrant
      ? (await repo.getWorldPageIndex(worldSlug)).filter((page) =>
          isPageAccessible(page, context, shareAccessOptions(options.shareGrant)),
        )
      : await repo.getWorldPageIndexForContext(worldSlug, context);

  return pages.map((page) =>
    pageToWikiNode(worldSlug, page, context, {
      shareToken: options?.shareToken,
      shareGrant: options?.shareGrant,
    }),
  );
}

export function buildLookupIndex(
  nodes: WikiPageNode[],
  context: AccessContext,
  allPages?: PageSummary[],
  accessOptions?: PageAccessOptions,
): Map<string, WikiPageNode> {
  const index = new Map<string, WikiPageNode>();

  for (const node of nodes) {
    index.set(normalizeLookupKey(node.title), node);
    index.set(normalizeLookupKey(node.slug), node);
    for (const alias of node.aliases) {
      index.set(normalizeLookupKey(alias), node);
    }
  }

  if (context !== "dm" && allPages) {
    for (const page of allPages) {
      if (shouldHidePageTitle(page, context, accessOptions)) {
        const hiddenKeys = [
          normalizeLookupKey(page.title),
          normalizeLookupKey(page.slug),
          ...parseStringArray(page.aliases).map(normalizeLookupKey),
        ];

        for (const key of hiddenKeys) {
          if (!index.has(key)) {
            index.set(key, {
              id: page.id,
              worldId: page.worldId,
              title: "Verborgen",
              slug: page.slug,
              type: page.type,
              visibility: page.visibility,
              publishStatus: page.publishStatus,
              tags: [],
              aliases: [],
              content: "",
              href: "",
            });
          }
        }
      }
    }
  }

  return index;
}

export interface PageViewLink {
  displayText: string;
  href?: string;
  status: "resolved" | "broken" | "hidden";
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
  /** Warning shown to DMs in player preview when content links to private targets. */
  privateReferenceWarning?: string | null;
}

export function resolveLinksInContent(
  content: string,
  index: Map<string, WikiPageNode>,
  context: AccessContext,
  allPages?: PageSummary[],
  accessOptions?: PageAccessOptions,
): PageViewLink[] {
  return parseWikiLinks(content).map((raw) => {
    const displayText = raw.label ?? raw.target;
    const node = index.get(normalizeLookupKey(raw.target));

    if (!node) {
      const hiddenPage = allPages?.find(
        (page) =>
          normalizeLookupKey(page.title) === normalizeLookupKey(raw.target) ||
          normalizeLookupKey(page.slug) === normalizeLookupKey(raw.target) ||
          parseStringArray(page.aliases).some(
            (alias) => normalizeLookupKey(alias) === normalizeLookupKey(raw.target),
          ),
      );

      if (hiddenPage && shouldHidePageTitle(hiddenPage, context, accessOptions)) {
        return {
          displayText: raw.label ?? "Verborgen",
          status: "hidden" as const,
        };
      }

      return { displayText, status: "broken" as const };
    }

    if (context !== "dm" && shouldHidePageTitle(node, context, accessOptions)) {
      return {
        displayText: raw.label ?? "Verborgen",
        status: "hidden" as const,
      };
    }

    if (!node.href) {
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
  if (link.status === "hidden") {
    return `<span class="wiki-link-hidden" title="Inhalt nicht verfügbar">${escapeHtml(link.displayText)}</span>`;
  }
  return `<span class="wiki-link-broken" title="Seite nicht gefunden">${escapeHtml(link.displayText)}</span>`;
}

/**
 * Rendert Wikitext-Inhalt zu sicherem HTML: escapt allen Klartext, ersetzt
 * [[Wikilinks]] durch klickbare Anker und übersetzt die Markdown-Grundstruktur
 * (Überschriften, Aufzählungen, Absätze mit weichen Zeilenumbrüchen) in Blöcke —
 * damit konvertierte Seiten nicht mehr als ein einziger Fließtext erscheinen.
 */
export function renderContentHtml(content: string, links: PageViewLink[]): string {
  if (!content) return "";

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
  context: AccessContext,
  options?: { shareGrant?: ShareAccessGrant; shareToken?: string },
): Promise<PageViewData | null> {
  let page: PageWithBlocks | null;

  if (context === "share" && options?.shareGrant) {
    const rawPage = await repo.getPageBySlug(worldSlug, pageSlug);
    if (!rawPage) return null;
    if (!isPageAccessible(rawPage, context, shareAccessOptions(options.shareGrant))) return null;
    page = {
      ...rawPage,
      contentBlocks: filterBlocksForContext(rawPage.contentBlocks, context, {
        shareGrant: options.shareGrant,
        pageId: rawPage.id,
      }),
    };
  } else {
    page = await repo.getPageForContext(worldSlug, pageSlug, context);
  }

  if (!page) return null;

  const node = pageToWikiNode(worldSlug, page, context, {
    shareToken: options?.shareToken,
    shareGrant: options?.shareGrant,
  });
  const allPages = await repo.getWorldPageIndex(worldSlug);
  const visibleNodes = await buildWorldWikiIndex(repo, worldSlug, context, options);
  const index = buildLookupIndex(visibleNodes, context, allPages, shareAccessOptions(options?.shareGrant));

  const links = resolveLinksInContent(
    node.content,
    index,
    context,
    allPages,
    shareAccessOptions(options?.shareGrant),
  );
  const html = renderContentHtml(node.content, links);

  const backlinks: PageViewBacklink[] = [];
  for (const candidate of visibleNodes) {
    if (candidate.id === node.id) continue;

    const candidateLinks = resolveLinksInContent(
      candidate.content,
      index,
      context,
      allPages,
      shareAccessOptions(options?.shareGrant),
    );
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

  let privateReferenceWarning: string | null = null;
  if (context === "preview") {
    const dmPage = await repo.getPageBySlug(worldSlug, pageSlug);
    if (dmPage) {
      const playerContent = combineBlockContent(
        dmPage.contentBlocks.filter(
          (block) => block.type !== "gm_note" && block.visibility !== "dm_only" && block.visibility !== "private",
        ),
      );
      privateReferenceWarning = formatPrivateReferenceWarning(
        detectPrivateReferences(playerContent, allPages),
      );
    }
  }

  return {
    page: node,
    links,
    backlinks,
    relatedPages,
    html,
    privateReferenceWarning,
  };
}

export function renderPageContentHtml(
  worldSlug: string,
  page: PageWithBlocks,
  wikiIndex: WikiPageNode[],
  context: AccessContext,
  allPages?: PageSummary[],
  accessOptions?: PageAccessOptions,
): string {
  const visibleBlocks = filterBlocksForContext(page.contentBlocks, context, {
    ...accessOptions,
    pageId: page.id,
  });
  const content = combineBlockContent(visibleBlocks);
  const index = buildLookupIndex(wikiIndex, context, allPages, accessOptions);
  const links = resolveLinksInContent(content, index, context, allPages, accessOptions);
  return renderContentHtml(content, links);
}
