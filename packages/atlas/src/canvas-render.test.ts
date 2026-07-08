import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  drawCompassRose,
  drawScaleBar,
  drawSvgPath,
  paintTerrainBlobs,
  type PaintTerrainBlobsOptions,
  roundedRectPath,
} from "./canvas-render";

/**
 * A minimal Canvas2D context recorder — records every method call as
 * `[name, ...args]`. Keeps this suite jsdom-free while still exercising the
 * renderers' control flow.
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
    beginPath: rec("beginPath"),
    closePath: rec("closePath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    arcTo: rec("arcTo"),
    quadraticCurveTo: rec("quadraticCurveTo"),
    bezierCurveTo: rec("bezierCurveTo"),
    fill: rec("fill"),
    fillRect: rec("fillRect"),
    stroke: rec("stroke"),
    save: rec("save"),
    restore: rec("restore"),
    createLinearGradient: (...args: number[]) => {
      calls.push(["createLinearGradient", ...args]);
      return {
        addColorStop: (offset: number, color: string) => {
          calls.push(["addColorStop", offset, color]);
        },
      };
    },
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    calls,
    count: (n: string) => calls.filter((c) => c[0] === n).length,
  };
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

  it("adds a deterministic blend strip between side-by-side biomes", () => {
    const { ctx, calls, count } = makeRecordingCtx();
    const fills: Record<string, string> = { grass: "#0f0", sand: "#fc0" };
    paintTerrainBlobs(ctx, {
      cols: 2,
      rows: 1,
      getCell: (c, r) => {
        if (r !== 0) return undefined;
        if (c === 0) return "grass";
        if (c === 1) return "sand";
        return undefined;
      },
      tileRect: (c, r) => ({ x: c * 10, y: r * 10, w: 10, h: 10 }),
      fillFor: (biome) => fills[biome] ?? "#000",
      blendWidth: 4,
    });

    assert.equal(count("fill"), 2);
    assert.deepEqual(calls.filter((c) => c[0] === "createLinearGradient"), [
      ["createLinearGradient", 8, 0, 12, 0],
    ]);
    assert.deepEqual(calls.filter((c) => c[0] === "addColorStop"), [
      ["addColorStop", 0, "#0f0"],
      ["addColorStop", 1, "#fc0"],
    ]);
    assert.deepEqual(calls.filter((c) => c[0] === "fillRect"), [["fillRect", 8, 0, 4, 10]]);
  });

  it("adds a deterministic blend strip between stacked biomes", () => {
    const { ctx, calls, count } = makeRecordingCtx();
    const fills: Record<string, string> = { grass: "#0f0", water: "#06c" };
    paintTerrainBlobs(ctx, {
      cols: 1,
      rows: 2,
      getCell: (c, r) => {
        if (c !== 0) return undefined;
        if (r === 0) return "grass";
        if (r === 1) return "water";
        return undefined;
      },
      tileRect: (c, r) => ({ x: c * 10, y: r * 10, w: 10, h: 10 }),
      fillFor: (biome) => fills[biome] ?? "#000",
      blendWidth: 4,
    });

    assert.equal(count("fill"), 2);
    assert.deepEqual(calls.filter((c) => c[0] === "createLinearGradient"), [
      ["createLinearGradient", 0, 8, 0, 12],
    ]);
    assert.deepEqual(calls.filter((c) => c[0] === "addColorStop"), [
      ["addColorStop", 0, "#0f0"],
      ["addColorStop", 1, "#06c"],
    ]);
    assert.deepEqual(calls.filter((c) => c[0] === "fillRect"), [["fillRect", 0, 8, 10, 4]]);
  });
});

describe("paintTerrainBlobs — Küstensaum & Wasser-Look", () => {
  /** A 2×2 grid: grass on the left column, water on the right. */
  const mixedGrid = (
    coast?: PaintTerrainBlobsOptions["coast"],
  ): PaintTerrainBlobsOptions => ({
    cols: 2,
    rows: 2,
    getCell: (c, r) =>
      c < 0 || c > 1 || r < 0 || r > 1 ? undefined : c === 0 ? "grass" : "water",
    tileRect: (c, r) => ({ x: c * 10, y: r * 10, w: 10, h: 10 }),
    fillFor: (biome) => (biome === "water" ? "#06c" : "#0f0"),
    coast,
  });

  it("is byte-identical whether coast is omitted or explicitly undefined", () => {
    const a = makeRecordingCtx();
    const b = makeRecordingCtx();
    paintTerrainBlobs(a.ctx, mixedGrid());
    paintTerrainBlobs(b.ctx, mixedGrid(undefined));
    assert.deepEqual(a.calls, b.calls);
    // Regression guard: no coast ops leak in when the option is absent.
    assert.equal(a.count("save"), 0);
    assert.equal(a.count("stroke"), 0);
    assert.equal(a.count("quadraticCurveTo"), 0);
  });

  it("adds a shallow-water rim (extra fillRect) on water cells bordering land", () => {
    // (0,0)=grass, (1,0)=water — the water cell's left neighbour is land.
    const opts = (coast?: PaintTerrainBlobsOptions["coast"]): PaintTerrainBlobsOptions => ({
      cols: 2,
      rows: 1,
      getCell: (c, r) => (r !== 0 ? undefined : c === 0 ? "grass" : c === 1 ? "water" : undefined),
      tileRect: (c, r) => ({ x: c * 10, y: r * 10, w: 10, h: 10 }),
      fillFor: (biome) => (biome === "water" ? "#06c" : "#0f0"),
      coast,
    });

    const plain = makeRecordingCtx();
    paintTerrainBlobs(plain.ctx, opts());
    assert.equal(plain.count("fillRect"), 0, "no bridges, no coast ⇒ no rects");

    const withCoast = makeRecordingCtx();
    paintTerrainBlobs(withCoast.ctx, opts({}));
    // One rim band along the single land-facing (left) edge, drawn inside save/restore.
    assert.equal(withCoast.count("fillRect"), 1);
    assert.equal(withCoast.count("save"), 1);
    assert.equal(withCoast.count("restore"), 1);
    assert.deepEqual(
      withCoast.calls.filter((c) => c[0] === "fillRect"),
      [["fillRect", 10, 0, 10 * 0.22, 10]],
    );
    // Explicit rimColor overrides the paler-fill default (still one rim rect).
    const tinted = makeRecordingCtx();
    paintTerrainBlobs(tinted.ctx, opts({ rimColor: "#abc" }));
    assert.equal(tinted.count("fillRect"), 1);
  });

  it("draws open-water ripples only when the per-cell rng admits", () => {
    // A single water cell with no land neighbours ⇒ open water (ripple path).
    const single = (coast: PaintTerrainBlobsOptions["coast"]): PaintTerrainBlobsOptions => ({
      cols: 1,
      rows: 1,
      getCell: (c, r) => (c === 0 && r === 0 ? "water" : undefined),
      tileRect: () => ({ x: 0, y: 0, w: 10, h: 10 }),
      fillFor: () => "#06c",
      coast,
    });

    // Seed 7 gates cell (0,0) out (first rng() < 0.55) ⇒ nothing drawn.
    const quiet = makeRecordingCtx();
    paintTerrainBlobs(quiet.ctx, single({ rippleSeed: 7 }));
    assert.equal(quiet.count("quadraticCurveTo"), 0);
    assert.equal(quiet.count("stroke"), 0);

    // Seed 1 admits cell (0,0) ⇒ 1–2 quadratic ripple arcs, each stroked.
    const lively = makeRecordingCtx();
    paintTerrainBlobs(lively.ctx, single({ rippleSeed: 1 }));
    assert.ok(lively.count("quadraticCurveTo") >= 1, "at least one ripple arc");
    assert.equal(
      lively.count("quadraticCurveTo"),
      lively.count("stroke"),
      "one stroke per arc",
    );
    assert.equal(lively.count("save"), 1);
  });

  it("is deterministic: same seed ⇒ identical ops, different seed ⇒ different", () => {
    // 3×3 all-water grid — every cell is open water (no land neighbours).
    const waterField = (seed: number): PaintTerrainBlobsOptions => ({
      cols: 3,
      rows: 3,
      getCell: (c, r) => (c >= 0 && c <= 2 && r >= 0 && r <= 2 ? "water" : undefined),
      tileRect: (c, r) => ({ x: c * 10, y: r * 10, w: 10, h: 10 }),
      fillFor: () => "#06c",
      coast: { rippleSeed: seed },
    });

    const s1a = makeRecordingCtx();
    const s1b = makeRecordingCtx();
    const s2 = makeRecordingCtx();
    paintTerrainBlobs(s1a.ctx, waterField(1));
    paintTerrainBlobs(s1b.ctx, waterField(1));
    paintTerrainBlobs(s2.ctx, waterField(2));

    assert.deepEqual(s1a.calls, s1b.calls, "same seed ⇒ identical draw calls");
    assert.notDeepEqual(s1a.calls, s2.calls, "different seed ⇒ different draw calls");
    assert.ok(s1a.count("quadraticCurveTo") >= 1, "the field actually rippled");
  });

  it("accepts coast as an optional field at the type level", () => {
    // Compiles without `coast` …
    const withoutCoast: PaintTerrainBlobsOptions = {
      cols: 1,
      rows: 1,
      getCell: () => "water",
      tileRect: () => ({ x: 0, y: 0, w: 1, h: 1 }),
      fillFor: () => "#06c",
    };
    // … and with a fully-specified coast config.
    const withCoast: PaintTerrainBlobsOptions = {
      ...withoutCoast,
      coast: {
        waterKinds: ["water", "coast", "river"],
        rimColor: "#cde",
        rimWidthRatio: 0.3,
        rippleColor: "rgba(255,255,255,0.5)",
        rippleSeed: 42,
        rippleDensity: 2,
      },
    };
    assert.equal(withoutCoast.coast, undefined);
    assert.ok(withCoast.coast);
  });
});

// ---------------------------------------------------------------------------
// Decorations — compass rose & scale bar
// ---------------------------------------------------------------------------

/** Recording ctx variant with the extra methods the decoration renderers use. */
function makeDecorationCtx() {
  const calls: Array<[string, ...unknown[]]> = [];
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
  };
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    beginPath: rec("beginPath"),
    closePath: rec("closePath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    arc: rec("arc"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    fillRect: rec("fillRect"),
    strokeRect: rec("strokeRect"),
    fillText: rec("fillText"),
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    calls,
    count: (n: string) => calls.filter((c) => c[0] === n).length,
  };
}

describe("drawCompassRose", () => {
  const OPTS = { x: 50, y: 50, radius: 30, ink: "#1a1008", accent: "#8b1a10", parchment: "#f2e8c9" };

  it("draws disc + inner ring + eight points + N letter", () => {
    const { ctx, calls, count } = makeDecorationCtx();
    drawCompassRose(ctx, OPTS);
    assert.equal(count("arc"), 2, "outer disc + inner ring");
    assert.equal(count("closePath"), 8, "one closed triangle per point");
    assert.equal(count("fill"), 9, "disc fill + 8 point fills");
    const text = calls.find((c) => c[0] === "fillText");
    assert.ok(text && text[1] === "N", "renders the north letter");
  });

  it("does nothing for a non-positive radius", () => {
    const { ctx, calls } = makeDecorationCtx();
    drawCompassRose(ctx, { ...OPTS, radius: 0 });
    assert.equal(calls.length, 0);
  });
});

describe("drawScaleBar", () => {
  const OPTS = { x: 10, y: 90, width: 80, height: 8, ink: "#1a1008", parchment: "#f2e8c9" };

  it("fills alternating segments and outlines the bar", () => {
    const { ctx, count } = makeDecorationCtx();
    drawScaleBar(ctx, { ...OPTS, segments: 4 });
    assert.equal(count("fillRect"), 4);
    assert.equal(count("strokeRect"), 1);
    assert.equal(count("fillText"), 0, "no label requested");
  });

  it("renders the unit label below the bar when given", () => {
    const { ctx, calls } = makeDecorationCtx();
    drawScaleBar(ctx, { ...OPTS, label: "0 — 100 leagues" });
    const text = calls.find((c) => c[0] === "fillText");
    assert.ok(text && text[1] === "0 — 100 leagues");
  });

  it("does nothing for degenerate dimensions", () => {
    const { ctx, calls } = makeDecorationCtx();
    drawScaleBar(ctx, { ...OPTS, width: 0 });
    assert.equal(calls.length, 0);
  });
});
