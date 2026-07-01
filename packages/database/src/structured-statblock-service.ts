import type { DndRulesEdition, Prisma, PrismaClient } from "./generated/prisma/client";

export interface UpsertStructuredStatblockInput {
  worldId: string;
  pageId: string;
  data: Prisma.InputJsonValue;
  rulesEdition?: DndRulesEdition;
}

export class StructuredStatblockService {
  constructor(private readonly db: PrismaClient) {}

  async getByPageId(pageId: string) {
    return this.db.structuredStatblock.findUnique({ where: { pageId } });
  }

  async upsert(input: UpsertStructuredStatblockInput) {
    return this.db.structuredStatblock.upsert({
      where: { pageId: input.pageId },
      create: {
        worldId: input.worldId,
        pageId: input.pageId,
        data: input.data,
        rulesEdition: input.rulesEdition ?? "dnd5e_2024",
      },
      update: {
        data: input.data,
        rulesEdition: input.rulesEdition,
      },
    });
  }
}

export function createStructuredStatblockService(db: PrismaClient): StructuredStatblockService {
  return new StructuredStatblockService(db);
}
