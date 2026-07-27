import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { buildPageView, combineBlockContent } from "./page-service";
import { filterBlocksForContext } from "./permissions";

describe("page-service portal security", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let validoriSlug: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({
      name: "Security Test",
      slug: "security-test",
      description: "Test world",
    });
    worldSlug = world.slug;

    await repo.createPage({
      worldId: world.id,
      title: "Validori",
      slug: "validori",
      type: "location",
      visibility: "public",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "public",
          content: "Öffentliche Beschreibung mit Link zu [[Shagottar]].",
        },
        {
          type: "gm_note",
          sortOrder: 1,
          visibility: "dm_only",
          content: "Geheime GM-Notiz über Shagottar.",
        },
      ],
    });
    validoriSlug = "validori";

    await repo.createPage({
      worldId: world.id,
      title: "Shagottar",
      slug: "shagottar",
      type: "location",
      visibility: "dm_only",
      contentBlocks: [
        {
          type: "gm_note",
          sortOrder: 0,
          visibility: "dm_only",
          content: "Geheime Festung — verlinkt von Validori.",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Arbor",
      slug: "arbor",
      type: "region",
      visibility: "player_visible",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Der Wald [[Validori|Hafenstadt]] ist weit entfernt.",
        },
      ],
    });
  });

  after(async () => {
    const { createPrismaClient } = await import("./client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("does not expose dm_only blocks to portal context", async () => {
    const repo = createUweRepository(databaseUrl);
    const page = await repo.getPageForContext(worldSlug, validoriSlug, "portal");

    assert.ok(page);
    assert.equal(page.contentBlocks.length, 1);
    assert.ok(page.contentBlocks.every((block) => block.visibility !== "dm_only"));
  });

  it("filters dm_only blocks in combineBlockContent for portal", async () => {
    const repo = createUweRepository(databaseUrl);
    const page = await repo.getPageBySlug(worldSlug, validoriSlug);
    assert.ok(page);

    const portalBlocks = filterBlocksForContext(page.contentBlocks, "portal");
    const dmBlocks = filterBlocksForContext(page.contentBlocks, "dm");

    assert.equal(portalBlocks.length, 1);
    assert.equal(dmBlocks.length, 2);
    assert.ok(!combineBlockContent(portalBlocks).includes("Geheime GM-Notiz"));
    assert.ok(combineBlockContent(dmBlocks).includes("Geheime GM-Notiz"));
  });

  it("hides secret page titles in portal wikilinks", async () => {
    const repo = createUweRepository(databaseUrl);
    const view = await buildPageView(repo, worldSlug, validoriSlug, "portal");

    assert.ok(view);
    assert.ok(view.html.includes("Verborgen") || view.links.some((l) => l.status === "hidden"));
    assert.ok(!view.html.includes("Shagottar"));
  });

  it("does not expose secret page titles in portal backlinks", async () => {
    const repo = createUweRepository(databaseUrl);
    const view = await buildPageView(repo, worldSlug, validoriSlug, "portal");

    assert.ok(view);
    const backlinkTitles = view.backlinks.map((b) => b.title);
    assert.ok(!backlinkTitles.includes("Shagottar"));
  });

  it("shows all content to DM context", async () => {
    const repo = createUweRepository(databaseUrl);
    const view = await buildPageView(repo, worldSlug, validoriSlug, "dm");

    assert.ok(view);
    assert.ok(view.html.includes("Geheime GM-Notiz"));
    assert.ok(view.links.some((l) => l.displayText === "Shagottar" && l.status === "resolved"));
  });

  it("preview context matches portal filtering", async () => {
    const repo = createUweRepository(databaseUrl);
    const portalView = await buildPageView(repo, worldSlug, validoriSlug, "portal");
    const previewView = await buildPageView(repo, worldSlug, validoriSlug, "preview");

    assert.ok(portalView);
    assert.ok(previewView);
    assert.equal(portalView.html, previewView.html);
    assert.deepEqual(portalView.backlinks, previewView.backlinks);
  });

  it("DM can access dm_only pages while portal cannot", async () => {
    const repo = createUweRepository(databaseUrl);

    assert.equal(await repo.getPageForContext(worldSlug, "shagottar", "portal"), null);
    assert.equal(await repo.getPageForContext(worldSlug, "shagottar", "preview"), null);

    const dmPage = await repo.getPageForContext(worldSlug, "shagottar", "dm");
    assert.ok(dmPage);
    assert.equal(dmPage.title, "Shagottar");
  });
});
