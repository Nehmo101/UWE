/**
 * TZID-Auflösung für iCalendar-Zeiten.
 *
 * iOS schickt DTSTART/DTEND mit `TZID=Europe/Berlin` als Lokalzeit. Der Parser
 * behandelte solche Zeiten bisher als UTC — beim CalDAV-Schreiben vom iPhone
 * würden Termine dadurch um die Zeitzonen-Differenz verrutschen. Die Umrechnung
 * hier braucht keine Zonen-Datenbank: `Intl.DateTimeFormat` kennt die IANA-Zonen
 * der Node-Runtime, der Offset wird zweistufig bestimmt (DST-fest).
 */

const DEFAULT_TIMEZONE = "Europe/Berlin";

function isValidTimezone(tzid: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzid });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gültige IANA-Zone oder Fallback: erst `CALENDAR_DEFAULT_TIMEZONE`, dann
 * Europe/Berlin, zuletzt UTC.
 */
export function resolveTimezone(tzid: string | null | undefined): string {
  if (tzid && isValidTimezone(tzid)) return tzid;
  const fallback = process.env.CALENDAR_DEFAULT_TIMEZONE?.trim();
  if (fallback && isValidTimezone(fallback)) return fallback;
  if (isValidTimezone(DEFAULT_TIMEZONE)) return DEFAULT_TIMEZONE;
  return "UTC";
}

/** Offset der Zone gegenüber UTC zum gegebenen Zeitpunkt, in Millisekunden. */
function timezoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const read = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value ?? "0";
    return Number(value);
  };

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    // `hour12: false` liefert für Mitternacht je nach ICU "24".
    read("hour") % 24,
    read("minute"),
    read("second"),
  );
  return asUtc - at.getTime();
}

/**
 * Wandelt eine Wanduhr-Zeit einer IANA-Zone in den UTC-Zeitpunkt um.
 * Zwei Durchläufe, damit der Offset auch direkt an DST-Grenzen stimmt.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tzid: string | null | undefined,
): Date {
  const timeZone = resolveTimezone(tzid);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstGuess = wallClockAsUtc - timezoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  const refinedOffset = timezoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(wallClockAsUtc - refinedOffset);
}
