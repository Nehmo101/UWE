import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createPrismaClient, type PrismaClient } from "./client";
import { createCalendarService } from "./calendar-service";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";

describe("calendar-service", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    brainDb = createTestBrainClient();
  });

  it("ensures local feed and creates events", async () => {
    const calendar = createCalendarService(brainDb, db);
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
    const calendar = createCalendarService(brainDb, db);
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
    const calendar = createCalendarService(brainDb, db);
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

  it("mirrors contract deadlines into the local feed and prunes stale ones", async () => {
    const calendar = createCalendarService(brainDb, db);
    const now = new Date("2026-07-01T08:00:00Z");

    const contract = await brainDb.contractExpense.create({
      data: {
        name: "Streaming Abo",
        status: "active",
        billingInterval: "monthly",
        cancelByDate: new Date("2026-07-15T00:00:00Z"),
        nextPaymentDate: new Date("2026-07-20T00:00:00Z"),
      },
    });

    const first = await calendar.syncContractDeadlinesToCalendar({ now });
    assert.equal(first.synced, 2);

    const local = await calendar.ensureLocalFeed();
    const events = await calendar.listEvents({ feedId: local.id, limit: 200 });
    const cancelEvent = events.find(
      (event) => event.externalUid === `uwe-contract-${contract.id}-cancel`,
    );
    assert.ok(cancelEvent);
    assert.equal(cancelEvent.allDay, true);
    assert.ok(cancelEvent.title.includes("Kündigungsfrist"));

    // Kündigungstermin entfällt → Event wird beim nächsten Sync entfernt.
    await brainDb.contractExpense.update({
      where: { id: contract.id },
      data: { cancelByDate: null },
    });
    await calendar.syncContractDeadlinesToCalendar({ now });

    const after = await calendar.listEvents({ feedId: local.id, limit: 200 });
    assert.equal(
      after.some((event) => event.externalUid === `uwe-contract-${contract.id}-cancel`),
      false,
    );
    assert.ok(
      after.some((event) => event.externalUid === `uwe-contract-${contract.id}-payment`),
    );

    // Termine außerhalb des Horizonts werden nicht angelegt.
    await brainDb.contractExpense.update({
      where: { id: contract.id },
      data: { nextPaymentDate: new Date("2027-06-01T00:00:00Z") },
    });
    const farOut = await calendar.syncContractDeadlinesToCalendar({ now });
    assert.equal(farOut.synced, 0);
  });
});
