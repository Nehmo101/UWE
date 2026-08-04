import type { Prisma, PlayerNoteStatus, PlayerNoteVisibility } from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";

export type {
  PlayerNote,
  PlayerNoteStatus,
  PlayerNoteVisibility,
} from "./generated/prisma/client";

export {
  PlayerNoteStatus as PlayerNoteStatusEnum,
  PlayerNoteVisibility as PlayerNoteVisibilityEnum,
} from "./generated/prisma/client";

export const PLAYER_NOTE_STATUS_LABELS: Record<PlayerNoteStatus, string> = {
  draft: "Entwurf",
  visible_to_dm: "An GM gesendet",
  accepted: "Übernommen",
  hidden: "Verborgen",
  deleted: "Gelöscht",
};

export const PLAYER_NOTE_VISIBILITY_LABELS: Record<PlayerNoteVisibility, string> = {
  private: "Privat",
  dm_only: "Nur GM",
  party: "Gruppe",
};

export interface CreatePlayerNoteInput {
  worldId: string;
  campaignId: string;
  userId: string;
  content: string;
  pageId?: string | null;
  gameSessionId?: string | null;
  visibility?: PlayerNoteVisibility;
  status?: PlayerNoteStatus;
  /**
   * Vom Client vergebene Kennung für offline entstandene Notizen. Ist sie
   * gesetzt und schon bekannt, wird die vorhandene Notiz zurückgegeben statt
   * einer zweiten — ein wiederholter Sync darf nichts verdoppeln.
   */
  clientRef?: string | null;
}

export interface UpdatePlayerNoteInput {
  content?: string;
  visibility?: PlayerNoteVisibility;
  status?: PlayerNoteStatus;
}

export type PlayerNoteWithRelations = Prisma.PlayerNoteGetPayload<{
  include: {
    user: { select: { id: true; displayName: true } };
    page: { select: { id: true; title: true; slug: true } };
    gameSession: { select: { id: true; title: true; sessionNumber: true } };
    campaign: { select: { id: true; name: true; slug: true } };
  };
}>;

export interface PortalPlayerNoteView {
  id: string;
  worldId: string;
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

export interface DmPlayerNoteView extends PortalPlayerNoteView {
  campaignName: string;
  campaignSlug: string;
}

function noteInclude() {
  return {
    user: { select: { id: true, displayName: true } },
    page: { select: { id: true, title: true, slug: true } },
    gameSession: { select: { id: true, title: true, sessionNumber: true } },
    campaign: { select: { id: true, name: true, slug: true } },
  } as const;
}

export function toPortalPlayerNoteView(note: PlayerNoteWithRelations): PortalPlayerNoteView {
  return {
    id: note.id,
    worldId: note.worldId,
    campaignId: note.campaignId,
    pageId: note.pageId,
    gameSessionId: note.gameSessionId,
    userId: note.userId,
    authorDisplayName: note.user.displayName,
    content: note.content,
    visibility: note.visibility,
    status: note.status,
    pageTitle: note.page?.title ?? null,
    pageSlug: note.page?.slug ?? null,
    sessionTitle: note.gameSession?.title ?? null,
    sessionNumber: note.gameSession?.sessionNumber ?? null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function toDmPlayerNoteView(note: PlayerNoteWithRelations): DmPlayerNoteView {
  return {
    ...toPortalPlayerNoteView(note),
    campaignName: note.campaign.name,
    campaignSlug: note.campaign.slug,
  };
}

const ACTIVE_STATUSES: PlayerNoteStatus[] = [
  "draft",
  "visible_to_dm",
  "accepted",
  "hidden",
];

export class PlayerNoteService {
  constructor(private readonly db: PrismaClient) {}

  async getById(noteId: string): Promise<PlayerNoteWithRelations | null> {
    return this.db.playerNote.findUnique({
      where: { id: noteId },
      include: noteInclude(),
    });
  }

  async getByIdForWorld(
    worldSlug: string,
    noteId: string,
  ): Promise<PlayerNoteWithRelations | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    return this.db.playerNote.findFirst({
      where: { id: noteId, worldId: world.id },
      include: noteInclude(),
    });
  }

  async listByWorld(
    worldSlug: string,
    options?: {
      campaignId?: string | null;
      status?: PlayerNoteStatus | PlayerNoteStatus[];
      includeDeleted?: boolean;
      limit?: number;
    },
  ): Promise<PlayerNoteWithRelations[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const statuses: PlayerNoteStatus[] = options?.status
      ? Array.isArray(options.status)
        ? options.status
        : [options.status]
      : options?.includeDeleted
        ? [...ACTIVE_STATUSES, "deleted"]
        : ACTIVE_STATUSES;

    return this.db.playerNote.findMany({
      where: {
        worldId: world.id,
        status: { in: statuses },
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
      },
      include: noteInclude(),
      orderBy: [{ updatedAt: "desc" }],
      take: options?.limit,
    });
  }

  async listForPage(
    worldSlug: string,
    pageId: string,
    options?: { campaignId?: string | null; limit?: number },
  ): Promise<PlayerNoteWithRelations[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.playerNote.findMany({
      where: {
        worldId: world.id,
        pageId,
        status: { in: ACTIVE_STATUSES },
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
      },
      include: noteInclude(),
      orderBy: [{ createdAt: "asc" }],
      take: options?.limit,
    });
  }

  async listForGameSession(
    worldSlug: string,
    gameSessionId: string,
    options?: { limit?: number },
  ): Promise<PlayerNoteWithRelations[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.playerNote.findMany({
      where: {
        worldId: world.id,
        gameSessionId,
        status: { in: ACTIVE_STATUSES },
      },
      include: noteInclude(),
      orderBy: [{ createdAt: "asc" }],
      take: options?.limit,
    });
  }

  async listByUser(
    worldSlug: string,
    userId: string,
    options?: { campaignId?: string | null },
  ): Promise<PlayerNoteWithRelations[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.playerNote.findMany({
      where: {
        worldId: world.id,
        userId,
        status: { in: ACTIVE_STATUSES },
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
      },
      include: noteInclude(),
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async create(input: CreatePlayerNoteInput): Promise<PlayerNoteWithRelations> {
    await this.validateScope(input.worldId, input.campaignId, input.pageId, input.gameSessionId);

    const clientRef = input.clientRef?.trim() || null;

    // Zweiter Anlauf desselben Offline-Eintrags: die Notiz gibt es schon.
    // Vorab nachsehen statt den Unique-Fehler abzufangen — so bleibt der
    // Rückgabetyp gleich und der Aufrufer merkt vom Retry nichts.
    if (clientRef) {
      const existing = await this.db.playerNote.findUnique({
        where: { userId_clientRef: { userId: input.userId, clientRef } },
        include: noteInclude(),
      });
      if (existing) {
        return existing;
      }
    }

    return this.db.playerNote.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId,
        userId: input.userId,
        content: input.content,
        pageId: input.pageId ?? null,
        gameSessionId: input.gameSessionId ?? null,
        visibility: input.visibility ?? "private",
        status: input.status ?? "draft",
        clientRef,
      },
      include: noteInclude(),
    });
  }

  async update(noteId: string, input: UpdatePlayerNoteInput): Promise<PlayerNoteWithRelations> {
    return this.db.playerNote.update({
      where: { id: noteId },
      data: {
        content: input.content,
        visibility: input.visibility,
        status: input.status,
      },
      include: noteInclude(),
    });
  }

  async submitToDm(noteId: string): Promise<PlayerNoteWithRelations> {
    const note = await this.update(noteId, {
      status: "visible_to_dm",
      visibility: "dm_only",
    });


    return note;
  }

  async accept(noteId: string): Promise<PlayerNoteWithRelations> {
    return this.update(noteId, {
      status: "accepted",
      visibility: "party",
    });
  }

  async hide(noteId: string): Promise<PlayerNoteWithRelations> {
    return this.update(noteId, {
      status: "hidden",
      visibility: "private",
    });
  }

  async softDelete(noteId: string): Promise<PlayerNoteWithRelations> {
    return this.update(noteId, {
      status: "deleted",
      visibility: "private",
    });
  }

  async adoptAsContentBlock(
    noteId: string,
    targetPageId: string,
    options?: { blockType?: "player_text" | "rich_text" },
  ): Promise<{ note: PlayerNoteWithRelations; contentBlockId: string }> {
    const note = await this.getById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const page = await this.db.page.findFirst({
      where: { id: targetPageId, worldId: note.worldId },
    });
    if (!page) {
      throw new Error("Target page not found in world");
    }

    const lastBlock = await this.db.contentBlock.findFirst({
      where: { pageId: targetPageId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (lastBlock?.sortOrder ?? -1) + 1;

    const block = await this.db.contentBlock.create({
      data: {
        pageId: targetPageId,
        type: options?.blockType ?? "player_text",
        sortOrder,
        content: note.content,
        metadata: {
          source: "player_note",
          playerNoteId: note.id,
          authorUserId: note.userId,
          authorDisplayName: note.user.displayName,
        },
      },
    });

    const updatedNote = await this.accept(noteId);
    return { note: updatedNote, contentBlockId: block.id };
  }

  async adoptAsPage(
    noteId: string,
    options?: { title?: string; slug?: string },
  ): Promise<{ note: PlayerNoteWithRelations; pageId: string }> {
    const note = await this.getById(noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const baseTitle =
      options?.title ??
      (note.page
        ? `Spielernotiz: ${note.page.title}`
        : note.gameSession
          ? `Spielernotiz: Session ${note.gameSession.sessionNumber}`
          : "Spielernotiz");

    const baseSlug =
      options?.slug ??
      `spieler-notiz-${note.id.slice(-8).toLowerCase()}`;

    const page = await this.db.page.create({
      data: {
        worldId: note.worldId,
        campaignId: note.campaignId,
        title: baseTitle,
        slug: baseSlug,
        type: "note",
        summary: `Übernommen von ${note.user.displayName}`,
        canonicalStatus: "idea",
        contentBlocks: {
          create: [
            {
              type: "rich_text",
              sortOrder: 0,
              content: note.content,
              metadata: {
                source: "player_note",
                playerNoteId: note.id,
                authorUserId: note.userId,
              },
            },
          ],
        },
      },
    });

    const updatedNote = await this.accept(noteId);
    return { note: updatedNote, pageId: page.id };
  }

  private async validateScope(
    worldId: string,
    campaignId: string,
    pageId?: string | null,
    gameSessionId?: string | null,
  ) {
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, worldId },
    });
    if (!campaign) {
      throw new Error("Campaign does not belong to world");
    }

    if (pageId) {
      const page = await this.db.page.findFirst({
        where: { id: pageId, worldId },
      });
      if (!page) {
        throw new Error("Page does not belong to world");
      }
      if (page.campaignId && page.campaignId !== campaignId) {
        throw new Error("Page campaign mismatch");
      }
    }

    if (gameSessionId) {
      const session = await this.db.gameSession.findFirst({
        where: { id: gameSessionId, worldId },
      });
      if (!session) {
        throw new Error("Game session does not belong to world");
      }
      if (session.campaignId && session.campaignId !== campaignId) {
        throw new Error("Game session campaign mismatch");
      }
    }
  }
}

export function createPlayerNoteService(databaseUrl?: string): PlayerNoteService {
  return new PlayerNoteService(createPrismaClient(databaseUrl));
}
