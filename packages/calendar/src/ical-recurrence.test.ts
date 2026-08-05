import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseIcalEvents, pickMasterEvent } from "./index";

describe("parseIcalEvents mit Serien", () => {
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

  it("liefert null für leere Listen und nimmt sonst das erste VEVENT", () => {
    assert.equal(pickMasterEvent([]), null);
    const events = parseIcalEvents(
      [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "UID:nur-ausnahme",
        "SUMMARY:Ausnahme",
        "DTSTART:20260722T070000Z",
        "RECURRENCE-ID:20260722T070000Z",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
    );
    assert.equal(pickMasterEvent(events)?.title, "Ausnahme");
  });
});
