import type { PrismaClient } from "./client";

export interface CreateAssetAlbumInput {
  worldId: string;
  title: string;
  description?: string | null;
}

export class AssetAlbumService {
  constructor(private readonly db: PrismaClient) {}

  async createAlbum(input: CreateAssetAlbumInput) {
    return this.db.assetAlbum.create({
      data: {
        worldId: input.worldId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
      },
    });
  }

  async listAlbumsByWorld(worldId: string) {
    return this.db.assetAlbum.findMany({
      where: { worldId },
      orderBy: { title: "asc" },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  async getAlbum(id: string) {
    return this.db.assetAlbum.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            asset: {
              include: {
                pageLinks: { include: { page: { select: { title: true } } } },
              },
            },
          },
        },
      },
    });
  }

  async addAsset(albumId: string, assetId: string) {
    const last = await this.db.assetAlbumItem.findFirst({
      where: { albumId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;
    return this.db.assetAlbumItem.upsert({
      where: { albumId_assetId: { albumId, assetId } },
      create: { albumId, assetId, sortOrder },
      update: {},
    });
  }

  async removeAsset(albumId: string, assetId: string) {
    await this.db.assetAlbumItem.deleteMany({ where: { albumId, assetId } });
  }

  async listAssetIdsInAlbum(albumId: string): Promise<string[]> {
    const items = await this.db.assetAlbumItem.findMany({
      where: { albumId },
      select: { assetId: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return items.map((item) => item.assetId);
  }
}

export function createAssetAlbumService(db: PrismaClient) {
  return new AssetAlbumService(db);
}
