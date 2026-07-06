import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ATLAS_PLOT_FILL_PROPOSAL_KIND,
  buildAtlasPlotFillPromptContext,
  formatAtlasPlotFillPromptContext,
  isAtlasPlotFillProposal,
  validateAtlasPlotFillProposal,
} from "./plot-fill-proposal";
import type { AtlasPlotFillProposalValidationResult } from "./plot-fill-proposal";

const validProposal = {
  schemaVersion: 1,
  kind: "atlas_plot_fill",
  plotKey: "ck-plot-1",
  biomeKind: "forest",
  density: 1.4,
  seed: 12345,
  assets: [
    { gouacheKey: "g_oak", weight: 3, scaleMin: 0.8, scaleMax: 1.2 },
    { gouacheKey: "g_mushroom", weight: 1, rotateMin: -8, rotateMax: 8, blur: 0.5 },
  ],
  notes: "Dense old forest with rare mushrooms.",
} as const;

function assertValid(
  result: AtlasPlotFillProposalValidationResult,
): asserts result is Extract<AtlasPlotFillProposalValidationResult, { ok: true }> {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
}

function assertInvalid(
  result: AtlasPlotFillProposalValidationResult,
): asserts result is Extract<AtlasPlotFillProposalValidationResult, { ok: false }> {
  if (result.ok) throw new Error("expected validation failure");
}

describe("validateAtlasPlotFillProposal", () => {
  it("accepts a bounded Gouache plot-fill recipe", () => {
    const result = validateAtlasPlotFillProposal(validProposal);

    assertValid(result);
    assert.equal(result.proposal.kind, ATLAS_PLOT_FILL_PROPOSAL_KIND);
    assert.equal(result.proposal.biomeKind, "forest");
    assert.equal(result.proposal.assets.length, 2);
    assert.equal(result.proposal.assets[0]?.gouacheKey, "g_oak");
    assert.equal(isAtlasPlotFillProposal(validProposal), true);
  });

  it("rejects object payloads and executable source", () => {
    const result = validateAtlasPlotFillProposal({
      ...validProposal,
      objects: [{ x: 0.5, y: 0.5, style: { gouache: "g_oak" } }],
      notes: "function draw(ctx) { ctx.fillRect(0, 0, 1, 1); }",
    });

    assertInvalid(result);
    assert.ok(result.errors.some((error) => error.code === "executable_code"));
    assert.ok(result.errors.some((error) => error.path === "$.objects"));
  });

  it("rejects unknown assets and unsafe numeric ranges", () => {
    const result = validateAtlasPlotFillProposal({
      schemaVersion: 1,
      kind: "atlas_plot_fill",
      biomeKind: "lava",
      density: 12,
      seed: -1,
      assets: [
        { gouacheKey: "g_missing", scaleMin: 2, scaleMax: 1 },
      ],
    });

    assertInvalid(result);
    assert.ok(result.errors.some((error) => error.path === "$.biomeKind"));
    assert.ok(result.errors.some((error) => error.path === "$.density"));
    assert.ok(result.errors.some((error) => error.path === "$.assets[0].gouacheKey"));
    assert.ok(result.errors.some((error) => error.path === "$.assets[0].scaleMin"));
  });
});

describe("Atlas plot-fill prompt context", () => {
  it("documents the strict recipe shape and registry allowlist", () => {
    const context = buildAtlasPlotFillPromptContext();
    const prompt = formatAtlasPlotFillPromptContext(context);

    assert.equal(context.kind, "atlas_plot_fill");
    assert.ok(context.acceptedBiomes.includes("forest"));
    assert.ok(context.acceptedGouacheAssets.some((asset) => asset.key === "g_oak"));
    assert.ok(prompt.includes("schemaVersion"));
    assert.ok(prompt.includes("g_oak"));
    assert.ok(prompt.includes("no AtlasObject payloads"));
  });
});
