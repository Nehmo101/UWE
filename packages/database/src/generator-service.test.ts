import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_GENERATOR_PRESETS,
  detectMissingContent,
  listGeneratorActions,
  resolveGeneratorContextFromPage,
} from "./generator-service";
import {
  getStructuredGeneratorSchema,
  isStructuredGeneratorTarget,
  parseGeneratorPresetTemplate,
} from "./structured-generator-schemas";

describe("generator service", () => {
  it("resolves page context types", () => {
    const context = resolveGeneratorContextFromPage({
      pageId: "p1",
      pageType: "npc",
      pageTitle: "Gundren",
      worldId: "w1",
      worldSlug: "terra",
    });

    assert.equal(context.contextType, "npc");
    assert.equal(context.worldSlug, "terra");
  });

  it("lists contextual actions for sessions", () => {
    const actions = listGeneratorActions({
      contextType: "session",
      contextId: "s1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "prepare_next_session"));
    assert.ok(actions.every((action) => action.reviewRequired));
  });

  it("lists faction simulation for faction pages", () => {
    const actions = listGeneratorActions({
      contextType: "faction",
      contextId: "f1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "simulate_faction"));
  });

  it("detects missing NPC motivation", () => {
    const hints = detectMissingContent({
      pageType: "npc",
      summary: "",
      contentBlocks: [],
    });

    assert.ok(hints.some((hint) => hint.field === "summary"));
  });

  it("detects missing room read-aloud", () => {
    const hints = detectMissingContent({
      pageType: "room",
      contentBlocks: [{ type: "gm_note", content: "secret" }],
      prepStatus: "unprepared",
    });

    assert.ok(hints.some((hint) => hint.field === "player_text"));
  });

  it("lists structured npc generator for npc pages", () => {
    const actions = listGeneratorActions({
      contextType: "npc",
      contextId: "n1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "generate_npc"));
  });

  it("lists structured quest generator for quest pages", () => {
    const actions = listGeneratorActions({
      contextType: "quest",
      contextId: "q1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "generate_quest"));
  });

  it("lists structured item generator for item pages as review-only", () => {
    const actions = listGeneratorActions({
      contextType: "item",
      contextId: "i1",
      worldSlug: "terra",
    });

    const action = actions.find((entry) => entry.id === "generate_item");
    assert.ok(action);
    assert.equal(action.reviewRequired, true);
    assert.equal(action.requiresLocalRtx, true);
  });

  it("provides item builder default presets", () => {
    const itemPresets = DEFAULT_GENERATOR_PRESETS.filter(
      (preset) => preset.targetType === "item",
    );

    assert.ok(itemPresets.length >= 3);
    assert.ok(itemPresets.some((preset) => preset.name === "Magische Waffe"));
    assert.ok(itemPresets.some((preset) => preset.name === "Wundersamer Gegenstand"));
  });

  it("keeps structured default presets aligned with the structured schemas", () => {
    for (const preset of DEFAULT_GENERATOR_PRESETS) {
      if (!isStructuredGeneratorTarget(preset.targetType)) {
        continue;
      }

      const template = parseGeneratorPresetTemplate(preset.template);
      if (!template.structured) {
        continue;
      }

      const schema = getStructuredGeneratorSchema(preset.targetType);
      const knownIds = new Set(schema.fields.map((field) => field.id));
      for (const fieldId of template.fieldIds) {
        assert.ok(knownIds.has(fieldId), `${preset.name}: unbekanntes Feld ${fieldId}`);
      }
      for (const fieldId of Object.keys(template.defaults)) {
        assert.ok(knownIds.has(fieldId), `${preset.name}: unbekanntes Default-Feld ${fieldId}`);
      }
    }
  });
});
