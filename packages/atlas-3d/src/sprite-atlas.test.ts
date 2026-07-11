import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SpriteAtlasAllocator } from "./sprite-atlas";

describe("sprite atlas allocator", () => {
  it("allocates stable slots and reuses released capacity", () => {
    const atlas = new SpriteAtlasAllocator(2, 1);
    assert.deepEqual(atlas.allocate("tree"), { index: 0, column: 0, row: 0, u: 0, v: 0, width: 0.5, height: 1 });
    assert.equal(atlas.allocate("tree")?.index, 0);
    assert.equal(atlas.allocate("tower")?.index, 1);
    assert.equal(atlas.allocate("house"), null);
    assert.equal(atlas.release("tree"), true);
    assert.equal(atlas.allocate("house")?.index, 0);
  });
});
