import type { PrismaClient } from "./client";
import {
  parseMagicItemData,
  type MagicItemData,
} from "./magic-item-model";
import type { Prisma } from "./generated/prisma/client";

/**
 * Persistenz der Magic-Item-Werkbank: ein `StructuredItem` je Item-Seite
 * (1:1, analog zu StructuredStatblock). Reine Data-Access-Schicht; die
 * Export-/Formatierungslogik lebt pure in `magic-item-model.ts`.
 */

export interface StructuredItemRecord {
  pageId: string;
  worldId: string;
  data: MagicItemData;
  updatedAt: Date;
}

export class MagicItemService {
  constructor(private readonly db: PrismaClient) {}

  async getForPage(pageId: string): Promise<StructuredItemRecord | null> {
    const row = await this.db.structuredItem.findUnique({ where: { pageId } });
    if (!row) return null;
    return {
      pageId: row.pageId,
      worldId: row.worldId,
      data: parseMagicItemData(row.data),
      updatedAt: row.updatedAt,
    };
  }

  async upsertForPage(input: {
    worldId: string;
    pageId: string;
    data: MagicItemData;
  }): Promise<StructuredItemRecord> {
    const json = input.data as unknown as Prisma.InputJsonValue;
    const row = await this.db.structuredItem.upsert({
      where: { pageId: input.pageId },
      create: { worldId: input.worldId, pageId: input.pageId, data: json },
      update: { data: json },
    });
    return {
      pageId: row.pageId,
      worldId: row.worldId,
      data: parseMagicItemData(row.data),
      updatedAt: row.updatedAt,
    };
  }
}

export function createMagicItemService(db: PrismaClient): MagicItemService {
  return new MagicItemService(db);
}
