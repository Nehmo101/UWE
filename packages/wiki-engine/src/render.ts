import type { Page } from "@uwe/database";
import { isPlayerVisible } from "@uwe/database";
import type { WikiStore } from "@uwe/database";
import type { ResolvedWikiLink } from "./backlinks";
import { resolveWikiLinks } from "./backlinks";
import { findRelatedPages, type RelatedPage } from "./related";
import { getBacklinks, type Backlink } from "./backlinks";

export interface PlayerSafePageView {
  page: Page;
  href: string;
  resolvedLinks: ResolvedWikiLink[];
  backlinks: Backlink[];
  relatedPages: RelatedPage[];
}

export interface PlayerFilterOptions {
  /** Base path prefix for player portal routes. */
  basePath?: string;
}

/**
 * Build a player-safe view of a page — filters backlinks, related pages,
 * and treats dm_only targets as broken/unresolvable.
 */
export function buildPlayerSafePageView(
  store: WikiStore,
  page: Page,
  href: string,
): PlayerSafePageView | null {
  if (!isPlayerVisible(page.visibility)) {
    return null;
  }

  const resolvedLinks = resolveWikiLinks(store, page.worldId, page.id, page.content, {
    playerVisibleOnly: true,
  });

  const backlinks = getBacklinks(store, page.id, { playerVisibleOnly: true });
  const relatedPages = findRelatedPages(store, page.id, {
    playerVisibleOnly: true,
  });

  return {
    page,
    href,
    resolvedLinks,
    backlinks,
    relatedPages,
  };
}

/** Strip titles of non-visible pages from any list of page references. */
export function filterPageTitlesForPlayer(pages: Page[]): Page[] {
  return pages.filter((p) => isPlayerVisible(p.visibility));
}

/** Sanitize wikilink display — never expose dm_only page titles in portal. */
export function sanitizeLinkForPlayer(link: ResolvedWikiLink): ResolvedWikiLink {
  if (link.status === "hidden") {
    return link;
  }

  if (link.status === "resolved" && link.targetPage) {
    if (!isPlayerVisible(link.targetPage.visibility)) {
      return {
        ...link,
        status: "hidden",
        targetPage: undefined,
        href: undefined,
        displayText: link.raw.label ?? "Verborgen",
      };
    }
  }

  return link;
}

export function renderWikiContent(
  text: string,
  resolvedLinks: ResolvedWikiLink[],
  options?: { forPlayer?: boolean },
): string {
  if (resolvedLinks.length === 0) {
    return escapeHtml(text);
  }

  let result = "";
  let cursor = 0;

  for (const link of resolvedLinks) {
    const safeLink = options?.forPlayer ? sanitizeLinkForPlayer(link) : link;

    result += escapeHtml(text.slice(cursor, safeLink.raw.start));

    if (safeLink.status === "resolved" && safeLink.href) {
      result += `<a href="${escapeAttr(safeLink.href)}" class="wiki-link">${escapeHtml(safeLink.displayText)}</a>`;
    } else if (safeLink.status === "hidden") {
      result += `<span class="wiki-link-hidden" title="Inhalt nicht verfügbar">${escapeHtml(safeLink.displayText)}</span>`;
    } else {
      result += `<span class="wiki-link-broken" title="Seite nicht gefunden">${escapeHtml(safeLink.displayText)}</span>`;
    }

    cursor = safeLink.raw.end;
  }

  result += escapeHtml(text.slice(cursor));
  return result;
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
