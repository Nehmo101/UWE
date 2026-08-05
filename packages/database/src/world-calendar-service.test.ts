import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceInGameDate,
  DEFAULT_WORLD_CALENDAR_MONTHS,
  formatClockLabel,
  formatInGameDate,
} from "./world-calendar-service";

describe("formatClockLabel (pure)", () => {
  it("assembles day/month/year with the calendar name", () => {
    assert.equal(
      formatClockLabel("Terra-Kalender", { day: 12, monthName: "Regen", year: 1487 }, null),
      "Terra-Kalender: 12. Regen. 1487",
    );
  });
  it("falls back to the name when the date shape is unknown", () => {
    assert.equal(formatClockLabel("Kal", 42, null), "Kal");
  });
  it("returns null when nothing is known", () => {
    assert.equal(formatClockLabel(null, null, null), null);
  });
  it("uses the epoch label when present", () => {
    assert.equal(formatClockLabel(null, {}, "3. Zeitalter"), "3. Zeitalter");
  });
});

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
