import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarPageHref,
  parseCalendarFocusDate,
  shiftCalendarMonth,
  startOfWeekMonday,
  toDateTimeLocalValue,
} from "./calendar-nav";

describe("calendar-nav", () => {
  it("parses focus month from search params", () => {
    const focus = parseCalendarFocusDate("2026", "7", new Date("2026-01-15T12:00:00Z"));
    assert.equal(focus.getFullYear(), 2026);
    assert.equal(focus.getMonth(), 6);
    assert.equal(focus.getDate(), 1);
  });

  it("builds stable calendar page hrefs", () => {
    const focus = new Date(2026, 6, 1);
    assert.equal(calendarPageHref("month", focus), "/calendar?view=month&year=2026&month=7");
    assert.equal(calendarPageHref("week", focus), "/calendar?view=week&year=2026&month=7");
  });

  it("shifts months without day overflow", () => {
    const focus = new Date(2026, 0, 1);
    const next = shiftCalendarMonth(focus, 1);
    assert.equal(next.getMonth(), 1);
  });

  it("formats datetime-local values", () => {
    const value = toDateTimeLocalValue(new Date(2026, 6, 6, 14, 5));
    assert.equal(value, "2026-07-06T14:05");
  });

  it("starts weeks on Monday", () => {
    const monday = startOfWeekMonday(new Date(2026, 6, 8));
    assert.equal(monday.getDay(), 1);
  });
});
