import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBriefingContext,
  hasBriefingContent,
  weekRange,
  type BriefingInput,
} from "./briefing-service";

const utc = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);

function input(overrides: Partial<BriefingInput> = {}): BriefingInput {
  return {
    from: utc(2026, 8, 3),
    to: utc(2026, 8, 9),
    memberNames: ["Anna", "Lino", "Mimi"],
    events: [],
    anniversaries: [],
    healthDue: [],
    contracts: [],
    ...overrides,
  };
}

describe("weekRange", () => {
  it("beginnt am Montag und endet am Sonntag", () => {
    const { from, to } = weekRange(utc(2026, 8, 5)); // Mittwoch

    assert.equal(from.getDay(), 1, "Montag");
    assert.equal(to.getDay(), 0, "Sonntag");
    assert.equal(from.getDate(), 3);
    assert.equal(to.getDate(), 9);
  });

  it("rechnet den Sonntag zur ablaufenden Woche", () => {
    const { from, to } = weekRange(utc(2026, 8, 9)); // Sonntag

    assert.equal(from.getDate(), 3);
    assert.equal(to.getDate(), 9);
  });

  it("beginnt den Tag um Mitternacht und endet kurz vor der nächsten", () => {
    const { from, to } = weekRange(utc(2026, 8, 5, 14));

    assert.equal(from.getHours(), 0);
    assert.equal(to.getHours(), 23);
  });
});

describe("hasBriefingContent", () => {
  it("ist bei leerer Woche falsch", () => {
    assert.equal(hasBriefingContent(input()), false);
  });

  it("ist wahr, sobald irgendetwas ansteht", () => {
    const event = {
      title: "Zahnarzt",
      startAt: utc(2026, 8, 5, 9),
      allDay: false,
      location: null,
      memberNames: ["Anna"],
    };
    assert.ok(hasBriefingContent(input({ events: [event] })));
    assert.ok(
      hasBriefingContent(input({ contracts: [{ name: "Strom", endsOn: utc(2026, 8, 6) }] })),
    );
  });
});

describe("buildBriefingContext", () => {
  it("nennt den Haushalt und den Zeitraum", () => {
    const context = buildBriefingContext(input());

    assert.match(context, /Haushalt: Anna, Lino, Mimi/);
    assert.match(context, /Zeitraum: Montag, 3\. August bis Sonntag, 9\. August/);
  });

  it("führt Termine mit Zeit, Ort und Personen auf", () => {
    const context = buildBriefingContext(
      input({
        events: [
          {
            title: "Zahnarzt",
            startAt: utc(2026, 8, 5, 9),
            allDay: false,
            location: "Praxis Meier",
            memberNames: ["Anna"],
          },
        ],
      }),
    );

    assert.match(context, /Mittwoch, 5\. August, 09:00: Zahnarzt \(Praxis Meier\) \[Anna\]/);
  });

  it("kennzeichnet Termine ohne Zuordnung als „alle“", () => {
    const context = buildBriefingContext(
      input({
        events: [
          {
            title: "Familienessen",
            startAt: utc(2026, 8, 6, 18),
            allDay: false,
            location: null,
            memberNames: [],
          },
        ],
      }),
    );

    assert.match(context, /Familienessen \[alle\]/);
  });

  it("lässt bei Ganztagsterminen die Uhrzeit weg", () => {
    const context = buildBriefingContext(
      input({
        events: [
          {
            title: "Ferienbeginn",
            startAt: utc(2026, 8, 7),
            allDay: true,
            location: null,
            memberNames: [],
          },
        ],
      }),
    );

    assert.match(context, /Freitag, 7\. August: Ferienbeginn/);
    assert.doesNotMatch(context, /Ferienbeginn.*\d{2}:\d{2}/);
  });

  it("sagt ausdrücklich, wenn nichts ansteht", () => {
    const context = buildBriefingContext(input());

    assert.match(context, /Termine \(0\):\n- keine/);
    assert.match(context, /- nichts fällig/);
  });

  it("führt Gesundheitseinträge mit Art und Person auf", () => {
    const context = buildBriefingContext(
      input({
        healthDue: [
          {
            memberName: "Mimi",
            kind: "vet",
            title: "Tollwut-Impfung",
            nextDueOn: utc(2026, 8, 6),
          },
        ],
      }),
    );

    assert.match(context, /Mimi — Tollwut-Impfung \(Tierarzt\)/);
  });

  it("führt auslaufende Verträge auf", () => {
    const context = buildBriefingContext(
      input({ contracts: [{ name: "Stromvertrag", endsOn: utc(2026, 8, 8) }] }),
    );

    assert.match(context, /Samstag, 8\. August: Stromvertrag/);
  });

  it("kommt ohne Mitglieder zurecht", () => {
    assert.match(buildBriefingContext(input({ memberNames: [] })), /keine Mitglieder erfasst/);
  });
});
