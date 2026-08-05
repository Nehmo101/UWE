import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFamilyDayBrief,
  dayRange,
  localDayKey,
  utcDayKey,
  type FamilyDayBriefInput,
} from "./day-brief-service";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const utcMidnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

function input(overrides: Partial<FamilyDayBriefInput> = {}): FamilyDayBriefInput {
  const at = overrides.at ?? local(2026, 8, 2, 9);
  const range = dayRange(at, 2);
  return {
    at,
    from: range.from,
    to: range.to,
    members: [],
    events: [],
    anniversaries: [],
    anniversaryDates: [],
    meals: [],
    tasks: [],
    healthDue: [],
    shopping: null,
    ...overrides,
  };
}

describe("dayRange", () => {
  it("beginnt um Mitternacht des Bezugstages", () => {
    const { from, to } = dayRange(local(2026, 8, 2, 17, 30), 1);

    assert.equal(from.getHours(), 0);
    assert.equal(from.getDate(), 2);
    assert.equal(to.getDate(), 2);
    assert.equal(to.getHours(), 23);
  });

  it("umfasst mit days=2 heute und morgen", () => {
    const { from, to } = dayRange(local(2026, 8, 2, 17), 2);

    assert.equal(from.getDate(), 2);
    assert.equal(to.getDate(), 3);
  });

  it("deckelt auf zwei Tage und faengt Unsinn ab", () => {
    assert.equal(dayRange(local(2026, 8, 2), 9).to.getDate(), 3);
    assert.equal(dayRange(local(2026, 8, 2), 0).to.getDate(), 2);
    assert.equal(dayRange(local(2026, 8, 2), -3).to.getDate(), 2);
  });
});

describe("buildFamilyDayBrief", () => {
  it("legt einen Eintrag je Tag an und markiert heute", () => {
    const brief = buildFamilyDayBrief(input());

    assert.equal(brief.days.length, 2);
    assert.equal(brief.days[0].date, "2026-08-02");
    assert.equal(brief.days[0].isToday, true);
    assert.equal(brief.days[1].isToday, false);
  });

  it("sortiert Termine, Essen und Gesundheit auf den richtigen Tag", () => {
    const brief = buildFamilyDayBrief(
      input({
        events: [
          {
            id: "e1",
            title: "Zahnarzt",
            startAt: local(2026, 8, 3, 10),
            endAt: null,
            allDay: false,
            location: null,
            memberIds: ["m1"],
            memberNames: ["Anna"],
          },
        ],
        meals: [
          {
            id: "meal1",
            date: local(2026, 8, 2, 12),
            slot: "dinner",
            title: "Linsensuppe",
            recipeId: "r1",
            servings: 4,
            cooked: false,
          },
        ],
        healthDue: [
          {
            id: "h1",
            memberIds: ["m2"],
            memberNames: ["Mimi"],
            kind: "vet",
            title: "Impfung",
            nextDueOn: utcMidnight(2026, 8, 3),
          },
        ],
      }),
    );

    assert.equal(brief.days[0].meals.length, 1);
    assert.equal(brief.days[0].events.length, 0);
    assert.equal(brief.days[1].events[0].title, "Zahnarzt");
    assert.equal(brief.days[1].healthDue[0].title, "Impfung");
    assert.deepEqual(brief.counts, {
      events: 1,
      meals: 1,
      tasksDue: 0,
      healthDue: 1,
      shoppingOpen: 0,
    });
  });

  it("haengt ueberfaellige Aufgaben an den ersten Tag statt sie zu verlieren", () => {
    const brief = buildFamilyDayBrief(
      input({
        tasks: [
          {
            id: "t1",
            title: "Rauchmelder pruefen",
            category: "sicherheit",
            nextDueAt: local(2026, 7, 20),
            overdue: true,
          },
          {
            id: "t2",
            title: "Filter wechseln",
            category: "",
            nextDueAt: local(2026, 8, 3, 8),
            overdue: false,
          },
        ],
      }),
    );

    assert.deepEqual(
      brief.days[0].tasksDue.map((task) => task.id),
      ["t1"],
    );
    assert.deepEqual(
      brief.days[1].tasksDue.map((task) => task.id),
      ["t2"],
    );
    assert.equal(brief.counts.tasksDue, 2);
  });

  it("legt Geburtstage nach UTC-Datum ab, Termine nach Ortszeit", () => {
    const brief = buildFamilyDayBrief(
      input({
        anniversaries: [
          {
            memberId: "m1",
            memberName: "Anna",
            colour: "#abc",
            kind: "birthday",
            title: "Annas Geburtstag (7)",
            years: 7,
          },
        ],
        anniversaryDates: [utcMidnight(2026, 8, 3)],
      }),
    );

    assert.equal(brief.days[0].anniversaries.length, 0);
    assert.equal(brief.days[1].anniversaries[0].title, "Annas Geburtstag (7)");
  });

  it("laesst Termine ausserhalb des Zeitraums fallen, statt sie umzusortieren", () => {
    const brief = buildFamilyDayBrief(
      input({
        events: [
          {
            id: "spaet",
            title: "Naechste Woche",
            startAt: local(2026, 8, 9, 10),
            endAt: null,
            allDay: false,
            location: null,
            memberIds: [],
            memberNames: [],
          },
        ],
      }),
    );

    assert.equal(brief.counts.events, 0);
  });

  it("uebernimmt die Einkaufsliste samt voller Anzahl", () => {
    const brief = buildFamilyDayBrief(
      input({
        shopping: {
          listId: "l1",
          title: "Wocheneinkauf",
          openCount: 12,
          openItems: [
            { id: "i1", name: "Milch", amount: 2, unit: "piece", unitLabel: null, category: "dairy" },
          ],
        },
      }),
    );

    assert.equal(brief.shopping?.openCount, 12);
    assert.equal(brief.counts.shoppingOpen, 12);
  });
});

describe("Tagesschluessel", () => {
  it("trennt Ortszeit und UTC bewusst", () => {
    assert.equal(localDayKey(local(2026, 8, 2, 23, 30)), "2026-08-02");
    assert.equal(utcDayKey(utcMidnight(2026, 8, 2)), "2026-08-02");
  });
});
