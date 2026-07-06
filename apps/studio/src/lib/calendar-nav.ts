export function parseCalendarFocusDate(
  yearRaw: string | undefined,
  monthRaw: string | undefined,
  now = new Date(),
): Date {
  const year = Number.parseInt(yearRaw ?? String(now.getFullYear()), 10);
  const month = Number.parseInt(monthRaw ?? String(now.getMonth() + 1), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(year, month - 1, 1);
}

export function calendarPageHref(
  view: "month" | "week",
  focus: Date,
): string {
  return `/calendar?view=${view}&year=${focus.getFullYear()}&month=${focus.getMonth() + 1}`;
}

export function shiftCalendarMonth(focus: Date, delta: number): Date {
  return new Date(focus.getFullYear(), focus.getMonth() + delta, 1);
}

export function startOfWeekMonday(date: Date): Date {
  const start = new Date(date);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
