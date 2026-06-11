import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import {
  createPage,
  createWorld,
  getDmPage,
  getPublicPageForPortal,
  listPagesByWorld,
} from "./repository";

describe("UWE repository", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    const { createPrismaClient } = await import("./client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("does not expose dm_only blocks in getPublicPageForPortal", async () => {
    const world = await createWorld(
      { name: "Testwelt", slug: "testwelt", description: "Test" },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Validori",
        slug: "validori",
        type: "location",
        visibility: "public",
        publishStatus: "published",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "Öffentlicher Stadtüberblick.",
          },
          {
            type: "gm_note",
            sortOrder: 1,
            visibility: "dm_only",
            content: "Geheime Verschwörung im Rat.",
          },
        ],
      },
      databaseUrl,
    );

    const portalPage = await getPublicPageForPortal("testwelt", "validori", databaseUrl);
    const dmPage = await getDmPage("testwelt", "validori", databaseUrl);

    assert.ok(portalPage);
    assert.ok(dmPage);
    assert.equal(portalPage.contentBlocks.length, 1);
    assert.equal(dmPage.contentBlocks.length, 2);
    assert.equal(portalPage.contentBlocks[0]?.visibility, "public");
    assert.ok(
      portalPage.contentBlocks.every((block) => block.visibility !== "dm_only"),
      "portal must never return dm_only blocks",
    );
  });

  it("returns public and player_visible portal content", async () => {
    const world = await createWorld(
      { name: "Terra Test", slug: "terra-test", description: "Test" },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Arbor",
        slug: "arbor",
        type: "region",
        visibility: "player_visible",
        publishStatus: "published",
        contentBlocks: [
          {
            type: "player_text",
            sortOrder: 0,
            visibility: "player_visible",
            content: "Spieler sichtbarer Waldtext.",
          },
          {
            type: "rich_text",
            sortOrder: 1,
            visibility: "public",
            content: "Öffentlicher Reiseführer-Eintrag.",
          },
        ],
      },
      databaseUrl,
    );

    const portalPage = await getPublicPageForPortal("terra-test", "arbor", databaseUrl);

    assert.ok(portalPage);
    assert.equal(portalPage.contentBlocks.length, 2);
    assert.deepEqual(
      portalPage.contentBlocks.map((block) => block.visibility).sort(),
      ["player_visible", "public"],
    );
  });

  it("keeps slugs unique within a world", async () => {
    const world = await createWorld(
      { name: "Slug Test", slug: "slug-test", description: "Test" },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Nepurga",
        slug: "nepurga",
        type: "faction",
      },
      databaseUrl,
    );

    await assert.rejects(
      () =>
        createPage(
          {
            worldId: world.id,
            title: "Nepurga Duplicate",
            slug: "nepurga",
            type: "note",
          },
          databaseUrl,
        ),
      /Unique constraint failed/,
    );

    const pages = await listPagesByWorld("slug-test", databaseUrl);
    assert.equal(pages.length, 1);
    assert.equal(pages[0]?.slug, "nepurga");
  });

  it("hides unpublished or dm_only pages from the portal", async () => {
    const world = await createWorld(
      { name: "Portal Filter", slug: "portal-filter", description: "Test" },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Draft Page",
        slug: "draft-page",
        type: "note",
        visibility: "public",
        publishStatus: "draft",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "Should not appear.",
          },
        ],
      },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Secret Page",
        slug: "secret-page",
        type: "note",
        visibility: "dm_only",
        publishStatus: "published",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "Still hidden because page is dm_only.",
          },
        ],
      },
      databaseUrl,
    );

    assert.equal(await getPublicPageForPortal("portal-filter", "draft-page", databaseUrl), null);
    assert.equal(await getPublicPageForPortal("portal-filter", "secret-page", databaseUrl), null);
  });
});
