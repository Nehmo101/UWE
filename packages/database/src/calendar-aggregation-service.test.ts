import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateCalendarItems,
  classifyUrgency,
  createCalendarAggregationService,
  endOfWeek,
  isWithinHorizon,
  readMetadataDate,
  splitCalendarItemsByDay,
  startOfDay,
} from "./calendar-aggregation-service";
import { buildContractAlerts } from "./contract-expense-utils";
import { createCalendarService } from "./calendar-service";
import { createPrismaClient, type PrismaClient } from "./client";
import {
  createTestDatabaseUrl,
  createTestFamilyClient,
  type FamilyPrismaClient,
} from "./test-helpers";
import type { CalendarEvent } from "./generated/prisma-family/client";

const NOW = new Date("2026-06-19T10:00:00Z");

function makeEvent(overrides: Partial<CalendarEvent> & { feed?: { name: string; type: "familywall" } }): CalendarEvent & {
  feed?: { name: string; type: "familywall" };
} {
  return {
    id: "evt-1",
    feedId: null,
    worldId: null,
    sessionId: null,
    title: "Test Event",
    description: null,
    location: null,
    startAt: new Date("2026-06-20T19:00:00Z"),
    endAt: null,
    allDay: false,
    kind: "session",
    externalUid: null,
    remoteHref: null,
    remoteEtag: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("calendar-aggregation-service", () => {
  it("classifies urgency for today, upcoming, and overdue", () => {
    assert.equal(classifyUrgency(new Date("2026-06-18T12:00:00Z"), NOW), "overdue");
    assert.equal(classifyUrgency(new Date("2026-06-19T15:00:00Z"), NOW), "today");
    assert.equal(classifyUrgency(new Date("2026-06-25T12:00:00Z"), NOW), "upcoming");
  });

  it("reads due dates from metadata", () => {
    assert.equal(
      readMetadataDate({ dueDate: "2026-06-22T00:00:00Z" }, ["dueDate"])?.toISOString(),
      new Date("2026-06-22T00:00:00Z").toISOString(),
    );
    assert.equal(readMetadataDate(null, ["dueDate"]), null);
  });

  it("aggregates calendar events, contracts, workshops, and backup checks", () => {
    const contracts = [
      {
        id: "c1",
        name: "Hosting",
        vendor: "",
        status: "active" as const,
        expenseType: "subscription" as const,
        source: "manual" as const,
        billingInterval: "monthly" as const,
        categoryLabel: "",
        amountCents: 1000,
        currency: "EUR",
        billingDay: null,
        startDate: null,
        nextPaymentDate: new Date("2026-06-21T00:00:00Z"),
        renewalDate: null,
        cancelByDate: null,
        portalUrl: null,
        notes: "",
        metadata: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    const items = aggregateCalendarItems({
      events: [makeEvent({ id: "e1", title: "Session Abend" })],
      contractAlerts: buildContractAlerts(contracts, NOW, 14),
      workshops: [
        {
          id: "w1",
          title: "Dungeon Tiles",
          metadata: { dueDate: "2026-06-23T00:00:00Z" },
        },
      ],
      hardware: [
        {
          id: "h1",
          name: "NAS",
          metadata: { maintenanceDueAt: "2026-06-24T00:00:00Z" },
        },
      ],
      personalProjects: [],
      sessions: [
        {
          id: "s1",
          title: "Krypta",
          sessionNumber: 5,
          date: new Date("2026-06-26T19:00:00Z"),
          status: "planned",
          worldSlug: "terra",
        },
      ],
      lastBackupAt: new Date("2026-06-01T00:00:00Z"),
      now: NOW,
      horizonDays: 14,
    });

    assert.ok(items.some((item) => item.title === "Session Abend"));
    assert.ok(items.some((item) => item.source === "contract"));
    assert.ok(items.some((item) => item.source === "workshop"));
    assert.ok(items.some((item) => item.source === "hardware"));
    assert.ok(items.some((item) => item.source === "session_prep"));
    assert.ok(items.some((item) => item.source === "backup"));
    assert.equal(items[0]!.startAt.getTime() <= items[items.length - 1]!.startAt.getTime(), true);
  });

  it("skips backup item when backup is recent", () => {
    const items = aggregateCalendarItems({
      events: [],
      contractAlerts: [],
      workshops: [],
      hardware: [],
      personalProjects: [],
      sessions: [],
      lastBackupAt: new Date("2026-06-18T00:00:00Z"),
      now: NOW,
      horizonDays: 14,
    });

    assert.equal(items.some((item) => item.source === "backup"), false);
  });

  it("deduplicates sessions already linked as calendar events", () => {
    const items = aggregateCalendarItems({
      events: [makeEvent({ id: "e1", sessionId: "s1", title: "Session 5: Krypta" })],
      contractAlerts: [],
      workshops: [],
      hardware: [],
      personalProjects: [],
      sessions: [
        {
          id: "s1",
          title: "Krypta",
          sessionNumber: 5,
          date: new Date("2026-06-26T19:00:00Z"),
          status: "planned",
          worldSlug: "terra",
        },
      ],
      lastBackupAt: NOW,
      now: NOW,
      horizonDays: 14,
    });

    const sessionItems = items.filter((item) => item.kind === "session");
    assert.equal(sessionItems.length, 1);
    assert.equal(sessionItems[0]!.id, "event:e1");
  });

  it("splits items into today and this week buckets", () => {
    const todayEventStart = new Date(startOfDay(NOW).getTime() + 12 * 60 * 60 * 1000);
    const weekEventStart = new Date(startOfDay(NOW).getTime() + 86_400_000 + 12 * 60 * 60 * 1000);

    const items = [
      {
        id: "today",
        title: "Heute",
        startAt: todayEventStart,
        endAt: null,
        allDay: false,
        source: "calendar_event" as const,
        kind: "session" as const,
        moduleLabel: "DnD-Session",
        href: null,
        urgency: classifyUrgency(todayEventStart, NOW),
      },
      {
        id: "week",
        title: "Diese Woche",
        startAt: weekEventStart,
        endAt: null,
        allDay: false,
        source: "calendar_event" as const,
        kind: "session" as const,
        moduleLabel: "DnD-Session",
        href: null,
        urgency: classifyUrgency(weekEventStart, NOW),
      },
    ];

    const { today, thisWeek } = splitCalendarItemsByDay(items, NOW);
    assert.ok(today.length >= 1);
    if (weekEventStart.getTime() <= endOfWeek(NOW).getTime()) {
      assert.equal(thisWeek.length, 1);
    }
  });

  it("uses feed name as module label for external calendar events", () => {
    const items = aggregateCalendarItems({
      events: [
        makeEvent({
          id: "fw-1",
          title: "Familienausflug",
          kind: "external",
          startAt: new Date("2026-06-19T14:00:00Z"),
          feed: { name: "FamilyWall", type: "familywall" },
        }),
      ],
      contractAlerts: [],
      workshops: [],
      hardware: [],
      personalProjects: [],
      sessions: [],
      lastBackupAt: NOW,
      now: NOW,
      horizonDays: 14,
    });

    assert.equal(items[0]?.moduleLabel, "FamilyWall");
    assert.equal(items[0]?.source, "calendar_event");
  });

  it("checks horizon boundaries", () => {
    assert.equal(isWithinHorizon(new Date("2026-06-25T00:00:00Z"), NOW, 7), true);
    assert.equal(isWithinHorizon(new Date("2026-07-10T00:00:00Z"), NOW, 7), false);
    assert.equal(startOfDay(NOW).getHours(), 0);
  });
});

describe("calendar-aggregation-service integration", () => {
  let db: PrismaClient;
  let familyDb: FamilyPrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    familyDb = createTestFamilyClient();
  });

  it("returns feed and scoped world events for today summary", async () => {
    const calendar = createCalendarService(familyDb, db);
    const aggregation = createCalendarAggregationService(familyDb, db);
    const now = new Date("2026-06-19T10:00:00Z");

    const world = await db.world.create({
      data: { name: "Today Cal", slug: `today-cal-${Date.now()}` },
    });

    const feed = await calendar.createFeed({
      name: "iCal Feed",
      type: "ical_url",
    });

    await calendar.createEvent({
      feedId: feed.id,
      title: "Arzttermin heute",
      startAt: new Date("2026-06-19T15:00:00Z"),
      kind: "external",
    });

    await calendar.createEvent({
      feedId: feed.id,
      title: "Samstag extern",
      startAt: new Date("2026-06-20T10:00:00Z"),
      kind: "external",
    });

    await calendar.syncSessionToCalendar(
      (
        await db.gameSession.create({
          data: {
            worldId: world.id,
            title: "Kampagnenabend",
            sessionNumber: 3,
            date: new Date("2026-06-20T19:00:00Z"),
          },
        })
      ).id,
    );

    const summary = await aggregation.getTodaySummary({
      worldId: world.id,
      now,
      horizonDays: 14,
    });

    assert.ok(summary.today.some((item) => item.title === "Arzttermin heute"));
    assert.ok(summary.today.some((item) => item.moduleLabel === "iCal Feed"));
    assert.ok(summary.thisWeek.some((item) => item.title.includes("Kampagnenabend")));
    assert.ok(summary.thisWeek.some((item) => item.title === "Samstag extern"));
  });
});
