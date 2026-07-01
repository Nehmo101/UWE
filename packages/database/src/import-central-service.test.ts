import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import {
  executeMarkdownImport,
  previewMarkdownImport,
} from "./import-central-service";
import { createWorld } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("import central service", () => {
  let databaseUrl: string;
  let db: ReturnType<typeof createPrismaClient>;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
  });

  after(async () => {
    await db.$disconnect();
  });

  it("accepts pdf as import source for markdown pipeline", () => {
    const preview = previewMarkdownImport("# PDF Text\n\nInhalt", {
      sourceType: "pdf",
      targetType: "personal_brain",
      fileName: "notes.pdf",
    });

    assert.equal(preview.canExecute, true);
    assert.equal(preview.totalDocuments, 1);
  });

  it("previews multiple markdown documents for Life Brain", () => {
    const preview = previewMarkdownImport(
      `---
title: Erstes Dokument
category: notes
---

Inhalt eins

---

# Zweites Dokument

Inhalt zwei`,
      {
        sourceType: "markdown",
        targetType: "personal_brain",
        fileName: "bundle.md",
      },
    );

    assert.equal(preview.totalDocuments, 2);
    assert.equal(preview.items[0]?.title, "Erstes Dokument");
    assert.equal(preview.items[1]?.title, "Zweites Dokument");
    assert.equal(preview.canExecute, true);
  });

  it("imports selected documents into Life Brain", async () => {
    const lifeAdmin = createLifeAdminService(db);
    const beforeCount = (await lifeAdmin.listPersonalBrainDocuments()).length;

    const content = `---
title: Brain Import A
---

Alpha

---

# Brain Import B

Beta`;

    const result = await executeMarkdownImport(
      db,
      content,
      {
        sourceType: "obsidian",
        targetType: "personal_brain",
      },
      { itemIds: ["doc-0"] },
    );

    assert.equal(result.created, 1);
    assert.equal(result.skipped, 1);
    assert.equal(result.failed, 0);

    const afterDocs = await lifeAdmin.listPersonalBrainDocuments();
    assert.equal(afterDocs.length, beforeCount + 1);
    assert.ok(afterDocs.some((doc) => doc.title === "Brain Import A"));
  });

  it("imports markdown chunks into Capture as quick notes", async () => {
    const lifeAdmin = createLifeAdminService(db);
    const beforeCount = (await lifeAdmin.listCaptures({ status: "inbox" })).length;

    const result = await executeMarkdownImport(
      db,
      `# Capture One\n\nErster Text\n\n---\n\n# Capture Two\n\nZweiter Text`,
      {
        sourceType: "markdown",
        targetType: "capture",
      },
    );

    assert.equal(result.created, 2);
    assert.equal(result.failed, 0);

    const captures = await lifeAdmin.listCaptures({ status: "inbox" });
    assert.equal(captures.length, beforeCount + 2);
    assert.ok(captures.some((entry) => entry.title === "Capture One"));
    assert.ok(captures.some((entry) => entry.title === "Capture Two"));
  });

  it("creates a single DnD page from markdown", async () => {
    const world = await createWorld(
      { name: "Import Central World", slug: "import-central-world", description: "Test" },
      databaseUrl,
    );

    const result = await executeMarkdownImport(
      db,
      `---
title: Verlorene Mine
type: dungeon
---

# Eingang

Eine alte Zwergenmine.`,
      {
        sourceType: "markdown",
        targetType: "dnd_page",
        worldId: world.id,
        worldSlug: world.slug,
        fileName: "mine.md",
      },
    );

    assert.equal(result.created, 1);
    assert.equal(result.failed, 0);

    const page = await db.page.findFirst({
      where: { worldId: world.id, title: "Verlorene Mine" },
      include: { contentBlocks: true },
    });

    assert.ok(page);
    assert.equal(page.type, "dungeon");
    assert.equal(page.contentBlocks.length, 1);
    assert.match(page.contentBlocks[0]?.content ?? "", /Zwergenmine/);
  });
});
