import type { Page } from "@uwe/database";
import { pageHref, resolvePageByLinkTarget } from "@uwe/database";
import type { WikiStore } from "@uwe/database";
import { parseWikiLinks, type ParsedWikiLink } from "./parseWikiLinks";

export type ResolvedLinkStatus = "resolved" | "broken" | "hidden";

export interface ResolvedWikiLink {
  raw: ParsedWikiLink;
  status: ResolvedLinkStatus;
  targetPage?: Page;
  href?: string;
  /** Display text for rendering. */
  displayText: string;
}

export interface ResolveWikiLinksOptions {
  /** When true, dm_only pages are treated as non-existent (player portal). */
  playerVisibleOnly?: boolean;
}

function playerDisplayText(raw: ParsedWikiLink, hidden: boolean): string {
  if (hidden) {
    return raw.label ?? "Verborgen";
  }
  return raw.label ?? raw.target;
}

export function resolveWikiLinks(
  store: WikiStore,
  worldId: string,
  _sourcePageId: string,
  text: string,
  options?: ResolveWikiLinksOptions,
): ResolvedWikiLink[] {
  const parsed = parseWikiLinks(text);

  return parsed.map((raw) => {
    const page = resolvePageByLinkTarget(store, worldId, raw.target, {
      playerVisibleOnly: options?.playerVisibleOnly,
    });

    if (!page && options?.playerVisibleOnly) {
      const hiddenPage = resolvePageByLinkTarget(store, worldId, raw.target);
      if (hiddenPage?.visibility === "dm_only") {
        return {
          raw,
          status: "hidden",
          displayText: playerDisplayText(raw, true),
        };
      }
    }

    const displayText = raw.label ?? raw.target;

    if (!page) {
      return {
        raw,
        status: "broken",
        displayText,
      };
    }

    return {
      raw,
      status: "resolved",
      targetPage: page,
      href: pageHref(store, page),
      displayText,
    };
  });
}

export interface Backlink {
  sourcePage: Page;
  href: string;
}

export function getBacklinks(
  store: WikiStore,
  targetPageId: string,
  options?: ResolveWikiLinksOptions,
): Backlink[] {
  const targetPage = store.pages.get(targetPageId);
  if (!targetPage) return [];

  const backlinks: Backlink[] = [];

  for (const page of store.pages.values()) {
    if (page.worldId !== targetPage.worldId) continue;
    if (page.id === targetPageId) continue;
    if (options?.playerVisibleOnly && !isVisibleToPlayer(page)) continue;

    const resolved = resolveWikiLinks(store, page.worldId, page.id, page.content, options);
    const linksHere = resolved.some(
      (link) => link.status === "resolved" && link.targetPage?.id === targetPageId,
    );

    if (linksHere) {
      const href = pageHref(store, page);
      if (href) {
        backlinks.push({ sourcePage: page, href });
      }
    }
  }

  return backlinks.sort((a, b) =>
    a.sourcePage.title.localeCompare(b.sourcePage.title),
  );
}

function isVisibleToPlayer(page: Page): boolean {
  return page.visibility === "player_visible" || page.visibility === "public";
}
