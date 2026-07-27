import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterAssetsForContext,
  isAssetAccessible,
  type AccessContext,
  type AssetAccessRecord,
} from "./permissions";

/**
 * M8 regression guard.
 *
 * `filterAssetsForContext` (the list path) previously filtered non-DM contexts
 * by VISIBILITY ONLY, while its sibling `isAssetAccessible` (the single-asset
 * check) also rejected unrevealed secrets via the secret/reveal rule. A
 * `player_visible` asset marked `dm_secret` + `hidden` therefore passed the
 * list filter but failed the single check — a leak surface if a portal/share
 * caller ever used the list path.
 *
 * Both functions now route their non-DM path through the same
 * `isAssetExposableToPlayers` helper, so the two can never diverge again.
 */

const NON_DM_CONTEXTS: AccessContext[] = ["portal", "preview", "share"];

/** Never reaches players. */
const dmOnlyAsset: AssetAccessRecord = {
  id: "asset-dm-only",
  visibility: "dm_only",
};

/** Fully player-exposable asset. */
const exposableAsset: AssetAccessRecord = {
  id: "asset-exposable",
  visibility: "player_visible",
};

describe("asset permissions: filterAssetsForContext mirrors isAssetAccessible (M8)", () => {
  for (const context of NON_DM_CONTEXTS) {
    it(`excludes a dm_only asset in "${context}"`, () => {
      // single-asset check rejects it
      assert.equal(isAssetAccessible(dmOnlyAsset, context), false);
      // list filter agrees: no metadata leak through the list path
      assert.deepEqual(filterAssetsForContext([dmOnlyAsset], context), []);
    });

    it(`includes a fully player-exposable asset in "${context}"`, () => {
      assert.equal(isAssetAccessible(exposableAsset, context), true);
      assert.deepEqual(filterAssetsForContext([exposableAsset], context), [
        exposableAsset,
      ]);
    });

    it(`list filter agrees with the single check element-by-element in "${context}"`, () => {
      const assets = [dmOnlyAsset, exposableAsset];
      const filtered = filterAssetsForContext(assets, context);
      const expected = assets.filter((asset) => isAssetAccessible(asset, context));
      assert.deepEqual(filtered, expected);
      assert.deepEqual(filtered, [exposableAsset]);
    });
  }

  it("DM sees dm_only assets; players never do — via either path", () => {
    assert.equal(isAssetAccessible(dmOnlyAsset, "dm"), true);
    assert.deepEqual(filterAssetsForContext([dmOnlyAsset], "dm"), [dmOnlyAsset]);
    assert.equal(isAssetAccessible(dmOnlyAsset, "portal"), false);
    assert.deepEqual(filterAssetsForContext([dmOnlyAsset], "portal"), []);
  });

  it("a player_visible asset is exposable to players", () => {
    const plain: Pick<AssetAccessRecord, "id" | "visibility"> = {
      id: "asset-plain",
      visibility: "player_visible",
    };
    assert.equal(isAssetAccessible(plain, "portal"), true);
    assert.deepEqual(filterAssetsForContext([plain], "portal"), [plain]);
  });
});
