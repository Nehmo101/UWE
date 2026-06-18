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
});
