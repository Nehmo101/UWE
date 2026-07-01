import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPortalTimelineYearLabel,
  enrichPortalTimelineEvents,
  groupPortalTimelineEventsByYear,
  countPortalTimelineEventsThroughDate,
} from "./portal-timeline";
import type { PortalWorldEventView } from "./world-event-service";
import { DEFAULT_WORLD_CALENDAR_MONTHS } from "./world-calendar-service";

const sampleEvents: PortalWorldEventView[] = [
  {
    id: "e2",
    worldId: "w1",
    title: "Winterrat",
    inGameDate: { year: 472, month: 4, day: 2 },
    summaryPlayer: "Die Fraktionen verhandeln.",
    sortOrder: 0,
    linkedPages: [],
  },
  {
    id: "e1",
    worldId: "w1",
    title: "Frühlingssonne",
    inGameDate: { year: 472, month: 1, day: 5 },
    summaryPlayer: "Die Karawane bricht auf.",
    sortOrder: 0,
    linkedPages: [],
  },
  {
    id: "e3",
    worldId: "w1",
    title: "Neues Zeitalter",
    inGameDate: { year: 473, month: 1, day: 1 },
    summaryPlayer: null,
    sortOrder: 0,
    linkedPages: [],
  },
];

describe("portal timeline helpers", () => {
  it("groups events by in-game year in chronological order", () => {
    const enriched = enrichPortalTimelineEvents(sampleEvents, DEFAULT_WORLD_CALENDAR_MONTHS);
    const groups = groupPortalTimelineEventsByYear(enriched, {
      epochLabel: "Zeitalter des Erwachens",
    });

    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.year, 472);
    assert.match(groups[0]?.label ?? "", /Zeitalter des Erwachens/);
    assert.equal(groups[0]?.events.length, 2);
    assert.equal(groups[0]?.events[0]?.id, "e1");
    assert.equal(groups[1]?.events[0]?.id, "e3");
  });

  it("builds readable year labels", () => {
    assert.equal(buildPortalTimelineYearLabel(1024), "Jahr 1024");
    assert.equal(
      buildPortalTimelineYearLabel(1024, "Nach der Sintflut"),
      "Nach der Sintflut · Jahr 1024",
    );
  });

  it("counts events up to a campaign date marker", () => {
    const enriched = enrichPortalTimelineEvents(sampleEvents, DEFAULT_WORLD_CALENDAR_MONTHS);
    assert.equal(
      countPortalTimelineEventsThroughDate(enriched, { year: 472, month: 4, day: 3 }),
      2,
    );
  });
});
