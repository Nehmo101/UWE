/**
 * Abbildung Haushalts-Kalender ↔ CalDAV-Ressourcen.
 *
 * Der CalDAV-Server stellt genau eine Kalender-Collection bereit: die Termine
 * des lokalen Feeds (`ensureLocalFeed`). Fremde Feeds, Geburtstage und die
 * Gesundheitsakte bleiben dem read-only ICS-Abo vorbehalten — was hier
 * erreichbar ist, ist auch schreibbar.
 *
 * Diese Schicht ist rein (keine Datenbankzugriffe): Namen, ETags, ctag und die
 * ICS-Übersetzung in beide Richtungen.
 */
import { createHash } from "node:crypto";
import {
  generateIcalCalendar,
  parseIcalEvents,
  pickMasterEvent,
} from "@uwe/calendar";

/** Pfadmodell des DAV-Baums — von den Routen und Antworten gemeinsam benutzt. */
export const DAV_ROOT_PATH = "/api/dav/";
export const DAV_PRINCIPAL_PATH = "/api/dav/principals/familie/";
export const DAV_HOME_SET_PATH = "/api/dav/cal/";
export const DAV_COLLECTION_PATH = "/api/dav/cal/familie/";

/** Enumerationsfenster: gleiche Spanne wie der ICS-Abo-Feed. */
export const DAV_MONTHS_BACK = 12;
export const DAV_MONTHS_AHEAD = 24;

export function davWindow(now = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth() - DAV_MONTHS_BACK, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + DAV_MONTHS_AHEAD + 1, 0, 23, 59, 59);
  return { from, to };
}

/**
 * Server-vergebene UIDs beginnen mit `uwe-` (Termine, Geburtstage, Akte im
 * ICS-Feed). Clients dürfen in diesem Namensraum nichts Neues anlegen.
 */
export const SERVER_UID_NAMESPACE = "uwe-";
const SERVER_EVENT_PREFIX = "uwe-family-event-";

export interface DavEventShape {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  externalUid: string | null;
  updatedAt: Date;
  metadata: unknown;
}

/** UID, unter der ein Termin nach aussen auftritt. */
export function davUidOf(event: Pick<DavEventShape, "id" | "externalUid">): string {
  if (event.externalUid && !event.externalUid.startsWith(SERVER_UID_NAMESPACE)) {
    return event.externalUid;
  }
  return `${SERVER_EVENT_PREFIX}${event.id}`;
}

/** Ressourcen-Name (ohne `.ics`), URL-sicher. */
export function resourceNameForEvent(
  event: Pick<DavEventShape, "id" | "externalUid">,
): string {
  return encodeURIComponent(davUidOf(event));
}

export function hrefForEvent(event: Pick<DavEventShape, "id" | "externalUid">): string {
  return `${DAV_COLLECTION_PATH}${resourceNameForEvent(event)}.ics`;
}

/**
 * Ressourcen-Name aus einem Pfad unterhalb der Collection: dekodiert, ohne
 * `.ics`. `null`, wenn der Pfad nicht auf eine Ressource zeigt.
 */
export function resourceNameFromPath(pathname: string): string | null {
  if (!pathname.startsWith(DAV_COLLECTION_PATH)) return null;
  const rest = pathname.slice(DAV_COLLECTION_PATH.length);
  if (!rest || rest.includes("/")) return null;
  const withoutExt = rest.replace(/\.ics$/i, "");
  if (!withoutExt) return null;
  try {
    return decodeURIComponent(withoutExt);
  } catch {
    return null;
  }
}

/** Termin-ID, wenn der Name im Server-Namensraum liegt. */
export function serverEventIdFromName(name: string): string | null {
  if (!name.startsWith(SERVER_EVENT_PREFIX)) return null;
  const id = name.slice(SERVER_EVENT_PREFIX.length);
  return id || null;
}

export function etagOf(event: Pick<DavEventShape, "updatedAt">): string {
  return String(event.updatedAt.getTime());
}

/**
 * ctag der Collection: ändert sich bei jedem Anlegen, Ändern und Löschen.
 * Hash über (id, updatedAt) aller Termine — robuster als count+max.
 */
export function ctagOf(events: readonly Pick<DavEventShape, "id" | "updatedAt">[]): string {
  const lines = events
    .map((event) => `${event.id}:${event.updatedAt.getTime()}`)
    .sort()
    .join("\n");
  return createHash("sha1").update(lines).digest("hex");
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

interface StoredDavIcs {
  raw: string;
  savedAtMs: number;
}

function readStoredDavIcs(metadata: unknown): StoredDavIcs | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  const raw = record.davIcs;
  const savedAt = record.davIcsSavedAt;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const savedAtMs = typeof savedAt === "string" ? Date.parse(savedAt) : NaN;
  if (Number.isNaN(savedAtMs)) return null;
  return { raw, savedAtMs };
}

/**
 * Frisch = der letzte Schreiber war der DAV-PUT selbst (Speichern von Feldern
 * und Roh-ICS liegt im selben Schreibvorgang, Differenz < 5 s). Eine spätere
 * Bearbeitung in UWE bumpt `updatedAt` weit darüber hinaus — dann gilt das
 * Roh-ICS als veraltet und das ICS wird aus den Feldern erzeugt (eine RRULE
 * geht dabei verloren; dokumentierte Einschränkung).
 */
const DAV_ICS_FRESHNESS_MS = 5000;

/**
 * ICS einer Ressource: das vom Client geschriebene Roh-ICS, solange es frisch
 * ist (Round-Trip-Treue inkl. RRULE/VTIMEZONE), sonst aus den Feldern erzeugt.
 */
export function eventToIcs(
  event: DavEventShape,
  memberNames?: readonly string[],
): string {
  const stored = readStoredDavIcs(event.metadata);
  if (stored && Math.abs(event.updatedAt.getTime() - stored.savedAtMs) < DAV_ICS_FRESHNESS_MS) {
    return stored.raw;
  }

  return generateIcalCalendar(
    [
      {
        uid: davUidOf(event),
        title: event.title,
        description: withMembers(event.description, memberNames),
        location: event.location,
        startAt: event.startAt,
        endAt: event.allDay ? (event.endAt ?? nextDay(event.startAt)) : event.endAt,
        allDay: event.allDay,
      },
    ],
    "UWE Family",
  );
}

export interface ParsedDavPut {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  hasRecurrence: boolean;
  /** Metadaten fürs Speichern: Roh-ICS + Zeitstempel für die Frische-Prüfung. */
  metadata: { davIcs: string; davIcsSavedAt: string };
}

/** VEVENT aus einem PUT-Body. `null` bei leerem/unbrauchbarem Kalender. */
export function icsToEventInput(rawIcs: string, now = new Date()): ParsedDavPut | null {
  const master = pickMasterEvent(parseIcalEvents(rawIcs));
  if (!master) return null;

  return {
    uid: master.uid,
    title: master.title,
    description: master.description ?? null,
    location: master.location ?? null,
    startAt: master.startAt,
    endAt: master.endAt ?? null,
    allDay: master.allDay,
    hasRecurrence: master.hasRecurrence === true,
    metadata: { davIcs: rawIcs, davIcsSavedAt: now.toISOString() },
  };
}
