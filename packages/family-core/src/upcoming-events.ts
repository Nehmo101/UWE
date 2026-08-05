/**
 * Nächste Termine — der Kalenderblick der Family-Startseite.
 *
 * Führt gespeicherte Termine (mit beteiligten Personen) und aufgespannte
 * Geburtstage/Jahrestage zu einer zeitlich sortierten Liste zusammen. Die
 * Formung ist rein und getestet; das Einsammeln übernimmt
 * `loadUpcomingCalendarEntries` nach dem Muster von `briefing-loader.ts`.
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { expandAnniversaries, type AnniversaryOccurrence } from "./anniversaries";
import { attachMembersToEvents, type EventMemberBadge } from "./event-members";
import type { DayBriefCalendarSource } from "./day-brief-service";
import { resolveMemberColour } from "./member-colours";
import { createFamilyMemberService } from "./member-service";

export interface UpcomingCalendarEntry {
  /** Termin-Id oder die stabile UID des aufgespannten Jahrestags. */
  id: string;
  title: string;
  startAt: Date;
  allDay: boolean;
  location: string | null;
  /**
   * true für Geburtstage/Jahrestage. Deren `startAt` ist UTC-Mitternacht
   * (siehe `anniversaries.ts`) — wer den Tag anzeigt, formatiert in UTC.
   */
  anniversary: boolean;
  members: EventMemberBadge[];
}

export interface UpcomingEventLike {
  id: string;
  title: string;
  startAt: Date;
  allDay: boolean;
  location: string | null;
  members: EventMemberBadge[];
}

/**
 * Termine und Jahrestage zeitlich sortiert zusammenführen. Bei gleichem
 * Zeitpunkt stehen Ganztägiges und dann der Titel-Vergleich fest — die
 * Reihenfolge bleibt so über Renderdurchläufe stabil.
 */
export function mergeUpcomingEntries(
  events: readonly UpcomingEventLike[],
  anniversaries: readonly AnniversaryOccurrence[],
  limit = 50,
): UpcomingCalendarEntry[] {
  const merged: UpcomingCalendarEntry[] = [
    ...events.map((event) => ({
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      allDay: event.allDay,
      location: event.location,
      anniversary: false,
      members: event.members,
    })),
    ...anniversaries.map((occurrence) => ({
      id: occurrence.uid,
      title: occurrence.title,
      startAt: occurrence.date,
      allDay: true,
      location: null,
      anniversary: true,
      members: [
        {
          id: occurrence.memberId,
          displayName: occurrence.memberName,
          colour: occurrence.colour,
        },
      ],
    })),
  ];

  merged.sort(
    (a, b) =>
      a.startAt.getTime() - b.startAt.getTime() ||
      Number(b.allDay) - Number(a.allDay) ||
      a.title.localeCompare(b.title, "de"),
  );

  return merged.slice(0, Math.max(0, Math.trunc(limit)));
}

export interface LoadUpcomingEntriesOptions {
  familyDb: FamilyPrismaClient;
  calendar: DayBriefCalendarSource;
  /** Bezugszeitpunkt; Default „jetzt". Der Zeitraum beginnt am Tagesanfang. */
  at?: Date;
  /** Wie viele Tage nach vorn geschaut wird; Default 7. */
  days?: number;
  limit?: number;
}

export interface UpcomingCalendarResult {
  from: Date;
  to: Date;
  entries: UpcomingCalendarEntry[];
}

/**
 * Sammelt die nächsten Termine des Haushalts ein: gespeicherte Termine samt
 * Personen plus Geburtstage/Jahrestage im Zeitraum. Der Zeitraum beginnt am
 * Tagesanfang, damit ein heutiger Ganztagstermin nicht schon mittags fehlt.
 */
export async function loadUpcomingCalendarEntries(
  options: LoadUpcomingEntriesOptions,
): Promise<UpcomingCalendarResult> {
  const at = options.at ?? new Date();
  const days = Math.min(Math.max(Math.trunc(options.days ?? 7), 1), 60);

  const from = new Date(at);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days - 1);
  to.setHours(23, 59, 59, 999);

  const [rawEvents, members] = await Promise.all([
    options.calendar.listEvents({ from, to, limit: 200 }),
    createFamilyMemberService(options.familyDb).listMembers(),
  ]);

  const enriched = await attachMembersToEvents(options.familyDb, rawEvents);
  const anniversaries = expandAnniversaries(members, {
    from,
    to,
    colourOf: resolveMemberColour,
  });

  return { from, to, entries: mergeUpcomingEntries(enriched, anniversaries, options.limit) };
}
