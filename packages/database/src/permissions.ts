import { getUweRuntimeConfig } from "@uwe/auth";
import type { ContentBlock, Page, Visibility } from "./generated/prisma/client";
import type { PublishStatus } from "./generated/prisma/client";
import {
  isBlockPlayerExposable,
  isDmOnlyVisibility,
  isPlayerExposableContent,
  isPlayerPortalVisibility,
  PLAYER_PORTAL_VISIBILITIES,
} from "./content-access";

/** Page visibilities exposed to the player portal API and UI. */
export const PORTAL_PAGE_VISIBILITIES: Visibility[] = [...PLAYER_PORTAL_VISIBILITIES];

/** Block visibilities exposed to the player portal API and UI. */
export const PORTAL_BLOCK_VISIBILITIES: Visibility[] = [...PLAYER_PORTAL_VISIBILITIES];

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

export type PageAccessRecord = Pick<
  Page,
  "id" | "visibility" | "publishStatus"
> & {
};

export type BlockAccessRecord = Pick<ContentBlock, "visibility" | "type"> & {
};

export function isPortalPageVisibility(visibility: Visibility): boolean {
  return isPlayerPortalVisibility(visibility);
}

export function isPortalBlockVisibility(visibility: Visibility): boolean {
  return isPlayerPortalVisibility(visibility);
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
  page: PageAccessRecord,
  context: AccessContext,
  options?: PageAccessOptions,
): boolean {
  if (context === "share" && options?.shareGrant) {
    return options.shareGrant.sharedPageIds.has(page.id);
  }

  if (context === "dm") {
    return true;
  }

  if (!isPlayerExposableContent(page)) {
    return false;
  }

  if (!isPublicVisibilityAllowed(page.visibility, context, options)) {
    return false;
  }

  return isPortalPageVisibility(page.visibility);
}

export function filterBlocksForContext<T extends BlockAccessRecord>(
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
      isBlockPlayerExposable(block) &&
      isPublicVisibilityAllowed(block.visibility, context, options),
  );
}

/** Asset visibilities exposed to the player portal API and UI. */
export const PORTAL_ASSET_VISIBILITIES: Visibility[] = [...PLAYER_PORTAL_VISIBILITIES];

export function isPortalAssetVisibility(visibility: Visibility): boolean {
  return isPlayerPortalVisibility(visibility);
}

export type AssetAccessRecord = {
  id: string;
  visibility: Visibility;
  publishStatus?: PublishStatus;
};

/**
 * Player-facing accessibility predicate for a single asset, excluding the
 * DM-context bypass and the share-grant membership shortcut. Both
 * {@link isAssetAccessible} and {@link filterAssetsForContext} route their
 * non-DM path through this helper so the single-asset check and the list
 * filter can never diverge again (M8): visibility, publish status AND the
 * secret/reveal rule are enforced identically. Secret fields are optional
 * and default to a fully exposable asset (`secretLevel: "none"`).
 */
function isAssetExposableToPlayers(
  asset: Pick<AssetAccessRecord, "visibility" | "publishStatus">,
  context: AccessContext,
  options?: PageAccessOptions,
): boolean {
  if (isDmOnlyVisibility(asset.visibility)) {
    return false;
  }

  if (!isPlayerPortalVisibility(asset.visibility)) {
    return false;
  }

  if (asset.publishStatus && !isPublishedForPortal(asset.publishStatus)) {
    return false;
  }

  if (!isPlayerExposableContent({
    visibility: asset.visibility,
    publishStatus: asset.publishStatus ?? "published",
  })) {
    return false;
  }

  return isPublicVisibilityAllowed(asset.visibility, context, options);
}

export function isAssetAccessible(
  asset: AssetAccessRecord,
  context: AccessContext,
  options?: PageAccessOptions,
): boolean {
  if (context === "share" && options?.shareGrant) {
    return options.shareGrant.sharedAssetIds.has(asset.id);
  }

  if (context === "dm") {
    return true;
  }

  return isAssetExposableToPlayers(asset, context, options);
}

export function filterAssetsForContext<
  T extends Pick<AssetAccessRecord, "visibility"> &
    Partial<Pick<AssetAccessRecord, "publishStatus">>,
>(
  assets: T[],
  context: AccessContext,
  options?: PageAccessOptions,
): T[] {
  if (context === "dm") {
    return assets;
  }

  return assets.filter((asset) => isAssetExposableToPlayers(asset, context, options));
}

export function shouldHidePageTitle(
  page: PageAccessRecord,
  context: AccessContext,
  options?: PageAccessOptions,
): boolean {
  return !isPageAccessible(page, context, options);
}
