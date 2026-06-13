import { getUweRuntimeConfig } from "@uwe/auth";
import type { ContentBlock, Page, Visibility } from "./generated/prisma/client";
import type { PublishStatus } from "./generated/prisma/client";

/** Page visibilities exposed to the player portal API and UI. */
export const PORTAL_PAGE_VISIBILITIES: Visibility[] = ["public", "player_visible"];

/** Block visibilities exposed to the player portal API and UI. */
export const PORTAL_BLOCK_VISIBILITIES: Visibility[] = ["public", "player_visible"];

export type AccessContext = "dm" | "portal" | "preview" | "share";

export interface ShareAccessGrant {
  sharedPageIds: Set<string>;
  sharedAssetIds: Set<string>;
}

export interface PortalAccessOptions {
  publicSharingEnabled?: boolean;
}

export interface PageAccessOptions extends PortalAccessOptions {
  shareGrant?: ShareAccessGrant;
  /** Required in share context when PLAYER_PREVIEW_ALLOW_DM_ONLY=true. */
  pageId?: string;
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
  page: Pick<Page, "id" | "visibility" | "publishStatus">,
  context: AccessContext,
  options?: PageAccessOptions,
): boolean {
  if (context === "share" && options?.shareGrant) {
    return options.shareGrant.sharedPageIds.has(page.id);
  }

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
  options?: PageAccessOptions,
): T[] {
  if (context === "dm") {
    return blocks;
  }

  if (
    context === "share" &&
    options?.shareGrant &&
    options.pageId &&
    options.shareGrant.sharedPageIds.has(options.pageId) &&
    getUweRuntimeConfig().playerPreviewAllowDmOnly
  ) {
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
  asset: Pick<{ id: string; visibility: Visibility }, "id" | "visibility">,
  context: AccessContext,
  options?: PageAccessOptions,
): boolean {
  if (context === "share" && options?.shareGrant) {
    return options.shareGrant.sharedAssetIds.has(asset.id);
  }

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
  page: Pick<Page, "id" | "visibility" | "publishStatus">,
  context: AccessContext,
  options?: PageAccessOptions,
): boolean {
  return !isPageAccessible(page, context, options);
}
