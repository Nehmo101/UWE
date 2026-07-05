import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GOUACHE_ASSETS,
  GOUACHE_ASSET_KEYS,
  GOUACHE_CATEGORY_LABELS,
  getGouacheAsset,
  listGouacheAssetsByCategory,
  isGouacheAsset,
} from "./assets";

describe("gouache asset registry", () => {
  it("has unique, non-empty keys and names", () => {
    const keys = new Set<string>();
    for (const a of GOUACHE_ASSETS) {
      assert.ok(a.key.length > 0, "key non-empty");
      assert.ok(a.name.length > 0, `name non-empty for ${a.key}`);
      assert.ok(!keys.has(a.key), `duplicate key ${a.key}`);
      keys.add(a.key);
    }
    assert.equal(GOUACHE_ASSET_KEYS.length, GOUACHE_ASSETS.length);
  });

  it("uses only known categories, each with a label", () => {
    for (const a of GOUACHE_ASSETS) {
      assert.ok(a.category in GOUACHE_CATEGORY_LABELS, `label for ${a.category}`);
    }
  });

  it("looks up assets by key and reports renderable keys", () => {
    for (const a of GOUACHE_ASSETS) {
      assert.equal(getGouacheAsset(a.key)?.name, a.name);
      assert.ok(isGouacheAsset(a.key), `${a.key} is renderable`);
    }
    assert.equal(getGouacheAsset("nope"), undefined);
    assert.equal(getGouacheAsset(null), undefined);
    assert.equal(isGouacheAsset("nope"), false);
  });

  it("groups by category consistently", () => {
    let total = 0;
    for (const cat of Object.keys(GOUACHE_CATEGORY_LABELS) as Array<
      keyof typeof GOUACHE_CATEGORY_LABELS
    >) {
      const list = listGouacheAssetsByCategory(cat);
      for (const a of list) assert.equal(a.category, cat);
      total += list.length;
    }
    assert.equal(total, GOUACHE_ASSETS.length, "every asset in exactly one category");
  });
});
