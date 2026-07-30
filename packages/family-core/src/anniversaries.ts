/**
 * Geburtstage und Jahrestage als jährlich wiederkehrende Termine.
 *
 * Die Daten liegen einmalig am Mitglied (`birthdayOn`, `anniversaryOn`); für
 * Kalender, ICS-Feed und Wochenbriefing werden daraus im gefragten Zeitraum
 * virtuelle Ganztagstermine aufgespannt. Es wird nichts gespeichert — ein
 * Geburtstag ist kein Kalendereintrag, den man löschen können sollte.
 *
 * Rein und ohne Datenbank, damit testbar.
 */
import type { FamilyMemberLike } from "./family-types";

export type AnniversaryKind = "birthday" | "anniversary";

export interface AnniversaryOccurrence {
  /** Stabile Kennung, auch über Feed-Abrufe hinweg — ICS braucht das. */
  uid: string;
  memberId: string;
  memberName: string;
  colour: string;
  kind: AnniversaryKind;
  /** Fertige Beschriftung, z. B. „Annas Geburtstag (7)". */
  title: string;
  /** UTC-Mitternacht des Tages, an dem der Termin in diesem Jahr liegt. */
  date: Date;
  /** Ursprungsdatum, wie am Mitglied gespeichert. */
  originalOn: Date;
  /** Vollendete Jahre an diesem Tag, `null` wenn das Ursprungsjahr in der Zukunft liegt. */
  years: number | null;
}

function utcMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Das Vorkommen eines Tag/Monat-Paares in einem bestimmten Jahr.
 * Der 29. Februar rutscht in Nicht-Schaltjahren auf den 28. — so hält es auch
 * die iOS-Kalender-App, und ein Geburtstag darf nicht drei von vier Jahren fehlen.
 */
export function occurrenceInYear(originalOn: Date, year: number): Date {
  const month = originalOn.getUTCMonth();
  const day = originalOn.getUTCDate();
  if (month === 1 && day === 29 && !isLeapYear(year)) {
    return utcMidnight(year, 1, 28);
  }
  return utcMidnight(year, month, day);
}

function genitive(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return trimmed;
  // „Lukas" → „Lukas'", sonst „Anna" → „Annas".
  return /[sxzß]$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}s`;
}

function buildTitle(
  member: FamilyMemberLike,
  kind: AnniversaryKind,
  years: number | null,
): string {
  const suffix = years !== null && years > 0 ? ` (${years})` : "";
  if (kind === "anniversary") {
    const label = member.anniversaryLabel?.trim();
    if (label) return `${label}${suffix}`;
    return `${genitive(member.displayName)} Jahrestag${suffix}`;
  }
  return `${genitive(member.displayName)} Geburtstag${suffix}`;
}

interface ExpandOptions {
  /** Beginn des Zeitraums (einschließlich). */
  from: Date;
  /** Ende des Zeitraums (einschließlich). */
  to: Date;
  /** Farbe je Mitglied — normalerweise `resolveMemberColour`. */
  colourOf: (member: FamilyMemberLike) => string;
  /** Auch inaktive Mitglieder berücksichtigen. Standard: nein. */
  includeInactive?: boolean;
}

/**
 * Spannt alle Geburtstage und Jahrestage der übergebenen Mitglieder im Zeitraum
 * auf. Der Zeitraum darf mehrere Jahre umfassen; jedes Jahr liefert ein
 * eigenes Vorkommen.
 */
export function expandAnniversaries(
  members: readonly FamilyMemberLike[],
  options: ExpandOptions,
): AnniversaryOccurrence[] {
  const { from, to, colourOf, includeInactive = false } = options;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  if (from.getTime() > to.getTime()) return [];

  const firstYear = from.getUTCFullYear();
  const lastYear = to.getUTCFullYear();
  const out: AnniversaryOccurrence[] = [];

  for (const member of members) {
    if (!includeInactive && !member.isActive) continue;

    const sources: { kind: AnniversaryKind; on: Date | null }[] = [
      { kind: "birthday", on: member.birthdayOn },
      { kind: "anniversary", on: member.anniversaryOn },
    ];

    for (const { kind, on } of sources) {
      if (!on || Number.isNaN(on.getTime())) continue;

      for (let year = firstYear; year <= lastYear; year += 1) {
        const date = occurrenceInYear(on, year);
        if (date.getTime() < from.getTime() || date.getTime() > to.getTime()) continue;

        const rawYears = year - on.getUTCFullYear();
        const years = rawYears >= 0 ? rawYears : null;

        out.push({
          uid: `uwe-family-${kind}-${member.id}-${year}`,
          memberId: member.id,
          memberName: member.displayName,
          colour: colourOf(member),
          kind,
          title: buildTitle(member, kind, years),
          date,
          originalOn: on,
          years,
        });
      }
    }
  }

  out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title, "de"));
  return out;
}
