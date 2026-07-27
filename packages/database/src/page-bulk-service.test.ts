import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository, type UweRepository } from "./repository";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";
import { createUndoService } from "./undo-service";
import { parseStringArray } from "./json-utils";
import { createPageBulkService, type PageBulkService } from "./page-bulk-service";

describe("page bulk service", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;
  let repo: UweRepository;
  let service: PageBulkService;
  const worldSlug = "bulk-test";
  let pageA: string;
  let pageB: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    brainDb = createTestBrainClient();
    repo = createUweRepository(databaseUrl);
    service = createPageBulkService(db);

    const world = await repo.createWorld({ name: "Bulk", slug: worldSlug });

    const a = await repo.createPage({
      worldId: world.id,
      title: "Seite A",
      slug: "a",
      type: "npc",
      visibility: "dm_only",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "dm_only", content: "Inhalt A" },
      ],
    });
    const b = await repo.createPage({
      worldId: world.id,
      title: "Seite B",
      slug: "b",
      type: "lore",
      visibility: "dm_only",
      contentBlocks: [],
    });
    pageA = a.id;
    pageB = b.id;
  });

  it("sets visibility for the whole selection and is undoable", async () => {
    const result = await service.apply(worldSlug, [pageA, pageB], {
      kind: "visibility",
      visibility: "player_visible",
    });
    assert.equal(result.ok, true);
    assert.equal(result.changedCount, 2);

    assert.equal((await repo.getPageBySlug(worldSlug, "a"))!.visibility, "player_visible");
    assert.equal((await repo.getPageBySlug(worldSlug, "b"))!.visibility, "player_visible");

    const undo = createUndoService(brainDb, db);
    for (const id of result.undoEntryIds) {
      assert.equal((await undo.undo(id)).ok, true);
    }
    assert.equal((await repo.getPageBySlug(worldSlug, "a"))!.visibility, "dm_only");
  });

  it("adds tags without duplicates and removes them again", async () => {
    const added = await service.apply(worldSlug, [pageA], {
      kind: "addTags",
      tags: ["Neu", "Alt", "neu"],
    });
    assert.equal(added.changedCount, 1);
    assert.deepEqual(parseStringArray((await repo.getPageBySlug(worldSlug, "a"))!.tags), [
      "Neu",
      "Alt",
    ]);

    const removed = await service.apply(worldSlug, [pageA], {
      kind: "removeTags",
      tags: ["alt"],
    });
    assert.equal(removed.changedCount, 1);
    assert.deepEqual(parseStringArray((await repo.getPageBySlug(worldSlug, "a"))!.tags), ["Neu"]);
  });

  it("ignores page ids that belong to another world", async () => {
    const other = await repo.createWorld({ name: "Andere Welt", slug: "other-bulk" });
    const foreign = await repo.createPage({
      worldId: other.id,
      title: "Fremd",
      slug: "fremd",
      type: "npc",
      visibility: "dm_only",
      contentBlocks: [],
    });

    const result = await service.apply(worldSlug, [foreign.id], {
      kind: "visibility",
      visibility: "public",
    });
    assert.equal(result.ok, false);
    assert.equal((await repo.getPageBySlug("other-bulk", "fremd"))!.visibility, "dm_only");
  });

  it("deletes selected pages and can restore them via undo", async () => {
    const result = await service.apply(worldSlug, [pageB], { kind: "delete" });
    assert.equal(result.changedCount, 1);
    assert.equal(await repo.getPageBySlug(worldSlug, "b"), null);

    const undo = createUndoService(brainDb, db);
    for (const id of result.undoEntryIds) {
      const undone = await undo.undo(id);
      assert.equal(undone.ok, true, undone.message);
    }
    const restored = await repo.getPageBySlug(worldSlug, "b");
    assert.ok(restored);
    assert.equal(restored!.title, "Seite B");
  });
});
