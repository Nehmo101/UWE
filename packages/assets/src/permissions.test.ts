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
 * `filterAssetsForContext` now routes through `isAssetAccessible`, and the
 * single check enforces the unrevealed-secret rule, so the list filter and the
 * single-asset check can never diverge.
 */

const NON_DM_CONTEXTS: AssetAccessContext[] = ["portal", "preview"];

const hiddenSecretAsset: AssetAccessInput = {
  visibility: "player_visible",
  secretLevel: "dm_secret",
  revealState: "hidden",
};

const exposableAsset: AssetAccessInput = {
  visibility: "player_visible",
};

describe("assets permissions: filterAssetsForContext mirrors isAssetAccessible (M8)", () => {
  for (const context of NON_DM_CONTEXTS) {
    it(`excludes an unrevealed dm_secret player_visible asset in "${context}"`, () => {
      assert.equal(isAssetAccessible(hiddenSecretAsset, context), false);
      assert.deepEqual(filterAssetsForContext([hiddenSecretAsset], context), []);
    });

    it(`includes a fully player-exposable asset in "${context}"`, () => {
      assert.equal(isAssetAccessible(exposableAsset, context), true);
      assert.deepEqual(filterAssetsForContext([exposableAsset], context), [
        exposableAsset,
      ]);
    });
  }

  it("DM context sees the hidden-secret asset via both paths", () => {
    assert.equal(isAssetAccessible(hiddenSecretAsset, "dm"), true);
    assert.deepEqual(filterAssetsForContext([hiddenSecretAsset], "dm"), [
      hiddenSecretAsset,
    ]);
  });

  it("a REVEALED dm_secret asset is exposable; a dm_only asset never is", () => {
    const revealed: AssetAccessInput = {
      visibility: "player_visible",
      secretLevel: "dm_secret",
      revealState: "revealed",
    };
    assert.equal(isAssetAccessible(revealed, "portal"), true);
    assert.deepEqual(filterAssetsForContext([revealed], "portal"), [revealed]);

    const dmOnly: AssetAccessInput = { visibility: "dm_only" };
    assert.equal(isAssetAccessible(dmOnly, "portal"), false);
    assert.deepEqual(filterAssetsForContext([dmOnly], "portal"), []);
  });
});
