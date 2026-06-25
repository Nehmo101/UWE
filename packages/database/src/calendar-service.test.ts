import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createPrismaClient, type PrismaClient } from "./client";
import { createCalendarService } from "./calendar-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("calendar-service", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("ensures local feed and creates events", async () => {
    const calendar = createCalendarService(db);
    const local = await calendar.ensureLocalFeed();
    const event = await calendar.createEvent({
      feedId: local.id,
      title: "Session Abend",
      startAt: new Date("2026-06-20T19:00:00Z"),
      kind: "session",
    });
    assert.equal(event.title, "Session Abend");
    const listed = await calendar.listEvents({ feedId: local.id });
    assert.ok(listed.some((entry) => entry.id === event.id));
  });

  it("syncs session to calendar and removes event when date cleared", async () => {
    const calendar = createCalendarService(db);
    const world = await db.world.create({
      data: { name: "Cal Test", slug: `cal-test-${Date.now()}` },
    });

    const session = await db.gameSession.create({
      data: {
        worldId: world.id,
        title: "Abenteuer",
        sessionNumber: 1,
        date: new Date("2026-06-25T19:00:00Z"),
      },
    });

    const synced = await calendar.syncSessionToCalendar(session.id);
    assert.ok(synced);
    assert.equal(synced?.sessionId, session.id);
    assert.equal(synced?.kind, "session");

    const events = await calendar.listEvents({ worldId: world.id });
    assert.equal(events.length, 1);

    await db.gameSession.update({
      where: { id: session.id },
      data: { date: null },
    });
    await calendar.syncSessionToCalendar(session.id);

    const afterClear = await calendar.listEvents({ worldId: world.id });
    assert.equal(afterClear.length, 0);
  });

  it("includes feed events when aggregating with a preferred world scope", async () => {
    const calendar = createCalendarService(db);
    const worldA = await db.world.create({
      data: { name: "World A", slug: `cal-a-${Date.now()}` },
    });
    const worldB = await db.world.create({
      data: { name: "World B", slug: `cal-b-${Date.now()}` },
    });

    const feed = await calendar.createFeed({
      name: "FamilyWall Test",
      type: "familywall",
      direction: "read_only",
    });

    const feedEvent = await calendar.createEvent({
      feedId: feed.id,
      title: "Schule",
      startAt: new Date("2026-06-20T08:00:00Z"),
      kind: "external",
    });

    await calendar.syncSessionToCalendar(
      (
        await db.gameSession.create({
          data: {
            worldId: worldA.id,
            title: "Session A",
            sessionNumber: 1,
            date: new Date("2026-06-21T19:00:00Z"),
          },
        })
      ).id,
    );

    await calendar.syncSessionToCalendar(
      (
        await db.gameSession.create({
          data: {
            worldId: worldB.id,
            title: "Session B",
            sessionNumber: 1,
            date: new Date("2026-06-22T19:00:00Z"),
          },
        })
      ).id,
    );

    const scoped = await calendar.listEventsForAggregation({
      worldId: worldA.id,
      from: new Date("2026-06-01T00:00:00Z"),
      to: new Date("2026-06-30T00:00:00Z"),
    });

    assert.ok(scoped.some((event) => event.id === feedEvent.id));
    assert.ok(scoped.some((event) => event.worldId === worldA.id));
    assert.equal(
      scoped.some((event) => event.worldId === worldB.id),
      false,
    );
  });
});
