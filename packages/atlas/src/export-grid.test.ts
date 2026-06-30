import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGridLines } from "./export-grid";
import type { ExportRect, GridLine, GridSpec } from "./export-grid";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Allowed slop when asserting an endpoint lies within the rect bounds. */
const EPS = 1e-6;

/** Assert every endpoint of every line lies within the rect (inclusive ± eps). */
function assertWithinRect(
  lines: GridLine[],
  rect: ExportRect,
  eps = EPS,
): void {
  const minX = rect.x;
  const minY = rect.y;
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;
  for (const line of lines) {
    for (const [px, py] of [
      [line.x1, line.y1],
      [line.x2, line.y2],
    ] as const) {
      assert.ok(px >= minX - eps && px <= maxX + eps, `x ${px} out of [${minX},${maxX}]`);
      assert.ok(py >= minY - eps && py <= maxY + eps, `y ${py} out of [${minY},${maxY}]`);
    }
  }
}

// ---------------------------------------------------------------------------
// Edge cases / guards
// ---------------------------------------------------------------------------

describe("buildGridLines / guards", () => {
  const rect: ExportRect = { x: 0, y: 0, width: 100, height: 100 };

  it("returns [] when cellSize is zero", () => {
    assert.deepEqual(buildGridLines(rect, { kind: "square", cellSize: 0 }), []);
    assert.deepEqual(buildGridLines(rect, { kind: "hex", cellSize: 0 }), []);
  });

  it("returns [] when cellSize is negative", () => {
    assert.deepEqual(buildGridLines(rect, { kind: "square", cellSize: -5 }), []);
    assert.deepEqual(buildGridLines(rect, { kind: "hex", cellSize: -5 }), []);
  });

  it("returns [] when width is zero or negative", () => {
    const spec: GridSpec = { kind: "square", cellSize: 10 };
    assert.deepEqual(buildGridLines({ x: 0, y: 0, width: 0, height: 100 }, spec), []);
    assert.deepEqual(buildGridLines({ x: 0, y: 0, width: -10, height: 100 }, spec), []);
  });

  it("returns [] when height is zero or negative", () => {
    const spec: GridSpec = { kind: "square", cellSize: 10 };
    assert.deepEqual(buildGridLines({ x: 0, y: 0, width: 100, height: 0 }, spec), []);
    assert.deepEqual(buildGridLines({ x: 0, y: 0, width: 100, height: -10 }, spec), []);
  });
});

// ---------------------------------------------------------------------------
// Square grid
// ---------------------------------------------------------------------------

describe("buildGridLines / square", () => {
  it("produces 5 vertical and 5 horizontal lines on a 100×100 rect, cellSize 25", () => {
    const rect: ExportRect = { x: 0, y: 0, width: 100, height: 100 };
    const lines = buildGridLines(rect, { kind: "square", cellSize: 25 });

    const vertical = lines.filter((l) => l.x1 === l.x2);
    const horizontal = lines.filter((l) => l.y1 === l.y2);

    assert.equal(vertical.length, 5, "expected vertical lines at x=0,25,50,75,100");
    assert.equal(horizontal.length, 5, "expected horizontal lines at y=0,25,50,75,100");

    const verticalXs = vertical.map((l) => l.x1).sort((a, b) => a - b);
    assert.deepEqual(verticalXs, [0, 25, 50, 75, 100]);

    const horizontalYs = horizontal.map((l) => l.y1).sort((a, b) => a - b);
    assert.deepEqual(horizontalYs, [0, 25, 50, 75, 100]);

    assertWithinRect(lines, rect);
  });

  it("vertical lines span full height, horizontal lines span full width", () => {
    const rect: ExportRect = { x: 0, y: 0, width: 100, height: 100 };
    const lines = buildGridLines(rect, { kind: "square", cellSize: 25 });
    for (const l of lines.filter((ln) => ln.x1 === ln.x2)) {
      assert.equal(l.y1, 0);
      assert.equal(l.y2, 100);
    }
    for (const l of lines.filter((ln) => ln.y1 === ln.y2)) {
      assert.equal(l.x1, 0);
      assert.equal(l.x2, 100);
    }
  });

  it("keeps every endpoint within bounds for a non-origin rect", () => {
    const rect: ExportRect = { x: 10, y: 20, width: 80, height: 60 };
    const lines = buildGridLines(rect, { kind: "square", cellSize: 25 });
    assert.ok(lines.length > 0, "should produce lines");
    assertWithinRect(lines, rect);
  });
});

// ---------------------------------------------------------------------------
// Hex grid
// ---------------------------------------------------------------------------

describe("buildGridLines / hex", () => {
  it("returns a non-empty set of lines for a 200×200 rect, cellSize 20", () => {
    const rect: ExportRect = { x: 0, y: 0, width: 200, height: 200 };
    const lines = buildGridLines(rect, { kind: "hex", cellSize: 20 });
    assert.ok(lines.length > 0, "hex grid should produce line segments");
  });

  it("keeps every endpoint within bounds (epsilon 1e-6)", () => {
    const rect: ExportRect = { x: 0, y: 0, width: 200, height: 200 };
    const lines = buildGridLines(rect, { kind: "hex", cellSize: 20 });
    assertWithinRect(lines, rect, 1e-6);
  });

  it("keeps endpoints within bounds for a non-origin rect", () => {
    const rect: ExportRect = { x: 15, y: 25, width: 180, height: 140 };
    const lines = buildGridLines(rect, { kind: "hex", cellSize: 18 });
    assert.ok(lines.length > 0, "should produce lines");
    assertWithinRect(lines, rect, 1e-6);
  });

  it("emits no zero-length segments", () => {
    const rect: ExportRect = { x: 0, y: 0, width: 200, height: 200 };
    const lines = buildGridLines(rect, { kind: "hex", cellSize: 20 });
    for (const l of lines) {
      assert.ok(l.x1 !== l.x2 || l.y1 !== l.y2, "no zero-length segment expected");
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("buildGridLines / determinism", () => {
  it("square: two calls deep-equal", () => {
    const rect: ExportRect = { x: 5, y: 7, width: 120, height: 90 };
    const spec: GridSpec = { kind: "square", cellSize: 15 };
    assert.deepEqual(buildGridLines(rect, spec), buildGridLines(rect, spec));
  });

  it("hex: two calls deep-equal", () => {
    const rect: ExportRect = { x: 5, y: 7, width: 220, height: 180 };
    const spec: GridSpec = { kind: "hex", cellSize: 22 };
    assert.deepEqual(buildGridLines(rect, spec), buildGridLines(rect, spec));
  });
});
