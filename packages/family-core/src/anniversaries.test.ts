import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandAnniversaries, occurrenceInYear } from "./anniversaries";
import type { FamilyMemberLike } from "./family-types";

function member(overrides: Partial<FamilyMemberLike> = {}): FamilyMemberLike {
  return {
    id: "m1",
    userId: null,
    displayName: "Anna",
    colour: "#e11d48",
    kind: "adult",
    isActive: true,
    sortIndex: 0,
    birthdayOn: null,
    anniversaryOn: null,
    anniversaryLabel: null,
    ...overrides,
  };
}

const colourOf = (m: FamilyMemberLike) => m.colour;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("occurrenceInYear", () => {
  it("hält Tag und Monat fest", () => {
    assert.deepEqual(occurrenceInYear(utc(1988, 6, 14), 2026), utc(2026, 6, 14));
  });

  it("rutscht den 29. Februar in Nicht-Schaltjahren auf den 28.", () => {
    assert.deepEqual(occurrenceInYear(utc(2000, 2, 29), 2026), utc(2026, 2, 28));
  });

  it("behält den 29. Februar in Schaltjahren", () => {
    assert.deepEqual(occurrenceInYear(utc(2000, 2, 29), 2028), utc(2028, 2, 29));
  });

  it("behandelt 1900 als Nicht-Schaltjahr, 2000 als Schaltjahr", () => {
    assert.deepEqual(occurrenceInYear(utc(1896, 2, 29), 1900), utc(1900, 2, 28));
    assert.deepEqual(occurrenceInYear(utc(1996, 2, 29), 2000), utc(2000, 2, 29));
  });
});

describe("expandAnniversaries", () => {
  it("liefert den Geburtstag mit vollendeten Jahren", () => {
    const out = expandAnniversaries([member({ birthdayOn: utc(2019, 6, 14) })], {
      from: utc(2026, 1, 1),
      to: utc(2026, 12, 31),
      colourOf,
    });

    assert.equal(out.length, 1);
    assert.equal(out[0]?.title, "Annas Geburtstag (7)");
    assert.equal(out[0]?.years, 7);
    assert.deepEqual(out[0]?.date, utc(2026, 6, 14));
    assert.equal(out[0]?.kind, "birthday");
  });

  it("bildet den Genitiv bei Namen auf s/x/z/ß mit Apostroph", () => {
    const out = expandAnniversaries(
      [member({ displayName: "Lukas", birthdayOn: utc(2020, 3, 2) })],
      { from: utc(2026, 1, 1), to: utc(2026, 12, 31), colourOf },
    );
    assert.equal(out[0]?.title, "Lukas' Geburtstag (6)");
  });

  it("nutzt die eigene Beschriftung des Jahrestags", () => {
    const out = expandAnniversaries(
      [
        member({
          anniversaryOn: utc(2015, 8, 22),
          anniversaryLabel: "Hochzeitstag",
        }),
      ],
      { from: utc(2026, 1, 1), to: utc(2026, 12, 31), colourOf },
    );
    assert.equal(out[0]?.title, "Hochzeitstag (11)");
    assert.equal(out[0]?.kind, "anniversary");
  });

  it("spannt über mehrere Jahre je ein Vorkommen auf", () => {
    const out = expandAnniversaries([member({ birthdayOn: utc(2019, 6, 14) })], {
      from: utc(2026, 1, 1),
      to: utc(2028, 12, 31),
      colourOf,
    });
    assert.deepEqual(
      out.map((o) => o.date),
      [utc(2026, 6, 14), utc(2027, 6, 14), utc(2028, 6, 14)],
    );
  });

  it("übergeht Vorkommen ausserhalb des Zeitraums", () => {
    const out = expandAnniversaries([member({ birthdayOn: utc(2019, 6, 14) })], {
      from: utc(2026, 1, 1),
      to: utc(2026, 5, 31),
      colourOf,
    });
    assert.equal(out.length, 0);
  });

  it("lässt inaktive Mitglieder aus, sofern nicht ausdrücklich gewünscht", () => {
    const m = [member({ isActive: false, birthdayOn: utc(2019, 6, 14) })];
    const range = { from: utc(2026, 1, 1), to: utc(2026, 12, 31), colourOf };

    assert.equal(expandAnniversaries(m, range).length, 0);
    assert.equal(expandAnniversaries(m, { ...range, includeInactive: true }).length, 1);
  });

  it("zeigt keine Jahreszahl, wenn das Ursprungsjahr in der Zukunft liegt", () => {
    const out = expandAnniversaries([member({ birthdayOn: utc(2030, 6, 14) })], {
      from: utc(2026, 1, 1),
      to: utc(2026, 12, 31),
      colourOf,
    });
    assert.equal(out[0]?.years, null);
    assert.equal(out[0]?.title, "Annas Geburtstag");
  });

  it("gibt Geburtstag und Jahrestag desselben Mitglieds getrennt aus", () => {
    const out = expandAnniversaries(
      [member({ birthdayOn: utc(2019, 6, 14), anniversaryOn: utc(2015, 8, 22) })],
      { from: utc(2026, 1, 1), to: utc(2026, 12, 31), colourOf },
    );
    assert.deepEqual(
      out.map((o) => o.kind),
      ["birthday", "anniversary"],
    );
    assert.notEqual(out[0]?.uid, out[1]?.uid);
  });

  it("sortiert nach Datum", () => {
    const out = expandAnniversaries(
      [
        member({ id: "a", displayName: "Anna", birthdayOn: utc(2019, 9, 1) }),
        member({ id: "b", displayName: "Bea", birthdayOn: utc(2020, 2, 3) }),
      ],
      { from: utc(2026, 1, 1), to: utc(2026, 12, 31), colourOf },
    );
    assert.deepEqual(
      out.map((o) => o.memberName),
      ["Bea", "Anna"],
    );
  });

  it("bleibt bei ungültigem Zeitraum leer", () => {
    const m = [member({ birthdayOn: utc(2019, 6, 14) })];
    assert.deepEqual(
      expandAnniversaries(m, { from: utc(2026, 12, 31), to: utc(2026, 1, 1), colourOf }),
      [],
    );
  });
});
