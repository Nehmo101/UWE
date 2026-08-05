import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnniversaryOccurrence } from "./anniversaries";
import { mergeUpcomingEntries, type UpcomingEventLike } from "./upcoming-events";

function event(overrides: Partial<UpcomingEventLike> = {}): UpcomingEventLike {
  return {
    id: "e1",
    title: "Zahnarzt",
    startAt: new Date("2026-08-06T09:30:00"),
    allDay: false,
    location: null,
    members: [],
    ...overrides,
  };
}

function birthday(overrides: Partial<AnniversaryOccurrence> = {}): AnniversaryOccurrence {
  return {
    uid: "m1-birthday-2026",
    memberId: "m1",
    memberName: "Anna",
    colour: "#e11d48",
    kind: "birthday",
    title: "Annas Geburtstag (7)",
    date: new Date(Date.UTC(2026, 7, 7)),
    originalOn: new Date(Date.UTC(2019, 7, 7)),
    years: 7,
    ...overrides,
  };
}

describe("mergeUpcomingEntries", () => {
  it("sortiert Termine und Jahrestage gemeinsam nach Zeitpunkt", () => {
    const entries = mergeUpcomingEntries(
      [
        event({ id: "later", title: "Elternabend", startAt: new Date("2026-08-08T19:00:00") }),
        event({ id: "sooner", startAt: new Date("2026-08-06T09:30:00") }),
      ],
      [birthday()],
    );

    assert.deepEqual(
      entries.map((entry) => entry.id),
      ["sooner", "m1-birthday-2026", "later"],
    );
  });

  it("übersetzt einen Jahrestag in einen ganztägigen Eintrag mit Personen-Badge", () => {
    const [entry] = mergeUpcomingEntries([], [birthday()]);

    assert.equal(entry.anniversary, true);
    assert.equal(entry.allDay, true);
    assert.equal(entry.location, null);
    assert.equal(entry.title, "Annas Geburtstag (7)");
    assert.deepEqual(entry.members, [
      { id: "m1", displayName: "Anna", colour: "#e11d48" },
    ]);
  });

  it("lässt gespeicherte Termine unangetastet durch", () => {
    const badge = { id: "m2", displayName: "Ben", colour: "#0ea5e9" };
    const [entry] = mergeUpcomingEntries(
      [event({ location: "Praxis Dr. Wolf", members: [badge] })],
      [],
    );

    assert.equal(entry.anniversary, false);
    assert.equal(entry.location, "Praxis Dr. Wolf");
    assert.deepEqual(entry.members, [badge]);
  });

  it("hält bei gleichem Zeitpunkt Ganztägiges vorn und die Reihenfolge stabil", () => {
    const at = new Date("2026-08-06T00:00:00");
    const entries = mergeUpcomingEntries(
      [
        event({ id: "timed", title: "B-Termin", startAt: at }),
        event({ id: "allday-b", title: "Brückentag", startAt: at, allDay: true }),
        event({ id: "allday-a", title: "Abholung", startAt: at, allDay: true }),
      ],
      [],
    );

    assert.deepEqual(
      entries.map((entry) => entry.id),
      ["allday-a", "allday-b", "timed"],
    );
  });

  it("kürzt auf das Limit, auch bei Limit 0", () => {
    const events = [
      event({ id: "a" }),
      event({ id: "b", startAt: new Date("2026-08-06T10:00:00") }),
      event({ id: "c", startAt: new Date("2026-08-06T11:00:00") }),
    ];

    assert.equal(mergeUpcomingEntries(events, [], 2).length, 2);
    assert.equal(mergeUpcomingEntries(events, [], 0).length, 0);
  });
});
