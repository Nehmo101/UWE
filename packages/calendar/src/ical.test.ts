import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateIcalCalendar, parseIcalEvents } from "./index";

describe("parseIcalEvents", () => {
  it("parses a simple VEVENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:test-1",
      "SUMMARY:DnD Session",
      "DTSTART:20260615T180000Z",
      "DTEND:20260615T220000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcalEvents(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.title, "DnD Session");
    assert.equal(events[0]?.uid, "test-1");
    assert.equal(events[0]?.allDay, false);
  });

  it("parses all-day events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:allday-1",
      "SUMMARY:Prep Day",
      "DTSTART;VALUE=DATE:20260620",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcalEvents(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.allDay, true);
  });
});

describe("generateIcalCalendar", () => {
  it("generates valid VCALENDAR output", () => {
    const ics = generateIcalCalendar([
      {
        uid: "uwe-1",
        title: "Test Event",
        startAt: new Date("2026-06-15T18:00:00Z"),
        endAt: new Date("2026-06-15T22:00:00Z"),
      },
    ]);

    assert.match(ics, /BEGIN:VCALENDAR/);
    assert.match(ics, /SUMMARY:Test Event/);
    assert.match(ics, /END:VCALENDAR/);

    const parsed = parseIcalEvents(ics);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.title, "Test Event");
  });
});
