import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  createPersonalBrainService,
  createPrismaClient,
  createTestDatabaseUrl,
} from "@uwe/database/server";
import { MockEmbeddingProvider } from "./provider";
import { indexPersonalBrainDocument } from "./personal-brain-indexer";
import { semanticSearchPersonalBrainChunks } from "./personal-brain-search";

describe("personal brain embeddings", () => {
  const db = createPrismaClient(createTestDatabaseUrl());
  const service = createPersonalBrainService(db);
  const provider = new MockEmbeddingProvider("personal-brain-mock");

  before(async () => {
    const document = await db.personalBrainDocument.create({
      data: {
        title: "Miniature storage",
        content: "Store painted miniatures away from direct sunlight.\nUse clear boxes with silica gel.",
      },
    });

    await indexPersonalBrainDocument(service, document.id, provider, {
      useMock: true,
      force: true,
    });
  });

  it("finds relevant chunks via semantic search", async () => {
    const results = await semanticSearchPersonalBrainChunks(
      service,
      { query: "painted miniatures sunlight", limit: 3 },
      provider,
    );

    assert.ok(results.length >= 1);
    assert.match(results[0]?.content ?? "", /miniatures/i);
  });
});
