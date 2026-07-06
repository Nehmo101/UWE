import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateDraft, proceduralDraft } from "./procedural";
import {
  normalizeAtlasDraftFeature,
  normalizeAtlasDraftFeatures,
} from "./draft-proposal";

describe("normalizeAtlasDraftFeatures", () => {
  it("maps procedural draft-only kinds to supported Atlas feature kinds", () => {
    const draft = generateDraft(42, { regionCount: 2, cityCount: 1, riverCount: 1 });
    const proposals = normalizeAtlasDraftFeatures(draft.features);

    assert.equal(proposals.length, draft.features.length);
    assert.ok(proposals.some((feature) => feature.kind === "region"));
    assert.ok(proposals.some((feature) => feature.kind === "biome"));
    assert.ok(proposals.some((feature) => feature.kind === "relief"));
    assert.ok(proposals.some((feature) => feature.kind === "river"));
    assert.ok(proposals.some((feature) => feature.kind === "pin"));
    assert.ok(!proposals.some((feature) => ["coastline", "forest", "city", "mountain"].includes(feature.kind)));
  });

  it("keeps the simple offline procedural fallback compatible", () => {
    const proposals = normalizeAtlasDraftFeatures(proceduralDraft("terra").features);

    assert.deepEqual(
      proposals.map((feature) => feature.kind),
      ["biome", "river"],
    );
    assert.equal(proposals[0]?.layer, 10);
    assert.equal(proposals[1]?.layer, 30);
  });

  it("rejects unknown kinds and geometry mismatches", () => {
    assert.equal(normalizeAtlasDraftFeature({ kind: "spell", geometry: { type: "Point", coordinates: [0.5, 0.5] } }), null);
    assert.equal(normalizeAtlasDraftFeature({ kind: "river", geometry: { type: "Point", coordinates: [0.5, 0.5] } }), null);
  });

  it("accepts plot proposals as deterministic review-only plot features", () => {
    const proposal = normalizeAtlasDraftFeature({
      id: "plot-1",
      kind: "plot",
      geometry: {
        type: "Polygon",
        rings: [
          [
            [0.1, 0.1],
            [0.4, 0.1],
            [0.4, 0.4],
            [0.1, 0.4],
            [0.1, 0.1],
          ],
        ],
      },
      style: { biomeKind: "swamp" },
      labelHint: "Sumpflichtung",
    });

    assert.ok(proposal);
    assert.equal(proposal.kind, "plot");
    assert.equal(proposal.layer, 18);
    assert.equal(proposal.style?.plotPreset, "gouache_scatter");
    assert.equal(proposal.style?.biomeKind, "swamp");
    assert.equal(typeof proposal.style?.seed, "number");
    assert.equal(proposal.labelHint, "Sumpflichtung");
  });
});
