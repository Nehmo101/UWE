/**
 * iCal parsing and generation utilities for UWE Calendar integration.
 * Supports read-only iCal feeds (FamilyWall, iCloud public links, Nextcloud, Radicale).
 */

import { assertUserProvidedFetchUrlAllowed } from "@uwe/security";
import { fetchCalDavEventsViaGet } from "./caldav-sync";

export interface ParsedIcalEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt?: Date;
  allDay: boolean;
  /** RRULE vorhanden — der Parser expandiert nicht, er markiert nur. */
  hasRecurrence?: boolean;
  /** Gesetzt bei Ausnahme-VEVENTs einer Serie (RECURRENCE-ID). */
  recurrenceId?: string;
}

function unfoldIcalLines(content: string): string[] {
  const raw = content.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/**
 * Versatz einer Zeitzone zu einem Zeitpunkt, in Millisekunden.
 * `Intl` kennt die Zonendatenbank; eine Bibliothek braucht es dafür nicht.
 */
function timeZoneOffsetMs(timestamp: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(timestamp));

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - timestamp;
}

/**
 * Ortszeit in einer Zeitzone → echter Zeitpunkt.
 *
 * Zwei Runden, weil der Versatz selbst vom Zeitpunkt abhängt: die erste Runde
 * schätzt mit dem Versatz der naiven Zeit, die zweite korrigiert ihn — das
 * trägt auch über die Zeitumstellung.
 */
function zonedTimeToUtc(naiveUtcMs: number, timeZone: string): Date {
  let timestamp = naiveUtcMs;
  for (let round = 0; round < 2; round += 1) {
    timestamp = naiveUtcMs - timeZoneOffsetMs(timestamp, timeZone);
  }
  return new Date(timestamp);
}

/**
 * `timeZone` kommt aus dem `TZID`-Parameter der Zeile. Ohne `Z` und ohne
 * `TZID` bleibt es bei der bisherigen Auslegung als UTC — eine schwebende
 * Zeitangabe hat keine Zone, und das Raten wäre schlimmer als die Annahme.
 */
function parseIcalDate(value: string, timeZone?: string): { date: Date; allDay: boolean } {
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) {
    const y = Number(trimmed.slice(0, 4));
    const m = Number(trimmed.slice(4, 6)) - 1;
    const d = Number(trimmed.slice(6, 8));
    return { date: new Date(Date.UTC(y, m, d)), allDay: true };
  }
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (match) {
    const [, ys, ms, ds, hs, mins, ss, utcMarker] = match;
    const naive = Date.UTC(
      Number(ys),
      Number(ms) - 1,
      Number(ds),
      Number(hs),
      Number(mins),
      Number(ss),
    );
    if (!utcMarker && timeZone) {
      try {
        return { date: zonedTimeToUtc(naive, timeZone), allDay: false };
      } catch {
        // Unbekannte Zone (Intl wirft) — lieber die Zeit als UTC lesen als den
        // ganzen Termin verlieren.
      }
    }
    return { date: new Date(naive), allDay: false };
  }
  const parsed = new Date(trimmed);
  return { date: parsed, allDay: false };
}

/** `DTSTART;TZID=Europe/Berlin:…` → „Europe/Berlin". */
function timeZoneOf(keyPart: string): string | undefined {
  const match = keyPart.match(/;TZID=([^;:]+)/i);
  return match?.[1]?.replace(/^"|"$/g, "").trim() || undefined;
}

function unescapeIcalText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function parseIcalEvents(content: string): ParsedIcalEvent[] {
  const lines = unfoldIcalLines(content);
  const events: ParsedIcalEvent[] = [];
  let inEvent = false;
  let current: Partial<ParsedIcalEvent> & {
    dtStart?: string;
    dtStartTz?: string;
    dtEnd?: string;
    dtEndTz?: string;
  } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.uid && current.title && current.dtStart) {
        const start = parseIcalDate(current.dtStart, current.dtStartTz);
        const end = current.dtEnd
          ? parseIcalDate(current.dtEnd, current.dtEndTz).date
          : undefined;
        events.push({
          uid: current.uid,
          title: current.title,
          description: current.description,
          location: current.location,
          startAt: start.date,
          endAt: end,
          allDay: start.allDay,
          ...(current.hasRecurrence ? { hasRecurrence: true } : {}),
          ...(current.recurrenceId ? { recurrenceId: current.recurrenceId } : {}),
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const keyPart = line.slice(0, sep);
    const value = unescapeIcalText(line.slice(sep + 1));
    const key = keyPart.split(";")[0]?.toUpperCase() ?? "";

    switch (key) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.title = value;
        break;
      case "DESCRIPTION":
        current.description = value;
        break;
      case "LOCATION":
        current.location = value;
        break;
      case "DTSTART":
        current.dtStart = keyPart.includes("VALUE=DATE") ? value.slice(0, 8) : value;
        current.dtStartTz = timeZoneOf(keyPart);
        break;
      case "DTEND":
        current.dtEnd = keyPart.includes("VALUE=DATE") ? value.slice(0, 8) : value;
        current.dtEndTz = timeZoneOf(keyPart);
        break;
      case "RRULE":
        current.hasRecurrence = true;
        break;
      case "RECURRENCE-ID":
        current.recurrenceId = value;
        break;
      default:
        break;
    }
  }

  return events;
}

/**
 * Das Master-VEVENT eines VCALENDAR: bei Serien schickt iOS Ausnahmen als
 * eigene VEVENTs mit RECURRENCE-ID im selben Kalender — massgeblich für
 * Titel/Zeit ist das VEVENT ohne RECURRENCE-ID.
 */
export function pickMasterEvent(events: readonly ParsedIcalEvent[]): ParsedIcalEvent | null {
  return events.find((event) => !event.recurrenceId) ?? events[0] ?? null;
}

function formatIcalDate(date: Date, allDay: boolean): string {
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

function escapeIcalText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export interface IcalExportEvent {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt?: Date | null;
  allDay?: boolean;
}

export function generateIcalCalendar(
  events: IcalExportEvent[],
  calendarName = "UWE Kalender",
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UWE//Calendar//DE",
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    "CALSCALE:GREGORIAN",
  ];

  for (const event of events) {
    const allDay = event.allDay ?? false;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`SUMMARY:${escapeIcalText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcalText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcalText(event.location)}`);
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcalDate(event.startAt, true)}`);
      if (event.endAt) lines.push(`DTEND;VALUE=DATE:${formatIcalDate(event.endAt, true)}`);
    } else {
      lines.push(`DTSTART:${formatIcalDate(event.startAt, false)}`);
      if (event.endAt) lines.push(`DTEND:${formatIcalDate(event.endAt, false)}`);
    }
    lines.push(`DTSTAMP:${formatIcalDate(new Date(), false)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function fetchIcalFeed(url: string, timeoutMs = 15000): Promise<string> {
  assertUserProvidedFetchUrlAllowed(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
    if (!response.ok) {
      throw new Error(`iCal-Feed konnte nicht geladen werden (${response.status}).`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface CalDavSyncOptions {
  caldavUrl: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

/** @deprecated Prefer syncCalDavCollection — kept for callers needing GET-only fetch. */
export async function fetchCalDavEvents(options: CalDavSyncOptions): Promise<ParsedIcalEvent[]> {
  return fetchCalDavEventsViaGet(options);
}

export {
  syncCalDavCollection,
  propfindCalendarCollection,
  reportCalendarQuery,
  fetchCalDavEventsViaGet,
  type CalDavSyncResult,
  type CalDavRemoteEvent,
} from "./caldav-sync";

export {
  DAV_NS,
  CALDAV_NS,
  CALENDARSERVER_NS,
  APPLE_ICAL_NS,
  escapeXml,
  buildMultistatus,
  parsePropfindProps,
  parseMultigetHrefs,
  parseCalendarQueryTimeRange,
  type DavProp,
  type MultistatusResponse,
} from "./dav-xml";
