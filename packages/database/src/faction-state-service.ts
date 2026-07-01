import type { Prisma, PrismaClient } from "./generated/prisma/client";

export interface UpsertFactionStateInput {
  worldId: string;
  pageId: string;
  goals?: Prisma.InputJsonValue;
  resources?: Prisma.InputJsonValue;
  relationships?: Prisma.InputJsonValue;
  agenda?: string;
  powerLevel?: number | null;
  notes?: string;
}

export class FactionStateService {
  constructor(private readonly db: PrismaClient) {}

  async getByPageId(pageId: string) {
    return this.db.factionState.findUnique({ where: { pageId } });
  }

  async listForWorld(worldId: string) {
    return this.db.factionState.findMany({
      where: { worldId },
      include: {
        page: { select: { id: true, title: true, slug: true, type: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async upsert(input: UpsertFactionStateInput) {
    return this.db.factionState.upsert({
      where: { pageId: input.pageId },
      create: {
        worldId: input.worldId,
        pageId: input.pageId,
        goals: input.goals,
        resources: input.resources,
        relationships: input.relationships,
        agenda: input.agenda ?? "",
        powerLevel: input.powerLevel ?? null,
        notes: input.notes ?? "",
      },
      update: {
        goals: input.goals,
        resources: input.resources,
        relationships: input.relationships,
        agenda: input.agenda,
        powerLevel: input.powerLevel,
        notes: input.notes,
      },
      include: {
        page: { select: { id: true, title: true, slug: true, type: true } },
      },
    });
  }
}

export function createFactionStateService(db: PrismaClient): FactionStateService {
  return new FactionStateService(db);
}
