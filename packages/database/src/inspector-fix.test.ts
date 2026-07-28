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



  it("remove_broken_wiki_link converts the link to plain text and is undoable", async () => {
    const page = await repo.createPage({
      worldId,
      title: "Kaputte Links",
      slug: "kaputte-links",
      type: "lore",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
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

});
