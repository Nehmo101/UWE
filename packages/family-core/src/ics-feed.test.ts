import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnniversaryOccurrence } from "./anniversaries";
import { buildFamilyFeedEvents, renderFamilyIcs, type FeedEventInput } from "./ics-feed";

const utc = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m - 1, d, h));

function event(overrides: Partial<FeedEventInput> = {}): FeedEventInput {
  return {
    id: "e1",
    title: "Zahnarzt",
    description: null,
    location: null,
    startAt: utc(2026, 7, 3, 9),
    endAt: utc(2026, 7, 3, 10),
    allDay: false,
    ...overrides,
  };
}

function anniversary(overrides: Partial<AnniversaryOccurrence> = {}): AnniversaryOccurrence {
  return {
    uid: "uwe-family-birthday-m1-2026",
    memberId: "m1",
    memberName: "Anna",
    colour: "#e11d48",
    kind: "birthday",
    title: "Annas Geburtstag (7)",
    date: utc(2026, 6, 14),
    originalOn: utc(2019, 6, 14),
    years: 7,
    ...overrides,
  };
}

const empty = { events: [], anniversaries: [], healthDue: [] };

describe("buildFamilyFeedEvents", () => {
  it("übernimmt echte Termine mit stabiler UID", () => {
    const [out] = buildFamilyFeedEvents({ ...empty, events: [event()] });

    assert.equal(out?.uid, "uwe-family-event-e1");
    assert.equal(out?.title, "Zahnarzt");
    assert.equal(out?.allDay, false);
  });

  it("schreibt die beteiligten Mitglieder in die Beschreibung", () => {
    const [out] = buildFamilyFeedEvents({
      ...empty,
      events: [event({ memberNames: ["Anna", "Bea"] })],
    });
    assert.equal(out?.description, "Betrifft: Anna, Bea");
  });

  it("hängt die Mitglieder an eine vorhandene Beschreibung an", () => {
    const [out] = buildFamilyFeedEvents({
      ...empty,
      events: [event({ description: "Kontrolle", memberNames: ["Anna"] })],
    });
    assert.equal(out?.description, "Kontrolle\n\nBetrifft: Anna");
  });

  it("lässt die Beschreibung ohne Mitglieder unverändert", () => {
    const [out] = buildFamilyFeedEvents({
      ...empty,
      events: [event({ description: "Kontrolle" })],
    });
    assert.equal(out?.description, "Kontrolle");
  });

  it("gibt Ganztagsterminen ohne Ende den Folgetag als Ende", () => {
    const [out] = buildFamilyFeedEvents({
      ...empty,
      events: [event({ allDay: true, startAt: utc(2026, 7, 3), endAt: null })],
    });
    assert.deepEqual(out?.endAt, utc(2026, 7, 4));
  });

  it("übernimmt Geburtstage als Ganztagstermine", () => {
    const [out] = buildFamilyFeedEvents({ ...empty, anniversaries: [anniversary()] });

    assert.equal(out?.uid, "uwe-family-birthday-m1-2026");
    assert.equal(out?.allDay, true);
    assert.deepEqual(out?.endAt, utc(2026, 6, 15));
  });

  it("übernimmt fällige Einträge aus der Akte mit Mitglied im Titel", () => {
    const [out] = buildFamilyFeedEvents({
      ...empty,
      healthDue: [
        {
          id: "h1",
          memberNames: ["Mimi"],
          kind: "vet",
          title: "Impfung Tollwut",
          nextDueOn: utc(2026, 9, 1),
        },
      ],
    });

    assert.equal(out?.uid, "uwe-family-health-h1");
    assert.equal(out?.title, "Mimi: Impfung Tollwut");
    assert.equal(out?.description, "Tierarzt — fällig");
  });

  it("sortiert alle drei Quellen gemeinsam nach Startzeit", () => {
    const out = buildFamilyFeedEvents({
      events: [event({ id: "spaet", startAt: utc(2026, 8, 1, 9) })],
      anniversaries: [anniversary({ date: utc(2026, 6, 14) })],
      healthDue: [
        {
          id: "h1",
          memberNames: ["Mimi"],
          kind: "vet",
          title: "Impfung",
          nextDueOn: utc(2026, 7, 1),
        },
      ],
    });

    assert.deepEqual(
      out.map((e) => e.uid),
      [
        "uwe-family-birthday-m1-2026",
        "uwe-family-health-h1",
        "uwe-family-event-spaet",
      ],
    );
  });

  it("bleibt bei leerer Eingabe leer", () => {
    assert.deepEqual(buildFamilyFeedEvents(empty), []);
  });
});

describe("renderFamilyIcs", () => {
  it("liefert einen gültigen Kalender mit Namen", () => {
    const ics = renderFamilyIcs({ ...empty, events: [event()] }, "Haushalt");

    assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
    assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
    assert.ok(ics.includes("X-WR-CALNAME:Haushalt"));
    assert.ok(ics.includes("UID:uwe-family-event-e1"));
    assert.ok(ics.includes("SUMMARY:Zahnarzt"));
  });

  it("nutzt CRLF als Zeilenende, wie es iCalendar verlangt", () => {
    const ics = renderFamilyIcs({ ...empty, events: [event()] }, "Haushalt");
    assert.ok(ics.includes("\r\n"));
  });

  it("schreibt Ganztagstermine als DATE-Werte", () => {
    const ics = renderFamilyIcs({ ...empty, anniversaries: [anniversary()] }, "Haushalt");
    assert.ok(ics.includes("DTSTART;VALUE=DATE:20260614"));
  });

  it("erzeugt auch ohne Termine einen leeren, gültigen Kalender", () => {
    const ics = renderFamilyIcs(empty, "Haushalt");
    assert.ok(ics.includes("BEGIN:VCALENDAR"));
    assert.ok(!ics.includes("BEGIN:VEVENT"));
  });
});
