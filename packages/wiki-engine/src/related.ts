import type { Page } from "@uwe/database";
import {
  getPageById,
  isPlayerVisible,
  listPagesInWorld,
  pageHref,
} from "@uwe/database";
import type { WikiStore } from "@uwe/database";
import { getBacklinks } from "./backlinks";
import { resolveWikiLinks } from "./backlinks";

export interface RelatedPage {
  page: Page;
  href: string;
  /** Why this page is related. */
  reasons: string[];
  score: number;
}

export interface FindRelatedPagesOptions {
  playerVisibleOnly?: boolean;
  limit?: number;
}

/**
 * Find related pages based on direct links, backlinks, shared tags, and relations.
 */
export function findRelatedPages(
  store: WikiStore,
  pageId: string,
  options?: FindRelatedPagesOptions,
): RelatedPage[] {
  const page = store.pages.get(pageId);
  if (!page) return [];

  const limit = options?.limit ?? 10;
  const scores = new Map<string, { page: Page; reasons: Set<string>; score: number }>();

  function addCandidate(candidate: Page, reason: string, weight: number): void {
    if (candidate.id === pageId) return;
    if (options?.playerVisibleOnly && !isPlayerVisible(candidate.visibility)) return;

    const existing = scores.get(candidate.id);
    if (existing) {
      existing.reasons.add(reason);
      existing.score += weight;
    } else {
      scores.set(candidate.id, {
        page: candidate,
        reasons: new Set([reason]),
        score: weight,
      });
    }
  }

  // Direct outbound links
  const outbound = resolveWikiLinks(store, page.worldId, page.id, page.content, options);
  for (const link of outbound) {
    if (link.status === "resolved" && link.targetPage) {
      addCandidate(link.targetPage, "direct_link", 3);
    }
  }

  // Backlinks
  const backlinks = getBacklinks(store, pageId, options);
  for (const backlink of backlinks) {
    addCandidate(backlink.sourcePage, "backlink", 2);
  }

  // Shared tags
  const worldPages = listPagesInWorld(store, page.worldId);
  for (const other of worldPages) {
    if (other.id === pageId) continue;
    const shared = other.tags.filter((tag) => page.tags.includes(tag));
    if (shared.length > 0) {
      addCandidate(other, `shared_tag:${shared.join(",")}`, shared.length);
    }
  }

  // Explicit relations
  for (const relation of page.relations) {
    const related = getPageById(store, relation.targetPageId);
    if (related) {
      addCandidate(related, `relation:${relation.type}`, 2);
    }
  }

  // Reverse relations (other pages pointing to this page)
  for (const other of worldPages) {
    for (const relation of other.relations) {
      if (relation.targetPageId === pageId) {
        addCandidate(other, `relation_from:${relation.type}`, 1);
      }
    }
  }

  return [...scores.values()]
    .map(({ page: relatedPage, reasons, score }) => {
      const href = pageHref(store, relatedPage);
      if (!href) return null;
      return {
        page: relatedPage,
        href,
        reasons: [...reasons],
        score,
      };
    })
    .filter((item): item is RelatedPage => item !== null)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
    .slice(0, limit);
}
