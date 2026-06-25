import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPersonalBrainFactsByQuery,
  loadPersonalBrainPromptContext,
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

  it("loads query-focused context via semantic chunk retrieval", async () => {
    const context = await loadPersonalBrainPromptContext({
      query: "router backup",
      retrievalLimit: 4,
      loadDocs: async () => [
        { title: "Unused full doc", content: "Should not appear when retrieval hits", category: null },
      ],
      loadFacts: async () => [
        { title: "Router VLAN", content: "Guest network isolated", factType: "homelab" },
        { title: "Paint shelf", content: "Vallejo rack B", factType: "workshop" },
      ],
      searchChunks: async () => [
        {
          documentTitle: "Homelab notes",
          category: "hardware_homelab",
          content: "Router backup stored on NAS volume backup/life",
          score: 0.91,
        },
      ],
    });

    assert.match(context, /relevante Ausschnitte/);
    assert.match(context, /Homelab notes/);
    assert.match(context, /Router VLAN/);
    assert.doesNotMatch(context, /Unused full doc/);
  });
});
