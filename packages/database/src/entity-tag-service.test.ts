import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createEntityTagService } from "./entity-tag-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("entity tag service", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("upserts tags by normalized key and attaches to entities", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createEntityTagService(db);

    await service.attachTag({
      tagKey: "  Quest Hook ",
      entityType: "page",
      entityId: "page-1",
      worldId: "world-1",
    });

    const tags = await service.listTagsForEntity("page", "page-1");
    assert.equal(tags.length, 1);
    assert.equal(tags[0]?.key, "quest-hook");
    assert.equal(tags[0]?.label, "quest hook");

    const ids = await service.listEntityIdsByTagKey("Quest-Hook", "page", { worldId: "world-1" });
    assert.deepEqual(ids, ["page-1"]);

    await db.$disconnect();
  });

  it("replaces entity tag sets idempotently", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createEntityTagService(db);

    await service.replaceEntityTags("capture", "cap-1", ["alpha", "beta"], { worldId: null });
    let tags = await service.listTagsForEntity("capture", "cap-1");
    assert.equal(tags.length, 2);

    await service.replaceEntityTags("capture", "cap-1", ["beta"], { worldId: null });
    tags = await service.listTagsForEntity("capture", "cap-1");
    assert.equal(tags.length, 1);
    assert.equal(tags[0]?.key, "beta");

    await db.$disconnect();
  });
});
