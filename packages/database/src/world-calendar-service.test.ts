import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceInGameDate,
  DEFAULT_WORLD_CALENDAR_MONTHS,
  formatInGameDate,
} from "./world-calendar-service";

describe("advanceInGameDate", () => {
  const months = DEFAULT_WORLD_CALENDAR_MONTHS;

  it("adds days within the same month", () => {
    const next = advanceInGameDate({ year: 1, month: 1, day: 5 }, 3, months);
    assert.deepEqual(next, { year: 1, month: 1, day: 8 });
  });

  it("wraps into the next month", () => {
    const next = advanceInGameDate({ year: 1, month: 1, day: 28 }, 5, months);
    assert.deepEqual(next, { year: 1, month: 2, day: 3 });
  });

  it("wraps into the next year", () => {
    const next = advanceInGameDate({ year: 1, month: 4, day: 25 }, 10, months);
    assert.deepEqual(next, { year: 2, month: 1, day: 5 });
  });

  it("formats advanced dates with month names", () => {
    const next = advanceInGameDate({ year: 472, month: 3, day: 12 }, 1, months);
    assert.equal(formatInGameDate(next, months), "13. Herbst 472");
  });
});
