import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createPage, createWorld } from "./repository";
import {
  assertPlayerSafeExport,
  buildLabelContentFromPage,
  createLabelService,
  normalizeLabel,
} from "./label-service";
import { renderLabelExport, renderLabelHtml } from "./label-export";
import { createPrismaClient } from "./client";

describe("Label service", () => {
  let databaseUrl: string;
  let labels: ReturnType<typeof createLabelService>;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
    labels = createLabelService(databaseUrl);
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("creates a label from a published page without dm_only blocks", async () => {
    const world = await createWorld(
      { name: "Labelwelt", slug: "labelwelt", description: "Test" },
      databaseUrl,
    );

    const page = await createPage(
      {
        worldId: world.id,
        title: "Stadt Validori",
        slug: "validori",
        type: "location",
        visibility: "public",
        publishStatus: "published",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "Eine lebendige Hafenstadt am Meer.",
          },
        ],
      },
      databaseUrl,
    );

    const template = await labels.getDefaultTemplate();
    const label = await labels.createFromSource({
      worldId: world.id,
      sourceType: "page",
      sourceId: page.id,
      templateId: template.id,
    });

    assert.equal(label.sourceType, "page");
    assert.equal(label.sourceId, page.id);
    assert.equal(label.title, "Stadt Validori");

    const parsed = normalizeLabel(label);
    assert.match(parsed.content.text, /Hafenstadt/);
    assert.equal(parsed.content.containsDmOnly, false);
  });

  it("creates a label from a dungeon room page", async () => {
    const world = await createWorld(
      { name: "Dungeonwelt", slug: "dungeonwelt", description: "Test" },
      databaseUrl,
    );

    const room = await createPage(
      {
        worldId: world.id,
        title: "Schatzkammer",
        slug: "schatzkammer",
        type: "room",
        visibility: "dm_only",
        publishStatus: "draft",
        contentBlocks: [
          {
            type: "player_text",
            sortOrder: 0,
            visibility: "player_visible",
            content: "Ein staubiger Raum voller Truhen.",
          },
          {
            type: "gm_note",
            sortOrder: 1,
            visibility: "dm_only",
            content: "Die Truhe ist trapped.",
          },
        ],
      },
      databaseUrl,
    );

    const template = await labels.getDefaultTemplate();
    const label = await labels.createFromSource({
      worldId: world.id,
      sourceType: "dungeon_room",
      sourceId: room.id,
      templateId: template.id,
    });

    assert.equal(label.sourceType, "dungeon_room");
    const parsed = normalizeLabel(label);
    assert.match(parsed.content.text, /Truhen/);
    assert.equal(parsed.content.containsDmOnly, true);
    assert.ok((parsed.content.dmOnlyBlockCount ?? 0) > 0);
  });

  it("saves and reopens a label draft", async () => {
    const world = await createWorld(
      { name: "Speicherwelt", slug: "speicherwelt", description: "Test" },
      databaseUrl,
    );

    const template = await labels.getDefaultTemplate();
    const created = await labels.createLabel({
      worldId: world.id,
      title: "Mein Entwurf",
      sourceType: "manual",
      templateId: template.id,
      content: {
        title: "Mein Entwurf",
        text: "Erster Entwurfstext.",
      },
    });

    const reopened = await labels.getLabelById(created.id);
    assert.ok(reopened);
    assert.equal(reopened.title, "Mein Entwurf");

    const updated = await labels.updateLabel(created.id, {
      content: {
        title: "Mein Entwurf",
        text: "Aktualisierter Text.",
      },
    });

    const parsed = normalizeLabel(updated);
    assert.match(parsed.content.text, /Aktualisierter Text/);
  });

  it("exports printable HTML and PDF", async () => {
    const template = await labels.getDefaultTemplate();
    const world = await createWorld(
      { name: "Exportwelt", slug: "exportwelt", description: "Test" },
      databaseUrl,
    );

    const label = await labels.createLabel({
      worldId: world.id,
      title: "Export Test",
      sourceType: "manual",
      templateId: template.id,
      content: {
        title: "Export Test",
        text: "Druckbarer Inhalt für das Label.",
      },
      layoutSettings: {
        mode: "text_only",
        truncateToPage: true,
        truncateLongWords: true,
        maxChars: 500,
        maxWordLength: 20,
        widthInches: 6,
        heightInches: 4,
      },
    });

    const parsed = normalizeLabel(label);
    const htmlExport = renderLabelExport("html", {
      content: parsed.content,
      layoutSettings: parsed.layoutSettings,
      title: label.title,
      worldName: "Exportwelt",
    });

    assert.equal(htmlExport.contentType, "text/html; charset=utf-8");
    assert.match(String(htmlExport.body), /Druckbarer Inhalt/);
    assert.match(String(htmlExport.body), /6in 4in/);

    const pdfExport = renderLabelExport("pdf", {
      content: parsed.content,
      layoutSettings: parsed.layoutSettings,
      title: label.title,
    });

    assert.equal(pdfExport.contentType, "application/pdf");
    assert.match(String(pdfExport.body).slice(0, 8), /%PDF-1.4/);
  });

  it("blocks player export when dm_only content is present without confirmation", async () => {
    const world = await createWorld(
      { name: "Sicherheitswelt", slug: "sicherheitswelt", description: "Test" },
      databaseUrl,
    );

    const page = await createPage(
      {
        worldId: world.id,
        title: "Geheime Kammer",
        slug: "geheim",
        type: "room",
        visibility: "dm_only",
        contentBlocks: [
          {
            type: "gm_note",
            sortOrder: 0,
            visibility: "dm_only",
            content: "Nur für den DM.",
          },
        ],
      },
      databaseUrl,
    );

    const db = createPrismaClient(databaseUrl);
    const fullPage = await db.page.findUniqueOrThrow({
      where: { id: page.id },
      include: { contentBlocks: true, campaign: true },
    });

    const content = await buildLabelContentFromPage(db, fullPage, { includeDmOnly: false });
    const safety = assertPlayerSafeExport(content, false);

    assert.equal(safety.allowed, false);
    assert.match(safety.reason ?? "", /DM-only/);
  });

  it("allows dm export when explicitly confirmed", async () => {
    const world = await createWorld(
      { name: "Dm Export", slug: "dm-export", description: "Test" },
      databaseUrl,
    );

    const page = await createPage(
      {
        worldId: world.id,
        title: "Geheime Kammer",
        slug: "geheim-dm",
        type: "room",
        visibility: "dm_only",
        contentBlocks: [
          {
            type: "gm_note",
            sortOrder: 0,
            visibility: "dm_only",
            content: "Nur für den DM.",
          },
        ],
      },
      databaseUrl,
    );

    const label = await labels.createFromSource({
      worldId: world.id,
      sourceType: "dungeon_room",
      sourceId: page.id,
      templateId: "tpl_standard_6x4",
      includeDmOnly: true,
    });

    const html = renderLabelHtml({
      content: normalizeLabel(label).content,
      layoutSettings: normalizeLabel(label).layoutSettings,
      title: label.title,
    });

    assert.match(html, /Nur für den DM/);
  });
});
