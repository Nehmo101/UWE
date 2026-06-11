import type {
  GameSessionStatus,
  Prisma,
} from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";
import { parseStringArray } from "./json-utils";
import type { PageSummary } from "./repository";

export type {
  GameSession,
  GameSessionPageLink,
  GameSessionStatus,
} from "./generated/prisma/client";

export {
  GameSessionStatus as GameSessionStatusEnum,
} from "./generated/prisma/client";

export const GAME_SESSION_STATUS_LABELS: Record<GameSessionStatus, string> = {
  planned: "Geplant",
  prepared: "Vorbereitet",
  played: "Gespielt",
  summarized: "Zusammengefasst",
  archived: "Archiviert",
};

export interface CreateGameSessionInput {
  worldId: string;
  campaignId?: string | null;
  title: string;
  sessionNumber: number;
  date?: Date | null;
  status?: GameSessionStatus;
  summaryDm?: string | null;
  summaryPlayer?: string | null;
  notes?: string | null;
  openPlots?: string | null;
  playerDecisions?: string | null;
  linkedPageIds?: string[];
}

export interface UpdateGameSessionInput {
  title?: string;
  sessionNumber?: number;
  date?: Date | null;
  status?: GameSessionStatus;
  campaignId?: string | null;
  summaryDm?: string | null;
  summaryPlayer?: string | null;
  notes?: string | null;
  openPlots?: string | null;
  playerDecisions?: string | null;
  recapPublished?: boolean;
  linkedPageIds?: string[];
}

export type GameSessionWithLinks = Prisma.GameSessionGetPayload<{
  include: {
    campaign: true;
    linkedPages: {
      include: {
        page: {
          include: { campaign: true };
        };
      };
    };
  };
}>;

export type LinkedPageSummary = PageSummary;

export interface PortalGameSessionView {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  sessionNumber: number;
  date: Date | null;
  status: GameSessionStatus;
  summaryPlayer: string | null;
  linkedPages: LinkedPageSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DmGameSessionView extends PortalGameSessionView {
  summaryDm: string | null;
  notes: string | null;
  openPlots: string | null;
  playerDecisions: string | null;
  recapPublished: boolean;
}

function withParsedPageArrays<T extends { tags: unknown; aliases: unknown }>(page: T) {
  return {
    ...page,
    tags: parseStringArray(page.tags),
    aliases: parseStringArray(page.aliases),
  };
}

function mapLinkedPages(session: GameSessionWithLinks): LinkedPageSummary[] {
  return session.linkedPages.map((link) => withParsedPageArrays(link.page));
}

export function toDmGameSessionView(session: GameSessionWithLinks): DmGameSessionView {
  return {
    id: session.id,
    worldId: session.worldId,
    campaignId: session.campaignId,
    title: session.title,
    sessionNumber: session.sessionNumber,
    date: session.date,
    status: session.status,
    summaryDm: session.summaryDm,
    summaryPlayer: session.summaryPlayer,
    notes: session.notes,
    openPlots: session.openPlots,
    playerDecisions: session.playerDecisions,
    recapPublished: session.recapPublished,
    linkedPages: mapLinkedPages(session),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/** Portal view — DM-only fields are never included. */
export function toPortalGameSessionView(session: GameSessionWithLinks): PortalGameSessionView {
  return {
    id: session.id,
    worldId: session.worldId,
    campaignId: session.campaignId,
    title: session.title,
    sessionNumber: session.sessionNumber,
    date: session.date,
    status: session.status,
    summaryPlayer: session.summaryPlayer,
    linkedPages: mapLinkedPages(session),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export class GameSessionService {
  constructor(private readonly db: PrismaClient) {}

  private sessionInclude() {
    return {
      campaign: true,
      linkedPages: {
        include: {
          page: {
            include: { campaign: true },
          },
        },
        orderBy: { createdAt: "asc" as const },
      },
    };
  }

  async listByWorld(
    worldSlug: string,
    options?: { campaignId?: string | null },
  ): Promise<GameSessionWithLinks[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.gameSession.findMany({
      where: {
        worldId: world.id,
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
      },
      include: this.sessionInclude(),
      orderBy: [{ sessionNumber: "desc" }, { date: "desc" }],
    });
  }

  async getById(sessionId: string): Promise<GameSessionWithLinks | null> {
    return this.db.gameSession.findUnique({
      where: { id: sessionId },
      include: this.sessionInclude(),
    });
  }

  async getByIdForWorld(
    worldSlug: string,
    sessionId: string,
  ): Promise<GameSessionWithLinks | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    return this.db.gameSession.findFirst({
      where: { id: sessionId, worldId: world.id },
      include: this.sessionInclude(),
    });
  }

  async getNextSessionNumber(worldId: string, campaignId?: string | null): Promise<number> {
    const last = await this.db.gameSession.findFirst({
      where: {
        worldId,
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { sessionNumber: "desc" },
      select: { sessionNumber: true },
    });

    return (last?.sessionNumber ?? 0) + 1;
  }

  async create(input: CreateGameSessionInput): Promise<GameSessionWithLinks> {
    const linkedPageIds = input.linkedPageIds ?? [];

    return this.db.gameSession.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        title: input.title,
        sessionNumber: input.sessionNumber,
        date: input.date ?? null,
        status: input.status ?? "planned",
        summaryDm: input.summaryDm ?? null,
        summaryPlayer: input.summaryPlayer ?? null,
        notes: input.notes ?? null,
        openPlots: input.openPlots ?? null,
        playerDecisions: input.playerDecisions ?? null,
        linkedPages: linkedPageIds.length
          ? {
              create: linkedPageIds.map((pageId) => ({ pageId })),
            }
          : undefined,
      },
      include: this.sessionInclude(),
    });
  }

  async update(sessionId: string, input: UpdateGameSessionInput): Promise<GameSessionWithLinks> {
    if (input.linkedPageIds) {
      await this.db.gameSessionPageLink.deleteMany({ where: { gameSessionId: sessionId } });
      if (input.linkedPageIds.length > 0) {
        await this.db.gameSessionPageLink.createMany({
          data: input.linkedPageIds.map((pageId) => ({
            gameSessionId: sessionId,
            pageId,
          })),
        });
      }
    }

    return this.db.gameSession.update({
      where: { id: sessionId },
      data: {
        title: input.title,
        sessionNumber: input.sessionNumber,
        date: input.date,
        status: input.status,
        campaignId: input.campaignId,
        summaryDm: input.summaryDm,
        summaryPlayer: input.summaryPlayer,
        notes: input.notes,
        openPlots: input.openPlots,
        playerDecisions: input.playerDecisions,
        recapPublished: input.recapPublished,
      },
      include: this.sessionInclude(),
    });
  }

  async linkPage(sessionId: string, pageId: string) {
    return this.db.gameSessionPageLink.upsert({
      where: {
        gameSessionId_pageId: {
          gameSessionId: sessionId,
          pageId,
        },
      },
      create: { gameSessionId: sessionId, pageId },
      update: {},
    });
  }

  async unlinkPage(sessionId: string, pageId: string) {
    return this.db.gameSessionPageLink.deleteMany({
      where: { gameSessionId: sessionId, pageId },
    });
  }

  async publishRecap(sessionId: string): Promise<GameSessionWithLinks> {
    return this.update(sessionId, {
      recapPublished: true,
      status: "summarized",
    });
  }

  async listPublishedForPortal(worldSlug: string): Promise<GameSessionWithLinks[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.gameSession.findMany({
      where: {
        worldId: world.id,
        recapPublished: true,
      },
      include: this.sessionInclude(),
      orderBy: [{ sessionNumber: "desc" }],
    });
  }
}

export function createGameSessionService(databaseUrl?: string): GameSessionService {
  return new GameSessionService(createPrismaClient(databaseUrl));
}
