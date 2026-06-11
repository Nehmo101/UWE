import type { ContentBlock, Page, Visibility } from "./generated/prisma/client";
import type { PublishStatus } from "./generated/prisma/client";

/** Page visibilities exposed to the player portal API and UI. */
export const PORTAL_PAGE_VISIBILITIES: Visibility[] = ["public", "player_visible"];

/** Block visibilities exposed to the player portal API and UI. */
export const PORTAL_BLOCK_VISIBILITIES: Visibility[] = ["public", "player_visible"];

export type AccessContext = "dm" | "portal" | "preview";

export interface PortalAccessOptions {
  publicSharingEnabled?: boolean;
}

export function isPortalPageVisibility(visibility: Visibility): boolean {
  return PORTAL_PAGE_VISIBILITIES.includes(visibility);
}

export function isPortalBlockVisibility(visibility: Visibility): boolean {
  return PORTAL_BLOCK_VISIBILITIES.includes(visibility);
}

export function isPublishedForPortal(publishStatus: PublishStatus): boolean {
  return publishStatus === "published";
}

function isPublicVisibilityAllowed(
  visibility: Visibility,
  context: AccessContext,
  options?: PortalAccessOptions,
): boolean {
  if (visibility !== "public") {
    return true;
  }

  if (context === "dm") {
    return true;
  }

  return options?.publicSharingEnabled !== false;
}

export function isPageAccessible(
  page: Pick<Page, "visibility" | "publishStatus">,
  context: AccessContext,
  options?: PortalAccessOptions,
): boolean {
  if (context === "dm") {
    return true;
  }

  if (!isPublishedForPortal(page.publishStatus)) {
    return false;
  }

  if (!isPublicVisibilityAllowed(page.visibility, context, options)) {
    return false;
  }

  return isPortalPageVisibility(page.visibility);
}

export function filterBlocksForContext<T extends Pick<ContentBlock, "visibility">>(
  blocks: T[],
  context: AccessContext,
  options?: PortalAccessOptions,
): T[] {
  if (context === "dm") {
    return blocks;
  }

  return blocks.filter(
    (block) =>
      isPortalBlockVisibility(block.visibility) &&
      isPublicVisibilityAllowed(block.visibility, context, options),
  );
}

/** Asset visibilities exposed to the player portal API and UI. */
export const PORTAL_ASSET_VISIBILITIES: Visibility[] = ["public", "player_visible"];

export function isPortalAssetVisibility(visibility: Visibility): boolean {
  return PORTAL_ASSET_VISIBILITIES.includes(visibility);
}

export function isAssetAccessible(
  asset: Pick<{ visibility: Visibility }, "visibility">,
  context: AccessContext,
): boolean {
  if (context === "dm") {
    return true;
  }

  return isPortalAssetVisibility(asset.visibility);
}

export function filterAssetsForContext<T extends Pick<{ visibility: Visibility }, "visibility">>(
  assets: T[],
  context: AccessContext,
): T[] {
  if (context === "dm") {
    return assets;
  }

  return assets.filter((asset) => isPortalAssetVisibility(asset.visibility));
}

export function shouldHidePageTitle(
  page: Pick<Page, "visibility" | "publishStatus">,
  context: AccessContext,
): boolean {
  return !isPageAccessible(page, context);
}
