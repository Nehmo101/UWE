/**
 * Import einer ICS-Datei in den Haushalts-Kalender.
 *
 * Der Unterschied zum Abo (`/calendar/feeds`): ein Import ist eine
 * **einmalige Übernahme**. Was hier hereinkommt, gehört danach dem Haushalt —
 * es liegt im lokalen Feed, ist änderbar und löschbar und wird von keinem
 * Abgleich wieder überschrieben. Ein Abo dagegen bleibt fremd.
 *
 * Dieses Modul ist rein: Text hinein, Termine heraus. Es liest keine
 * Datenbank und schreibt nichts — dafür ist `ics-import-service.ts` da.
 */
import { createHash } from "node:crypto";
import { parseIcalEvents } from "@uwe/calendar";

/**
 * Namensraum der importierten Termine im lokalen Feed. Ohne Präfix könnte
 * eine fremde Datei die Kennungen der Vertrags-Termine (`uwe-contract-…`)
 * treffen, und deren Aufräumen würde einen Import mitnehmen.
 */
export const ICS_IMPORT_UID_PREFIX = "ics-import:";

/** Eine Kalenderdatei ist Text; alles darüber ist keine mehr. */
export const ICS_IMPORT_MAX_BYTES = 2_000_000;

/** Mehr Termine übernimmt ein Durchgang nicht — der Rest wird gemeldet. */
export const ICS_IMPORT_MAX_EVENTS = 500;

const MAX_TITLE_LENGTH = 300;
const MAX_TEXT_LENGTH = 4000;

export class IcsImportError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "IcsImportError";
  }
}

export interface IcsImportEvent {
  /** `UID` aus der Datei — oder eine aus dem Eintrag abgeleitete Kennung. */
  sourceUid: string;
  /** Kennung im Kalender: Präfix + `sourceUid`. Macht den Import wiederholbar. */
  importUid: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  /**
   * Die Datei beschreibt eine Serie (`RRULE`/`RDATE`). Übernommen wird nur der
   * erste Termin — das sagt die Vorschau, statt es stillschweigend zu tun.
   */
  recurring: boolean;
}

export interface IcsImportRead {
  events: IcsImportEvent[];
  /** Einträge ohne brauchbare Eckdaten (kein Titel, kein oder kaputter Beginn). */
  skipped: number;
  /** Die Datei enthielt mehr Termine, als ein Durchgang übernimmt. */
  truncated: boolean;
}

export type IcsImportStatus = "new" | "update" | "duplicate";

export interface IcsImportPlanItem {
  event: IcsImportEvent;
  /**
   * `new` — noch nicht da.
   * `update` — schon einmal aus derselben Datei importiert.
   * `duplicate` — Titel und Beginn stehen bereits im Kalender, aber als
   *   eigener Termin. Der bleibt unberührt; angehakt wird das nicht.
   */
  status: IcsImportStatus;
  existingEventId: string | null;
}

/** Der Ausschnitt eines gespeicherten Termins, den der Abgleich braucht. */
export interface IcsImportExistingEvent {
  id: string;
  externalUid: string | null;
  title: string;
  startAt: Date;
}

function unfoldIcsLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
      continue;
    }
    lines.push(line);
  }
  return lines;
}

// eslint-disable-next-line no-control-regex -- genau darum geht es: sie sollen weg.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Steuerzeichen heraus, Länge gedeckelt — eine Datei ist fremder Text. */
function clean(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const stripped = value.replace(CONTROL_CHARACTERS, "").trim();
  if (stripped === "") return null;
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength - 1)}…` : stripped;
}

interface VEventBlock {
  lines: string[];
  uid: string;
  recurring: boolean;
}

/**
 * Zerlegt die Datei in `VEVENT`-Blöcke und ergänzt, was der gemeinsame Parser
 * nicht hergibt:
 *
 * - **Fehlende `UID`.** Handgeschriebene und manche exportierte Dateien haben
 *   keine; der Parser lässt solche Einträge fallen. Hier bekommen sie eine aus
 *   ihrem Inhalt abgeleitete Kennung — stabil, damit ein zweiter Import
 *   derselben Datei denselben Termin trifft statt einen zweiten anzulegen.
 * - **Serien.** `RRULE` interessiert den Parser nicht; für die Vorschau ist es
 *   der Unterschied zwischen „ein Termin" und „jeden Montag".
 */
function readVEventBlocks(lines: readonly string[]): VEventBlock[] {
  const blocks: VEventBlock[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (trimmed.toUpperCase() === "END:VEVENT") {
      if (current) blocks.push(toBlock(current));
      current = null;
      continue;
    }
    if (current && trimmed !== "") current.push(trimmed);
  }

  return blocks;
}

function toBlock(lines: string[]): VEventBlock {
  const uidLine = lines.find((line) => /^UID[;:]/i.test(line));
  const uid =
    clean(uidLine?.slice(uidLine.indexOf(":") + 1), 300) ??
    `uwe-ics-${createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16)}`;

  return {
    lines: uidLine ? lines : [`UID:${uid}`, ...lines],
    uid,
    recurring: lines.some((line) => /^(RRULE|RDATE)[;:]/i.test(line)),
  };
}

function rebuildIcs(blocks: readonly VEventBlock[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0"];
  for (const block of blocks) {
    lines.push("BEGIN:VEVENT", ...block.lines, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Liest eine ICS-Datei und liefert die übernehmbaren Termine.
 *
 * Wirft nur, wenn gar nichts zu holen ist — eine Datei mit ein paar kaputten
 * Einträgen soll importierbar bleiben, die zählt `skipped`.
 */
export function readIcsFile(text: string): IcsImportRead {
  if (text.length > ICS_IMPORT_MAX_BYTES) {
    throw new IcsImportError(
      `Die Datei ist zu groß (max. ${Math.round(ICS_IMPORT_MAX_BYTES / 1000)} kB).`,
    );
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new IcsImportError("Das ist keine Kalenderdatei (kein BEGIN:VCALENDAR).");
  }

  const blocks = readVEventBlocks(unfoldIcsLines(text));
  if (blocks.length === 0) {
    throw new IcsImportError("Die Datei enthält keine Termine.");
  }

  const truncated = blocks.length > ICS_IMPORT_MAX_EVENTS;
  const kept = truncated ? blocks.slice(0, ICS_IMPORT_MAX_EVENTS) : blocks;
  const recurringByUid = new Map(kept.map((block) => [block.uid, block.recurring]));

  const parsed = parseIcalEvents(rebuildIcs(kept));
  const events: IcsImportEvent[] = [];
  const seen = new Set<string>();

  for (const raw of parsed) {
    const title = clean(raw.title, MAX_TITLE_LENGTH);
    if (!title || Number.isNaN(raw.startAt.getTime())) continue;

    // Derselbe Termin mehrfach in einer Datei: Ausnahmen einer Serie
    // (`RECURRENCE-ID`) teilen sich die UID. Der erste Eintrag gilt.
    if (seen.has(raw.uid)) continue;
    seen.add(raw.uid);

    const endAt = raw.endAt && !Number.isNaN(raw.endAt.getTime()) ? raw.endAt : null;
    events.push({
      sourceUid: raw.uid,
      importUid: `${ICS_IMPORT_UID_PREFIX}${raw.uid}`,
      title,
      description: clean(raw.description, MAX_TEXT_LENGTH),
      location: clean(raw.location, MAX_TEXT_LENGTH),
      startAt: raw.startAt,
      endAt: endAt && endAt.getTime() > raw.startAt.getTime() ? endAt : null,
      allDay: raw.allDay,
      recurring: recurringByUid.get(raw.uid) ?? false,
    });
  }

  if (events.length === 0) {
    throw new IcsImportError("In der Datei steht kein Termin mit Titel und Beginn.");
  }

  return { events, skipped: kept.length - events.length, truncated };
}

function duplicateKey(title: string, startAt: Date): string {
  return `${title.trim().toLowerCase()}|${startAt.getTime()}`;
}

/**
 * Gleicht die gelesenen Termine gegen den Kalender ab.
 *
 * Zwei Wege, einen bekannten Termin zu erkennen: dieselbe Import-Kennung (dann
 * stammt er aus einem früheren Durchgang derselben Datei) oder derselbe Titel
 * zur selben Zeit (dann steht er schon von Hand drin).
 */
export function buildIcsImportPlan(
  events: readonly IcsImportEvent[],
  existing: readonly IcsImportExistingEvent[],
): IcsImportPlanItem[] {
  const byUid = new Map<string, IcsImportExistingEvent>();
  const byTitleAndStart = new Map<string, IcsImportExistingEvent>();

  for (const row of existing) {
    if (row.externalUid) byUid.set(row.externalUid, row);
    const key = duplicateKey(row.title, row.startAt);
    if (!byTitleAndStart.has(key)) byTitleAndStart.set(key, row);
  }

  return events.map((event) => {
    const known = byUid.get(event.importUid);
    if (known) {
      return { event, status: "update" as const, existingEventId: known.id };
    }
    const twin = byTitleAndStart.get(duplicateKey(event.title, event.startAt));
    if (twin) {
      return { event, status: "duplicate" as const, existingEventId: twin.id };
    }
    return { event, status: "new" as const, existingEventId: null };
  });
}

/** Was standardmäßig angehakt ist: alles außer den schon vorhandenen Zwillingen. */
export function defaultIcsImportSelection(items: readonly IcsImportPlanItem[]): string[] {
  return items
    .filter((item) => item.status !== "duplicate")
    .map((item) => item.event.importUid);
}
