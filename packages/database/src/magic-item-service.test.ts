import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createMagicItemService } from "./magic-item-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("magic item service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let worldId: string;
  let pageId: string;

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    const world = await createUweRepository(url).createWorld({ name: "MI", slug: "mi-test" });
    worldId = world.id;
    const page = await db.page.create({
      data: { worldId, title: "Ring der Macht", slug: "ring", type: "item" },
    });
    pageId = page.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("returns null before anything is stored", async () => {
    assert.equal(await createMagicItemService(db).getForPage(pageId), null);
  });

  it("upserts and reads back typed data, then updates it", async () => {
    const service = createMagicItemService(db);
    await service.upsertForPage({
      worldId,
      pageId,
      data: { rarity: "legendary", requiresAttunement: true, curse: "verführerisch" },
    });

    const stored = await service.getForPage(pageId);
    assert.ok(stored);
    assert.equal(stored.data.rarity, "legendary");
    assert.equal(stored.data.curse, "verführerisch");

    await service.upsertForPage({ worldId, pageId, data: { rarity: "rare" } });
    const updated = await service.getForPage(pageId);
    assert.equal(updated?.data.rarity, "rare");
    assert.equal(updated?.data.curse, undefined);
  });
});
