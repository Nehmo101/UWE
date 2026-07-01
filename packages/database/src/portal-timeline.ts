import type { InGameDate, WorldCalendarMonth } from "./world-calendar-service";
import { formatInGameDate } from "./world-calendar-service";
import {
  compareInGameDates,
  type PortalWorldEventView,
} from "./world-event-service";

export interface PortalTimelineEventView extends PortalWorldEventView {
  dateLabel: string;
}

export interface PortalTimelineYearGroup {
  year: number;
  label: string;
  events: PortalTimelineEventView[];
}

export function buildPortalTimelineYearLabel(
  year: number,
  epochLabel?: string | null,
): string {
  if (epochLabel?.trim()) {
    return `${epochLabel.trim()} · Jahr ${year}`;
  }
  return `Jahr ${year}`;
}

export function enrichPortalTimelineEvents(
  events: PortalWorldEventView[],
  months: WorldCalendarMonth[],
): PortalTimelineEventView[] {
  return [...events]
    .sort((left, right) => compareInGameDates(left.inGameDate, right.inGameDate))
    .map((event) => ({
      ...event,
      dateLabel: formatInGameDate(event.inGameDate, months),
    }));
}

export function groupPortalTimelineEventsByYear(
  events: PortalTimelineEventView[],
  options: { epochLabel?: string | null } = {},
): PortalTimelineYearGroup[] {
  if (events.length === 0) {
    return [];
  }

  const groups = new Map<number, PortalTimelineEventView[]>();
  for (const event of events) {
    const year = event.inGameDate.year;
    const bucket = groups.get(year);
    if (bucket) {
      bucket.push(event);
    } else {
      groups.set(year, [event]);
    }
  }

  return [...groups.entries()]
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, yearEvents]) => ({
      year,
      label: buildPortalTimelineYearLabel(year, options.epochLabel),
      events: yearEvents.sort((left, right) => compareInGameDates(left.inGameDate, right.inGameDate)),
    }));
}

export function isInGameDateBeforeOrEqual(date: InGameDate, marker: InGameDate): boolean {
  return compareInGameDates(date, marker) <= 0;
}

export function countPortalTimelineEventsThroughDate(
  events: PortalTimelineEventView[],
  marker: InGameDate,
): number {
  return events.filter((event) => isInGameDateBeforeOrEqual(event.inGameDate, marker)).length;
}
