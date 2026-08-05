import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAV_COLLECTION_PATH,
  ctagOf,
  davUidOf,
  etagOf,
  eventToIcs,
  hrefForEvent,
  icsToEventInput,
  resourceNameFromPath,
  serverEventIdFromName,
  type DavEventShape,
} from "./caldav-collection";

function makeEvent(overrides: Partial<DavEventShape> = {}): DavEventShape {
  return {
    id: "ev1",
    title: "Familienessen",
    description: null,
    location: null,
    startAt: new Date("2026-08-10T17:00:00Z"),
    endAt: new Date("2026-08-10T19:00:00Z"),
    allDay: false,
    externalUid: null,
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    metadata: null,
    ...overrides,
  };
}

describe("Ressourcen-Namen", () => {
  it("bildet UWE-Termine auf den Server-Namensraum ab", () => {
    const event = makeEvent();
    assert.equal(davUidOf(event), "uwe-family-event-ev1");
    assert.equal(hrefForEvent(event), `${DAV_COLLECTION_PATH}uwe-family-event-ev1.ics`);
  });

  it("nutzt die Client-UID für iPhone-Termine", () => {
    const event = makeEvent({ externalUid: "ABC-123-IOS" });
    assert.equal(davUidOf(event), "ABC-123-IOS");
    assert.equal(hrefForEvent(event), `${DAV_COLLECTION_PATH}ABC-123-IOS.ics`);
  });

  it("löst Pfade in beide Richtungen auf, inkl. URL-Encoding", () => {
    assert.equal(
      resourceNameFromPath(`${DAV_COLLECTION_PATH}uwe-family-event-ev1.ics`),
      "uwe-family-event-ev1",
    );
    assert.equal(resourceNameFromPath(`${DAV_COLLECTION_PATH}a%26b.ics`), "a&b");
    assert.equal(resourceNameFromPath(DAV_COLLECTION_PATH), null);
    assert.equal(resourceNameFromPath("/api/dav/cal/anders/x.ics"), null);
    assert.equal(serverEventIdFromName("uwe-family-event-ev9"), "ev9");
    assert.equal(serverEventIdFromName("ABC-123"), null);
  });
});

describe("ETag und ctag", () => {
  it("ändert den ctag bei Update und Löschung", () => {
    const a = makeEvent({ id: "a" });
    const b = makeEvent({ id: "b" });
    const before = ctagOf([a, b]);
    const afterUpdate = ctagOf([a, { ...b, updatedAt: new Date("2026-08-02T12:00:00Z") }]);
    const afterDelete = ctagOf([a]);
    assert.notEqual(before, afterUpdate);
    assert.notEqual(before, afterDelete);
    assert.equal(ctagOf([b, a]), before);
  });

  it("leitet den ETag aus updatedAt ab", () => {
    assert.equal(etagOf(makeEvent()), String(new Date("2026-08-01T12:00:00Z").getTime()));
  });
});

describe("eventToIcs", () => {
  it("erzeugt ICS aus den Feldern, mit Betrifft-Zeile und exklusivem DTEND", () => {
    const allDay = makeEvent({
      allDay: true,
      startAt: new Date("2026-08-10T00:00:00Z"),
      endAt: null,
    });
    const ics = eventToIcs(allDay, ["Kaja", "Milo"]);
    assert.match(ics, /UID:uwe-family-event-ev1/);
    assert.match(ics, /DTSTART;VALUE=DATE:20260810/);
    assert.match(ics, /DTEND;VALUE=DATE:20260811/);
    assert.match(ics, /Betrifft: Kaja\\, Milo/);
  });

  it("liefert frisches Roh-ICS verbatim, verwirft veraltetes", () => {
    const raw = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const updatedAt = new Date("2026-08-01T12:00:00Z");
    const fresh = makeEvent({
      updatedAt,
      metadata: { davIcs: raw, davIcsSavedAt: new Date(updatedAt.getTime() - 500).toISOString() },
    });
    assert.equal(eventToIcs(fresh), raw);

    const stale = makeEvent({
      updatedAt: new Date("2026-08-05T12:00:00Z"),
      metadata: { davIcs: raw, davIcsSavedAt: updatedAt.toISOString() },
    });
    assert.doesNotMatch(eventToIcs(stale), /RRULE/);
    assert.match(eventToIcs(stale), /SUMMARY:Familienessen/);
  });
});

describe("icsToEventInput", () => {
  it("liest das Master-VEVENT samt Roh-ICS-Metadaten", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:ios-uid-7",
      "SUMMARY:Schwimmen",
      "DTSTART;TZID=Europe/Berlin:20260810T170000",
      "DTEND;TZID=Europe/Berlin:20260810T180000",
      "RRULE:FREQ=WEEKLY",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const parsed = icsToEventInput(raw, new Date("2026-08-01T00:00:00Z"));
    assert.equal(parsed?.uid, "ios-uid-7");
    assert.equal(parsed?.title, "Schwimmen");
    // Sommerzeit: 17:00 Berlin = 15:00 UTC
    assert.equal(parsed?.startAt.toISOString(), "2026-08-10T15:00:00.000Z");
    assert.equal(parsed?.hasRecurrence, true);
    assert.equal(parsed?.metadata.davIcs, raw);
  });

  it("liefert null für leere Kalender", () => {
    assert.equal(icsToEventInput("BEGIN:VCALENDAR\r\nEND:VCALENDAR"), null);
  });
});
