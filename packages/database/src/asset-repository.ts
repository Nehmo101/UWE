import type { AssetType, Prisma, Visibility } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { logAuditEvent } from "./audit-log-service";
import { parseStringArray, toJsonArray } from "./json-utils";
import {
  filterAssetsForContext,
  isAssetAccessible,
  type AccessContext,
} from "./permissions";

export interface CreateAssetInput {
  worldId: string;
  campaignId?: string | null;
  title: string;
  description?: string | null;
  type: AssetType;
  storageKey: string;
  mimeType?: string | null;
  size?: number;
  visibility?: Visibility;
  tags?: string[];
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateAssetInput {
  title?: string;
  description?: string | null;
  type?: AssetType;
  visibility?: Visibility;
  campaignId?: string | null;
  tags?: string[];
  metadata?: Prisma.InputJsonValue;
}

export type AssetWithLinks = Prisma.AssetGetPayload<{
  include: { pageLinks: { include: { page: { select: { id: true; title: true; slug: true } } } } };
}>;

function withParsedAssetTags<T extends { tags: unknown }>(
  asset: T,
): T & { tags: string[] } {
  return {
    ...asset,
    tags: parseStringArray(asset.tags),
  };
}

export async function listAssetsByWorld(
  db: PrismaClient,
  worldSlug: string,
  options?: { type?: AssetType; campaignId?: string | null },
) {
  const world = await db.world.findUnique({ where: { slug: worldSlug } });
  if (!world) return [];

  const assets = await db.asset.findMany({
    where: {
      worldId: world.id,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
    },
    include: {
      pageLinks: {
        include: {
          page: { select: { id: true, title: true, slug: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return assets.map((asset) => withParsedAssetTags(asset));
}

export async function getAssetById(db: PrismaClient, assetId: string) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: {
      pageLinks: {
        include: {
          page: { select: { id: true, title: true, slug: true } },
        },
      },
    },
  });

  return asset ? withParsedAssetTags(asset) : null;
}

export async function getAssetByStorageKey(db: PrismaClient, worldId: string, storageKey: string) {
  const asset = await db.asset.findFirst({
    where: { worldId, storageKey },
    include: {
      pageLinks: { select: { pageId: true } },
    },
  });

  return asset ? withParsedAssetTags(asset) : null;
}

export async function createAssetRecord(db: PrismaClient, input: CreateAssetInput) {
  const asset = await db.asset.create({
    data: {
      worldId: input.worldId,
      campaignId: input.campaignId ?? null,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      storageKey: input.storageKey,
      mimeType: input.mimeType ?? null,
      size: input.size ?? 0,
      visibility: input.visibility ?? "dm_only",
      tags: toJsonArray(input.tags),
      metadata: input.metadata ?? {},
    },
    include: {
      pageLinks: {
        include: {
          page: { select: { id: true, title: true, slug: true } },
        },
      },
    },
  });

  return withParsedAssetTags(asset);
}

export async function updateAssetRecord(db: PrismaClient, assetId: string, input: UpdateAssetInput) {
  const asset = await db.asset.update({
    where: { id: assetId },
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      visibility: input.visibility,
      campaignId: input.campaignId,
      tags: input.tags ? toJsonArray(input.tags) : undefined,
      metadata: input.metadata,
    },
    include: {
      pageLinks: {
        include: {
          page: { select: { id: true, title: true, slug: true } },
        },
      },
    },
  });

  return withParsedAssetTags(asset);
}

export async function deleteAssetRecord(db: PrismaClient, assetId: string) {
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  const deleted = await db.asset.delete({ where: { id: assetId } });

  if (asset) {
    await logAuditEvent(db, {
      action: "upload_deleted",
      targetType: "asset",
      targetId: assetId,
      worldId: asset.worldId,
      metadata: { title: asset.title, type: asset.type },
    });
  }

  return deleted;
}

export async function linkAssetToPage(db: PrismaClient, assetId: string, pageId: string) {
  return db.assetPageLink.upsert({
    where: {
      assetId_pageId: { assetId, pageId },
    },
    create: { assetId, pageId },
    update: {},
  });
}

export async function unlinkAssetFromPage(db: PrismaClient, assetId: string, pageId: string) {
  return db.assetPageLink.deleteMany({
    where: { assetId, pageId },
  });
}

export async function linkAssetToContentBlock(
  db: PrismaClient,
  blockId: string,
  assetId: string | null,
) {
  return db.contentBlock.update({
    where: { id: blockId },
    data: { assetId },
  });
}

export async function listAssetsForContext(
  db: PrismaClient,
  worldSlug: string,
  context: AccessContext,
  options?: { type?: AssetType },
) {
  const assets = await listAssetsByWorld(db, worldSlug, options);
  return filterAssetsForContext(assets, context);
}

export async function getAssetForContext(
  db: PrismaClient,
  assetId: string,
  context: AccessContext,
) {
  const asset = await getAssetById(db, assetId);
  if (!asset || !isAssetAccessible(asset, context)) {
    return null;
  }
  return asset;
}

export async function listAssetsForPage(db: PrismaClient, pageId: string) {
  const links = await db.assetPageLink.findMany({
    where: { pageId },
    include: {
      asset: {
        include: {
          pageLinks: {
            include: {
              page: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      },
    },
  });

  return links.map((link) => withParsedAssetTags(link.asset));
}

export { filterAssetsForContext, isAssetAccessible };
