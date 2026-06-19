import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectPersonalBrainTags,
  searchPersonalBrain,
  searchPersonalBrainDocuments,
  searchPersonalBrainFacts,
} from "./personal-brain-search";

const sampleDocs = [
  {
    id: "doc-1",
    title: "Homelab Router",
    content: "Backup config stored on NAS share homelab",
    category: "hardware_homelab",
    tags: ["homelab", "network"],
    updatedAt: new Date("2026-06-01"),
  },
  {
    id: "doc-2",
    title: "PLA Filament Notes",
    content: "Matte black for terrain bases",
    category: "printing_3d",
    tags: ["3d-druck"],
    updatedAt: new Date("2026-06-10"),
  },
];

const sampleFacts = [
  {
    id: "fact-1",
    title: "Preferred filament",
    content: "PLA matte black",
    factType: "material",
    tags: ["3d-druck"],
    updatedAt: new Date("2026-06-09"),
  },
];

describe("personal-brain-search", () => {
  it("scores keyword matches across title and content", () => {
    const hits = searchPersonalBrainDocuments(sampleDocs, { query: "homelab nas" });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.item.id, "doc-1");
    assert.equal(hits[0]?.matchMode, "keyword");
    assert.ok((hits[0]?.score ?? 0) >= 0.5);
  });

  it("filters documents by category", () => {
    const hits = searchPersonalBrainDocuments(sampleDocs, { category: "printing_3d" });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.item.id, "doc-2");
    assert.equal(hits[0]?.matchMode, "filter");
  });

  it("filters facts by tag", () => {
    const hits = searchPersonalBrainFacts(sampleFacts, { tag: "3d-druck" });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.item.id, "fact-1");
  });

  it("combines document and fact search", () => {
    const result = searchPersonalBrain(sampleDocs, sampleFacts, { query: "PLA" });
    assert.equal(result.documents.length, 1);
    assert.equal(result.facts.length, 1);
  });

  it("collects unique tags from docs and facts", () => {
    const tags = collectPersonalBrainTags(sampleDocs, sampleFacts);
    assert.deepEqual(tags, ["3d-druck", "homelab", "network"]);
  });
});
