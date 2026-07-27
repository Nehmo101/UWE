import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  createBrainStoreService,
  createWorld,
} from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  BrainEmbeddingOfflineError,
  checkEmbeddingHealth,
  chunkBrainText,
  cosineSimilarity,
  createEmbeddingProvider,
  deterministicMockVector,
  indexBrainDocument,
  reindexBrainWorld,
  semanticSearchBrainChunks,
} from "./index";

describe("Embeddings — chunking", () => {
  it("chunks text deterministically", () => {
    const text = "Absatz eins.\n\nAbsatz zwei mit mehr Inhalt.\n\nAbsatz drei.";
    const first = chunkBrainText(text, { maxChars: 30, overlap: 5 });
    const second = chunkBrainText(text, { maxChars: 30, overlap: 5 });

    assert.deepEqual(first, second);
    assert.ok(first.length > 1);
  });

  it("includes the document title in the first chunk", () => {
    const chunks = chunkBrainText("Inhalt über den Wald.", {
      includeTitle: "Arbor",
      maxChars: 200,
    });

    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]?.startsWith("Arbor"));
  });
});

describe("Embeddings — cosine similarity", () => {
  it("returns 1 for identical vectors", () => {
    const vector = deterministicMockVector("test", 8);
    assert.ok(Math.abs(cosineSimilarity(vector, vector) - 1) < 1e-9);
  });
});

describe("Embeddings — indexing and search", () => {
  let databaseUrl: string;

  beforeEach(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  afterEach(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("indexes brain chunks and stores vectors in UWE", async () => {
    const brainStore = createBrainStoreService(databaseUrl);
    const world = await createWorld({ name: "Brain", slug: "brain-embed" }, databaseUrl);
    const provider = createEmbeddingProvider({ useMock: true });

    const document = await brainStore.createDocument({
      worldId: world.id,
      title: "Validori",
      content: "Validori ist eine weise Magisterin im Turm von Arbor.",
      status: "canonical",
    });

    const result = await indexBrainDocument(brainStore, document.id, provider, {
      useMock: true,
    });

    assert.ok(result.chunkCount >= 1);
    assert.equal(result.embeddedCount, result.chunkCount);

    const stored = await brainStore.getDocumentById(document.id);
    assert.ok(stored);
    assert.equal(stored.chunks.length, result.chunkCount);
    assert.ok(stored.chunks.every((chunk) => Array.isArray(chunk.embedding)));
  });

  it("stores chunks without vectors when provider is offline", async () => {
    const brainStore = createBrainStoreService(databaseUrl);
    const world = await createWorld({ name: "Offline", slug: "brain-offline" }, databaseUrl);
    const provider = createEmbeddingProvider({ useMock: true });

    const offlineProvider = {
      ...provider,
      healthCheck: async () => ({
        ok: false,
        provider: "mock" as const,
        message: "offline",
      }),
      embedText: provider.embedText.bind(provider),
    };

    const document = await brainStore.createDocument({
      worldId: world.id,
      title: "Offline-Dokument",
      content: "Dieser Text wird ohne Vektoren gespeichert.",
      status: "canonical",
    });

    const result = await indexBrainDocument(brainStore, document.id, offlineProvider);
    assert.equal(result.embeddedCount, 0);
    assert.equal(result.providerOnline, false);

    const stored = await brainStore.getDocumentById(document.id);
    assert.ok(stored);
    assert.ok(stored.chunks.length > 0);
    assert.ok(stored.chunks.every((chunk) => chunk.embedding == null));
  });

  it("rejects reindex when RTX provider is offline", async () => {
    const brainStore = createBrainStoreService(databaseUrl);
    const world = await createWorld({ name: "Reindex", slug: "brain-reindex" }, databaseUrl);
    const provider = createEmbeddingProvider({ useMock: true });

    await brainStore.createDocument({
      worldId: world.id,
      title: "Dokument",
      content: "Inhalt für Reindex.",
      status: "canonical",
    });

    const offlineProvider = {
      ...provider,
      healthCheck: async () => ({
        ok: false,
        provider: "mock" as const,
        message: "offline",
      }),
      embedText: provider.embedText.bind(provider),
    };

    await assert.rejects(
      () => reindexBrainWorld(brainStore, world.slug, offlineProvider),
      BrainEmbeddingOfflineError,
    );
  });

  it("finds relevant chunks via semantic search", async () => {
    const brainStore = createBrainStoreService(databaseUrl);
    const world = await createWorld({ name: "Search", slug: "brain-search" }, databaseUrl);
    const provider = createEmbeddingProvider({ useMock: true });

    const npcDoc = await brainStore.createDocument({
      worldId: world.id,
      title: "NPC Validori",
      content: "Validori leitet den Magisterturm und kennt alte Runen.",
      status: "canonical",
    });

    const secretDoc = await brainStore.createDocument({
      worldId: world.id,
      title: "GM Geheimnis",
      content: "Unter Arbor schlummert ein verbotenes Portal nur für den DM.",
      status: "canonical",
    });

    await indexBrainDocument(brainStore, npcDoc.id, provider, { useMock: true });
    await indexBrainDocument(brainStore, secretDoc.id, provider, { useMock: true });

    const indexedNpc = await brainStore.getDocumentById(npcDoc.id);
    const npcChunkContent = indexedNpc?.chunks[0]?.content ?? "";

    const dmResults = await semanticSearchBrainChunks(
      brainStore,
      {
        query: npcChunkContent,
        worldSlug: world.slug,
        minScore: 0.999,
      },
      provider,
    );

    assert.ok(dmResults.length > 0);
    assert.ok(dmResults.some((result) => result.documentTitle.includes("Validori")));
    assert.equal(dmResults[0]?.matchMode, "semantic");

    const portalResults = await semanticSearchBrainChunks(
      brainStore,
      {
        query: "verbotenes Portal Arbor",
        worldSlug: world.slug,
        minScore: 0.2,
      },
      provider,
    );

    assert.ok(portalResults.every((result) => result.visibility !== "dm_only"));
    assert.ok(!portalResults.some((result) => result.documentTitle.includes("GM Geheimnis")));
  });

  it("falls back to keyword search when embeddings are unavailable", async () => {
    const brainStore = createBrainStoreService(databaseUrl);
    const world = await createWorld({ name: "Keyword", slug: "brain-keyword" }, databaseUrl);

    const document = await brainStore.createDocument({
      worldId: world.id,
      title: "Wald Arbor",
      content: "Die Helden erkundeten den mystischen Wald Arbor.",
      status: "canonical",
    });

    await brainStore.replaceDocumentChunks(document.id, [
      {
        chunkIndex: 0,
        content: document.content,
        tokenCount: 10,
      },
    ]);

    const results = await semanticSearchBrainChunks(brainStore, {
      query: "Arbor Wald",
      worldSlug: world.slug,
      minScore: 0.5,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.matchMode, "keyword");
    assert.equal(results[0]?.documentTitle, "Wald Arbor");
  });

  it("reports embedding health for mock provider", async () => {
    const provider = createEmbeddingProvider({ useMock: true });
    const health = await checkEmbeddingHealth(provider);

    assert.equal(health.enabled, true);
    assert.equal(health.ok, true);
    assert.equal(health.store, "uwe-database");
  });
});
