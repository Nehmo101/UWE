import type { Prisma, PrismaClient, Visibility, SecretLevel, WorldEventSourceType, WorldEventEntityRole } from "./generated/prisma/client";
import type { InGameDate } from "./world-calendar-service";

export interface CreateWorldEventInput {
  worldId: string;
  calendarId?: string | null;
  inGameDate: InGameDate;
  title: string;
  summaryPlayer?: string | null;
  summaryDm?: string | null;
  visibility?: Visibility;
  secretLevel?: SecretLevel;
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
            page: { select: { id: true, title: true, slug: true, type: true } },
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
          where: { pageId },
          include: {
            page: { select: { id: true, title: true, slug: true, type: true } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
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
        secretLevel: input.secretLevel ?? "none",
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
            page: { select: { id: true, title: true, slug: true, type: true } },
          },
        },
      },
    });
  }
}

export function createWorldEventService(db: PrismaClient): WorldEventService {
  return new WorldEventService(db);
}
