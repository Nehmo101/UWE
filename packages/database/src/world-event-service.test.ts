import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";
import {
  WORLD_EVENT_ENTITY_ROLE_LABELS,
  createWorldEventService,
} from "./world-event-service";

describe("world event entity roles (pure)", () => {
  it("labels every role including trigger and consequence", () => {
    assert.equal(WORLD_EVENT_ENTITY_ROLE_LABELS.trigger, "Auslöser");
    assert.equal(WORLD_EVENT_ENTITY_ROLE_LABELS.consequence, "Folge");
    for (const label of Object.values(WORLD_EVENT_ENTITY_ROLE_LABELS)) {
      assert.ok(label.length > 0);
    }
  });
});

describe("world event entity links (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let worldId: string;

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    const world = await createUweRepository(url).createWorld({
      name: "Chronik",
      slug: "chronik-test",
    });
    worldId = world.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("adds and removes a trigger link on an event", async () => {
    const service = createWorldEventService(db);
    const quest = await db.page.create({
      data: { worldId, title: "Der Pakt", slug: "der-pakt", type: "quest", questStatus: "open" },
    });
    const event = await service.create({
      worldId,
      inGameDate: { year: 1487, month: 3, day: 12 },
      title: "Der Turm fällt",
    });

    const link = await service.addEntityLink(worldId, event.id, quest.id, "trigger");
    assert.equal(link.role, "trigger");

    const loaded = await service.getByIdForWorld(worldId, event.id);
    assert.ok(loaded);
    assert.equal(loaded.entityLinks.length, 1);
    assert.equal(loaded.entityLinks[0].role, "trigger");
    assert.equal(loaded.entityLinks[0].page.slug, "der-pakt");

    await service.removeEntityLink(worldId, link.id);
    const afterRemove = await service.getByIdForWorld(worldId, event.id);
    assert.ok(afterRemove);
    assert.equal(afterRemove.entityLinks.length, 0);
  });

  it("rejects links to foreign worlds", async () => {
    const service = createWorldEventService(db);
    const otherWorld = await createUweRepository(createTestDatabaseUrl()).createWorld({
      name: "Fremd",
      slug: "fremd",
    });
    const event = await service.create({
      worldId,
      inGameDate: { year: 1, month: 1, day: 1 },
      title: "Lokal",
    });
    await assert.rejects(
      service.addEntityLink(otherWorld.id, event.id, "nope", "involved"),
      /nicht gefunden/,
    );
  });
});
