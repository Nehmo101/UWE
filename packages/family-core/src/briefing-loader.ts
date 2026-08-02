/**
 * Einsammeln für das Wochenbriefing.
 *
 * Bewusst getrennt von `briefing-service.ts`: dort steht die reine, getestete
 * Formung, hier der Datenbank-Teil. Vorher lag dieses Einsammeln in
 * `apps/family/app/briefing/page.tsx` — Business-Logik gehört nach
 * `packages/` (CLAUDE.md, „Goldene Regel"), und seit es hier liegt, kann es
 * neben der Seite auch eine API bedienen.
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { expandAnniversaries } from "./anniversaries";
import { weekRange, type BriefingContract, type BriefingInput } from "./briefing-service";
import { attachMembersToEvents } from "./event-members";
import type { FamilyHealthRecordKind } from "./family-types";
import { createFamilyHealthService } from "./health-service";
import { resolveMemberColour } from "./member-colours";
import { createFamilyMemberService } from "./member-service";
import type { DayBriefCalendarSource } from "./day-brief-service";

export interface LoadWeekBriefingOptions {
  familyDb: FamilyPrismaClient;
  calendar: DayBriefCalendarSource;
  /** Bezugszeitpunkt; Default „jetzt". Die Woche läuft Montag bis Sonntag. */
  at?: Date;
  eventLimit?: number;
}

/**
 * Baut den Rohstoff für `buildBriefingContext` — Termine der Woche mit
 * Personen, Geburtstage, fällige Gesundheitseinträge, auslaufende Verträge.
 */
export async function loadWeekBriefingInput(
  options: LoadWeekBriefingOptions,
): Promise<BriefingInput> {
  const { from, to } = weekRange(options.at ?? new Date());

  const [rawEvents, members, healthDue, contractRows] = await Promise.all([
    options.calendar.listEvents({ from, to, limit: options.eventLimit ?? 300 }),
    createFamilyMemberService(options.familyDb).listMembers(),
    createFamilyHealthService(options.familyDb).listDueUntil(to, from),
    options.familyDb.contractExpense.findMany({
      where: { status: "active", cancelByDate: { gte: from, lte: to } },
      select: { name: true, cancelByDate: true },
    }),
  ]);

  const enriched = await attachMembersToEvents(options.familyDb, rawEvents);

  const contracts: BriefingContract[] = contractRows.flatMap((row) =>
    row.cancelByDate ? [{ name: row.name, endsOn: row.cancelByDate }] : [],
  );

  return {
    from,
    to,
    memberNames: members.map((member) => member.displayName),
    events: enriched.map((event) => ({
      title: event.title,
      startAt: event.startAt,
      allDay: event.allDay,
      location: event.location,
      memberNames: event.members.map((member) => member.displayName),
    })),
    anniversaries: expandAnniversaries(members, { from, to, colourOf: resolveMemberColour }),
    healthDue: healthDue.flatMap((record) =>
      record.nextDueOn
        ? [
            {
              memberName: record.member.displayName,
              kind: record.kind as FamilyHealthRecordKind,
              title: record.title,
              nextDueOn: record.nextDueOn,
            },
          ]
        : [],
    ),
    contracts,
  };
}
