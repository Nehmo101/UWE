/**
 * Aufbau des ICS-Feeds für den Haushalts-Kalender.
 *
 * Der Feed vereint drei Quellen zu einer Liste, die `generateIcalCalendar`
 * aus `@uwe/calendar` in iCalendar übersetzt:
 *
 * 1. echte Termine,
 * 2. Geburtstage und Jahrestage (jährlich aufgespannt, nicht gespeichert),
 * 3. fällige Einträge aus der Gesundheits-/Tierarzt-Akte.
 *
 * Der Aufbau ist rein: Datenbankzugriffe passieren beim Aufrufer, hier wird
 * nur zusammengesetzt. Damit ist der Feed ohne laufende App testbar.
 */
import { generateIcalCalendar, type IcalExportEvent } from "@uwe/calendar";
import type { AnniversaryOccurrence } from "./anniversaries";
import { FAMILY_HEALTH_KIND_LABEL, type FamilyHealthRecordKind } from "./family-types";

export interface FeedEventInput {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  /** Namen der beteiligten Mitglieder — landen in der Beschreibung. */
  memberNames?: readonly string[];
}

export interface FeedHealthInput {
  id: string;
  /** Namen der betroffenen Personen — die Wurmkur gilt oft für beide Katzen. */
  memberNames: readonly string[];
  kind: FamilyHealthRecordKind;
  title: string;
  nextDueOn: Date;
}

export interface BuildFeedInput {
  events: readonly FeedEventInput[];
  anniversaries: readonly AnniversaryOccurrence[];
  healthDue: readonly FeedHealthInput[];
}

/** Ein Ganztagstermin endet in iCalendar am Folgetag (DTEND ist exklusiv). */
function nextDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function withMembers(description: string | null, memberNames?: readonly string[]): string | null {
  if (!memberNames || memberNames.length === 0) return description;
  const line = `Betrifft: ${[...memberNames].join(", ")}`;
  return description && description.trim() !== "" ? `${description}\n\n${line}` : line;
}

/**
 * Setzt die drei Quellen zu einer nach Startzeit sortierten Liste zusammen.
 * Die UIDs sind über Abrufe hinweg stabil — sonst legt die Kalender-App bei
 * jedem Abgleich neue Einträge an, statt bestehende zu aktualisieren.
 */
export function buildFamilyFeedEvents(input: BuildFeedInput): IcalExportEvent[] {
  const out: IcalExportEvent[] = [];

  for (const event of input.events) {
    out.push({
      uid: `uwe-family-event-${event.id}`,
      title: event.title,
      description: withMembers(event.description, event.memberNames),
      location: event.location,
      startAt: event.startAt,
      endAt: event.allDay
        ? (event.endAt ?? nextDay(event.startAt))
        : event.endAt,
      allDay: event.allDay,
    });
  }

  for (const occurrence of input.anniversaries) {
    out.push({
      uid: occurrence.uid,
      title: occurrence.title,
      description: null,
      location: null,
      startAt: occurrence.date,
      endAt: nextDay(occurrence.date),
      allDay: true,
    });
  }

  for (const due of input.healthDue) {
    out.push({
      uid: `uwe-family-health-${due.id}`,
      title: due.memberNames.length > 0 ? `${due.memberNames.join(", ")}: ${due.title}` : due.title,
      description: `${FAMILY_HEALTH_KIND_LABEL[due.kind]} — fällig`,
      location: null,
      startAt: due.nextDueOn,
      endAt: nextDay(due.nextDueOn),
      allDay: true,
    });
  }

  out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return out;
}

/** Fertiger iCalendar-Text für die Feed-Route. */
export function renderFamilyIcs(input: BuildFeedInput, calendarName: string): string {
  return generateIcalCalendar(buildFamilyFeedEvents(input), calendarName);
}
