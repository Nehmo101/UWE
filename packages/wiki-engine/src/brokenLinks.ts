import type { Page } from "@uwe/database";
import { getWorldById, listPagesInWorld, pageHref } from "@uwe/database";
import type { WikiStore } from "@uwe/database";
import { resolveWikiLinks } from "./backlinks";

export interface BrokenLink {
  sourcePage: Page;
  sourceHref: string;
  /** Raw wikilink target text. */
  target: string;
  /** Display label if present. */
  label?: string;
}

export interface BrokenLinkReport {
  worldId: string;
  worldSlug: string;
  brokenLinks: BrokenLink[];
}

/** Collect all unresolved wikilinks in a world (DM view — includes all pages). */
export function findBrokenLinks(store: WikiStore, worldId: string): BrokenLink[] {
  const world = getWorldById(store, worldId);
  if (!world) return [];

  const broken: BrokenLink[] = [];

  for (const page of listPagesInWorld(store, worldId)) {
    const resolved = resolveWikiLinks(store, worldId, page.id, page.content);
    const sourceHref = pageHref(store, page) ?? "";

    for (const link of resolved) {
      if (link.status === "broken") {
        broken.push({
          sourcePage: page,
          sourceHref,
          target: link.raw.target,
          label: link.raw.label,
        });
      }
    }
  }

  return broken;
}

export function findBrokenLinksReport(store: WikiStore, worldId: string): BrokenLinkReport | null {
  const world = getWorldById(store, worldId);
  if (!world) return null;

  return {
    worldId: world.id,
    worldSlug: world.slug,
    brokenLinks: findBrokenLinks(store, worldId),
  };
}

/**
 * Player-safe broken links — only from player-visible source pages.
 * Does NOT reveal whether a broken target matches a dm_only page.
 */
export function findPlayerVisibleBrokenLinks(
  store: WikiStore,
  worldId: string,
): BrokenLink[] {
  const world = getWorldById(store, worldId);
  if (!world) return [];

  const broken: BrokenLink[] = [];

  for (const page of listPagesInWorld(store, worldId)) {
    if (page.visibility !== "player_visible" && page.visibility !== "public") continue;

    const resolved = resolveWikiLinks(store, worldId, page.id, page.content, {
      playerVisibleOnly: true,
    });
    const sourceHref = pageHref(store, page) ?? "";

    for (const link of resolved) {
      if (link.status === "broken") {
        broken.push({
          sourcePage: page,
          sourceHref,
          target: link.raw.target,
          label: link.raw.label,
        });
      }
    }
  }

  return broken;
}

/**
 * Check that resolving with playerVisibleOnly does not leak dm_only page titles.
 * Returns true if a dm_only page would be exposed via resolution.
 */
export function wouldLeakSecretPage(
  store: WikiStore,
  worldId: string,
  target: string,
): boolean {
  const dmResolved = resolveWikiLinks(store, worldId, "check", `[[${target}]]`);
  const playerResolved = resolveWikiLinks(
    store,
    worldId,
    "check",
    `[[${target}]]`,
    { playerVisibleOnly: true },
  );

  const dmLink = dmResolved[0];
  const playerLink = playerResolved[0];

  if (dmLink?.status === "resolved" && (playerLink?.status === "broken" || playerLink?.status === "hidden")) {
    const page = dmLink.targetPage;
    if (page && page.visibility === "dm_only") {
      return false; // Correctly hidden — not a leak
    }
  }

  if (playerLink?.status === "resolved" && playerLink.targetPage?.visibility === "dm_only") {
    return true; // Leak!
  }

  return false;
}
