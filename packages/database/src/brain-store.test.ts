import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createBrainStoreService,
  filterBrainByVisibility,
  isPortalBrainVisibility,
} from "./brain-store-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("UWE brain store", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let worldId: string;
  let pageId: string;
  let documentId: string;
  let factId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);
    const brain = createBrainStoreService(databaseUrl);

    const world = await repo.createWorld({
      name: "Brain Test World",
      slug: "brain-test",
      description: "Brain store tests",
    });
    worldSlug = world.slug;
    worldId = world.id;

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Main Campaign",
      slug: "main",
    });

    const page = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Test Location",
      slug: "test-location",
      type: "location",
      visibility: "player_visible",
      publishStatus: "published",
    });
    pageId = page.id;

    const document = await brain.createDocument({
      worldId: world.id,
      campaignId: campaign.id,
      pageId: page.id,
      title: "DM-only lore document",
      content: "Secret background for the location.",
      documentType: "location_facts",
      visibility: "dm_only",
      source: "manual",
      status: "canonical",
    });
    documentId = document.id;

    await brain.replaceDocumentChunks(document.id, [
      { chunkIndex: 0, content: "Secret background for the location.", tokenCount: 8 },
    ]);

    const playerDoc = await brain.createDocument({
      worldId: world.id,
      title: "Player-visible recap",
      content: "The party visited the town square.",
      documentType: "session_summary",
      visibility: "player_visible",
      source: "session_summary",
      status: "canonical",
    });

    await brain.replaceDocumentChunks(playerDoc.id, [
      { chunkIndex: 0, content: "The party visited the town square.", tokenCount: 7 },
    ]);

    const fact = await brain.createFact({
      worldId: world.id,
      pageId: page.id,
      title: "Hidden NPC motive",
      content: "The mayor is secretly a werewolf.",
      factType: "npc",
      visibility: "dm_only",
      status: "canonical",
    });
    factId = fact.id;

    await brain.createFact({
      worldId: world.id,
      title: "Public town fact",
      content: "The town is known for its market.",
      factType: "location",
      visibility: "public",
      status: "canonical",
    });

    await brain.createLink({
      worldId: world.id,
      sourceType: "brain_document",
      sourceId: document.id,
      targetType: "page",
      targetId: page.id,
      relationType: "describes",
    });
  });

  after(async () => {
    const db = createPrismaClient(databaseUrl);
    await db.$disconnect();
  });

  it("lists all documents for DM context", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const documents = await brain.listDocuments(worldSlug, { accessContext: "dm" });
    assert.ok(documents.length >= 2);
  });

  it("filters documents by portal visibility", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const portalDocs = await brain.listDocuments(worldSlug, { accessContext: "portal" });
    assert.ok(portalDocs.every((doc) => isPortalBrainVisibility(doc.visibility)));
    assert.ok(portalDocs.some((doc) => doc.visibility === "player_visible"));
    assert.ok(!portalDocs.some((doc) => doc.visibility === "dm_only"));
  });

  it("filters facts by portal visibility", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const portalFacts = await brain.listFacts(worldSlug, { accessContext: "portal" });
    assert.ok(portalFacts.every((fact) => isPortalBrainVisibility(fact.visibility)));
    assert.ok(portalFacts.some((fact) => fact.visibility === "public"));
    assert.ok(!portalFacts.some((fact) => fact.visibility === "dm_only"));
  });

  it("creates and updates a brain document", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const created = await brain.createDocument({
      worldId,
      title: "New draft",
      content: "Initial content",
      status: "draft",
    });
    assert.equal(created.title, "New draft");

    const updated = await brain.updateDocument(created.id, {
      title: "Updated draft",
      status: "canonical",
    });
    assert.equal(updated.title, "Updated draft");
    assert.equal(updated.status, "canonical");
  });

  it("stores chunks on a document", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const doc = await brain.getDocumentById(documentId);
    assert.ok(doc);
    assert.equal(doc.chunks.length, 1);
    assert.equal(doc.chunks[0]?.content, "Secret background for the location.");
  });

  it("creates links between brain entries and pages", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const links = await brain.listLinksForSource(worldSlug, "brain_document", documentId);
    assert.equal(links.length, 1);
    assert.equal(links[0]?.targetType, "page");
    assert.equal(links[0]?.targetId, pageId);
  });

  it("returns world summary counts", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const summary = await brain.getWorldSummary(worldSlug);
    assert.ok(summary);
    assert.ok(summary.documentCount >= 2);
    assert.ok(summary.factCount >= 2);
    assert.ok(summary.chunkCount >= 2);
    assert.ok(summary.linkCount >= 1);
  });

  it("persists and queries visibility correctly", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const created = await brain.createDocument({
      worldId,
      title: "Visibility test doc",
      visibility: "player_visible",
      status: "draft",
    });
    assert.equal(created.visibility, "player_visible");

    const fetched = await brain.getDocumentById(created.id);
    assert.ok(fetched);
    assert.equal(fetched.visibility, "player_visible");

    const portalDocs = await brain.listDocuments(worldSlug, { accessContext: "portal" });
    assert.ok(portalDocs.some((doc) => doc.id === created.id));

    const dmOnly = await brain.createFact({
      worldId,
      title: "Secret fact",
      visibility: "dm_only",
      status: "draft",
    });
    const portalFacts = await brain.listFacts(worldSlug, { accessContext: "portal" });
    assert.ok(!portalFacts.some((fact) => fact.id === dmOnly.id));
  });

  it("filterBrainByVisibility helper respects context", () => {
    const items = [
      { id: "1", visibility: "dm_only" as const },
      { id: "2", visibility: "player_visible" as const },
      { id: "3", visibility: "public" as const },
    ];
    const portal = filterBrainByVisibility(items, "portal");
    assert.equal(portal.length, 2);
    const dm = filterBrainByVisibility(items, "dm");
    assert.equal(dm.length, 3);
  });

  it("updates a brain fact", async () => {
    const brain = createBrainStoreService(databaseUrl);
    const updated = await brain.updateFact(factId, {
      content: "Updated motive text",
      status: "deprecated",
    });
    assert.equal(updated.content, "Updated motive text");
    assert.equal(updated.status, "deprecated");
  });
});
