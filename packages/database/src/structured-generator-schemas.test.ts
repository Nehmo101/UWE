import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGeneratorPresetToSchema,
  buildStructuredGeneratorPrompt,
  formatStructuredGeneratorMarkdown,
  getStructuredGeneratorSchema,
  parseGeneratorPresetTemplate,
  parseStructuredGeneratorOutput,
  STRUCTURED_GENERATOR_FIELD_MAX_LENGTH,
  validateStructuredGeneratorInput,
} from "./structured-generator-schemas";

describe("structured generator schemas", () => {
  it("builds npc prompt with provided inputs", () => {
    const schema = getStructuredGeneratorSchema("npc");
    const prompt = buildStructuredGeneratorPrompt(schema, "Gundren", {
      motivation: "Schutz der Mine",
    });

    assert.match(prompt, /Gundren/);
    assert.match(prompt, /Motivation/);
    assert.match(prompt, /JSON/);
  });

  it("parses structured npc output", () => {
    const schema = getStructuredGeneratorSchema("npc");
    const output = parseStructuredGeneratorOutput(
      JSON.stringify({
        fields: {
          motivation: "Rache",
          voice: "Knapp und misstrauisch",
        },
        summary: "Zwergenabenteurer",
      }),
      schema,
    );

    assert.equal(output.fields.motivation, "Rache");
    assert.equal(output.summary, "Zwergenabenteurer");
  });

  it("formats markdown for review apply", () => {
    const schema = getStructuredGeneratorSchema("quest");
    const markdown = formatStructuredGeneratorMarkdown(schema, {
      fields: {
        patron: "Bürgermeister",
        objective: "Den Turm sichern",
      },
    });

    assert.match(markdown, /Auftraggeber/);
    assert.match(markdown, /Bürgermeister/);
  });

  it("exposes builder fields for rarity, attunement and srd base on items", () => {
    const schema = getStructuredGeneratorSchema("item");
    const ids = schema.fields.map((field) => field.id);

    assert.ok(ids.includes("rarity"));
    assert.ok(ids.includes("attunement"));
    assert.ok(ids.includes("srdBase"));
  });

  it("validates required quest builder input", () => {
    const schema = getStructuredGeneratorSchema("quest");
    const result = validateStructuredGeneratorInput(schema, { twist: "Verrat" });

    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.fieldId === "patron"));
    assert.ok(result.issues.some((issue) => issue.fieldId === "objective"));
  });

  it("rejects unknown structured input fields", () => {
    const schema = getStructuredGeneratorSchema("quest");
    const result = validateStructuredGeneratorInput(schema, {
      patron: "Bürgermeister",
      objective: "Den Turm sichern",
      evil: "nein",
    });

    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.fieldId === "evil"));
  });

  it("rejects overlong structured input values", () => {
    const schema = getStructuredGeneratorSchema("item");
    const result = validateStructuredGeneratorInput(schema, {
      properties: "x".repeat(STRUCTURED_GENERATOR_FIELD_MAX_LENGTH + 1),
    });

    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.fieldId === "properties"));
  });

  it("trims valid structured input and drops empty fields", () => {
    const schema = getStructuredGeneratorSchema("quest");
    const result = validateStructuredGeneratorInput(schema, {
      patron: "  Bürgermeister ",
      objective: "Den Turm sichern",
      twist: "   ",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.values, {
      patron: "Bürgermeister",
      objective: "Den Turm sichern",
    });
  });

  it("parses generator preset templates with fields and defaults", () => {
    const template = parseGeneratorPresetTemplate({
      structured: true,
      fields: ["rarity", "attunement", ""],
      defaults: { rarity: "selten", curse: 3 },
    });

    assert.equal(template.structured, true);
    assert.deepEqual(template.fieldIds, ["rarity", "attunement"]);
    assert.deepEqual(template.defaults, { rarity: "selten" });
  });

  it("parses unknown preset template shapes as empty", () => {
    const template = parseGeneratorPresetTemplate("not-a-template");

    assert.equal(template.structured, false);
    assert.deepEqual(template.fieldIds, []);
    assert.deepEqual(template.defaults, {});
  });

  it("applies presets to schemas but keeps required fields", () => {
    const schema = getStructuredGeneratorSchema("item");
    const applied = applyGeneratorPresetToSchema(schema, {
      structured: true,
      fields: ["rarity", "attunement"],
    });

    const ids = applied.fields.map((field) => field.id);
    assert.deepEqual(ids, ["rarity", "attunement", "properties"]);
  });

  it("falls back to the full schema when a preset selects no known fields", () => {
    const schema = getStructuredGeneratorSchema("item");
    const applied = applyGeneratorPresetToSchema(schema, {
      structured: true,
      fields: ["does-not-exist"],
    });

    assert.equal(applied.fields.length, schema.fields.length);
  });
});
