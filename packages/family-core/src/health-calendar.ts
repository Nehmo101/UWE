/**
 * Einträge der Gesundheits-/Tierarzt-Akte als Kalender-Vorkommen.
 *
 * Ein Akteneintrag trägt zwei Daten: wann es war (`occurredOn`) und wann das
 * Nächste ansteht (`nextDueOn`). Beide gehören in den Kalender — die Fälligkeit,
 * damit sie niemand verpasst, das Vergangene als Notiz, damit im Rückblick
 * sichtbar ist, was an dem Tag war.
 *
 * Wie Geburtstage wird hier **nichts gespeichert**: aus der Akte wird für den
 * gefragten Zeitraum aufgespannt. Ein Termin, den man im Kalender löschen könnte,
 * während der Eintrag in der Akte stehen bleibt, wäre zwei Wahrheiten statt einer.
 *
 * Rein und ohne Datenbank, damit testbar.
 */
import {
  FAMILY_HEALTH_KIND_LABEL,
  isFamilyHealthRecordKind,
  type FamilyHealthRecordKind,
} from "./family-types";

/** Fälligkeit (`nextDueOn`) oder Vergangenes (`occurredOn`). */
export type HealthOccurrenceKind = "due" | "logged";

export interface HealthRecordWithMembers {
  id: string;
  /** Roh aus der Datenbank; SQLite liefert den Enum als Text. */
  kind: string;
  title: string;
  notes: string;
  occurredOn: Date | null;
  nextDueOn: Date | null;
  /** Eine oder mehrere Personen — die Wurmkur betrifft beide Katzen. */
  members: readonly { id: string; displayName: string; colour: string }[];
}

export interface HealthOccurrence {
  /** Stabile Kennung, auch über Abrufe hinweg — Anker und ICS brauchen das. */
  uid: string;
  recordId: string;
  /** Wie beim Termin: ein Eintrag kann mehrere Personen betreffen. */
  memberIds: readonly string[];
  memberNames: readonly string[];
  /** Farben in derselben Reihenfolge wie `memberNames`. */
  colours: readonly string[];
  /** Art des Akteneintrags (Impfung, Vorsorge, …). */
  recordKind: FamilyHealthRecordKind;
  /** Ob dieses Vorkommen die Fälligkeit oder das Vergangene ist. */
  occurrenceKind: HealthOccurrenceKind;
  /** Fertige Beschriftung, z. B. „Tollwut-Impfung fällig". */
  title: string;
  /** Deutschsprachige Beschriftung der Art, für Liste und Tooltip. */
  kindLabel: string;
  /** Notiz aus der Akte, leer wenn keine hinterlegt ist. */
  notes: string;
  date: Date;
}

export interface ExpandHealthOptions {
  /** Beginn des Zeitraums (einschließlich). */
  from: Date;
  /** Ende des Zeitraums (einschließlich). */
  to: Date;
  /** Farbe je Mitglied — normalerweise `resolveMemberColour`. */
  colourOf: (member: { id: string; colour: string }) => string;
  /**
   * Auch vergangene Einträge (`occurredOn`) aufspannen. Standard: ja.
   * Der ICS-Feed lässt sie aus, damit ein frisches Abo nicht rückwirkend
   * Jahre an Arztbesuchen aufs Telefon schiebt.
   */
  includeLogged?: boolean;
  /**
   * Nur Einträge, an denen diese Person beteiligt ist — wie der Personenfilter
   * im Kalender. Geteilte Einträge bleiben dabei sichtbar.
   */
  memberId?: string | undefined;
}

function inRange(date: Date, from: Date, to: Date): boolean {
  const value = date.getTime();
  return value >= from.getTime() && value <= to.getTime();
}

/**
 * Spannt die Akteneinträge im Zeitraum auf. Ein Eintrag kann zwei Vorkommen
 * liefern (Vergangenes und Fälligkeit), wenn beide Daten im Zeitraum liegen.
 */
export function expandHealthOccurrences(
  records: readonly HealthRecordWithMembers[],
  options: ExpandHealthOptions,
): HealthOccurrence[] {
  const { from, to, colourOf, includeLogged = true, memberId } = options;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  if (from.getTime() > to.getTime()) return [];

  const out: HealthOccurrence[] = [];

  for (const record of records) {
    if (memberId && !record.members.some((member) => member.id === memberId)) continue;

    const recordKind: FamilyHealthRecordKind = isFamilyHealthRecordKind(record.kind)
      ? record.kind
      : "other";
    const kindLabel = FAMILY_HEALTH_KIND_LABEL[recordKind];
    const colours = record.members.map(colourOf);

    const sources: { occurrenceKind: HealthOccurrenceKind; on: Date | null }[] = [
      { occurrenceKind: "due", on: record.nextDueOn },
      { occurrenceKind: "logged", on: includeLogged ? record.occurredOn : null },
    ];

    for (const { occurrenceKind, on } of sources) {
      if (!on || Number.isNaN(on.getTime())) continue;
      if (!inRange(on, from, to)) continue;

      out.push({
        uid: `uwe-family-health-${record.id}-${occurrenceKind}`,
        recordId: record.id,
        memberIds: record.members.map((member) => member.id),
        memberNames: record.members.map((member) => member.displayName),
        colours,
        recordKind,
        occurrenceKind,
        title: occurrenceKind === "due" ? `${record.title} fällig` : record.title,
        kindLabel,
        notes: record.notes ?? "",
        date: on,
      });
    }
  }

  out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title, "de"));
  return out;
}
