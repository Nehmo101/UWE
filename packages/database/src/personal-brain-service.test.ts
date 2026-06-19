import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createPersonalBrainService } from "./personal-brain-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("personal brain service", () => {
  let db: PrismaClient;
  let service: ReturnType<typeof createPersonalBrainService>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    service = createPersonalBrainService(db);
  });

  it("replaces document chunks", async () => {
    const document = await db.personalBrainDocument.create({
      data: {
        title: "Homelab",
        content: "Router backup location and restore steps.",
      },
    });

    await service.replaceDocumentChunks(document.id, [
      {
        chunkIndex: 0,
        content: "Router backup location",
        tokenCount: 4,
        embedding: [0.1, 0.2, 0.3],
      },
    ]);

    const chunks = await service.listSearchableChunks([document.id]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.content, "Router backup location");
    assert.deepEqual(chunks[0]?.embedding, [0.1, 0.2, 0.3]);
  });

  it("reports index status per document", async () => {
    const document = await db.personalBrainDocument.create({
      data: { title: "Status doc", content: "Chunked content for status." },
    });

    await service.replaceDocumentChunks(document.id, [
      { chunkIndex: 0, content: "A", embedding: [1, 0] },
      { chunkIndex: 1, content: "B", embedding: null },
    ]);

    const statuses = await service.getIndexStatusForDocuments();
    const status = statuses.find((entry) => entry.documentId === document.id);
    assert.equal(status?.chunkCount, 2);
    assert.equal(status?.embeddedCount, 1);
  });
});
