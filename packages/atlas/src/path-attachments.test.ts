import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generatePathAttachments } from "./path-attachments";
import type { Coordinate, Path } from "./geometry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A straight horizontal path at y = 0.5. */
const HORIZONTAL_PATH: Path = {
  type: "Path",
  coordinates: [
    [0.1, 0.5],
    [0.9, 0.5],
  ],
};

/** The same horizontal path as a raw coordinate list. */
const HORIZONTAL_COORDS: Coordinate[] = [
  [0.1, 0.5],
  [0.9, 0.5],
];

// ---------------------------------------------------------------------------
// generatePathAttachments / edge cases
// ---------------------------------------------------------------------------

describe("generatePathAttachments / edge cases", () => {
  it("returns empty for a path with < 2 points", () => {
    const single: Path = { type: "Path", coordinates: [[0.5, 0.5]] };
    assert.equal(
      generatePathAttachments(single, { kind: "trees", spacing: 0.1 }).length,
      0,
    );
    assert.equal(
      generatePathAttachments([], { kind: "trees", spacing: 0.1 }).length,
      0,
    );
  });

  it("returns empty for spacing <= 0", () => {
    assert.equal(
      generatePathAttachments(HORIZONTAL_PATH, { kind: "trees", spacing: 0 }).length,
      0,
    );
    assert.equal(
      generatePathAttachments(HORIZONTAL_PATH, { kind: "trees", spacing: -0.1 })
        .length,
      0,
    );
  });

  it("accepts either a Path or a raw Coordinate[]", () => {
    const fromPath = generatePathAttachments(HORIZONTAL_PATH, {
      kind: "trees",
      spacing: 0.1,
      seed: 3,
    });
    const fromCoords = generatePathAttachments(HORIZONTAL_COORDS, {
      kind: "trees",
      spacing: 0.1,
      seed: 3,
    });
    assert.ok(fromPath.length > 0, "should produce placements");
    assert.deepEqual(fromCoords, fromPath, "Path and Coordinate[] inputs match");
  });
});

// ---------------------------------------------------------------------------
// generatePathAttachments / sides
// ---------------------------------------------------------------------------

describe("generatePathAttachments / sides", () => {
  it("side 'both' yields placements symmetric above and below the line", () => {
    const items = generatePathAttachments(HORIZONTAL_PATH, {
      kind: "trees",
      spacing: 0.1,
      side: "both",
      offset: 0.03,
      seed: 5,
    });
    assert.ok(items.length > 0, "should produce placements");

    const above = items.filter((p) => p.y > 0.5);
    const below = items.filter((p) => p.y < 0.5);
    assert.ok(above.length > 0, "should have a set above the line");
    assert.ok(below.length > 0, "should have a set below the line");
    assert.equal(above.length, below.length, "both sides equally populated");

    for (const p of items) {
      assert.ok(
        Math.abs(Math.abs(p.y - 0.5) - 0.03) < 1e-9,
        `offset magnitude should equal 0.03, got ${p.y}`,
      );
    }
  });

  it("'left' and 'right' populate opposite sides, ~half of 'both'", () => {
    const opts = { kind: "trees" as const, spacing: 0.1, offset: 0.03, seed: 11 };
    const both = generatePathAttachments(HORIZONTAL_PATH, { ...opts, side: "both" });
    const left = generatePathAttachments(HORIZONTAL_PATH, { ...opts, side: "left" });
    const right = generatePathAttachments(HORIZONTAL_PATH, { ...opts, side: "right" });

    assert.ok(left.length > 0 && right.length > 0, "both sides produce items");
    assert.equal(left.length, right.length, "left/right have equal counts");
    assert.equal(both.length, left.length + right.length, "both == left + right");
    assert.equal(left.length, both.length / 2, "left is half of both");

    const leftAbove = left.every((p) => p.y < 0.5);
    const rightAbove = right.every((p) => p.y > 0.5);
    assert.ok(leftAbove, "left side stays on one side of the line");
    assert.ok(rightAbove, "right side stays on the opposite side");
  });
});

// ---------------------------------------------------------------------------
// generatePathAttachments / spacing & kinds
// ---------------------------------------------------------------------------

describe("generatePathAttachments / spacing & kinds", () => {
  it("smaller spacing produces more placements", () => {
    const dense = generatePathAttachments(HORIZONTAL_PATH, {
      kind: "houses",
      spacing: 0.05,
      seed: 9,
    });
    const sparse = generatePathAttachments(HORIZONTAL_PATH, {
      kind: "houses",
      spacing: 0.2,
      seed: 9,
    });
    assert.ok(dense.length > sparse.length, "smaller spacing → more placements");
  });

  it("maps kinds to the expected builtin glyph keys", () => {
    const trees = generatePathAttachments(HORIZONTAL_PATH, { kind: "trees", spacing: 0.1 });
    const houses = generatePathAttachments(HORIZONTAL_PATH, { kind: "houses", spacing: 0.1 });
    const towers = generatePathAttachments(HORIZONTAL_PATH, { kind: "towers", spacing: 0.1 });

    assert.ok(trees.length > 0 && houses.length > 0 && towers.length > 0);
    assert.ok(trees.every((p) => p.glyphKey === "tree"), "trees → tree");
    assert.ok(houses.every((p) => p.glyphKey === "village"), "houses → village");
    assert.ok(towers.every((p) => p.glyphKey === "castle"), "towers → castle");
  });

  it("towers use a tighter rotation range than trees", () => {
    const towers = generatePathAttachments(HORIZONTAL_PATH, {
      kind: "towers",
      spacing: 0.05,
      seed: 21,
    });
    for (const p of towers) {
      assert.ok(Math.abs(p.rotation) <= 5.0001, `tower rotation ${p.rotation} > 5°`);
    }
    const trees = generatePathAttachments(HORIZONTAL_PATH, {
      kind: "trees",
      spacing: 0.05,
      seed: 21,
    });
    for (const p of trees) {
      assert.ok(Math.abs(p.rotation) <= 12.0001, `tree rotation ${p.rotation} > 12°`);
    }
  });

  it("scale jitter stays within [0.8, 1.2]", () => {
    const items = generatePathAttachments(HORIZONTAL_PATH, {
      kind: "trees",
      spacing: 0.05,
      seed: 33,
    });
    assert.ok(items.length > 0);
    for (const p of items) {
      assert.ok(p.scale >= 0.8 && p.scale <= 1.2, `scale ${p.scale} out of range`);
    }
  });
});

// ---------------------------------------------------------------------------
// generatePathAttachments / determinism & bounds
// ---------------------------------------------------------------------------

describe("generatePathAttachments / determinism & bounds", () => {
  it("is deterministic — same seed → deep-equal output", () => {
    const a = generatePathAttachments(HORIZONTAL_PATH, { kind: "trees", spacing: 0.07, seed: 42 });
    const b = generatePathAttachments(HORIZONTAL_PATH, { kind: "trees", spacing: 0.07, seed: 42 });
    assert.deepEqual(a, b);
  });

  it("different seeds produce different output", () => {
    const a = generatePathAttachments(HORIZONTAL_PATH, { kind: "trees", spacing: 0.07, seed: 1 });
    const b = generatePathAttachments(HORIZONTAL_PATH, { kind: "trees", spacing: 0.07, seed: 2 });
    assert.equal(a.length, b.length, "geometry-driven counts match");
    const identical = a.every(
      (p, i) => b[i] && p.x === b[i]!.x && p.scale === b[i]!.scale,
    );
    assert.equal(identical, false, "different seeds should differ");
  });

  it("clamps all coordinates to [0, 1]", () => {
    const diagonal: Path = {
      type: "Path",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    };
    const items = generatePathAttachments(diagonal, {
      kind: "houses",
      spacing: 0.03,
      offset: 0.05,
      side: "both",
      seed: 8,
    });
    assert.ok(items.length > 0);
    for (const p of items) {
      assert.ok(p.x >= 0 && p.x <= 1, `x ${p.x} out of [0,1]`);
      assert.ok(p.y >= 0 && p.y <= 1, `y ${p.y} out of [0,1]`);
    }
  });
});
