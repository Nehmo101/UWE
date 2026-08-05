/**
 * Der Datenbank-Teil des ICS-Imports.
 *
 * Getrennt von `ics-import.ts` wie überall in diesem Paket: dort die reine,
 * getestete Formung, hier das Lesen und Schreiben. Die Route bleibt damit ein
 * Türsteher — Fachlogik steht nicht im Route Handler (CLAUDE.md).
 *
 * Importierte Termine landen im **lokalen** Feed und sind danach ganz normale
 * Haushalts-Termine: änderbar, löschbar, im ICS-Abo enthalten. Ihre
 * Import-Kennung (`externalUid`) bleibt stehen, damit derselbe Kalender ein
 * zweites Mal eingelesen werden kann, ohne alles zu verdoppeln.
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { resolveEventEnd } from "./event-duration";
import { setEventMembers } from "./event-members";
import {
  buildIcsImportPlan,
  defaultIcsImportSelection,
  readIcsFile,
  type IcsImportEvent,
  type IcsImportExistingEvent,
  type IcsImportPlanItem,
} from "./ics-import";

/** Der Ausschnitt des Kalender-Dienstes, den der Import braucht. */
export interface IcsImportCalendarTarget {
  ensureLocalFeed(): Promise<{ id: string }>;
  createEvent(input: {
    feedId?: string | null;
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: Date;
    endAt?: Date | null;
    allDay?: boolean;
    kind?: "personal";
    externalUid?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<{ id: string }>;
  updateEvent(
    id: string,
    input: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startAt?: Date;
      endAt?: Date | null;
      allDay?: boolean;
    },
  ): Promise<{ id: string }>;
}

export interface IcsImportPreview {
  items: IcsImportPlanItem[];
  /** Vorschlag, was angehakt sein soll: alles außer den schon vorhandenen. */
  selection: string[];
  counts: { total: number; new: number; update: number; duplicate: number };
  skipped: number;
  truncated: boolean;
}

export interface ApplyIcsImportOptions {
  familyDb: FamilyPrismaClient;
  calendar: IcsImportCalendarTarget;
  /** Inhalt der hochgeladenen Datei. */
  text: string;
  /** Import-Kennungen der übernommenen Termine; leer heißt: keiner. */
  selectedUids: readonly string[];
  /** Wen die Termine betreffen. Leer lässt sie den ganzen Haushalt betreffen. */
  memberIds?: readonly string[];
}

export interface IcsImportResult {
  created: number;
  updated: number;
  /** Nicht angehakt oder nicht in der Datei gefunden. */
  skipped: number;
}

/**
 * Termine, gegen die abgeglichen wird: die mit passender Import-Kennung und
 * alle im Zeitraum der Datei — mehr braucht der Zwillings-Vergleich nicht, und
 * so bleibt die Abfrage auch bei einem vollen Kalender überschaubar.
 */
async function loadExistingEvents(
  db: FamilyPrismaClient,
  events: readonly IcsImportEvent[],
): Promise<IcsImportExistingEvent[]> {
  if (events.length === 0) return [];

  const times = events.map((event) => event.startAt.getTime());
  const rows = await db.calendarEvent.findMany({
    where: {
      OR: [
        { externalUid: { in: events.map((event) => event.importUid) } },
        {
          startAt: {
            gte: new Date(Math.min(...times)),
            lte: new Date(Math.max(...times)),
          },
        },
      ],
    },
    select: { id: true, externalUid: true, title: true, startAt: true },
    take: 2000,
  });
  return rows;
}

/** Liest die Datei und sagt, was ein Import täte — ohne etwas zu schreiben. */
export async function previewIcsImport(
  db: FamilyPrismaClient,
  text: string,
): Promise<IcsImportPreview> {
  const read = readIcsFile(text);
  const items = buildIcsImportPlan(read.events, await loadExistingEvents(db, read.events));

  return {
    items,
    selection: defaultIcsImportSelection(items),
    counts: {
      total: items.length,
      new: items.filter((item) => item.status === "new").length,
      update: items.filter((item) => item.status === "update").length,
      duplicate: items.filter((item) => item.status === "duplicate").length,
    },
    skipped: read.skipped,
    truncated: read.truncated,
  };
}

/**
 * Übernimmt die angehakten Termine.
 *
 * Die Datei wird dafür ein zweites Mal gelesen: was übernommen wird, bestimmt
 * der Server aus dem Dateiinhalt, der Browser schickt nur die Auswahl. So
 * bekommt ein Termin auch dann den Inhalt der Datei, wenn zwischen Vorschau
 * und Bestätigung jemand an der Seite gedreht hat.
 */
export async function applyIcsImport(options: ApplyIcsImportOptions): Promise<IcsImportResult> {
  const { familyDb, calendar, text, selectedUids } = options;
  const memberIds = options.memberIds ?? [];
  const wanted = new Set(selectedUids);

  const read = readIcsFile(text);
  const items = buildIcsImportPlan(read.events, await loadExistingEvents(familyDb, read.events));
  const chosen = items.filter((item) => wanted.has(item.event.importUid));

  if (chosen.length === 0) {
    return { created: 0, updated: 0, skipped: items.length };
  }

  const localFeed = await calendar.ensureLocalFeed();
  let created = 0;
  let updated = 0;

  for (const item of chosen) {
    const { event } = item;
    const payload = {
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt,
      // Ein Importierter ist danach ein eigener Haushalts-Termin, kein Gast aus
      // einem Feed — also gilt die Haushalts-Regel: ohne eigenes Ende eine
      // Stunde. Ohne sie stünde er im Monatsraster als Strich statt als Block,
      // und das Abo aufs Handy bekäme einen Termin ohne DTEND. Ganztägig bleibt
      // ohne Ende, ein Ende aus der Datei bleibt unangetastet.
      endAt: resolveEventEnd(event.startAt, event.endAt, { allDay: event.allDay }),
      allDay: event.allDay,
    };

    // Ein „duplicate" hat zwar einen Zwilling im Kalender, aber keine
    // Import-Kennung — wer ihn trotzdem anhakt, will ihn haben. Angefasst wird
    // der bestehende Termin dabei nicht.
    if (item.status === "update" && item.existingEventId) {
      const row = await calendar.updateEvent(item.existingEventId, payload);
      if (memberIds.length > 0) await setEventMembers(familyDb, row.id, memberIds);
      updated += 1;
      continue;
    }

    const row = await calendar.createEvent({
      ...payload,
      feedId: localFeed.id,
      kind: "personal",
      externalUid: event.importUid,
      metadata: {
        source: "ics-import",
        sourceUid: event.sourceUid,
        ...(event.recurring ? { recurring: true } : {}),
      },
    });
    if (memberIds.length > 0) await setEventMembers(familyDb, row.id, memberIds);
    created += 1;
  }

  return { created, updated, skipped: items.length - chosen.length };
}
