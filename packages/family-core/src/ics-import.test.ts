import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIcsImportPlan,
  defaultIcsImportSelection,
  IcsImportError,
  ICS_IMPORT_UID_PREFIX,
  readIcsFile,
  type IcsImportEvent,
} from "./ics-import";

function ics(...events: string[][]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...events.flatMap((lines) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n");
}

describe("readIcsFile", () => {
  it("liest Titel, Zeitraum und Ort", () => {
    const read = readIcsFile(
      ics([
        "UID:elternabend-1",
        "SUMMARY:Elternabend",
        "LOCATION:Aula",
        "DESCRIPTION:Bitte Zettel mitbringen",
        "DTSTART:20260910T180000Z",
        "DTEND:20260910T200000Z",
      ]),
    );

    assert.equal(read.events.length, 1);
    const event = read.events[0]!;
    assert.equal(event.title, "Elternabend");
    assert.equal(event.location, "Aula");
    assert.equal(event.description, "Bitte Zettel mitbringen");
    assert.equal(event.startAt.toISOString(), "2026-09-10T18:00:00.000Z");
    assert.equal(event.endAt?.toISOString(), "2026-09-10T20:00:00.000Z");
    assert.equal(event.allDay, false);
    assert.equal(event.recurring, false);
    assert.equal(event.importUid, `${ICS_IMPORT_UID_PREFIX}elternabend-1`);
  });

  it("rechnet eine Ortszeit mit TZID in den echten Zeitpunkt um", () => {
    const read = readIcsFile(
      ics([
        "UID:zahnarzt",
        "SUMMARY:Zahnarzt",
        "DTSTART;TZID=Europe/Berlin:20260805T140000",
        "DTEND;TZID=Europe/Berlin:20260805T150000",
      ]),
    );

    // Sommerzeit in Berlin ist UTC+2 — 14:00 Ortszeit sind 12:00 UTC.
    assert.equal(read.events[0]?.startAt.toISOString(), "2026-08-05T12:00:00.000Z");
    assert.equal(read.events[0]?.endAt?.toISOString(), "2026-08-05T13:00:00.000Z");
  });

  it("erkennt Ganztagstermine", () => {
    const read = readIcsFile(
      ics(["UID:ferien", "SUMMARY:Ferienbeginn", "DTSTART;VALUE=DATE:20260720"]),
    );

    assert.equal(read.events[0]?.allDay, true);
    assert.equal(read.events[0]?.startAt.toISOString(), "2026-07-20T00:00:00.000Z");
  });

  it("meldet Serien, statt sie stillschweigend zu kürzen", () => {
    const read = readIcsFile(
      ics([
        "UID:muell",
        "SUMMARY:Gelber Sack",
        "DTSTART;VALUE=DATE:20260806",
        "RRULE:FREQ=WEEKLY;BYDAY=TH",
      ]),
    );

    assert.equal(read.events.length, 1);
    assert.equal(read.events[0]?.recurring, true);
  });

  it("gibt Einträgen ohne UID eine stabile Kennung", () => {
    const file = ics(["SUMMARY:Ohne Kennung", "DTSTART:20260401T090000Z"]);

    const first = readIcsFile(file);
    const second = readIcsFile(file);

    assert.equal(first.events.length, 1);
    assert.match(first.events[0]!.sourceUid, /^uwe-ics-[0-9a-f]{16}$/);
    // Ein zweiter Durchgang derselben Datei muss denselben Termin treffen.
    assert.equal(first.events[0]!.importUid, second.events[0]!.importUid);
  });

  it("faltet umgebrochene Zeilen wieder zusammen", () => {
    const file = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:lang",
      "SUMMARY:Ein sehr langer Titel, der",
      "  umgebrochen wurde",
      "DTSTART:20260401T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    assert.equal(
      readIcsFile(file).events[0]?.title,
      "Ein sehr langer Titel, der umgebrochen wurde",
    );
  });

  it("zählt unbrauchbare Einträge, statt die ganze Datei zu verwerfen", () => {
    const read = readIcsFile(
      ics(
        ["UID:gut", "SUMMARY:Turnier", "DTSTART:20260401T090000Z"],
        ["UID:ohne-titel", "DTSTART:20260402T090000Z"],
      ),
    );

    assert.equal(read.events.length, 1);
    assert.equal(read.skipped, 1);
  });

  it("nimmt bei doppelter UID den ersten Eintrag", () => {
    const read = readIcsFile(
      ics(
        ["UID:serie", "SUMMARY:Training", "DTSTART:20260401T170000Z"],
        ["UID:serie", "SUMMARY:Training (verlegt)", "DTSTART:20260408T190000Z"],
      ),
    );

    assert.equal(read.events.length, 1);
    assert.equal(read.events[0]?.title, "Training");
  });

  it("weist zurück, was keine Kalenderdatei ist", () => {
    assert.throws(() => readIcsFile("Guten Tag,\n\nanbei der Termin."), IcsImportError);
    assert.throws(() => readIcsFile(ics()), IcsImportError);
    assert.throws(
      () => readIcsFile(ics(["UID:leer", "DTSTART:20260401T090000Z"])),
      IcsImportError,
    );
  });

  it("deckelt sehr große Dateien", () => {
    assert.throws(() => readIcsFile(`BEGIN:VCALENDAR${"x".repeat(2_000_001)}`), IcsImportError);
  });
});

function event(overrides: Partial<IcsImportEvent> & { title: string; startAt: Date }): IcsImportEvent {
  return {
    sourceUid: overrides.title.toLowerCase(),
    importUid: `${ICS_IMPORT_UID_PREFIX}${overrides.title.toLowerCase()}`,
    description: null,
    location: null,
    endAt: null,
    allDay: false,
    recurring: false,
    ...overrides,
  };
}

describe("buildIcsImportPlan", () => {
  const start = new Date("2026-09-10T18:00:00.000Z");

  it("kennt neu, erneut importiert und schon von Hand eingetragen", () => {
    const items = buildIcsImportPlan(
      [
        event({ title: "Neu", startAt: start }),
        event({ title: "Wieder", startAt: start }),
        event({ title: "Zwilling", startAt: start }),
      ],
      [
        {
          id: "e1",
          externalUid: `${ICS_IMPORT_UID_PREFIX}wieder`,
          title: "Wieder (alt)",
          startAt: new Date("2026-09-11T18:00:00.000Z"),
        },
        { id: "e2", externalUid: null, title: "zwilling", startAt: start },
      ],
    );

    assert.deepEqual(
      items.map((item) => item.status),
      ["new", "update", "duplicate"],
    );
    assert.equal(items[1]?.existingEventId, "e1");
    assert.equal(items[2]?.existingEventId, "e2");
  });

  it("hakt vorab alles an, was noch nicht im Kalender steht", () => {
    const items = buildIcsImportPlan(
      [event({ title: "Neu", startAt: start }), event({ title: "Zwilling", startAt: start })],
      [{ id: "e2", externalUid: null, title: "Zwilling", startAt: start }],
    );

    assert.deepEqual(defaultIcsImportSelection(items), [`${ICS_IMPORT_UID_PREFIX}neu`]);
  });
});
