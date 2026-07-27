import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  RTX_ATLAS_ASSET_CATALOG_PATH,
  RTX_ATLAS_ASSET_REGISTRY_EXPORT,
  RTX_ATLAS_ASSET_STYLEGUIDE_PATH,
  buildRtxAtlasAssetPromptContext,
  formatRtxAtlasAssetPromptContext,
  isRtxAtlasAssetProposal,
  validateRtxAtlasAssetProposal,
} from "./rtx-asset-proposal";
import type {
  RtxAtlasAssetProposalValidationResult,
} from "./rtx-asset-proposal";

/** packages/ai-brain/src/proposal-validators → repo root */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const validRecipeProposal = {
  name: "Verwunschener Leuchtturm",
  category: "landmark",
  tags: ["lighthouse", "cliff"],
  engineTags: ["Landmark", "Stamp"],
  palette: ["#d8c99c", "#59432a", "#3d5a69"],
  prompt: "verwunschener Leuchtturm auf Klippe, Gouache, Landmarke",
  rationale: "Uses a base shadow, muted pigments, and a base-center anchor.",
  outputType: "json-recipe",
  recipe: {
    schemaVersion: 1,
    coordinateSystem: "base-center-normalized",
    description: "Stacked tower silhouette with a soft ground shadow.",
    layers: [
      {
        id: "ground-shadow",
        role: "shadow",
        shape: "ellipse",
        fill: "#2a1e0c",
        opacity: 0.18,
        x: 0,
        y: 0.06,
        rx: 0.58,
        ry: 0.16,
      },
      {
        id: "tower-body",
        role: "base",
        shape: "polygon",
        fill: "#d8c99c",
        stroke: "#59432a",
        points: [
          [-0.22, 0],
          [0.22, 0],
          [0.14, -0.9],
          [-0.14, -0.9],
        ],
      },
      {
        id: "lamp-glow",
        role: "highlight",
        shape: "path",
        fill: "#f2d77a",
        opacity: 0.72,
        path: "M -0.18 -0.9 L 0 -1.06 L 0.18 -0.9 Z",
      },
    ],
  },
} as const;

function assertValid(
  result: RtxAtlasAssetProposalValidationResult,
): asserts result is Extract<RtxAtlasAssetProposalValidationResult, { ok: true }> {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
}

function assertInvalid(
  result: RtxAtlasAssetProposalValidationResult,
): asserts result is Extract<RtxAtlasAssetProposalValidationResult, { ok: false }> {
  if (result.ok) throw new Error("expected validation failure");
}

describe("validateRtxAtlasAssetProposal", () => {
  it("accepts a constrained JSON gouache recipe", () => {
    const result = validateRtxAtlasAssetProposal(validRecipeProposal);

    assertValid(result);
    assert.equal(result.proposal.outputType, "json-recipe");
    assert.equal(result.proposal.category, "landmark");
    assert.equal(result.proposal.recipe.layers.length, 3);
    assert.deepEqual(result.proposal.engineTags, ["Landmark", "Stamp"]);
    assert.equal(isRtxAtlasAssetProposal(validRecipeProposal), true);
  });

  it("accepts PNG fallback metadata without image bytes", () => {
    const result = validateRtxAtlasAssetProposal({
      name: "Nebeliger Sumpfmarker",
      category: "prop",
      tags: ["swamp", "mist"],
      engineTags: ["Stamp"],
      palette: ["#5c7a4a"],
      outputType: "png-fallback",
      pngFallback: {
        mimeType: "image/png",
        width: 512,
        height: 512,
        transparentBackground: true,
        filename: "misty-swamp-marker.png",
        sha256: "a".repeat(64),
        altText: "A misty swamp marker in the Atlas gouache style.",
      },
    });

    assertValid(result);
    assert.equal(result.proposal.outputType, "png-fallback");
    assert.equal(result.proposal.pngFallback.mimeType, "image/png");
    assert.equal(result.proposal.pngFallback.width, 512);
  });

  it("rejects executable fields and source-like strings", () => {
    const result = validateRtxAtlasAssetProposal({
      ...validRecipeProposal,
      script: "function draw(ctx) { ctx.fillRect(0, 0, 10, 10); }",
    });

    assertInvalid(result);
    assert.ok(result.errors.some((error) => error.code === "executable_code"));
  });

  it("rejects proposals that include both accepted output forms", () => {
    const result = validateRtxAtlasAssetProposal({
      ...validRecipeProposal,
      pngFallback: {
        mimeType: "image/png",
        width: 256,
        height: 256,
        transparentBackground: true,
      },
    });

    assertInvalid(result);
    assert.ok(
      result.errors.some((error) =>
        error.message.includes("not both"),
      ),
    );
  });

  it("rejects invalid categories and unsafe PNG metadata", () => {
    const result = validateRtxAtlasAssetProposal({
      name: "Unsafe fallback",
      category: "spellbook",
      outputType: "png-fallback",
      pngFallback: {
        mimeType: "image/jpeg",
        width: 8192,
        height: 512.5,
        transparentBackground: "yes",
        filename: "../unsafe.png",
      },
    });

    assertInvalid(result);
    assert.ok(result.errors.some((error) => error.path === "$.category"));
    assert.ok(result.errors.some((error) => error.path === "$.pngFallback.mimeType"));
    assert.ok(result.errors.some((error) => error.path === "$.pngFallback.filename"));
  });

  it("accepts every Gouache category from the registry", () => {
    for (const category of ["flora", "structure", "landmark", "vehicle", "market", "prop"]) {
      const result = validateRtxAtlasAssetProposal({ ...validRecipeProposal, category });
      assertValid(result);
      assert.equal(result.proposal.category, category);
    }
  });
});

describe("RTX Atlas asset prompt context", () => {
  it("mentions the styleguide, asset catalog, registry, and current asset keys", () => {
    const context = buildRtxAtlasAssetPromptContext();
    const promptContext = formatRtxAtlasAssetPromptContext(context);

    assert.equal(context.styleguidePath, RTX_ATLAS_ASSET_STYLEGUIDE_PATH);
    assert.equal(context.assetCatalogPath, RTX_ATLAS_ASSET_CATALOG_PATH);
    assert.ok(promptContext.includes("docs/prompts/atlas-pictogram-styleguide.md"));
    assert.ok(promptContext.includes("docs/design/atlas-redesign/asset-catalog.md"));
    assert.ok(promptContext.includes(RTX_ATLAS_ASSET_REGISTRY_EXPORT));
    assert.ok(context.existingAssets.some((asset) => asset.key === "g_oak"));
    assert.ok(promptContext.includes("json-recipe"));
    assert.ok(promptContext.includes("png-fallback"));
    assert.ok(promptContext.includes("base-center"));
    assert.ok(promptContext.includes("Stamp is a single AtlasObject asset"));
    assert.ok(context.styleguideExcerpt.length > 0);
    assert.ok(context.assetCatalogExcerpt.length > 0);
  });

  /**
   * The two doc paths are plain strings inside the prompt, not imports —
   * moving or deleting a file would break the prompt silently at runtime.
   * This turns that into a loud test failure.
   */
  it("points at documentation files that actually exist", () => {
    for (const relative of [RTX_ATLAS_ASSET_STYLEGUIDE_PATH, RTX_ATLAS_ASSET_CATALOG_PATH]) {
      assert.ok(
        existsSync(join(REPO_ROOT, relative)),
        `prompt references a missing file: ${relative}`,
      );
    }
  });

  /**
   * Same class of silent breakage for the registry pointer: it names a package
   * subpath export, so `package.json` and the prompt must stay in sync.
   */
  it("names a registry subpath export that resolves", async () => {
    const [subpath, exportName] = RTX_ATLAS_ASSET_REGISTRY_EXPORT.split("#");
    assert.equal(subpath, "@uwe/ai-brain/proposal-validators");
    assert.equal(exportName, "GOUACHE_ASSETS");

    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, "packages", "ai-brain", "package.json"), "utf8"),
    ) as { exports: Record<string, string> };
    const relative = pkg.exports["./proposal-validators"];
    assert.ok(relative, "package.json is missing the ./proposal-validators export");
    assert.ok(existsSync(join(REPO_ROOT, "packages", "ai-brain", relative)));

    const barrel: Record<string, unknown> = await import("./index");
    assert.ok(Array.isArray(barrel[exportName as string]));
  });
});
