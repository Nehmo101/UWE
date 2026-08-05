import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandHealthOccurrences, type HealthRecordWithMembers } from "./health-calendar";
import { resolveMemberColour } from "./member-colours";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

const cat = { id: "member-cat", displayName: "Mimi", colour: "#16a34a" };
const child = { id: "member-child", displayName: "Lino", colour: "#2563eb" };

function record(overrides: Partial<HealthRecordWithMembers>): HealthRecordWithMembers {
  return {
    id: "rec-1",
    kind: "vet",
    title: "Tollwut-Impfung",
    notes: "",
    occurredOn: null,
    nextDueOn: null,
    members: [cat],
    ...overrides,
  };
}

const MARCH = { from: utc(2026, 3, 1), to: utc(2026, 3, 31), colourOf: resolveMemberColour };

describe("expandHealthOccurrences", () => {
  it("spannt eine Fälligkeit im Zeitraum auf", () => {
    const out = expandHealthOccurrences([record({ nextDueOn: utc(2026, 3, 12) })], MARCH);

    assert.equal(out.length, 1);
    assert.equal(out[0]?.occurrenceKind, "due");
    assert.equal(out[0]?.title, "Tollwut-Impfung fällig");
    assert.equal(out[0]?.kindLabel, "Tierarzt");
    assert.deepEqual(out[0]?.memberNames, ["Mimi"]);
    assert.deepEqual(out[0]?.colours, ["#16a34a"]);
    assert.deepEqual(out[0]?.date, utc(2026, 3, 12));
  });

  it("spannt Vergangenes und Fälligkeit als zwei Vorkommen auf", () => {
    const out = expandHealthOccurrences(
      [record({ occurredOn: utc(2026, 3, 2), nextDueOn: utc(2026, 3, 20) })],
      MARCH,
    );

    assert.deepEqual(
      out.map((o) => o.occurrenceKind),
      ["logged", "due"],
    );
    assert.equal(out[0]?.title, "Tollwut-Impfung");
    assert.equal(out[1]?.title, "Tollwut-Impfung fällig");
    // Beide zeigen auf denselben Akteneintrag, tragen aber eigene Kennungen.
    assert.equal(out[0]?.recordId, out[1]?.recordId);
    assert.notEqual(out[0]?.uid, out[1]?.uid);
  });

  it("lässt Vergangenes aus, wenn includeLogged aus ist", () => {
    const out = expandHealthOccurrences(
      [record({ occurredOn: utc(2026, 3, 2), nextDueOn: utc(2026, 3, 20) })],
      { ...MARCH, includeLogged: false },
    );

    assert.deepEqual(
      out.map((o) => o.occurrenceKind),
      ["due"],
    );
  });

  it("lässt Daten ausserhalb des Zeitraums und Einträge ohne Datum weg", () => {
    const out = expandHealthOccurrences(
      [
        record({ id: "a", nextDueOn: utc(2026, 4, 1) }),
        record({ id: "b", occurredOn: utc(2026, 2, 28) }),
        record({ id: "c" }),
      ],
      MARCH,
    );

    assert.deepEqual(out, []);
  });

  it("nimmt die Ränder des Zeitraums mit", () => {
    const out = expandHealthOccurrences(
      [
        record({ id: "a", nextDueOn: utc(2026, 3, 1) }),
        record({ id: "b", nextDueOn: utc(2026, 3, 31) }),
      ],
      MARCH,
    );

    assert.equal(out.length, 2);
  });

  it("filtert auf eine Person", () => {
    const out = expandHealthOccurrences(
      [
        record({ id: "a", nextDueOn: utc(2026, 3, 5) }),
        record({
          id: "b",
          members: [child],
          kind: "checkup",
          title: "U9",
          nextDueOn: utc(2026, 3, 6),
        }),
      ],
      { ...MARCH, memberId: child.id },
    );

    assert.deepEqual(
      out.map((o) => o.title),
      ["U9 fällig"],
    );
  });

  it("zeigt beim Filtern auch geteilte Einträge", () => {
    const shared = [
      record({
        id: "geteilt",
        members: [cat, child],
        title: "Grippeimpfung",
        nextDueOn: utc(2026, 3, 9),
      }),
    ];

    // Derselbe Eintrag taucht in beiden gefilterten Ansichten auf, mit beiden
    // Namen — sonst sähe Linos Monat aus, als sei die Impfung nur die der Katze.
    for (const member of [cat, child]) {
      const out = expandHealthOccurrences(shared, { ...MARCH, memberId: member.id });

      assert.deepEqual(
        out.map((o) => o.title),
        ["Grippeimpfung fällig"],
      );
      assert.deepEqual(out[0]?.memberNames, ["Mimi", "Lino"]);
    }
  });

  it("sortiert nach Datum und liefert stabile Kennungen", () => {
    const out = expandHealthOccurrences(
      [
        record({ id: "b", title: "Zweite", nextDueOn: utc(2026, 3, 20) }),
        record({ id: "a", title: "Erste", nextDueOn: utc(2026, 3, 5) }),
      ],
      MARCH,
    );

    assert.deepEqual(
      out.map((o) => o.uid),
      ["uwe-family-health-a-due", "uwe-family-health-b-due"],
    );
  });

  it("fällt bei unbekannter Art auf „Sonstiges“ zurück", () => {
    const out = expandHealthOccurrences(
      [record({ kind: "quatsch", nextDueOn: utc(2026, 3, 9) })],
      MARCH,
    );

    assert.equal(out[0]?.recordKind, "other");
    assert.equal(out[0]?.kindLabel, "Sonstiges");
  });

  it("liefert nichts bei verdrehtem oder ungültigem Zeitraum", () => {
    const rows = [record({ nextDueOn: utc(2026, 3, 12) })];

    assert.deepEqual(
      expandHealthOccurrences(rows, { ...MARCH, from: utc(2026, 3, 31), to: utc(2026, 3, 1) }),
      [],
    );
    assert.deepEqual(
      expandHealthOccurrences(rows, { ...MARCH, from: new Date("kaputt") }),
      [],
    );
  });
});
