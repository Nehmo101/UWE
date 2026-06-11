import type { AssetVisibility } from "./types";

/** Asset visibilities exposed to the legacy player portal filter. */
export const PORTAL_ASSET_VISIBILITIES: AssetVisibility[] = ["public", "player_visible"];

export type AssetAccessContext = "dm" | "portal" | "preview";

export function isPortalAssetVisibility(visibility: AssetVisibility): boolean {
  return PORTAL_ASSET_VISIBILITIES.includes(visibility);
}

export function isAssetAccessible(
  asset: Pick<{ visibility: AssetVisibility }, "visibility">,
  context: AssetAccessContext,
): boolean {
  if (context === "dm") {
    return true;
  }

  return isPortalAssetVisibility(asset.visibility);
}

export function filterAssetsForContext<T extends Pick<{ visibility: AssetVisibility }, "visibility">>(
  assets: T[],
  context: AssetAccessContext,
): T[] {
  if (context === "dm") {
    return assets;
  }

  return assets.filter((asset) => isPortalAssetVisibility(asset.visibility));
}
