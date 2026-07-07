import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONTOUR_STEPS,
  DEFAULT_PARALLAX_STRENGTH,
  buildContourLines,
  buildHillshadeRGBA,
  cellElevation,
  elevationShadowOffset,
  hasElevation,
  normalizeContourSteps,
  normalizeElevationCells,
  normalizeParallaxStrength,
  parallaxCanvasOffset,
  sampleElevation,
  sampleElevationAlongPath,
  type ElevationGrid,
} from "./elevation";

/** 8×8 grid with a single peak (1.0) at cell (4,4) and a linear ramp around it. */
function peakGrid(): ElevationGrid {
  const elevation: Record<string, number> = {};
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const d = Math.max(Math.abs(c - 4), Math.abs(r - 4));
      const v = Math.max(0, 1 - d / 4);
      if (v > 0) elevation[`${c},${r}`] = v;
    }
  }
  return { cols: 8, rows: 8, elevation };
}

describe("cellElevation / hasElevation", () => {
  it("returns 0 for missing cells and grids without elevation", () => {
    assert.equal(cellElevation({ cols: 4, rows: 4 }, 1, 1), 0);
    assert.equal(cellElevation({ cols: 4, rows: 4, elevation: {} }, 1, 1), 0);
    assert.equal(hasElevation({ cols: 4, rows: 4 }), false);
    assert.equal(hasElevation({ cols: 4, rows: 4, elevation: { "1,1": 0 } }), false);
    assert.equal(hasElevation({ cols: 4, rows: 4, elevation: { "1,1": 0.5 } }), true);
  });

  it("clamps out-of-range indices to the edge and values to [0,1]", () => {
    const grid: ElevationGrid = { cols: 2, rows: 2, elevation: { "0,0": 2.5, "1,1": 0.5 } };
    assert.equal(cellElevation(grid, 0, 0), 1);
    assert.equal(cellElevation(grid, -3, -3), 1); // clamps to (0,0)
    assert.equal(cellElevation(grid, 5, 5), 0.5); // clamps to (1,1)
  });
});

describe("sampleElevation", () => {
  it("returns the cell value at a cell centre and interpolates between centres", () => {
    const grid: ElevationGrid = { cols: 4, rows: 1, elevation: { "1,0": 1 } };
    // Centre of cell 1 is nx = 1.5/4
    assert.ok(Math.abs(sampleElevation(grid, 1.5 / 4, 0.5) - 1) < 1e-9);
    // Halfway between centres of cell 1 (=1) and cell 2 (=0) → 0.5
    assert.ok(Math.abs(sampleElevation(grid, 2 / 4, 0.5) - 0.5) < 1e-9);
    assert.equal(sampleElevation({ cols: 4, rows: 1 }, 0.5, 0.5), 0);
  });

  it("samples along a path per vertex", () => {
    const grid = peakGrid();
    const heights = sampleElevationAlongPath(grid, [
      [4.5 / 8, 4.5 / 8], // peak centre
      [0.5 / 8, 0.5 / 8], // far corner
    ]);
    assert.equal(heights.length, 2);
    assert.ok(heights[0]! > 0.9);
    assert.ok(heights[1]! < 0.1);
  });
});

describe("buildHillshadeRGBA", () => {
  it("is fully transparent for flat terrain", () => {
    const rgba = buildHillshadeRGBA({ cols: 4, rows: 4, elevation: {} });
    assert.equal(rgba.length, 4 * 4 * 4);
    assert.ok(rgba.every((v) => v === 0));
  });

  it("lights NW-facing slopes and shades SE-facing slopes (fixed NW light)", () => {
    const grid = peakGrid();
    const rgba = buildHillshadeRGBA(grid);
    const alphaAt = (c: number, r: number) => rgba[(r * 8 + c) * 4 + 3]!;
    const redAt = (c: number, r: number) => rgba[(r * 8 + c) * 4]!;
    // NW of the peak: slope faces NW → highlight (bright colour)
    assert.ok(alphaAt(2, 2) > 0, "NW slope should have an overlay");
    assert.ok(redAt(2, 2) > 200, "NW slope should be a highlight");
    // SE of the peak: slope faces SE → shadow (dark colour)
    assert.ok(alphaAt(6, 6) > 0, "SE slope should have an overlay");
    assert.ok(redAt(6, 6) < 100, "SE slope should be a shadow");
  });
});

describe("buildContourLines", () => {
  it("returns no lines without elevation", () => {
    assert.deepEqual(buildContourLines({ cols: 8, rows: 8 }), []);
    assert.deepEqual(buildContourLines({ cols: 8, rows: 8, elevation: {} }), []);
  });

  it("produces closed rings around a single peak with points inside [0,1]", () => {
    const lines = buildContourLines(peakGrid(), 4);
    assert.ok(lines.length >= 3, `expected ≥3 isolines, got ${lines.length}`);
    for (const line of lines) {
      assert.ok(line.level > 0 && line.level < 1);
      assert.ok(line.points.length >= 3);
      for (const [x, y] of line.points) {
        assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
      }
      // Rings around a peak close on themselves.
      const first = line.points[0]!;
      const last = line.points[line.points.length - 1]!;
      assert.ok(Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6);
    }
    // Higher levels form smaller rings (bbox width shrinks).
    const bboxW = (pts: [number, number][]) =>
      Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const low = lines.find((l) => l.level === 0.25)!;
    const high = lines.find((l) => l.level === 0.75)!;
    assert.ok(bboxW(low.points) > bboxW(high.points));
  });

  it("is deterministic", () => {
    const a = buildContourLines(peakGrid(), 5);
    const b = buildContourLines(peakGrid(), 5);
    assert.deepEqual(a, b);
  });
});

describe("parallaxCanvasOffset / elevationShadowOffset", () => {
  it("returns zero at zero elevation or zero strength", () => {
    assert.deepEqual(parallaxCanvasOffset(0, 100, 100, 0, 0, 1), [0, 0]);
    assert.deepEqual(parallaxCanvasOffset(1, 100, 100, 0, 0, 0), [0, 0]);
  });

  it("shifts content away from the viewport centre, scaling with elevation", () => {
    const [dx] = parallaxCanvasOffset(1, 500, 300, 300, 300, 1);
    assert.ok(dx > 0, "content right of centre shifts further right");
    const [dxHalf] = parallaxCanvasOffset(0.5, 500, 300, 300, 300, 1);
    assert.ok(Math.abs(dxHalf * 2 - dx) < 1e-9, "offset is linear in elevation");
    const [dxLeft] = parallaxCanvasOffset(1, 100, 300, 300, 300, 1);
    assert.ok(dxLeft < 0, "content left of centre shifts further left");
    assert.deepEqual(parallaxCanvasOffset(1, 300, 300, 300, 300, 1), [0, 0]);
  });

  it("casts shadows towards the southeast (light fixed NW)", () => {
    const [sx, sy] = elevationShadowOffset(1, 2);
    assert.ok(sx > 0 && sy > 0);
    assert.deepEqual(elevationShadowOffset(0, 2), [0, 0]);
  });
});

describe("normalisation helpers", () => {
  it("normalizeElevationCells keeps only valid sparse entries", () => {
    assert.equal(normalizeElevationCells(undefined), undefined);
    assert.equal(normalizeElevationCells([1, 2]), undefined);
    assert.equal(normalizeElevationCells({ "1,1": 0, "bad": 0.5, "2,2": NaN }), undefined);
    assert.deepEqual(normalizeElevationCells({ "1,1": 0.5, "2,2": 7 }), { "1,1": 0.5, "2,2": 1 });
  });

  it("normalizeParallaxStrength / normalizeContourSteps clamp with defaults", () => {
    assert.equal(normalizeParallaxStrength(undefined), DEFAULT_PARALLAX_STRENGTH);
    assert.equal(normalizeParallaxStrength(-1), 0);
    assert.equal(normalizeParallaxStrength(2), 1);
    assert.equal(normalizeContourSteps("x"), DEFAULT_CONTOUR_STEPS);
    assert.equal(normalizeContourSteps(1), 2);
    assert.equal(normalizeContourSteps(99), 24);
    assert.equal(normalizeContourSteps(7.4), 7);
  });
});
