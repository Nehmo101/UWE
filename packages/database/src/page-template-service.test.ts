import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { PAGE_TEMPLATES } from "./page-templates";
import {
  createPageTemplateService,
  ensureSystemPageTemplates,
  PAGE_TEMPLATE_SEED_KEY,
  type PageTemplateService,
} from "./page-template-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("page template service (DB-backed)", () => {
  let db: PrismaClient;
  let service: PageTemplateService;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    service = createPageTemplateService(db);
  });

  it("seeds the code-defined templates exactly once (no duplicates on restart)", async () => {
    const first = await ensureSystemPageTemplates(db);
    assert.equal(first.applied, true);

    // Simulated restarts: seed must be a no-op.
    const second = await ensureSystemPageTemplates(db);
    const third = await ensureSystemPageTemplates(db);
    assert.equal(second.applied, false);
    assert.equal(third.applied, false);

    const count = await db.pageTemplate.count();
    assert.equal(count, PAGE_TEMPLATES.length);

    const seedEntry = await db.seedHistory.findUnique({
      where: { key: PAGE_TEMPLATE_SEED_KEY },
    });
    assert.ok(seedEntry, "seed must be tracked in seed_history");
  });

  it("resolves templates by legacy slug (existing ?template= links keep working)", async () => {
    const npc = await service.getTemplate("npc");
    assert.ok(npc);
    assert.equal(npc.slug, "npc");
    assert.equal(npc.pageType, "npc");
    assert.ok(npc.blocks.length >= 2);

    const byId = await service.getTemplate(npc.id);
    assert.equal(byId?.id, npc.id);
  });

  it("creates, edits, duplicates and deactivates user templates", async () => {
    const created = await service.createTemplate({
      name: "Tavernen-Special",
      description: "Eigene Vorlage",
      pageType: "location",
      blocks: [
        { type: "rich_text", content: "## Schankraum" },
        { type: "rich_text", content: "## Geheimgang" },
      ],
    });
    assert.equal(created.isSystem, false);
    assert.equal(created.isActive, true);
    assert.equal(created.slug, "tavernen-special");

    const updated = await service.updateTemplate(created.id, {
      name: "Tavernen-Vorlage",
    });
    assert.equal(updated.name, "Tavernen-Vorlage");
    assert.equal(updated.blocks.length, 2);

    const copy = await service.duplicateTemplate(created.id);
    assert.notEqual(copy.id, created.id);
    assert.equal(copy.slug, "tavernen-special-kopie");
    assert.equal(copy.blocks.length, 2);

    const deactivated = await service.setTemplateActive(copy.id, false);
    assert.equal(deactivated.isActive, false);

    const activeOnly = await service.listTemplates();
    assert.ok(!activeOnly.some((template) => template.id === copy.id));

    const all = await service.listTemplates({ includeInactive: true });
    assert.ok(all.some((template) => template.id === copy.id));
  });

  it("rejects templates with invalid blocks", async () => {
    await assert.rejects(
      service.createTemplate({
        name: "Kaputt",
        pageType: "lore",
        blocks: [],
      }),
      /mindestens einen Block/,
    );

    await assert.rejects(
      service.createTemplate({
        name: "Kaputt 2",
        pageType: "lore",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blocks: [{ type: "bogus", content: "" } as any],
      }),
      /unbekannter Block-Typ/,
    );
  });

  it("writes template lifecycle events to the activity log", async () => {
    const entries = await db.activityLog.findMany({
      where: { targetType: "page_template" },
    });
    assert.ok(entries.some((entry) => entry.action === "template_created"));
    assert.ok(entries.some((entry) => entry.action === "template_updated"));
  });
});
