import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datesOfIsoWeek } from "./meal-plan-service";
import {
  assignShoppingTrip,
  DEFAULT_FRESH_WEEKDAY,
  weekdayIndexOf,
} from "./shopping-split";

// KW 27/2026: Montag 2026-06-29 … Sonntag 2026-07-05.
const WEEK = datesOfIsoWeek(2026, 27);

describe("weekdayIndexOf (pure)", () => {
  it("maps week dates to their index regardless of time of day", () => {
    assert.equal(weekdayIndexOf(new Date("2026-06-29T00:00:00Z"), WEEK), 0);
    assert.equal(weekdayIndexOf(new Date("2026-07-02T18:30:00Z"), WEEK), 3);
    assert.equal(weekdayIndexOf(new Date("2026-07-05T23:59:59Z"), WEEK), 6);
  });

  it("returns null for dates outside the week", () => {
    assert.equal(weekdayIndexOf(new Date("2026-07-06T00:00:00Z"), WEEK), null);
    assert.equal(weekdayIndexOf(new Date("2026-06-28T12:00:00Z"), WEEK), null);
  });
});

describe("assignShoppingTrip (pure)", () => {
  const thursday = WEEK[DEFAULT_FRESH_WEEKDAY];
  const monday = WEEK[0];
  const sunday = WEEK[6];

  it("sends perishables first used on/after the fresh day to the fresh trip", () => {
    assert.equal(
      assignShoppingTrip({ category: "produce", firstUseDate: thursday }, WEEK),
      "fresh",
    );
    assert.equal(
      assignShoppingTrip({ category: "chilled", firstUseDate: sunday }, WEEK),
      "fresh",
    );
  });

  it("keeps perishables used early in the week in the main trip", () => {
    assert.equal(
      assignShoppingTrip({ category: "produce", firstUseDate: monday }, WEEK),
      "main",
    );
    assert.equal(
      assignShoppingTrip({ category: "chilled", firstUseDate: WEEK[2] }, WEEK),
      "main",
    );
  });

  it("keeps non-perishables in the main trip even for late use (frozen, dry)", () => {
    assert.equal(
      assignShoppingTrip({ category: "frozen", firstUseDate: sunday }, WEEK),
      "main",
    );
    assert.equal(
      assignShoppingTrip({ category: "dry", firstUseDate: sunday }, WEEK),
      "main",
    );
  });

  it("items without a first-use date (basics, manual) go to the main trip", () => {
    assert.equal(
      assignShoppingTrip({ category: "produce", firstUseDate: null }, WEEK),
      "main",
    );
  });

  it("dates outside the week fall back to the main trip", () => {
    assert.equal(
      assignShoppingTrip(
        { category: "produce", firstUseDate: new Date("2026-07-10T00:00:00Z") },
        WEEK,
      ),
      "main",
    );
  });

  it("respects a custom fresh weekday from the week goals", () => {
    // Frische-Einkauf schon Mittwoch (Index 2): Mittwochs-Gemüse wird fresh.
    assert.equal(
      assignShoppingTrip({ category: "produce", firstUseDate: WEEK[2] }, WEEK, 2),
      "fresh",
    );
  });

  it("falls back to Thursday for invalid fresh weekdays (0, 7, NaN)", () => {
    for (const invalid of [0, 7, Number.NaN, -1]) {
      assert.equal(
        assignShoppingTrip({ category: "produce", firstUseDate: WEEK[2] }, WEEK, invalid),
        "main",
      );
      assert.equal(
        assignShoppingTrip({ category: "produce", firstUseDate: WEEK[4] }, WEEK, invalid),
        "fresh",
      );
    }
  });
});
