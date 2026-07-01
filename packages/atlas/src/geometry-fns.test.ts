import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LabelAnchor, Path, Point, Polygon } from "./geometry";
import {
  canvasToWorld,
  centroid,
  distToSegment,
  pointInPolygon,
  translateGeometry,
  worldToCanvas,
} from "./geometry";

describe("worldToCanvas / canvasToWorld", () => {
  it("projects a normalised point to canvas pixels", () => {
    assert.deepEqual(worldToCanvas(0.5, 0.5, 0, 0, 1, 100, 100), [50, 50]);
    assert.deepEqual(worldToCanvas(0, 0, 10, 20, 2, 100, 100), [10, 20]);
  });

  it("inverts back to the same normalised coordinate", () => {
    const [cx, cy] = worldToCanvas(0.4, 0.7, 15, -8, 1.5, 200, 120);
    const [nx, ny] = canvasToWorld(cx, cy, 15, -8, 1.5, 200, 120);
    assert.ok(Math.abs(nx - 0.4) < 1e-9);
    assert.ok(Math.abs(ny - 0.7) < 1e-9);
  });

  it("clamps to [0, 1]", () => {
    assert.deepEqual(canvasToWorld(-500, 5000, 0, 0, 1, 100, 100), [0, 1]);
  });
});

describe("pointInPolygon", () => {
  const square: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  it("detects an interior point", () => {
    assert.equal(pointInPolygon([0.5, 0.5], square), true);
  });
  it("rejects an exterior point", () => {
    assert.equal(pointInPolygon([1.5, 0.5], square), false);
    assert.equal(pointInPolygon([-0.1, 0.5], square), false);
  });
});

describe("distToSegment", () => {
  it("returns the perpendicular distance to a segment", () => {
    assert.equal(distToSegment([0, 1], [0, 0], [2, 0]), 1);
  });
  it("clamps to the nearest endpoint past the segment ends", () => {
    assert.equal(distToSegment([-1, 0], [0, 0], [2, 0]), 1);
  });
  it("handles a degenerate (zero-length) segment", () => {
    assert.equal(distToSegment([3, 4], [0, 0], [0, 0]), 5);
  });
});

describe("centroid", () => {
  it("averages a ring's vertices", () => {
    assert.deepEqual(centroid([[0, 0], [2, 0], [2, 2], [0, 2]]), [1, 1]);
  });
  it("falls back to the canvas centre for an empty ring", () => {
    assert.deepEqual(centroid([]), [0.5, 0.5]);
  });
});

describe("translateGeometry", () => {
  it("shifts a Point without mutating the original", () => {
    // Use exact binary fractions (multiples of 0.25) to avoid float noise.
    const p: Point = { type: "Point", coordinates: [0.25, 0.5] };
    const moved = translateGeometry(p, 0.25, 0.25) as Point;
    assert.deepEqual(moved.coordinates, [0.5, 0.75]);
    assert.deepEqual(p.coordinates, [0.25, 0.5], "original must be untouched");
  });

  it("shifts every coordinate of a Path", () => {
    const path: Path = { type: "Path", coordinates: [[0, 0], [1, 1]] };
    const moved = translateGeometry(path, 1, 2) as Path;
    assert.deepEqual(moved.coordinates, [[1, 2], [2, 3]]);
  });

  it("shifts every ring of a Polygon", () => {
    const poly: Polygon = { type: "Polygon", rings: [[[0, 0], [1, 0], [1, 1]]] };
    const moved = translateGeometry(poly, 0.5, 0.5) as Polygon;
    assert.deepEqual(moved.rings, [[[0.5, 0.5], [1.5, 0.5], [1.5, 1.5]]]);
  });

  it("shifts a LabelAnchor's anchor and pathCoordinates", () => {
    const label: LabelAnchor = {
      type: "LabelAnchor",
      coordinates: [0.25, 0.25],
      text: "Region",
      pathCoordinates: [[0, 0], [0.5, 0.5]],
    };
    const moved = translateGeometry(label, 0.25, 0.25) as LabelAnchor;
    assert.deepEqual(moved.coordinates, [0.5, 0.5]);
    assert.deepEqual(moved.pathCoordinates, [[0.25, 0.25], [0.75, 0.75]]);
  });
});
