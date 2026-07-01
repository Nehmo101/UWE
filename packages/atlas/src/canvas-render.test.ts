import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { drawSvgPath, paintTerrainBlobs, roundedRectPath } from "./canvas-render";

/**
 * A minimal Canvas2D context recorder — records every method call as
 * `[name, ...args]`. Keeps this suite jsdom-free while still exercising the
 * renderers' control flow.
 */
function makeRecordingCtx() {
  const calls: Array<[string, ...number[]]> = [];
  const rec = (name: string) => (...args: number[]) => {
    calls.push([name, ...args]);
  };
  const ctx = {
    fillStyle: "",
    beginPath: rec("beginPath"),
    closePath: rec("closePath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    arcTo: rec("arcTo"),
    quadraticCurveTo: rec("quadraticCurveTo"),
    bezierCurveTo: rec("bezierCurveTo"),
    fill: rec("fill"),
    fillRect: rec("fillRect"),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, count: (n: string) => calls.filter((c) => c[0] === n).length };
}

describe("roundedRectPath", () => {
  it("traces begin → move → 4×arcTo → close", () => {
    const { ctx, count } = makeRecordingCtx();
    roundedRectPath(ctx, 0, 0, 10, 10, 3);
    assert.equal(count("beginPath"), 1);
    assert.equal(count("moveTo"), 1);
    assert.equal(count("arcTo"), 4);
    assert.equal(count("closePath"), 1);
  });

  it("clamps the radius to half the shortest edge", () => {
    const { ctx, calls } = makeRecordingCtx();
    roundedRectPath(ctx, 0, 0, 4, 10, 999);
    // moveTo starts at x + clampedRadius; clamped radius is min(999, 2, 5) = 2.
    const moveTo = calls.find((c) => c[0] === "moveTo");
    assert.deepEqual(moveTo, ["moveTo", 2, 0]);
  });
});

describe("drawSvgPath", () => {
  it("parses M/L/Q/Z into the matching context calls", () => {
    const { ctx, calls } = makeRecordingCtx();
    drawSvgPath(ctx, "M0 0 L10 0 Q10 10 0 10 Z");
    assert.deepEqual(calls, [
      ["moveTo", 0, 0],
      ["lineTo", 10, 0],
      ["quadraticCurveTo", 10, 10, 0, 10],
      ["closePath"],
    ]);
  });

  it("treats H and V as horizontal/vertical line segments", () => {
    const { ctx, calls } = makeRecordingCtx();
    drawSvgPath(ctx, "M2 3 H8 V9");
    assert.deepEqual(calls, [
      ["moveTo", 2, 3],
      ["lineTo", 8, 3],
      ["lineTo", 8, 9],
    ]);
  });
});

describe("paintTerrainBlobs", () => {
  it("fills each painted cell and bridges same-biome neighbours", () => {
    // Full 2×2 grass grid; out-of-bounds cells read as empty.
    const { ctx, count } = makeRecordingCtx();
    paintTerrainBlobs(ctx, {
      cols: 2,
      rows: 2,
      getCell: (c, r) => (c >= 0 && c <= 1 && r >= 0 && r <= 1 ? "grass" : undefined),
      tileRect: (c, r) => ({ x: c * 10, y: r * 10, w: 10, h: 10 }),
      fillFor: () => "#0f0",
    });
    // One rounded fill per tile.
    assert.equal(count("fill"), 4);
    assert.equal(count("beginPath"), 4);
    // Bridges: (0,0) right+bottom+inner-corner = 3; (0,1) right = 1;
    // (1,0) bottom = 1; (1,1) none → 5 bridge rects total.
    assert.equal(count("fillRect"), 5);
  });

  it("skips everything when the grid is empty", () => {
    const { ctx, count } = makeRecordingCtx();
    paintTerrainBlobs(ctx, {
      cols: 3,
      rows: 3,
      getCell: () => undefined,
      tileRect: (c, r) => ({ x: c, y: r, w: 1, h: 1 }),
      fillFor: () => "#000",
    });
    assert.equal(count("fill"), 0);
    assert.equal(count("fillRect"), 0);
  });
});
