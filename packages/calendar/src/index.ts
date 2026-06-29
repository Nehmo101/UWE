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

function parseIcalDate(value: string): { date: Date; allDay: boolean } {
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) {
    const y = Number(trimmed.slice(0, 4));
    const m = Number(trimmed.slice(4, 6)) - 1;
    const d = Number(trimmed.slice(6, 8));
    return { date: new Date(Date.UTC(y, m, d)), allDay: true };
  }
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (match) {
    const [, ys, ms, ds, hs, mins, ss] = match;
    const date = new Date(
      Date.UTC(
        Number(ys),
        Number(ms) - 1,
        Number(ds),
        Number(hs),
        Number(mins),
        Number(ss),
      ),
    );
    return { date, allDay: false };
  }
  const parsed = new Date(trimmed);
  return { date: parsed, allDay: false };
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
  let current: Partial<ParsedIcalEvent> & { dtStart?: string; dtEnd?: string } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.uid && current.title && current.dtStart) {
        const start = parseIcalDate(current.dtStart);
        const end = current.dtEnd ? parseIcalDate(current.dtEnd).date : undefined;
        events.push({
          uid: current.uid,
          title: current.title,
          description: current.description,
          location: current.location,
          startAt: start.date,
          endAt: end,
          allDay: start.allDay,
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
        break;
      case "DTEND":
        current.dtEnd = keyPart.includes("VALUE=DATE") ? value.slice(0, 8) : value;
        break;
      default:
        break;
    }
  }

  return events;
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
  putCalDavEvent,
  deleteCalDavEvent,
  buildCalDavEventHref,
  eventToIcalBody,
  type CalDavWriteOptions,
  type CalDavAuth,
} from "./caldav-write";
