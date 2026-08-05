import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createTestFamilyClient,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import {
  applyIcsImport,
  previewIcsImport,
  type IcsImportCalendarTarget,
} from "./ics-import-service";
import { memberIdsByEvent } from "./event-members";
import { createFamilyMemberService } from "./member-service";

/**
 * Der Kalender-Dienst aus `@uwe/database` zieht die Kern-Datenbank mit; für
 * den Import reicht der Ausschnitt, den er selbst deklariert.
 */
function calendarTarget(db: FamilyPrismaClient): IcsImportCalendarTarget {
  return {
    async ensureLocalFeed() {
      const existing = await db.calendarFeed.findFirst({ where: { type: "local" } });
      if (existing) return { id: existing.id };
      return db.calendarFeed.create({
        data: { name: "UWE Kalender", type: "local", direction: "read_write" },
      });
    },
    async createEvent(input) {
      return db.calendarEvent.create({
        data: {
          feedId: input.feedId ?? null,
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          startAt: input.startAt,
          endAt: input.endAt ?? null,
          allDay: input.allDay ?? false,
          kind: input.kind ?? "personal",
          externalUid: input.externalUid ?? null,
        },
      });
    },
    async updateEvent(id, input) {
      return db.calendarEvent.update({
        where: { id },
        data: {
          ...(input.title != null ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.startAt != null ? { startAt: input.startAt } : {}),
          ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
          ...(input.allDay != null ? { allDay: input.allDay } : {}),
        },
      });
    },
  };
}

const FILE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:schule-elternabend",
  "SUMMARY:Elternabend",
  "LOCATION:Aula",
  "DTSTART;TZID=Europe/Berlin:20260910T180000",
  "DTEND;TZID=Europe/Berlin:20260910T200000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:schule-wandertag",
  "SUMMARY:Wandertag",
  "DTSTART;VALUE=DATE:20260925",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("ICS-Import in den Haushalts-Kalender", () => {
  let db: FamilyPrismaClient;
  let calendar: IcsImportCalendarTarget;

  before(() => {
    db = createTestFamilyClient();
    calendar = calendarTarget(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  it("zeigt in der Vorschau lauter neue Termine und schreibt nichts", async () => {
    const preview = await previewIcsImport(db, FILE);

    assert.equal(preview.counts.total, 2);
    assert.equal(preview.counts.new, 2);
    assert.equal(preview.selection.length, 2);
    assert.equal(await db.calendarEvent.count(), 0);
  });

  it("übernimmt nur die angehakten Termine und ordnet sie Personen zu", async () => {
    const anna = await createFamilyMemberService(db).createMember({ displayName: "Anna" });
    const preview = await previewIcsImport(db, FILE);
    const elternabend = preview.items.find((item) => item.event.title === "Elternabend");

    const result = await applyIcsImport({
      familyDb: db,
      calendar,
      text: FILE,
      selectedUids: [elternabend!.event.importUid],
      memberIds: [anna.id],
    });

    assert.deepEqual(result, { created: 1, updated: 0, skipped: 1 });

    const events = await db.calendarEvent.findMany();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.title, "Elternabend");
    assert.equal(events[0]?.location, "Aula");
    // Ortszeit 18:00 in Berlin (Sommerzeit) ist 16:00 UTC.
    assert.equal(events[0]?.startAt.toISOString(), "2026-09-10T16:00:00.000Z");
    // Im lokalen Feed und als eigener Termin — sonst wäre er in der Oberfläche
    // schreibgeschützt.
    assert.equal(events[0]?.kind, "personal");
    assert.ok(events[0]?.feedId);

    const byEvent = await memberIdsByEvent(db, [events[0]!.id]);
    assert.deepEqual(byEvent.get(events[0]!.id), [anna.id]);
  });

  it("legt dieselbe Datei beim zweiten Mal nicht doppelt an", async () => {
    const preview = await previewIcsImport(db, FILE);
    assert.equal(preview.counts.update, 1);
    assert.equal(preview.counts.new, 1);

    const result = await applyIcsImport({
      familyDb: db,
      calendar,
      text: FILE,
      selectedUids: preview.items.map((item) => item.event.importUid),
    });

    assert.deepEqual(result, { created: 1, updated: 1, skipped: 0 });
    assert.equal(await db.calendarEvent.count(), 2);
  });

  it("gibt einem Termin ohne DTEND die Haushalts-Stunde, ganztägig bleibt ohne Ende", async () => {
    const file = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:ohne-ende",
      "SUMMARY:Kurzer Anruf",
      "DTSTART:20261015T090000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ganztags",
      "SUMMARY:Brückentag",
      "DTSTART;VALUE=DATE:20261016",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const preview = await previewIcsImport(db, file);
    await applyIcsImport({
      familyDb: db,
      calendar,
      text: file,
      selectedUids: preview.items.map((item) => item.event.importUid),
    });

    const anruf = await db.calendarEvent.findFirst({ where: { title: "Kurzer Anruf" } });
    assert.equal(anruf?.endAt?.toISOString(), "2026-10-15T10:00:00.000Z");

    const brueckentag = await db.calendarEvent.findFirst({ where: { title: "Brückentag" } });
    assert.equal(brueckentag?.endAt, null);
  });

  it("erkennt einen von Hand eingetragenen Zwilling und hakt ihn nicht an", async () => {
    const file = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:einladung-4711",
      "SUMMARY:Kindergeburtstag",
      "DTSTART:20261101T150000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    await db.calendarEvent.create({
      data: { title: "Kindergeburtstag", startAt: new Date("2026-11-01T15:00:00.000Z") },
    });

    const preview = await previewIcsImport(db, file);
    assert.equal(preview.counts.duplicate, 1);
    assert.deepEqual(preview.selection, []);

    // Ohne Auswahl passiert nichts — der bestehende Termin bleibt unberührt.
    const result = await applyIcsImport({
      familyDb: db,
      calendar,
      text: file,
      selectedUids: [],
    });
    assert.deepEqual(result, { created: 0, updated: 0, skipped: 1 });
  });
});
