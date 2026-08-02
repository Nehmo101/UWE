/**
 * Offline-Abzug für den Tischmodus des Spieler-Portals.
 *
 * Am Spieltisch ist das WLAN unzuverlässig, und genau dann braucht jemand
 * seinen Charakterbogen. Der Abzug ist deshalb genau das, was ein Spieler
 * mitnehmen können soll: eigene Charaktere, sichtbare Notizen, das
 * Gruppen-Inventar — und sonst nichts.
 *
 * **Was hier hereinkommt, ist bereits gefiltert.** Die Route füttert diese
 * Formung ausschliesslich mit den `…ForViewer`-Ergebnissen aus
 * `@uwe/database`; hier wird nichts nachgeladen und keine Sichtbarkeit neu
 * entschieden. `dm_only` erreicht das Gerät deshalb nie.
 *
 * Reine Formung, keine Datenbank — testbar ohne Prisma.
 */
import type {
  PlayerNoteStatus,
  PlayerNoteVisibility,
  PortalCharacterView,
  PortalTreasuryView,
} from "@uwe/database/server";

/**
 * Formatversion des Abzugs. Steigt, wenn sich die Struktur ändert; der Client
 * wirft dann seinen lokalen Bestand weg, statt ihn falsch zu lesen.
 */
export const PORTAL_OFFLINE_SNAPSHOT_VERSION = 1;

/**
 * Notiz im Abzug. Zeitstempel als ISO-Zeichenketten: der Abzug geht als JSON
 * über die Leitung und liegt danach als JSON im Browser — ein `Date` im Typ
 * wäre dort eine Lüge.
 */
export interface PortalOfflineNote {
  id: string;
  campaignId: string;
  pageId: string | null;
  gameSessionId: string | null;
  userId: string;
  authorDisplayName: string;
  content: string;
  visibility: PlayerNoteVisibility;
  status: PlayerNoteStatus;
  pageTitle: string | null;
  pageSlug: string | null;
  sessionTitle: string | null;
  sessionNumber: number | null;
  createdAt: string;
  updatedAt: string;
  /** Vom angemeldeten Spieler selbst verfasst — nur die darf er bearbeiten. */
  own: boolean;
}

export interface PortalOfflineSnapshot {
  version: number;
  snapshotAt: string;
  world: { slug: string; name: string };
  /** Ohne Kampagne kann offline nichts Neues angelegt werden. */
  campaignId: string | null;
  viewerUserId: string | null;
  characters: PortalCharacterView[];
  notes: PortalOfflineNote[];
  treasury: PortalTreasuryView | null;
}

/**
 * Notiz, wie sie aus `@uwe/database` kommt — strukturell beschrieben statt
 * importiert, damit diese Datei ohne Prisma-Typen testbar bleibt.
 */
export interface PlayerNoteLike {
  id: string;
  campaignId: string;
  pageId: string | null;
  gameSessionId: string | null;
  userId: string;
  authorDisplayName: string;
  content: string;
  visibility: PlayerNoteVisibility;
  status: PlayerNoteStatus;
  pageTitle: string | null;
  pageSlug: string | null;
  sessionTitle: string | null;
  sessionNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildPortalOfflineSnapshotInput {
  snapshotAt: Date;
  world: { slug: string; name: string };
  campaignId: string | null;
  viewerUserId: string | null;
  characters: readonly PortalCharacterView[];
  notes: readonly PlayerNoteLike[];
  treasury: PortalTreasuryView | null;
}

/** Eine Notiz in die JSON-Fassung überführen, die Gerät und Leitung sehen. */
export function toPortalOfflineNote(
  note: PlayerNoteLike,
  viewerUserId: string | null,
): PortalOfflineNote {
  return {
    id: note.id,
    campaignId: note.campaignId,
    pageId: note.pageId,
    gameSessionId: note.gameSessionId,
    userId: note.userId,
    authorDisplayName: note.authorDisplayName,
    content: note.content,
    visibility: note.visibility,
    status: note.status,
    pageTitle: note.pageTitle,
    pageSlug: note.pageSlug,
    sessionTitle: note.sessionTitle,
    sessionNumber: note.sessionNumber,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    own: viewerUserId !== null && note.userId === viewerUserId,
  };
}

/** Formt den Abzug. Reihenfolge: neueste Notiz zuerst — so liest man am Tisch. */
export function buildPortalOfflineSnapshot(
  input: BuildPortalOfflineSnapshotInput,
): PortalOfflineSnapshot {
  const notes = [...input.notes]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((note) => toPortalOfflineNote(note, input.viewerUserId));

  return {
    version: PORTAL_OFFLINE_SNAPSHOT_VERSION,
    snapshotAt: input.snapshotAt.toISOString(),
    world: input.world,
    campaignId: input.campaignId,
    viewerUserId: input.viewerUserId,
    characters: [...input.characters],
    notes,
    treasury: input.treasury,
  };
}

/**
 * Taugt ein gespeicherter Abzug noch? Ein Abzug aus einer älteren Fassung
 * wird verworfen statt halb gelesen.
 */
export function isUsablePortalOfflineSnapshot(value: unknown): value is PortalOfflineSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PortalOfflineSnapshot>;
  return (
    candidate.version === PORTAL_OFFLINE_SNAPSHOT_VERSION &&
    typeof candidate.snapshotAt === "string" &&
    Array.isArray(candidate.characters) &&
    Array.isArray(candidate.notes)
  );
}
