import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createActivityLogService, type ActivityLogService } from "./activity-log-service";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository, type UweRepository } from "./repository";
import { runSeedOnce, isSeedApplied } from "./seed-tracker";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUndoService, type UndoService } from "./undo-service";

describe("activity log + undo basis", () => {
  let db: PrismaClient;
  let repo: UweRepository;
  let activity: ActivityLogService;
  let undo: UndoService;
  let worldId: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);
    activity = createActivityLogService(db);
    undo = createUndoService(db);

    const world = await repo.createWorld({ name: "Audit Test", slug: "audit-test" });
    worldId = world.id;
  });

  it("records and lists entries newest-first with undo info", async () => {
    await activity.log({
      worldId,
      worldSlug: "audit-test",
      action: "content_created",
      targetType: "page",
      targetId: "p1",
      targetLabel: "Erste Seite",
      targetHref: "/worlds/audit-test/lore/erste-seite",
      summary: "Seite „Erste Seite“ erstellt.",
    });
    await activity.log({
      worldId,
      worldSlug: "audit-test",
      action: "visibility_changed",
      targetType: "page",
      targetId: "p1",
      summary: "Sichtbarkeit geändert.",
      details: { from: "dm_only", to: "player_visible" },
    });

    const entries = await activity.list({ worldId });
    assert.ok(entries.length >= 2);
    assert.equal(entries[0].action, "visibility_changed");
    assert.equal(entries[0].details && (entries[0].details as { to: string }).to, "player_visible");
    assert.equal(entries[1].targetHref, "/worlds/audit-test/lore/erste-seite");
  });

  it("survives deletion of the logged object (no FK to content)", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Kurzlebig",
      slug: "kurzlebig",
      type: "note",
      visibility: "dm_only",
      publishStatus: "draft",
    });

    await activity.log({
      worldId,
      action: "content_created",
      targetType: "page",
      targetId: page.id,
      targetLabel: "Kurzlebig",
      summary: "Seite „Kurzlebig“ erstellt.",
    });

    await db.page.delete({ where: { id: page.id } });

    const entries = await activity.list({ worldId });
    assert.ok(entries.some((entry) => entry.targetLabel === "Kurzlebig"));
  });

  it("restores a deleted page including its blocks", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Wiederkehrer",
      slug: "wiederkehrer",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "draft",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "dm_only", content: "Inhalt A" },
        { type: "gm_note", sortOrder: 1, visibility: "dm_only", content: "Notiz B" },
      ],
    });

    const entry = await undo.capturePageDelete(page.id);
    await db.page.delete({ where: { id: page.id } });
    assert.equal(await db.page.findUnique({ where: { id: page.id } }), null);

    const result = await undo.undo(entry.id);
    assert.equal(result.ok, true);

    const restored = await db.page.findUnique({
      where: { id: page.id },
      include: { contentBlocks: { orderBy: { sortOrder: "asc" } } },
    });
    assert.ok(restored);
    assert.equal(restored.title, "Wiederkehrer");
    assert.equal(restored.contentBlocks.length, 2);
    assert.equal(restored.contentBlocks[1].content, "Notiz B");
  });

  it("restores a deleted content block", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Blockhalter",
      slug: "blockhalter",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "draft",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "dm_only", content: "Bleibt." },
        { type: "rich_text", sortOrder: 1, visibility: "dm_only", content: "Wird gelöscht." },
      ],
    });

    const blocks = await db.contentBlock.findMany({
      where: { pageId: page.id },
      orderBy: { sortOrder: "asc" },
    });
    const doomed = blocks[1];

    const entry = await undo.captureBlock(doomed.id, "block.delete");
    await db.contentBlock.delete({ where: { id: doomed.id } });

    const result = await undo.undo(entry.id);
    assert.equal(result.ok, true);

    const restored = await db.contentBlock.findUnique({ where: { id: doomed.id } });
    assert.ok(restored);
    assert.equal(restored.content, "Wird gelöscht.");
  });

  it("refuses double-undo", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Einmaliger",
      slug: "einmaliger",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "draft",
    });

    const entry = await undo.capturePageUpdate(page.id);
    await db.page.update({ where: { id: page.id }, data: { visibility: "player_visible" } });

    const first = await undo.undo(entry.id);
    assert.equal(first.ok, true);

    const second = await undo.undo(entry.id);
    assert.equal(second.ok, false);
    assert.match(second.message, /bereits/);
  });

  it("tracks seeds idempotently via seed_history", async () => {
    let runs = 0;
    const seed = async () => {
      runs += 1;
      return { ranAt: runs };
    };

    const first = await runSeedOnce(db, "test.seed", 1, seed);
    const second = await runSeedOnce(db, "test.seed", 1, seed);
    assert.equal(first.applied, true);
    assert.equal(second.applied, false);
    assert.equal(runs, 1);
    assert.equal(await isSeedApplied(db, "test.seed", 1), true);
    assert.equal(await isSeedApplied(db, "test.seed", 2), false);

    // A higher version runs again.
    const upgraded = await runSeedOnce(db, "test.seed", 2, seed);
    assert.equal(upgraded.applied, true);
    assert.equal(runs, 2);
  });
});
