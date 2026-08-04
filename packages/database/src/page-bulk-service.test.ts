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
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, content: "Inhalt A" },
      ],
    });
    const b = await repo.createPage({
      worldId: world.id,
      title: "Seite B",
      slug: "b",
      type: "lore",
      contentBlocks: [],
    });
    pageA = a.id;
    pageB = b.id;
  });


  it("setzt und entzieht die Portal-Freigabe als Massenaktion", async () => {
    // Der Weg nach dem #85-Deploy: alle Bestandsseiten stehen auf „nicht
    // freigegeben" — die Massenaktion gibt sie frei, ohne Einzel-Checkboxen.
    const released = await service.apply(worldSlug, [pageA, pageB], {
      kind: "portalRelease",
      released: true,
    });
    assert.equal(released.ok, true);
    assert.equal(released.changedCount, 2);

    // Idempotent: schon freigegebene Seiten zählen nicht noch einmal.
    const again = await service.apply(worldSlug, [pageA], {
      kind: "portalRelease",
      released: true,
    });
    assert.equal(again.changedCount, 0);

    const locked = await service.apply(worldSlug, [pageA], {
      kind: "portalRelease",
      released: false,
    });
    assert.equal(locked.changedCount, 1);
    const page = await db.page.findUnique({ where: { id: pageA } });
    assert.equal(page?.portalReleased, false);
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
