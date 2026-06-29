import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDbBrainKnowledgeSource } from "./db-brain-knowledge-source";
import type { BrainStoreService } from "@uwe/database/server";

function createMockBrainStore(): BrainStoreService {
  return {
    listDocuments: async () => [
      {
        id: "doc-1",
        title: "Canon Fact",
        content: "The dragon sleeps under the mountain.",
        visibility: "dm_only",
        documentType: "canon_facts",
        pageId: null,
        status: "published",
      },
    ],
    listFacts: async () => [],
    listSearchableChunks: async () => [
      {
        id: "chunk-1",
        documentId: "doc-1",
        content: "dragon mountain sleep",
        chunkIndex: 0,
        embedding: null,
        document: {
          title: "Canon Fact",
          visibility: "dm_only",
          documentType: "canon_facts",
        },
      },
    ],
  } as unknown as BrainStoreService;
}

describe("createDbBrainKnowledgeSource", () => {
  it("uses list fallback with reduced cap when no query is provided", async () => {
    const source = createDbBrainKnowledgeSource(createMockBrainStore(), "terra");
    const entries = await source.findRelevant({
      worldId: "world-1",
      taskType: "summarize_page",
      allowDmOnly: true,
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.sourceType, "brain_document:canon_facts");
  });

  it("prefers semantic chunk results when query is provided", async () => {
    const source = createDbBrainKnowledgeSource(createMockBrainStore(), "terra");
    const entries = await source.findRelevant({
      worldId: "world-1",
      taskType: "summarize_page",
      allowDmOnly: true,
      query: "dragon mountain",
      maxEntries: 4,
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.sourceType, "brain_chunk:canon_facts");
    assert.match(entries[0]?.content ?? "", /dragon mountain sleep/);
  });
});
