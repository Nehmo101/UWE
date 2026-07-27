import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GOUACHE_ASSETS, GOUACHE_CATEGORY_LABELS } from "./gouache-registry";

/**
 * Temporary drift guard for the window in which two copies of the Gouache
 * registry metadata exist: the canonical one here and the original inside the
 * (retiring, frozen) `@uwe/atlas` package.
 *
 * The import is dynamic and the test skips itself when `@uwe/atlas` is gone, so
 * deleting the package does not leave a red test behind — this whole file can
 * then be removed together with the `@uwe/atlas` dependency in
 * `packages/ai-brain/package.json`.
 */
type AtlasAssetsModule = {
  GOUACHE_ASSETS: readonly { key: string; name: string; category: string }[];
  GOUACHE_CATEGORY_LABELS: Record<string, string>;
};

async function loadRetiredAtlasRegistry(): Promise<AtlasAssetsModule | null> {
  try {
    return (await import("@uwe/atlas/assets")) as unknown as AtlasAssetsModule;
  } catch {
    return null;
  }
}

describe("gouache registry vs. the retiring @uwe/atlas copy", () => {
  it("matches key, name, category and order exactly", async (t) => {
    const atlas = await loadRetiredAtlasRegistry();
    if (!atlas) {
      t.skip("@uwe/atlas is gone — this guard has served its purpose");
      return;
    }

    assert.deepEqual(
      GOUACHE_ASSETS.map((asset) => [asset.key, asset.name, asset.category]),
      atlas.GOUACHE_ASSETS.map((asset) => [asset.key, asset.name, asset.category]),
    );
    assert.deepEqual(GOUACHE_CATEGORY_LABELS, atlas.GOUACHE_CATEGORY_LABELS);
  });
});
