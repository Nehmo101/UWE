/**
 * Warteschlange für Notizen, die offline entstanden sind.
 *
 * Der Tischmodus schreibt nicht direkt zum Server, sondern in eine lokale
 * Warteschlange; sobald wieder Netz da ist, wird sie in einem Rutsch
 * abgeschickt. Diese Datei enthält davon den denkenden Teil — zusammenfassen,
 * abgleichen, anzeigen — als reine Funktionen, damit er ohne Browser und ohne
 * Datenbank getestet werden kann.
 *
 * **Zwei Regeln, die dahinterstehen:**
 *
 *  1. *Jeder Eintrag trägt eine eigene Kennung* (`clientRef`). Reisst die
 *     Verbindung nach dem Speichern, aber vor der Antwort ab, schickt der
 *     Client denselben Eintrag noch einmal — der Server erkennt ihn daran
 *     wieder und legt ihn kein zweites Mal an.
 *  2. *Nichts Getipptes geht verloren.* Wurde eine Notiz zwischenzeitlich
 *     anderswo geändert, gewinnt der Server beim Inhalt — die lokale Fassung
 *     wandert aber als neue Notiz zurück in die Warteschlange, statt still
 *     überschrieben zu werden.
 */
import type { PortalOfflineNote } from "./offline-snapshot";

export interface OfflineNoteCreate {
  op: "create";
  clientRef: string;
  campaignId: string;
  content: string;
  pageId: string | null;
  gameSessionId: string | null;
  /** Wann lokal zuletzt getippt wurde (ISO). Entscheidet, welcher Stand gilt. */
  clientUpdatedAt: string;
}

export interface OfflineNoteUpdate {
  op: "update";
  clientRef: string;
  campaignId: string;
  noteId: string;
  content: string;
  /** Stand der Notiz, auf dem der Offline-Edit aufsetzt (ISO), sonst null. */
  baseUpdatedAt: string | null;
  clientUpdatedAt: string;
}

export type OfflineNoteOperation = OfflineNoteCreate | OfflineNoteUpdate;

export type OfflineSyncStatus = "applied" | "conflict" | "denied";

export interface OfflineSyncResult {
  clientRef: string;
  status: OfflineSyncStatus;
  /** Fassung, die jetzt auf dem Server steht — bei `denied` fehlt sie. */
  note?: PortalOfflineNote | null;
  reason?: string;
}

/** Notiz für die Anzeige: entweder vom Server oder noch in der Warteschlange. */
export interface PortalTableNote extends PortalOfflineNote {
  pending: boolean;
  /** Gesetzt, solange der Eintrag noch nicht bestätigt ist. */
  clientRef: string | null;
}

export interface ReconcileResult {
  /** Was weiter wartet — inklusive der aus Konflikten neu entstandenen Einträge. */
  queue: OfflineNoteOperation[];
  applied: OfflineSyncResult[];
  conflicts: OfflineSyncResult[];
  denied: OfflineSyncResult[];
}

function isNewer(a: string, b: string): boolean {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left)) return false;
  if (Number.isNaN(right)) return true;
  return left >= right;
}

/**
 * Fasst die Warteschlange auf einen Eintrag je `clientRef` zusammen.
 *
 * Wer eine offline angelegte Notiz dreimal nachbessert, soll den Server nicht
 * dreimal beschäftigen. Ein `create` bleibt dabei ein `create`: die Notiz
 * existiert serverseitig ja noch gar nicht, nur ihr Inhalt ist neuer.
 */
export function collapseNoteQueue(
  operations: readonly OfflineNoteOperation[],
): OfflineNoteOperation[] {
  const byRef = new Map<string, OfflineNoteOperation>();

  for (const operation of operations) {
    const existing = byRef.get(operation.clientRef);
    if (!existing) {
      byRef.set(operation.clientRef, operation);
      continue;
    }

    if (!isNewer(operation.clientUpdatedAt, existing.clientUpdatedAt)) {
      continue;
    }

    byRef.set(
      operation.clientRef,
      existing.op === "create"
        ? { ...existing, content: operation.content, clientUpdatedAt: operation.clientUpdatedAt }
        : operation,
    );
  }

  return [...byRef.values()].sort((a, b) => a.clientUpdatedAt.localeCompare(b.clientUpdatedAt));
}

/**
 * Gleicht die Server-Antwort mit der Warteschlange ab.
 *
 * Ein Eintrag ohne Antwort bleibt stehen — lieber ein zweiter Versuch als eine
 * verlorene Notiz. `makeClientRef` liefert die Kennung für die Fassung, die
 * nach einem Konflikt als neue Notiz gerettet wird.
 */
export function reconcileNoteQueue(
  queue: readonly OfflineNoteOperation[],
  results: readonly OfflineSyncResult[],
  makeClientRef: (operation: OfflineNoteOperation, index: number) => string,
): ReconcileResult {
  const byRef = new Map(results.map((result) => [result.clientRef, result]));
  const remaining: OfflineNoteOperation[] = [];
  const applied: OfflineSyncResult[] = [];
  const conflicts: OfflineSyncResult[] = [];
  const denied: OfflineSyncResult[] = [];

  queue.forEach((operation, index) => {
    const result = byRef.get(operation.clientRef);

    if (!result) {
      remaining.push(operation);
      return;
    }

    if (result.status === "applied") {
      applied.push(result);
      return;
    }

    if (result.status === "denied") {
      denied.push(result);
      return;
    }

    conflicts.push(result);
    remaining.push({
      op: "create",
      clientRef: makeClientRef(operation, index),
      campaignId: operation.campaignId,
      content: operation.content,
      pageId: null,
      gameSessionId: null,
      clientUpdatedAt: operation.clientUpdatedAt,
    });
  });

  return { queue: remaining, applied, conflicts, denied };
}

export interface MergeNotesOptions {
  viewerUserId: string | null;
  viewerDisplayName: string;
}

/**
 * Blendet die Warteschlange in die Liste ein, damit der Tisch sofort sieht,
 * was gerade getippt wurde — ohne auf Netz zu warten.
 */
export function mergeNotesWithQueue(
  notes: readonly PortalOfflineNote[],
  queue: readonly OfflineNoteOperation[],
  options: MergeNotesOptions,
): PortalTableNote[] {
  const updates = new Map<string, OfflineNoteUpdate>();
  const creates: OfflineNoteCreate[] = [];

  for (const operation of collapseNoteQueue(queue)) {
    if (operation.op === "update") {
      updates.set(operation.noteId, operation);
    } else {
      creates.push(operation);
    }
  }

  const merged: PortalTableNote[] = notes.map((note) => {
    const pendingUpdate = updates.get(note.id);
    return pendingUpdate
      ? {
          ...note,
          content: pendingUpdate.content,
          updatedAt: pendingUpdate.clientUpdatedAt,
          pending: true,
          clientRef: pendingUpdate.clientRef,
        }
      : { ...note, pending: false, clientRef: null };
  });

  const pendingCreates: PortalTableNote[] = creates.map((operation) => ({
    id: operation.clientRef,
    campaignId: operation.campaignId,
    pageId: operation.pageId,
    gameSessionId: operation.gameSessionId,
    userId: options.viewerUserId ?? "",
    authorDisplayName: options.viewerDisplayName,
    content: operation.content,
    visibility: "private",
    status: "draft",
    pageTitle: null,
    pageSlug: null,
    sessionTitle: null,
    sessionNumber: null,
    createdAt: operation.clientUpdatedAt,
    updatedAt: operation.clientUpdatedAt,
    own: true,
    pending: true,
    clientRef: operation.clientRef,
  }));

  return [...pendingCreates, ...merged].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
