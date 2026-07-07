import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { drawRtxGouacheRecipePreview } from "./rtx-asset-preview";
import type { RtxGouacheJsonRecipe, RtxGouacheRecipeLayer } from "./rtx-asset-proposal";

/**
 * Minimal Canvas2D recorder — records every method call as `[name, ...args]`
 * (same pattern as canvas-render.test.ts). Keeps this suite jsdom-free while
 * asserting the renderer's exact, deterministic call sequence.
 */
function makeRecordingCtx() {
  const calls: Array<[string, ...unknown[]]> = [];
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
  };
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
    lineJoin: "",
    lineCap: "",
    save: rec("save"),
    restore: rec("restore"),
    beginPath: rec("beginPath"),
    closePath: rec("closePath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    quadraticCurveTo: rec("quadraticCurveTo"),
    bezierCurveTo: rec("bezierCurveTo"),
    ellipse: rec("ellipse"),
    fill: rec("fill"),
    stroke: rec("stroke"),
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    calls,
    count: (n: string) => calls.filter((c) => c[0] === n).length,
    drawCalls: () => calls.filter((c) => c[0] !== "save" && c[0] !== "restore"),
  };
}

function recipe(layers: RtxGouacheRecipeLayer[]): RtxGouacheJsonRecipe {
  return { schemaVersion: 1, coordinateSystem: "base-center-normalized", layers };
}

const OPTS = { x: 100, y: 100, unitScale: 10 };

describe("drawRtxGouacheRecipePreview", () => {
  it("projects an ellipse layer around the base-centre anchor and fills it", () => {
    const { ctx, calls } = makeRecordingCtx();
    drawRtxGouacheRecipePreview(
      ctx,
      recipe([{ id: "crown", role: "base", shape: "ellipse", fill: "#4a6b3a", x: 0, y: -2, rx: 1.5, ry: 1 }]),
      OPTS,
    );
    assert.deepEqual(calls.filter((c) => c[0] === "ellipse"), [
      ["ellipse", 100, 80, 15, 10, 0, 0, Math.PI * 2],
    ]);
    assert.equal(calls.filter((c) => c[0] === "fill").length, 1);
    assert.equal(calls.filter((c) => c[0] === "stroke").length, 0);
  });

  it("draws a rect as four projected corners and strokes it", () => {
    const { ctx, count, calls } = makeRecordingCtx();
    drawRtxGouacheRecipePreview(
      ctx,
      recipe([{ id: "wall", role: "base", shape: "rect", fill: "#b6a680", stroke: "#1a1008", x: 0, y: 0, width: 2, height: 1 }]),
      OPTS,
    );
    assert.deepEqual(calls.find((c) => c[0] === "moveTo"), ["moveTo", 90, 95]);
    assert.equal(count("lineTo"), 3);
    assert.equal(count("closePath"), 1);
    assert.equal(count("fill"), 1);
    assert.equal(count("stroke"), 1);
  });

  it("renders layers in array order and parses the absolute path subset", () => {
    const { ctx, drawCalls } = makeRecordingCtx();
    drawRtxGouacheRecipePreview(
      ctx,
      recipe([
        { id: "ground", role: "shadow", shape: "polygon", fill: "#2a1e0c", points: [[-1, 0], [1, 0], [0, 1]] },
        { id: "roof", role: "detail", shape: "path", stroke: "#8b1a10", path: "M-1 0 L1 0 H2 V-1 Q1 -2 0 -1 C0 0 1 1 2 2 Z" },
      ]),
      OPTS,
    );
    assert.deepEqual(drawCalls(), [
      ["beginPath"],
      ["moveTo", 90, 100],
      ["lineTo", 110, 100],
      ["lineTo", 100, 110],
      ["closePath"],
      ["fill"],
      ["beginPath"],
      ["moveTo", 90, 100],
      ["lineTo", 110, 100],
      ["lineTo", 120, 100],
      ["lineTo", 120, 90],
      ["quadraticCurveTo", 110, 80, 100, 90],
      ["bezierCurveTo", 100, 100, 110, 110, 120, 120],
      ["closePath"],
      ["stroke"],
    ]);
  });

  it("is deterministic — drawing twice records identical call lists", () => {
    const input = recipe([
      { id: "shadow", role: "shadow", shape: "ellipse", fill: "#2a1e0c", x: 0, y: 0.2, rx: 1.4, ry: 0.5 },
      { id: "trunk", role: "base", shape: "rect", fill: "#5a4026", x: 0, y: -0.5, width: 0.4, height: 1.4, rotation: 0.2 },
      { id: "crown", role: "highlight", shape: "polygon", fill: "#4a6b3a", stroke: "#1a1008", points: [[-1, -1], [1, -1], [0, -3]] },
      { id: "vine", role: "detail", shape: "path", stroke: "#3a5a2a", path: "M0 -1 Q0.5 -2 0 -3" },
    ]);
    const first = makeRecordingCtx();
    const second = makeRecordingCtx();
    drawRtxGouacheRecipePreview(first.ctx, input, OPTS);
    drawRtxGouacheRecipePreview(second.ctx, input, OPTS);
    assert.ok(first.calls.length > 0);
    assert.deepEqual(first.calls, second.calls);
  });

  it("skips layers with relative or unsupported path commands without throwing", () => {
    const { ctx, drawCalls } = makeRecordingCtx();
    drawRtxGouacheRecipePreview(
      ctx,
      recipe([
        { id: "relative", role: "base", shape: "path", fill: "#4a6b3a", path: "m0 0 l1 1 Z" },
        { id: "arc", role: "base", shape: "path", fill: "#4a6b3a", path: "M0 0 A1 1 0 0 1 2 2 Z" },
        { id: "smooth", role: "base", shape: "path", fill: "#4a6b3a", path: "M0 0 S1 1 2 2" },
        { id: "ok", role: "base", shape: "path", fill: "#4a6b3a", path: "M0 0 L1 1 Z" },
      ]),
      OPTS,
    );
    // Only the last layer draws — one beginPath/fill, no partial output from the skipped ones.
    assert.deepEqual(drawCalls(), [
      ["beginPath"],
      ["moveTo", 100, 100],
      ["lineTo", 110, 110],
      ["closePath"],
      ["fill"],
    ]);
  });

  it("skips layers with malformed numbers, missing colors, or unknown shapes", () => {
    const { ctx, drawCalls } = makeRecordingCtx();
    drawRtxGouacheRecipePreview(
      ctx,
      recipe([
        { id: "nan", role: "base", shape: "path", fill: "#4a6b3a", path: "M0 0 L1" },
        { id: "nocolor", role: "base", shape: "ellipse", x: 0, y: 0, rx: 1, ry: 1 },
        { id: "badcolor", role: "base", shape: "ellipse", fill: "url(javascript:x)", x: 0, y: 0, rx: 1, ry: 1 },
        // Unknown shape sneaking past the type system must be ignored, not drawn.
        { id: "unknown", role: "base", shape: "star" as unknown as "rect", fill: "#4a6b3a", x: 0, y: 0 },
        { id: "fewpoints", role: "base", shape: "polygon", fill: "#4a6b3a", points: [[0, 0], [1, 1]] },
      ]),
      OPTS,
    );
    assert.deepEqual(drawCalls(), []);
  });

  it("no-ops for empty or invalid recipes", () => {
    const { ctx, calls } = makeRecordingCtx();
    drawRtxGouacheRecipePreview(ctx, null, OPTS);
    drawRtxGouacheRecipePreview(ctx, undefined, OPTS);
    drawRtxGouacheRecipePreview(ctx, recipe([]), OPTS);
    drawRtxGouacheRecipePreview(
      ctx,
      { schemaVersion: 2, layers: [{ id: "x", role: "base", shape: "rect" }] } as unknown as RtxGouacheJsonRecipe,
      OPTS,
    );
    drawRtxGouacheRecipePreview(
      ctx,
      recipe([{ id: "ok", role: "base", shape: "ellipse", fill: "#4a6b3a", x: 0, y: 0, rx: 1, ry: 1 }]),
      { x: 100, y: 100, unitScale: 0 },
    );
    assert.deepEqual(calls, []);
  });
});
