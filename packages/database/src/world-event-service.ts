import type { Prisma, PrismaClient, Visibility, WorldEventSourceType, WorldEventEntityRole } from "./generated/prisma/client";
import type { InGameDate } from "./world-calendar-service";
import { parseInGameDate } from "./world-calendar-service";

export const WORLD_EVENT_ENTITY_ROLE_LABELS: Record<WorldEventEntityRole, string> = {
  primary: "Hauptakteur",
  involved: "Beteiligt",
  location: "Ort",
  faction: "Fraktion",
};

export interface PortalWorldEventView {
  id: string;
  worldId: string;
  title: string;
  inGameDate: InGameDate;
  summaryPlayer: string | null;
  sortOrder: number;
  linkedPages: Array<{ id: string; title: string; slug: string; type: string }>;
}

export type WorldEventWithLinks = Prisma.WorldEventGetPayload<{
  include: {
    entityLinks: {
      include: {
        page: { select: { id: true; title: true; slug: true; type: true; visibility: true; playerAccess: true } };
      };
    };
  };
}>;

export interface CreateWorldEventInput {
  worldId: string;
  calendarId?: string | null;
  inGameDate: InGameDate;
  title: string;
  summaryPlayer?: string | null;
  summaryDm?: string | null;
  visibility?: Visibility;
  sourceType?: WorldEventSourceType;
  sourceAiProposalId?: string | null;
  gameSessionId?: string | null;
  sortOrder?: number;
  linkedPages?: Array<{ pageId: string; role?: WorldEventEntityRole }>;
}

export class WorldEventService {
  constructor(private readonly db: PrismaClient) {}

  async listForWorld(worldId: string, options?: { limit?: number }) {
    return this.db.worldEvent.findMany({
      where: { worldId },
      include: {
        entityLinks: {
          include: {
            page: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                visibility: true,
                playerAccess: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: options?.limit,
    });
  }

  async listForPage(pageId: string) {
    return this.db.worldEvent.findMany({
      where: { entityLinks: { some: { pageId } } },
      include: {
        entityLinks: {
          include: {
            page: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                visibility: true,
                playerAccess: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async getByIdForWorld(worldId: string, eventId: string) {
    return this.db.worldEvent.findFirst({
      where: { id: eventId, worldId },
      include: {
        entityLinks: {
          include: {
            page: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                visibility: true,
                playerAccess: true,
              },
            },
          },
        },
      },
    });
  }

  async deleteById(worldId: string, eventId: string) {
    const existing = await this.db.worldEvent.findFirst({
      where: { id: eventId, worldId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Chronik-Eintrag nicht gefunden.");
    }
    await this.db.worldEvent.delete({ where: { id: eventId } });
  }

  async create(input: CreateWorldEventInput) {
    return this.db.worldEvent.create({
      data: {
        worldId: input.worldId,
        calendarId: input.calendarId ?? null,
        inGameDate: input.inGameDate as unknown as Prisma.InputJsonValue,
        title: input.title,
        summaryPlayer: input.summaryPlayer ?? null,
        summaryDm: input.summaryDm ?? null,
        visibility: input.visibility ?? "private",
        sourceType: input.sourceType ?? "manual",
        sourceAiProposalId: input.sourceAiProposalId ?? null,
        gameSessionId: input.gameSessionId ?? null,
        sortOrder: input.sortOrder ?? 0,
        entityLinks: input.linkedPages?.length
          ? {
              create: input.linkedPages.map((link) => ({
                pageId: link.pageId,
                role: link.role ?? "involved",
              })),
            }
          : undefined,
      },
      include: {
        entityLinks: {
          include: {
            page: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                visibility: true,
                playerAccess: true,
              },
            },
          },
        },
      },
    });
  }
}

export function createWorldEventService(db: PrismaClient): WorldEventService {
  return new WorldEventService(db);
}

export function compareInGameDates(a: InGameDate, b: InGameDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function toPortalWorldEventView(event: WorldEventWithLinks): PortalWorldEventView {
  return {
    id: event.id,
    worldId: event.worldId,
    title: event.title,
    inGameDate: parseInGameDate(event.inGameDate),
    summaryPlayer: event.summaryPlayer,
    sortOrder: event.sortOrder,
    linkedPages: event.entityLinks.map((link) => ({
      id: link.page.id,
      title: link.page.title,
      slug: link.page.slug,
      type: link.page.type,
    })),
  };
}
