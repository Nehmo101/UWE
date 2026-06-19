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
});
