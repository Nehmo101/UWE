import type { ContentBlock, Page, Visibility } from "./generated/prisma/client";
import type { PublishStatus } from "./generated/prisma/client";

/** Page visibilities exposed to the player portal API and UI. */
export const PORTAL_PAGE_VISIBILITIES: Visibility[] = ["public", "player_visible"];

/** Block visibilities exposed to the player portal API and UI. */
export const PORTAL_BLOCK_VISIBILITIES: Visibility[] = ["public", "player_visible"];

export type AccessContext = "dm" | "portal" | "preview";

export function isPortalPageVisibility(visibility: Visibility): boolean {
  return PORTAL_PAGE_VISIBILITIES.includes(visibility);
}

export function isPortalBlockVisibility(visibility: Visibility): boolean {
  return PORTAL_BLOCK_VISIBILITIES.includes(visibility);
}

export function isPublishedForPortal(publishStatus: PublishStatus): boolean {
  return publishStatus === "published";
}

export function isPageAccessible(
  page: Pick<Page, "visibility" | "publishStatus">,
  context: AccessContext,
): boolean {
  if (context === "dm") {
    return true;
  }

  if (!isPublishedForPortal(page.publishStatus)) {
    return false;
  }

  return isPortalPageVisibility(page.visibility);
}

export function filterBlocksForContext<T extends Pick<ContentBlock, "visibility">>(
  blocks: T[],
  context: AccessContext,
): T[] {
  if (context === "dm") {
    return blocks;
  }

  return blocks.filter((block) => isPortalBlockVisibility(block.visibility));
}

export function shouldHidePageTitle(
  page: Pick<Page, "visibility" | "publishStatus">,
  context: AccessContext,
): boolean {
  return !isPageAccessible(page, context);
}
