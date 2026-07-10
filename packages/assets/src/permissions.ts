import type { AssetVisibility } from "./types";
import {
  isDmOnlyVisibility,
  isPlayerPortalVisibility,
  isSecretVisibleToPlayer,
  type RevealState,
  type SecretLevel,
} from "@uwe/auth/content-access";

/** Asset visibilities exposed to the legacy player portal filter. */
export const PORTAL_ASSET_VISIBILITIES: AssetVisibility[] = ["public", "player_visible"];

export type AssetAccessContext = "dm" | "portal" | "preview";

/**
 * Minimal asset shape the access checks read. `secretLevel`/`revealState` are
 * optional and default to a fully exposable asset (`secretLevel: "none"`,
 * `revealState: "hidden"`), so existing callers that pass only `visibility`
 * keep their behavior while callers that carry secret metadata get the
 * unrevealed-secret rule enforced.
 */
export type AssetAccessInput = {
  visibility: AssetVisibility;
  secretLevel?: SecretLevel | null;
  revealState?: RevealState | null;
};

export function isPortalAssetVisibility(visibility: AssetVisibility): boolean {
  return isPlayerPortalVisibility(visibility);
}

export function isAssetAccessible(
  asset: AssetAccessInput,
  context: AssetAccessContext,
): boolean {
  if (context === "dm") {
    return true;
  }

  if (isDmOnlyVisibility(asset.visibility)) {
    return false;
  }

  if (!isPortalAssetVisibility(asset.visibility)) {
    return false;
  }

  return isSecretVisibleToPlayer(asset);
}

export function filterAssetsForContext<T extends AssetAccessInput>(
  assets: T[],
  context: AssetAccessContext,
): T[] {
  if (context === "dm") {
    return assets;
  }

  return assets.filter((asset) => isAssetAccessible(asset, context));
}
