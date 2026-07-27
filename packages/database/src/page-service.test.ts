import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import { buildPageView, combineBlockContent } from "./page-service";

describe("page-service page view", () => {
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
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Öffentliche Beschreibung mit Link zu [[Shagottar]].",
        },
        {
          type: "rich_text",
          sortOrder: 1,
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
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Geheime Festung — verlinkt von Validori.",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Arbor",
      slug: "arbor",
      type: "region",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Der Wald [[Validori|Hafenstadt]] ist weit entfernt.",
        },
      ],
    });
  });

  after(async () => {
    const { createPrismaClient } = await import("./client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("returns every block of the page", async () => {
    const repo = createUweRepository(databaseUrl);
    const page = await repo.getPageBySlug(worldSlug, validoriSlug);

    assert.ok(page);
    assert.equal(page.contentBlocks.length, 2);
    assert.ok(combineBlockContent(page.contentBlocks).includes("Geheime GM-Notiz"));
  });

  it("resolves wikilinks to other pages of the world", async () => {
    const repo = createUweRepository(databaseUrl);
    const view = await buildPageView(repo, worldSlug, validoriSlug);

    assert.ok(view);
    assert.ok(view.html.includes("Geheime GM-Notiz"));
    assert.ok(view.links.some((l) => l.displayText === "Shagottar" && l.status === "resolved"));
  });

  it("builds a view for every page of the world", async () => {
    const repo = createUweRepository(databaseUrl);
    const page = await buildPageView(repo, worldSlug, "shagottar");
    assert.ok(page);
    assert.equal(page.page.title, "Shagottar");
  });
});
