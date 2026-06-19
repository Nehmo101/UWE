import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPersonalBrainFactsByQuery,
  serializePersonalBrainRetrievalForPrompt,
} from "./personal-brain-context";

describe("personal brain retrieval context", () => {
  it("filters facts by query terms", () => {
    const facts = [
      { title: "Router", content: "Backup on NAS", factType: "homelab" },
      { title: "Paint", content: "Vallejo green", factType: "workshop" },
    ];

    const filtered = filterPersonalBrainFactsByQuery(facts, "router backup", 5);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.title, "Router");
  });

  it("serializes retrieved chunks for prompts", () => {
    const text = serializePersonalBrainRetrievalForPrompt(
      [
        {
          documentTitle: "Homelab",
          category: "hardware_homelab",
          content: "SSH via 192.168.1.10",
        },
      ],
      [],
    );

    assert.match(text, /relevante Ausschnitte/);
    assert.match(text, /Homelab/);
    assert.match(text, /SSH via/);
  });
});
