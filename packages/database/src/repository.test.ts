import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import {
  createPage,
  createWorld,
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

});
