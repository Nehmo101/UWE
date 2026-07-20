import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCampaignEntities } from "./parser";

describe("parseCampaignEntities", () => {
  it("parses a valid entity array", () => {
    const result = parseCampaignEntities(
      JSON.stringify([
        {
          kind: "npc",
          title: "Mara",
          summary: "Wirtin",
          body: "Kennt den Pass.",
          tags: ["Dorf"],
        },
      ]),
    );

    assert.deepEqual(result, [
      {
        kind: "npc",
        title: "Mara",
        summary: "Wirtin",
        body: "Kennt den Pass.",
        tags: ["Dorf"],
      },
    ]);
  });

  it("accepts json fences and trailing prose", () => {
    const fence = String.fromCharCode(96).repeat(3);
    const fenced = parseCampaignEntities(
      fence + 'json\n[{"kind":"lore","title":"Sage","body":"Alt"}]\n' + fence,
    );
    const trailing = parseCampaignEntities(
      '[{"kind":"quest","title":"Spur","body":"Folgen"}]\nFertig.',
    );

    assert.equal(fenced[0]?.title, "Sage");
    assert.equal(trailing[0]?.kind, "quest");
  });

  it("returns an empty array for empty or invalid output", () => {
    assert.deepEqual(parseCampaignEntities("[]"), []);
    assert.deepEqual(parseCampaignEntities("kein json"), []);
  });

  it("skips malformed elements", () => {
    const result = parseCampaignEntities(
      JSON.stringify([
        { kind: "npc", title: "", body: "Fehlt" },
        { kind: "location", title: "Turm", body: "Am See" },
        null,
      ]),
    );

    assert.deepEqual(
      result.map((entity) => entity.title),
      ["Turm"],
    );
  });

  it("maps unknown kinds to note", () => {
    const result = parseCampaignEntities(
      '[{"kind":"deity","title":"Ena","body":"Sternengöttin"}]',
    );
    assert.equal(result[0]?.kind, "note");
  });
});
