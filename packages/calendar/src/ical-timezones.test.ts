import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTimezone, zonedTimeToUtc } from "./ical-timezones";
import { parseIcalEvents, pickMasterEvent } from "./index";

describe("zonedTimeToUtc", () => {
  it("rechnet Berliner Winterzeit (+01:00) um", () => {
    const utc = zonedTimeToUtc(2026, 1, 15, 9, 0, 0, "Europe/Berlin");
    assert.equal(utc.toISOString(), "2026-01-15T08:00:00.000Z");
  });

  it("rechnet Berliner Sommerzeit (+02:00) um", () => {
    const utc = zonedTimeToUtc(2026, 7, 15, 9, 0, 0, "Europe/Berlin");
    assert.equal(utc.toISOString(), "2026-07-15T07:00:00.000Z");
  });

  it("fällt bei unbekannter TZID auf die Default-Zone zurück", () => {
    const utc = zonedTimeToUtc(2026, 1, 15, 9, 0, 0, "Nicht/Existent");
    assert.equal(utc.toISOString(), "2026-01-15T08:00:00.000Z");
  });
});

describe("resolveTimezone", () => {
  it("akzeptiert gültige IANA-Zonen und verwirft ungültige", () => {
    assert.equal(resolveTimezone("America/New_York"), "America/New_York");
    assert.equal(resolveTimezone("Quatsch/Zone"), "Europe/Berlin");
    assert.equal(resolveTimezone(null), "Europe/Berlin");
  });
});

describe("parseIcalEvents mit TZID", () => {
  const vcal = (dtLines: string) =>
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:tz-test-1",
      "SUMMARY:Zahnarzt",
      dtLines,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

  it("wandelt TZID-Lokalzeiten in den richtigen UTC-Zeitpunkt", () => {
    const events = parseIcalEvents(
      vcal("DTSTART;TZID=Europe/Berlin:20260715T090000\r\nDTEND;TZID=Europe/Berlin:20260715T100000"),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.startAt.toISOString(), "2026-07-15T07:00:00.000Z");
    assert.equal(events[0]?.endAt?.toISOString(), "2026-07-15T08:00:00.000Z");
  });

  it("lässt Zulu-Zeiten und Datumswerte unverändert (Regression)", () => {
    const zulu = parseIcalEvents(vcal("DTSTART:20260715T070000Z"));
    assert.equal(zulu[0]?.startAt.toISOString(), "2026-07-15T07:00:00.000Z");

    const allDay = parseIcalEvents(vcal("DTSTART;VALUE=DATE:20260715"));
    assert.equal(allDay[0]?.allDay, true);
    assert.equal(allDay[0]?.startAt.toISOString(), "2026-07-15T00:00:00.000Z");
  });

  it("markiert Serien und findet das Master-VEVENT", () => {
    const content = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:serie-1",
      "SUMMARY:Ausnahme",
      "DTSTART:20260722T070000Z",
      "RECURRENCE-ID:20260722T070000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:serie-1",
      "SUMMARY:Wöchentlich",
      "DTSTART:20260715T070000Z",
      "RRULE:FREQ=WEEKLY",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const events = parseIcalEvents(content);
    assert.equal(events.length, 2);
    const master = pickMasterEvent(events);
    assert.equal(master?.title, "Wöchentlich");
    assert.equal(master?.hasRecurrence, true);
    assert.equal(master?.recurrenceId, undefined);
  });
});
