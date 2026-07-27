import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterAssetsForContext,
  isAssetAccessible,
  type AssetAccessContext,
  type AssetAccessInput,
} from "./permissions";

/**
 * M8 regression guard (assets-package copy).
 *
 * `filterAssetsForContext` routes through `isAssetAccessible`, so the list
 * filter and the single-asset check can never disagree. The cases used to turn
 * on secret level and reveal state; those were removed, so what remains to pin
 * is the visibility rule itself — and the invariant that both entry points
 * answer it identically.
 */

const NON_DM_CONTEXTS: AssetAccessContext[] = ["portal", "preview"];

const dmOnlyAsset: AssetAccessInput = { visibility: "dm_only" };
const exposableAsset: AssetAccessInput = { visibility: "player_visible" };

describe("assets permissions: filterAssetsForContext mirrors isAssetAccessible (M8)", () => {
  for (const context of NON_DM_CONTEXTS) {
    it(`excludes a dm_only asset in "${context}" via both paths`, () => {
      assert.equal(isAssetAccessible(dmOnlyAsset, context), false);
      assert.deepEqual(filterAssetsForContext([dmOnlyAsset], context), []);
    });

    it(`includes a player-exposable asset in "${context}" via both paths`, () => {
      assert.equal(isAssetAccessible(exposableAsset, context), true);
      assert.deepEqual(filterAssetsForContext([exposableAsset], context), [exposableAsset]);
    });
  }

  it("DM context sees the dm_only asset via both paths", () => {
    assert.equal(isAssetAccessible(dmOnlyAsset, "dm"), true);
    assert.deepEqual(filterAssetsForContext([dmOnlyAsset], "dm"), [dmOnlyAsset]);
  });

  it("filters a mixed list identically to checking each asset on its own", () => {
    const mixed = [exposableAsset, dmOnlyAsset];
    for (const context of NON_DM_CONTEXTS) {
      const filtered = filterAssetsForContext(mixed, context);
      const individually = mixed.filter((asset) => isAssetAccessible(asset, context));
      assert.deepEqual(filtered, individually, `both paths must agree in "${context}"`);
    }
  });
});
