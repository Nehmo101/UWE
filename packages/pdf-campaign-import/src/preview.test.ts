import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCampaignPreview, toCampaignPreviewSummary } from "./preview";
import type { ExtractedCampaignEntity } from "./entity-schema";

function entity(overrides: Partial<ExtractedCampaignEntity> = {}): ExtractedCampaignEntity {
  return {
    kind: "note",
    title: "Titel",
    summary: "Zusammenfassung",
    body: "Körpertext",
    tags: ["a", "b"],
    ...overrides,
  };
}

describe("buildCampaignPreview", () => {
  it("returns an empty, non-executable preview for no entities", () => {
    const preview = buildCampaignPreview([]);
    assert.deepEqual(preview.items, []);
    assert.deepEqual(preview.entities, []);
    assert.equal(preview.totalDocuments, 0);
    assert.equal(preview.canExecute, false);
  });

  it("prefers the summary for the excerpt and falls back to the body", () => {
    const withSummary = buildCampaignPreview([entity({ summary: "kurz", body: "lang" })]);
    assert.equal(withSummary.items[0].excerpt, "kurz");

    const withoutSummary = buildCampaignPreview([entity({ summary: "", body: "aus dem Body" })]);
    assert.equal(withoutSummary.items[0].excerpt, "aus dem Body");
  });

  it("truncates the excerpt to 240 chars and collapses whitespace", () => {
    const preview = buildCampaignPreview([
      entity({ summary: "", body: `Zeile1\n\n   Zeile2\t${"x".repeat(400)}` }),
    ]);
    const excerpt = preview.items[0].excerpt;
    assert.equal(excerpt.length, 240);
    assert.doesNotMatch(excerpt, /\s\s/);
    assert.doesNotMatch(excerpt, /[\n\t]/);
  });

  it("copies tags so mutating the source entity does not change the preview", () => {
    const source = entity({ tags: ["one"] });
    const preview = buildCampaignPreview([source]);
    source.tags?.push("two");
    assert.deepEqual(preview.items[0].tags, ["one"]);
    assert.deepEqual(preview.entities[0].tags, ["one"]);
  });

  it("marks canExecute true and counts documents when entities exist", () => {
    const preview = buildCampaignPreview([entity(), entity({ title: "Zwei" })]);
    assert.equal(preview.totalDocuments, 2);
    assert.equal(preview.canExecute, true);
    assert.equal(preview.items.length, 2);
    assert.equal(preview.items[1].itemId, "ent-1");
  });
});

describe("toCampaignPreviewSummary", () => {
  it("strips the entity bodies from the client-facing payload", () => {
    const preview = buildCampaignPreview([entity()]);
    const summary = toCampaignPreviewSummary(preview);
    assert.equal("entities" in summary, false);
    assert.deepEqual(summary.items, preview.items);
    assert.equal(summary.totalDocuments, preview.totalDocuments);
    assert.equal(summary.canExecute, preview.canExecute);
  });
});
