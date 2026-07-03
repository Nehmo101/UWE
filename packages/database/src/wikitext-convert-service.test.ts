import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository, type UweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUndoService } from "./undo-service";
import {
  createWikitextConvertService,
  type WikitextConvertService,
} from "./wikitext-convert-service";

describe("wikitext convert service", () => {
  let db: PrismaClient;
  let repo: UweRepository;
  let service: WikitextConvertService;
  let worldId: string;
  const worldSlug = "convert-test";

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);
    service = createWikitextConvertService(db);

    const world = await repo.createWorld({ name: "Convert Test", slug: worldSlug });
    worldId = world.id;

    await repo.createPage({
      worldId,
      title: "Gandalf",
      slug: "gandalf",
      type: "npc",
      visibility: "dm_only",
      publishStatus: "draft",
      aliases: ["Mithrandir"],
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "dm_only",
          content: "#Der Zauberer\nEr wohnt zeitweise im Schwarzen Turm.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Schwarzer Turm",
      slug: "schwarzer-turm",
      type: "location",
      visibility: "dm_only",
      publishStatus: "draft",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "dm_only",
          content: "Mithrandir besuchte den Turm oft.\n\n\nSehr oft.",
        },
        {
          type: "statblock",
          sortOrder: 1,
          visibility: "dm_only",
          content: "Gandalf HP 100",
        },
      ],
    });
  });

  it("preview finds structure and link changes without writing", async () => {
    const preview = await service.previewWorldConversion(worldSlug);
    assert.ok(preview);
    assert.equal(preview.totalPages, 2);

    const turmBlock = preview.changedBlocks.find(
      (block) => block.pageTitle === "Schwarzer Turm",
    );
    assert.ok(turmBlock, "Turm block should be converted");
    assert.equal(
      turmBlock.nextContent,
      "[[Gandalf|Mithrandir]] besuchte den Turm oft.\n\nSehr oft.",
    );

    // Statblock stays untouched.
    assert.ok(
      preview.changedBlocks.every((block) => block.blockType !== "statblock"),
      "statblock must not be converted",
    );

    // Preview is a dry run.
    const gandalfPage = await repo.getPageBySlug(worldSlug, "gandalf");
    assert.match(gandalfPage!.contentBlocks[0]!.content, /^#Der Zauberer/);
  });

  it("apply converts blocks, logs the run and is undoable", async () => {
    const result = await service.applyWorldConversion(worldSlug);
    assert.equal(result.ok, true);
    assert.equal(result.changedPageCount, 2);
    assert.ok(result.changedBlockCount >= 2);
    assert.ok(result.undoEntryIds.length === result.changedBlockCount);

    const gandalfPage = await repo.getPageBySlug(worldSlug, "gandalf");
    assert.equal(
      gandalfPage!.contentBlocks[0]!.content,
      "# Der Zauberer\n\nEr wohnt zeitweise im Schwarzen Turm.",
    );

    const turmPage = await repo.getPageBySlug(worldSlug, "schwarzer-turm");
    const richText = turmPage!.contentBlocks.find((block) => block.type === "rich_text");
    assert.equal(
      richText!.content,
      "[[Gandalf|Mithrandir]] besuchte den Turm oft.\n\nSehr oft.",
    );

    // Activity log entry with undo reference exists.
    const activity = await db.activityLog.findFirst({
      where: { worldId, action: "content_updated" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(activity);
    assert.match(activity.summary, /Wikitext-Konvertierung/);

    // Undo restores the original content.
    const undo = createUndoService(db);
    for (const undoEntryId of result.undoEntryIds) {
      const undoResult = await undo.undo(undoEntryId);
      assert.equal(undoResult.ok, true, undoResult.message);
    }

    const restored = await repo.getPageBySlug(worldSlug, "gandalf");
    assert.equal(
      restored!.contentBlocks[0]!.content,
      "#Der Zauberer\nEr wohnt zeitweise im Schwarzen Turm.",
    );
  });

  it("second apply is a no-op (idempotent)", async () => {
    // Re-apply after undo, then apply again.
    await service.applyWorldConversion(worldSlug);
    const second = await service.applyWorldConversion(worldSlug);
    assert.equal(second.ok, true);
    assert.equal(second.changedBlockCount, 0);
    assert.match(second.message, /keine Änderungen/);
  });

  it("returns an error for unknown worlds", async () => {
    const result = await service.applyWorldConversion("gibt-es-nicht");
    assert.equal(result.ok, false);
    const preview = await service.previewWorldConversion("gibt-es-nicht");
    assert.equal(preview, null);
  });
});
