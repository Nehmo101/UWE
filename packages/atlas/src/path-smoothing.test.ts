import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { smoothPath, sampleTaperedWidths } from "./path-smoothing";
import type { Coordinate } from "./geometry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPSILON = 1e-9;

/** Assert two coordinates are equal within a small epsilon. */
function assertCoordClose(
  actual: Coordinate,
  expected: Coordinate,
  msg?: string,
): void {
  assert.ok(
    Math.abs(actual[0] - expected[0]) <= EPSILON &&
      Math.abs(actual[1] - expected[1]) <= EPSILON,
    msg ?? `expected ${actual} ≈ ${expected}`,
  );
}

/** Compute the bounding box [minX, minY, maxX, maxY] of a coordinate list. */
function bboxOf(coords: Coordinate[]): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** An S-shaped open polyline. */
const S_PATH: Coordinate[] = [
  [0.1, 0.5],
  [0.3, 0.2],
  [0.6, 0.8],
  [0.9, 0.4],
];

/** A square closed loop. */
const SQUARE_LOOP: Coordinate[] = [
  [0.2, 0.2],
  [0.8, 0.2],
  [0.8, 0.8],
  [0.2, 0.8],
];

// ---------------------------------------------------------------------------
// smoothPath / degenerate input
// ---------------------------------------------------------------------------

describe("smoothPath / fewer than 3 points", () => {
  it("returns a copy of a 2-point path unchanged", () => {
    const input: Coordinate[] = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    const out = smoothPath(input);
    assert.deepEqual(out, input);
  });

  it("does not return the same array reference", () => {
    const input: Coordinate[] = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    const out = smoothPath(input);
    assert.notEqual(out, input, "must be a shallow copy, not the same reference");
  });

  it("returns a copy of a single-point path", () => {
    const input: Coordinate[] = [[0.5, 0.5]];
    const out = smoothPath(input);
    assert.deepEqual(out, input);
    assert.notEqual(out, input);
  });

  it("returns an empty array for empty input", () => {
    assert.deepEqual(smoothPath([]), []);
  });
});

// ---------------------------------------------------------------------------
// smoothPath / endpoint preservation
// ---------------------------------------------------------------------------

describe("smoothPath / endpoints", () => {
  it("open path starts at the first input coordinate", () => {
    const out = smoothPath(S_PATH);
    assertCoordClose(out[0]!, S_PATH[0]!);
  });

  it("open path ends at the last input coordinate", () => {
    const out = smoothPath(S_PATH);
    assertCoordClose(out[out.length - 1]!, S_PATH[S_PATH.length - 1]!);
  });

  it("interpolates the original interior vertices", () => {
    // With the default 8 segments, vertex k lands at output index k*8.
    const segments = 8;
    const out = smoothPath(S_PATH, { segments });
    for (let k = 0; k < S_PATH.length; k++) {
      assertCoordClose(out[k * segments]!, S_PATH[k]!, `vertex ${k} preserved`);
    }
  });
});

// ---------------------------------------------------------------------------
// smoothPath / subdivision behaviour
// ---------------------------------------------------------------------------

describe("smoothPath / segments", () => {
  it("produces more points as segment count increases", () => {
    const coarse = smoothPath(S_PATH, { segments: 2 });
    const fine = smoothPath(S_PATH, { segments: 16 });
    assert.ok(
      fine.length > coarse.length,
      `expected more points for finer subdivision (${fine.length} > ${coarse.length})`,
    );
  });

  it("an open path with default segments has the expected length", () => {
    // n-1 segments × segments points + 1 leading vertex.
    const segments = 8;
    const out = smoothPath(S_PATH, { segments });
    assert.equal(out.length, (S_PATH.length - 1) * segments + 1);
  });

  it("clamps segments below 1 up to 1", () => {
    const out = smoothPath(S_PATH, { segments: 0 });
    // 1 segment per span → (n-1) + 1 = n points (the original vertices).
    assert.equal(out.length, S_PATH.length);
  });

  it("clamps very large segment counts to 64", () => {
    const out = smoothPath(S_PATH, { segments: 10_000 });
    assert.equal(out.length, (S_PATH.length - 1) * 64 + 1);
  });
});

// ---------------------------------------------------------------------------
// smoothPath / bounds
// ---------------------------------------------------------------------------

describe("smoothPath / bounds", () => {
  it("keeps all output coordinates near the input bounding box", () => {
    const [minX, minY, maxX, maxY] = bboxOf(S_PATH);
    const out = smoothPath(S_PATH, { segments: 16 });
    for (const [x, y] of out) {
      assert.ok(x >= minX - 0.2 && x <= maxX + 0.2, `x ${x} out of bounds`);
      assert.ok(y >= minY - 0.2 && y <= maxY + 0.2, `y ${y} out of bounds`);
    }
  });

  it("keeps a closed loop's output near its bounding box", () => {
    const [minX, minY, maxX, maxY] = bboxOf(SQUARE_LOOP);
    const out = smoothPath(SQUARE_LOOP, { segments: 12, closed: true });
    for (const [x, y] of out) {
      assert.ok(x >= minX - 0.2 && x <= maxX + 0.2, `x ${x} out of bounds`);
      assert.ok(y >= minY - 0.2 && y <= maxY + 0.2, `y ${y} out of bounds`);
    }
  });
});

// ---------------------------------------------------------------------------
// smoothPath / closed loops
// ---------------------------------------------------------------------------

describe("smoothPath / closed", () => {
  it("returns to the starting coordinate for a closed loop", () => {
    const out = smoothPath(SQUARE_LOOP, { segments: 8, closed: true });
    assertCoordClose(out[0]!, SQUARE_LOOP[0]!);
    assertCoordClose(out[out.length - 1]!, SQUARE_LOOP[0]!);
  });

  it("emits an extra wrap-around segment compared to an open path", () => {
    const segments = 8;
    const open = smoothPath(SQUARE_LOOP, { segments });
    const loop = smoothPath(SQUARE_LOOP, { segments, closed: true });
    assert.equal(loop.length, open.length + segments);
  });
});

// ---------------------------------------------------------------------------
// smoothPath / determinism
// ---------------------------------------------------------------------------

describe("smoothPath / determinism", () => {
  it("yields deep-equal output when called twice", () => {
    const a = smoothPath(S_PATH, { segments: 10, tension: 0.4 });
    const b = smoothPath(S_PATH, { segments: 10, tension: 0.4 });
    assert.deepEqual(a, b);
  });

  it("does not mutate the input array", () => {
    const input: Coordinate[] = S_PATH.map((p): Coordinate => [p[0], p[1]]);
    const snapshot = JSON.stringify(input);
    smoothPath(input);
    assert.equal(JSON.stringify(input), snapshot);
  });
});

// ---------------------------------------------------------------------------
// sampleTaperedWidths
// ---------------------------------------------------------------------------

describe("sampleTaperedWidths", () => {
  it("returns one width per input vertex", () => {
    const widths = sampleTaperedWidths(S_PATH, 4, 1);
    assert.equal(widths.length, S_PATH.length);
  });

  it("endpoints equal the start and end widths", () => {
    const widths = sampleTaperedWidths(S_PATH, 4, 1);
    assert.equal(widths[0], 4);
    assert.equal(widths[widths.length - 1], 1);
  });

  it("the midpoint is roughly the average of start and end", () => {
    const points: Coordinate[] = [
      [0, 0],
      [0.5, 0],
      [1, 0],
    ];
    const widths = sampleTaperedWidths(points, 2, 6);
    assert.ok(Math.abs(widths[1]! - 4) <= 1e-9, "midpoint should be the average");
  });

  it("interpolates linearly across vertices", () => {
    const points: Coordinate[] = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    const widths = sampleTaperedWidths(points, 0, 8);
    assert.deepEqual(widths, [0, 2, 4, 6, 8]);
  });

  it("returns [startWidth] for a single point", () => {
    assert.deepEqual(sampleTaperedWidths([[0.5, 0.5]], 3, 9), [3]);
  });

  it("returns [] for an empty path", () => {
    assert.deepEqual(sampleTaperedWidths([], 3, 9), []);
  });

  it("is deterministic across calls", () => {
    const a = sampleTaperedWidths(S_PATH, 5, 2);
    const b = sampleTaperedWidths(S_PATH, 5, 2);
    assert.deepEqual(a, b);
  });
});
