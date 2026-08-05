/**
 * Standarddauer eines Termins.
 *
 * Wer eine Startzeit einträgt, meint fast immer einen Termin *mit* Dauer. Ohne
 * Ende steht im Kalender ein Strich statt eines Blocks, und die exportierte
 * ICS-Datei liefert einen Termin ohne DTEND — Kalender-Apps zeigen den je nach
 * Laune als Punkt oder gar nicht. Also bekommt jeder Termin ohne eigenes Ende
 * eine Stunde.
 *
 * Das ist eine **Vorbelegung, kein Zwang**: ein mitgegebenes Ende bleibt
 * unangetastet, und Nacharbeiten geht immer — im Formular wie über die API.
 *
 * Ganztägige Termine bleiben bewusst ohne Ende. Dort spannt der ICS-Feed den
 * ganzen Tag auf (`ics-feed.ts`); eine Stunde wäre schlicht falsch.
 */

/** Eine Stunde — die Dauer, die ein Termin ohne eigenes Ende bekommt. */
export const DEFAULT_EVENT_DURATION_MINUTES = 60;

const MINUTE_MS = 60_000;

function isUsableDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Das Ende, mit dem ein Termin gespeichert wird.
 *
 * - Ende angegeben → bleibt, wie es ist.
 * - Ganztägig ohne Ende → bleibt leer.
 * - Startzeit ohne Ende → Start plus eine Stunde.
 */
export function resolveEventEnd(
  startAt: Date,
  endAt: Date | null | undefined,
  options: { allDay?: boolean } = {},
): Date | null {
  if (isUsableDate(endAt)) return endAt;
  if (options.allDay) return null;
  if (!isUsableDate(startAt)) return null;
  return new Date(startAt.getTime() + DEFAULT_EVENT_DURATION_MINUTES * MINUTE_MS);
}
