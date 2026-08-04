/**
 * Der Weg zwischen Gerät und Server.
 *
 * Abzug holen, Warteschlange abschicken, Ergebnis verrechnen — mehr passiert
 * hier nicht. Die Regeln (zusammenfassen, Konflikte retten) stehen in
 * `@uwe/player-hub`, damit sie ohne Browser getestet werden können.
 */
import {
  collapseNoteQueue,
  reconcileNoteQueue,
  type OfflineNoteOperation,
  type OfflineSyncResult,
  type PortalOfflineSnapshot,
} from "@uwe/player-hub";
import { resetOfflineState } from "./offline-reset";
import { readQueue, replaceQueue, saveSnapshot } from "./offline-store";

/**
 * 401 heisst: Die Sitzung ist weg — abgemeldet, abgelaufen oder das Gerät ist
 * schon beim nächsten Spieler. Der lokale Bestand gehört dann niemandem mehr,
 * der ihn lesen dürfte; er wird sofort geräumt statt erst beim
 * Abmelde-Knopf (den ein weitergereichtes Gerät nie sieht).
 */
async function clearOnUnauthorized(response: Response): Promise<void> {
  if (response.status === 401) {
    await resetOfflineState();
  }
}

export interface SyncOutcome {
  applied: OfflineSyncResult[];
  conflicts: OfflineSyncResult[];
  denied: OfflineSyncResult[];
  /** Was weiter wartet — leer heisst: alles durch. */
  pending: number;
}

/** Kennung für einen Warteschlangen-Eintrag. Muss je Konto eindeutig sein. */
export function newClientRef(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchSnapshot(worldSlug: string): Promise<PortalOfflineSnapshot> {
  const response = await fetch(`/api/worlds/${encodeURIComponent(worldSlug)}/offline-snapshot`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    await clearOnUnauthorized(response);
    throw new Error(`Abzug nicht erhalten (${response.status}).`);
  }

  const snapshot = (await response.json()) as PortalOfflineSnapshot;
  await saveSnapshot(snapshot);
  return snapshot;
}

/**
 * Schickt die Warteschlange ab und verrechnet die Antwort.
 *
 * Schlägt die Anfrage fehl, bleibt die Warteschlange unangetastet — lieber ein
 * zweiter Versuch als eine verlorene Notiz.
 */
export async function flushQueue(worldSlug: string): Promise<SyncOutcome> {
  const queue = collapseNoteQueue(await readQueue(worldSlug));
  if (queue.length === 0) {
    return { applied: [], conflicts: [], denied: [], pending: 0 };
  }

  const response = await fetch(`/api/worlds/${encodeURIComponent(worldSlug)}/notes/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ operations: queue }),
  });

  if (!response.ok) {
    await clearOnUnauthorized(response);
    throw new Error(`Abgleich fehlgeschlagen (${response.status}).`);
  }

  const payload = (await response.json()) as { results?: OfflineSyncResult[] };
  const outcome = reconcileNoteQueue(
    queue,
    payload.results ?? [],
    (operation: OfflineNoteOperation) => `${operation.clientRef}-konflikt-${newClientRef()}`,
  );

  await replaceQueue(worldSlug, outcome.queue);

  return {
    applied: outcome.applied,
    conflicts: outcome.conflicts,
    denied: outcome.denied,
    pending: outcome.queue.length,
  };
}
