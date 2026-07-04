import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectSubtreeNodeIds } from "./atlas-node-subtree";

describe("collectSubtreeNodeIds", () => {
  it("returns just the root for a leaf node", () => {
    const nodes = [
      { id: "root", parentId: null },
      { id: "sibling", parentId: null },
    ];
    assert.deepEqual(collectSubtreeNodeIds("root", nodes), ["root"]);
  });

  it("collects the root plus every descendant, parent before child", () => {
    const nodes = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "a" },
      { id: "d", parentId: "b" },
      { id: "other", parentId: null },
    ];
    const ids = collectSubtreeNodeIds("a", nodes);
    assert.deepEqual(new Set(ids), new Set(["a", "b", "c", "d"]));
    // Parents always precede their children in BFS order.
    assert.ok(ids.indexOf("a") < ids.indexOf("b"));
    assert.ok(ids.indexOf("b") < ids.indexOf("d"));
    // A sibling subtree is never included.
    assert.ok(!ids.includes("other"));
  });

  it("returns an empty array when the root is absent", () => {
    const nodes = [{ id: "a", parentId: null }];
    assert.deepEqual(collectSubtreeNodeIds("missing", nodes), []);
  });

  it("does not loop forever on a cycle in the parent links", () => {
    // Malformed data: a ↔ b reference each other as parents.
    const nodes = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    const ids = collectSubtreeNodeIds("a", nodes);
    assert.deepEqual(new Set(ids), new Set(["a", "b"]));
    assert.equal(ids.length, 2);
  });
});
