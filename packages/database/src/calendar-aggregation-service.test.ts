import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateCalendarItems,
  classifyUrgency,
  endOfWeek,
  isWithinHorizon,
  readMetadataDate,
  splitCalendarItemsByDay,
  startOfDay,
} from "./calendar-aggregation-service";
import { buildContractAlerts } from "./contract-expense-utils";
import type { CalendarEvent } from "./generated/prisma/client";

const NOW = new Date("2026-06-19T10:00:00Z");

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
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
    caldavPending: false,
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

  it("checks horizon boundaries", () => {
    assert.equal(isWithinHorizon(new Date("2026-06-25T00:00:00Z"), NOW, 7), true);
    assert.equal(isWithinHorizon(new Date("2026-07-10T00:00:00Z"), NOW, 7), false);
    assert.equal(startOfDay(NOW).getHours(), 0);
  });
});
