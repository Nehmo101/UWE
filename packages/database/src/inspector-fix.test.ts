import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createInspectorFixService, type InspectorFixService } from "./inspector-fix-service";
import { createUweRepository, type UweRepository } from "./repository";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";
import { createUndoService } from "./undo-service";
import { createWorldInspectorService, type WorldInspectorService } from "./world-inspector";

describe("inspector fix actions", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;
  let repo: UweRepository;
  let fixes: InspectorFixService;
  let inspector: WorldInspectorService;
  let worldId: string;
  const worldSlug = "fix-test";

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    brainDb = createTestBrainClient();
    repo = createUweRepository(databaseUrl);
    fixes = createInspectorFixService(db);
    inspector = createWorldInspectorService(db);

    const world = await repo.createWorld({ name: "Fix Test", slug: worldSlug });
    worldId = world.id;
  });

  it("set_block_dm_only closes a gm_note leak and is undoable", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Leaky NPC",
      slug: "leaky-npc",
      type: "npc",
      visibility: "player_visible",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "gm_note",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Geheime Motivation",
        },
      ],
    });

    // Finding must exist before the fix, with target info attached.
    const before = await inspector.inspectWorld(worldSlug);
    const finding = before!.safetyFindings.find(
      (entry) => entry.code === "gm_note_player_visible" && entry.pageId === page.id,
    );
    assert.ok(finding, "leak finding expected before fix");
    assert.ok(finding.blockId, "finding must reference the affected block");
    assert.ok(finding.fixes.some((fix) => fix.action === "set_block_dm_only"));

    const result = await fixes.applyFix({
      worldSlug,
      action: "set_block_dm_only",
      blockId: finding.blockId,
    });
    assert.equal(result.ok, true);
    assert.ok(result.undoEntryId, "fix must be undoable");

    const block = await db.contentBlock.findUnique({ where: { id: finding.blockId! } });
    assert.equal(block!.visibility, "dm_only");

    // The finding must be closed after the fix.
    const after = await inspector.inspectWorld(worldSlug);
    assert.ok(
      !after!.safetyFindings.some((entry) => entry.id === finding.id),
      "finding must disappear after fix",
    );

    // An activity log entry must reference the undo entry.
    const logEntry = await db.activityLog.findFirst({
      where: { action: "inspector_fix_applied", targetId: finding.blockId },
    });
    assert.ok(logEntry);
    assert.equal(logEntry.undoEntryId, result.undoEntryId);

    // Undo restores the previous (leaky) visibility.
    const undoResult = await createUndoService(brainDb, db).undo(result.undoEntryId!);
    assert.equal(undoResult.ok, true);
    const restored = await db.contentBlock.findUnique({ where: { id: finding.blockId! } });
    assert.equal(restored!.visibility, "player_visible");

    // Re-apply so later assertions in this suite see a clean world.
    await fixes.applyFix({ worldSlug, action: "set_block_dm_only", blockId: finding.blockId });
  });

  it("set_page_dm_only hides a leaked secret page from the portal", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Verratenes Geheimnis",
      slug: "verratenes-geheimnis",
      type: "secret",
      visibility: "player_visible",
      publishStatus: "published",
    });

    const result = await fixes.applyFix({
      worldSlug,
      action: "set_page_dm_only",
      pageId: page.id,
    });
    assert.equal(result.ok, true);

    const updated = await db.page.findUnique({ where: { id: page.id } });
    assert.equal(updated!.visibility, "dm_only");
    assert.equal(await repo.getPublicPageForPortal(worldSlug, "verratenes-geheimnis"), null);

    const report = await inspector.inspectWorld(worldSlug);
    assert.ok(
      !report!.safetyFindings.some(
        (finding) => finding.code === "secret_page_portal_visible" && finding.pageId === page.id,
      ),
    );
  });

  it("publish_page resolves visible_but_unpublished", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Halbfertig",
      slug: "halbfertig",
      type: "lore",
      visibility: "player_visible",
      publishStatus: "draft",
    });

    const result = await fixes.applyFix({
      worldSlug,
      action: "publish_page",
      pageId: page.id,
    });
    assert.equal(result.ok, true);

    const updated = await db.page.findUnique({ where: { id: page.id } });
    assert.equal(updated!.publishStatus, "published");
  });

  it("remove_broken_wiki_link converts the link to plain text and is undoable", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Kaputte Links",
      slug: "kaputte-links",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "draft",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "dm_only",
          content: "Siehe [[Nicht Existent]] und [[Nicht Existent|den Ort]].",
        },
      ],
    });

    const report = await inspector.inspectWorld(worldSlug);
    const finding = report!.canonFindings.find(
      (entry) => entry.code === "broken_wiki_link" && entry.pageId === page.id,
    );
    assert.ok(finding);
    assert.equal(finding.linkTarget, "Nicht Existent");

    const result = await fixes.applyFix({
      worldSlug,
      action: "remove_broken_wiki_link",
      pageId: page.id,
      linkTarget: finding.linkTarget,
    });
    assert.equal(result.ok, true);
    assert.ok(result.undoEntryId);

    const blocks = await db.contentBlock.findMany({ where: { pageId: page.id } });
    assert.equal(blocks[0].content, "Siehe Nicht Existent und den Ort.");

    const after = await inspector.inspectWorld(worldSlug);
    assert.ok(!after!.canonFindings.some((entry) => entry.id === finding.id));

    const undoResult = await createUndoService(brainDb, db).undo(result.undoEntryId!);
    assert.equal(undoResult.ok, true);
    const restored = await db.contentBlock.findMany({ where: { pageId: page.id } });
    assert.equal(
      restored[0].content,
      "Siehe [[Nicht Existent]] und [[Nicht Existent|den Ort]].",
    );
  });

  it("assign_page_campaign assigns the single campaign of a world", async () => {
    const campaign = await repo.createCampaign({
      worldId,
      name: "Hauptkampagne",
      slug: "hauptkampagne",
    });

    const page = await repo.createPage({
      worldId,
      title: "Ohne Kampagne",
      slug: "ohne-kampagne",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "draft",
    });

    const report = await inspector.inspectWorld(worldSlug);
    const finding = report!.canonFindings.find(
      (entry) => entry.code === "uncategorized_page" && entry.pageId === page.id,
    );
    assert.ok(finding, "uncategorized_page finding expected");
    assert.ok(finding.fixes.some((fix) => fix.action === "assign_page_campaign"));

    const result = await fixes.applyFix({
      worldSlug,
      action: "assign_page_campaign",
      pageId: page.id,
    });
    assert.equal(result.ok, true);

    const updated = await db.page.findUnique({ where: { id: page.id } });
    assert.equal(updated!.campaignId, campaign.id);
  });

  it("rejects fixes for pages in other worlds", async () => {
    const otherWorld = await repo.createWorld({ name: "Other", slug: "fix-other" });
    const foreignPage = await repo.createPage({
      worldId: otherWorld.id,
      title: "Fremde Seite",
      slug: "fremde-seite",
      type: "lore",
      visibility: "player_visible",
      publishStatus: "published",
    });

    const result = await fixes.applyFix({
      worldSlug,
      action: "set_page_dm_only",
      pageId: foreignPage.id,
    });
    assert.equal(result.ok, false);

    const untouched = await db.page.findUnique({ where: { id: foreignPage.id } });
    assert.equal(untouched!.visibility, "player_visible");
  });
});
