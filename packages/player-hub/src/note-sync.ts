/**
 * Anwenden der Offline-Warteschlange auf dem Server.
 *
 * Die Sync-Route reicht nur durch; entschieden wird hier. Beide Wege laufen
 * über dieselben `…ForViewer`-Methoden wie das Formular im Browser — Rechte
 * werden also nicht neu erfunden, sondern geerbt: wer im Portal keine Notiz
 * anlegen oder ändern darf, darf es offline erst recht nicht.
 *
 * Die Konfliktregel steht in `offline-queue.ts`: Wurde die Notiz zwischendurch
 * anderswo geändert, gewinnt der Server beim Inhalt und die lokale Fassung
 * kommt als Konflikt zurück — der Client rettet sie dann als neue Notiz.
 */
import type { OfflineNoteOperation, OfflineSyncResult } from "./offline-queue";
import { toPortalOfflineNote, type PlayerNoteLike } from "./offline-snapshot";

/**
 * Der Ausschnitt des Auth-Service, den der Abgleich braucht. Strukturell statt
 * importiert, damit die Regeln ohne Datenbank getestet werden können.
 */
export interface PlayerNoteSyncTarget<Ctx> {
  createPlayerNoteForViewer(
    worldSlug: string,
    ctx: Ctx,
    input: {
      campaignId: string;
      content: string;
      pageId?: string | null;
      gameSessionId?: string | null;
      clientRef?: string | null;
    },
  ): Promise<PlayerNoteLike | null>;
  getPlayerNoteForViewer(
    worldSlug: string,
    noteId: string,
    ctx: Ctx,
  ): Promise<PlayerNoteLike | null>;
  updatePlayerNoteForViewer(
    worldSlug: string,
    noteId: string,
    ctx: Ctx,
    content: string,
  ): Promise<PlayerNoteLike | null>;
}

export interface ApplyNoteSyncOptions<Ctx> {
  target: PlayerNoteSyncTarget<Ctx>;
  worldSlug: string;
  ctx: Ctx;
  viewerUserId: string | null;
  operations: readonly OfflineNoteOperation[];
}

function denied(clientRef: string, reason: string): OfflineSyncResult {
  return { clientRef, status: "denied", reason };
}

/**
 * Wurde die Notiz serverseitig geändert, seit der Offline-Edit begann?
 *
 * Ohne bekannten Ausgangsstand gilt der Edit als Konflikt: lieber eine Notiz
 * zu viel als ein überschriebener fremder Text.
 */
function hasMovedOn(serverUpdatedAt: Date, baseUpdatedAt: string | null): boolean {
  if (!baseUpdatedAt) return true;
  const base = Date.parse(baseUpdatedAt);
  if (Number.isNaN(base)) return true;
  return serverUpdatedAt.getTime() > base;
}

/**
 * Arbeitet die Warteschlange der Reihe nach ab und meldet je Eintrag zurück,
 * was daraus geworden ist. Nacheinander statt parallel: zwei Änderungen an
 * derselben Notiz sollen sich nicht gegenseitig überholen.
 */
export async function applyNoteSyncOperations<Ctx>(
  options: ApplyNoteSyncOptions<Ctx>,
): Promise<OfflineSyncResult[]> {
  const results: OfflineSyncResult[] = [];

  for (const operation of options.operations) {
    if (operation.op === "create") {
      const created = await options.target.createPlayerNoteForViewer(options.worldSlug, options.ctx, {
        campaignId: operation.campaignId,
        content: operation.content,
        pageId: operation.pageId,
        gameSessionId: operation.gameSessionId,
        clientRef: operation.clientRef,
      });

      results.push(
        created
          ? {
              clientRef: operation.clientRef,
              status: "applied",
              note: toPortalOfflineNote(created, options.viewerUserId),
            }
          : denied(operation.clientRef, "Keine Berechtigung zum Anlegen."),
      );
      continue;
    }

    const current = await options.target.getPlayerNoteForViewer(
      options.worldSlug,
      operation.noteId,
      options.ctx,
    );

    if (!current) {
      results.push(denied(operation.clientRef, "Notiz nicht gefunden oder nicht sichtbar."));
      continue;
    }

    if (hasMovedOn(current.updatedAt, operation.baseUpdatedAt)) {
      results.push({
        clientRef: operation.clientRef,
        status: "conflict",
        note: toPortalOfflineNote(current, options.viewerUserId),
      });
      continue;
    }

    const updated = await options.target.updatePlayerNoteForViewer(
      options.worldSlug,
      operation.noteId,
      options.ctx,
      operation.content,
    );

    results.push(
      updated
        ? {
            clientRef: operation.clientRef,
            status: "applied",
            note: toPortalOfflineNote(updated, options.viewerUserId),
          }
        : denied(operation.clientRef, "Keine Berechtigung zum Ändern."),
    );
  }

  return results;
}
