import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStructuredGeneratorPrompt,
  formatStructuredGeneratorMarkdown,
  getStructuredGeneratorSchema,
  parseStructuredGeneratorOutput,
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
});
