import type {
  GameSessionStatus,
  Prisma,
} from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";
import { parseStringArray } from "./json-utils";
import type { PageSummary } from "./repository";
import { createCalendarService } from "./calendar-service";
// Der Kalender liegt seit Abschnitt G in uwe-family.db.
import { familyPrisma } from "./family-client";

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
  playerVisibleSchedule?: boolean;
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
  playerVisibleSchedule?: boolean;
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
  /** What happened — player recap narrative. */
  summaryPlayer: string | null;
  /** What the characters know / decided (published recaps only). */
  playerDecisions: string | null;
  /** Open questions and plot threads (published recaps only). */
  openPlots: string | null;
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
  playerVisibleSchedule: boolean;
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
    playerVisibleSchedule: session.playerVisibleSchedule,
    linkedPages: mapLinkedPages(session),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/** Portal view — DM prep fields (summaryDm, notes) are never included. */
export function toPortalGameSessionView(session: GameSessionWithLinks): PortalGameSessionView {
  const published = session.recapPublished;
  return {
    id: session.id,
    worldId: session.worldId,
    campaignId: session.campaignId,
    title: session.title,
    sessionNumber: session.sessionNumber,
    date: session.date,
    status: session.status,
    summaryPlayer: published ? session.summaryPlayer : null,
    playerDecisions: published ? session.playerDecisions : null,
    openPlots: published ? session.openPlots : null,
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

  async listByWorldId(
    worldId: string,
    options?: { campaignId?: string | null },
  ): Promise<GameSessionWithLinks[]> {
    return this.db.gameSession.findMany({
      where: {
        worldId,
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
      },
      include: this.sessionInclude(),
      orderBy: [{ sessionNumber: "desc" }, { date: "desc" }],
    });
  }

  async findSessionsForPage(
    worldId: string,
    pageId: string,
  ): Promise<GameSessionWithLinks[]> {
    return this.db.gameSession.findMany({
      where: {
        worldId,
        linkedPages: { some: { pageId } },
      },
      include: this.sessionInclude(),
      orderBy: [{ sessionNumber: "desc" }],
    });
  }

  async listByWorld(
    worldSlug: string,
    options?: {
      campaignId?: string | null;
      status?: GameSessionStatus | GameSessionStatus[];
      limit?: number;
      offset?: number;
    },
  ): Promise<GameSessionWithLinks[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const statusFilter = options?.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.gameSession.findMany({
      where: {
        worldId: world.id,
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: this.sessionInclude(),
      orderBy: [{ sessionNumber: "desc" }, { date: "desc" }],
      take: options?.limit,
      skip: options?.offset,
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

    const session = await this.db.gameSession.create({
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
        playerVisibleSchedule: input.playerVisibleSchedule ?? false,
        linkedPages: linkedPageIds.length
          ? {
              create: linkedPageIds.map((pageId) => ({ pageId })),
            }
          : undefined,
      },
      include: this.sessionInclude(),
    });

    if (session.date) {
      // Calendar sync is best-effort: a failing/optional calendar must never
      // fail session creation after the session was already persisted (QF4).
      await this.safeCalendarSync(session.id);
    }

    return session;
  }

  /** Calendar sync that never throws — logs and continues on failure. */
  private async safeCalendarSync(sessionId: string): Promise<void> {
    try {
      await this.runCalendarSync(sessionId);
    } catch (error) {
      console.warn(
        `[game-session] Kalender-Sync fehlgeschlagen für Session ${sessionId} (Session bleibt erhalten):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /** Calendar unsync that never throws. */
  private async safeCalendarUnsync(sessionId: string): Promise<void> {
    try {
      await this.runCalendarUnsync(sessionId);
    } catch (error) {
      console.warn(
        `[game-session] Kalender-Unsync fehlgeschlagen für Session ${sessionId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /** Overridable seam for tests. Performs the actual calendar sync. */
  protected async runCalendarSync(sessionId: string): Promise<void> {
    await createCalendarService(familyPrisma, this.db).syncSessionToCalendar(sessionId);
  }

  /** Overridable seam for tests. Performs the actual calendar unsync. */
  protected async runCalendarUnsync(sessionId: string): Promise<void> {
    await createCalendarService(familyPrisma, this.db).unsyncSessionFromCalendar(sessionId);
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

    const session = await this.db.gameSession.update({
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
        playerVisibleSchedule: input.playerVisibleSchedule,
      },
      include: this.sessionInclude(),
    });

    if (input.date !== undefined || input.title !== undefined || input.sessionNumber !== undefined) {
      // Best-effort (QF4): calendar problems must not fail the session update.
      if (input.date === null) {
        await this.safeCalendarUnsync(sessionId);
      } else {
        await this.safeCalendarSync(sessionId);
      }
    }

    return session;
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
    const session = await this.update(sessionId, {
      recapPublished: true,
      status: "summarized",
    });

    return session;
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

  /** Player-safe sessions: published recaps plus DM-announced upcoming sessions. */
  async listVisibleToPlayersForPortal(worldSlug: string): Promise<GameSessionWithLinks[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.gameSession.findMany({
      where: {
        worldId: world.id,
        OR: [
          { recapPublished: true },
          {
            playerVisibleSchedule: true,
            status: { in: ["planned", "prepared"] },
          },
        ],
      },
      include: this.sessionInclude(),
      orderBy: [{ sessionNumber: "desc" }],
    });
  }
}

export function createGameSessionService(databaseUrl?: string): GameSessionService {
  return new GameSessionService(createPrismaClient(databaseUrl));
}
