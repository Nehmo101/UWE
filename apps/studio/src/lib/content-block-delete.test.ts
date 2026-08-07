import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideContentBlockDelete } from "./content-block-delete";

describe("decideContentBlockDelete", () => {
  it("treats a repeated deletion as a successful no-op", () => {
    assert.equal(decideContentBlockDelete(null, "world-1"), "already_deleted");
  });

  it("allows a block from the requested world", () => {
    assert.equal(decideContentBlockDelete("world-1", "world-1"), "delete");
  });

  it("does not expose a block from another world", () => {
    assert.equal(decideContentBlockDelete("world-2", "world-1"), "not_found");
  });
});
