import type {
  MiniatureCollectionItem,
  MiniatureCollectionStatus,
  PrismaClient,
} from "./generated/prisma-brain/client";
import { toPrismaJsonValue } from "./json-utils";

export type {
  MiniatureCollectionItem,
  MiniatureCollectionStatus,
} from "./generated/prisma-brain/client";

export { MiniatureCollectionStatus as MiniatureCollectionStatusEnum } from "./generated/prisma-brain/client";

export const MINIATURE_COLLECTION_STATUS_LABELS: Record<MiniatureCollectionStatus, string> = {
  purchased: "Gekauft",
  built: "Gebaut",
  primed: "Grundiert",
  painted: "Bemalt",
};

export interface CreateMiniatureCollectionItemInput {
  name: string;
  manufacturer?: string | null;
  gameSystem?: string | null;
  faction?: string | null;
  quantity?: number;
  status?: MiniatureCollectionStatus;
  notes?: string;
  referenceImageAssetId?: string | null;
  comparePhotoAssetIds?: string[] | null;
  workshopProjectId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateMiniatureCollectionItemInput {
  name?: string;
  manufacturer?: string | null;
  gameSystem?: string | null;
  faction?: string | null;
  quantity?: number;
  status?: MiniatureCollectionStatus;
  notes?: string;
  referenceImageAssetId?: string | null;
  comparePhotoAssetIds?: string[] | null;
  workshopProjectId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListMiniatureCollectionOptions {
  status?: MiniatureCollectionStatus;
  manufacturer?: string;
  gameSystem?: string;
  faction?: string;
  limit?: number;
}

export class MiniatureCollectionService {
  constructor(private readonly db: PrismaClient) {}

  async listItems(options: ListMiniatureCollectionOptions = {}): Promise<MiniatureCollectionItem[]> {
    return this.db.miniatureCollectionItem.findMany({
      where: {
        ...(options.status ? { status: options.status } : {}),
        ...(options.manufacturer ? { manufacturer: options.manufacturer } : {}),
        ...(options.gameSystem ? { gameSystem: options.gameSystem } : {}),
        ...(options.faction ? { faction: options.faction } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 500,
    });
  }

  async getItem(id: string): Promise<MiniatureCollectionItem | null> {
    return this.db.miniatureCollectionItem.findUnique({ where: { id } });
  }

  async createItem(input: CreateMiniatureCollectionItemInput): Promise<MiniatureCollectionItem> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Name ist erforderlich.");
    }
    return this.db.miniatureCollectionItem.create({
      data: {
        name,
        manufacturer: input.manufacturer ?? null,
        gameSystem: input.gameSystem ?? null,
        faction: input.faction ?? null,
        quantity: input.quantity ?? 1,
        status: input.status ?? "purchased",
        notes: input.notes ?? "",
        referenceImageAssetId: input.referenceImageAssetId ?? null,
        comparePhotoAssetIds: toPrismaJsonValue(input.comparePhotoAssetIds),
        workshopProjectId: input.workshopProjectId ?? null,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateItem(
    id: string,
    input: UpdateMiniatureCollectionItemInput,
  ): Promise<MiniatureCollectionItem> {
    return this.db.miniatureCollectionItem.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
        ...(input.gameSystem !== undefined ? { gameSystem: input.gameSystem } : {}),
        ...(input.faction !== undefined ? { faction: input.faction } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.referenceImageAssetId !== undefined
          ? { referenceImageAssetId: input.referenceImageAssetId }
          : {}),
        ...(input.comparePhotoAssetIds !== undefined
          ? { comparePhotoAssetIds: toPrismaJsonValue(input.comparePhotoAssetIds) }
          : {}),
        ...(input.workshopProjectId !== undefined
          ? { workshopProjectId: input.workshopProjectId }
          : {}),
        ...(input.metadata !== undefined
          ? { metadata: toPrismaJsonValue(input.metadata) }
          : {}),
      },
    });
  }

  async deleteItem(id: string): Promise<MiniatureCollectionItem> {
    return this.db.miniatureCollectionItem.delete({ where: { id } });
  }
}

export function createMiniatureCollectionService(db: PrismaClient): MiniatureCollectionService {
  return new MiniatureCollectionService(db);
}
