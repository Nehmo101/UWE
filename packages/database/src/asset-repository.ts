import fs from "node:fs";
import {
  ensureUploadDirectory,
  inferAssetTypeFromMime,
  resolveAssetFilePath,
  validateUploadInput,
  UploadValidationError,
  type DetectedFileKind,
  type UploadPolicyConfig,
} from "@uwe/assets";
import type { AssetType, Prisma } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { logAuditEvent } from "./audit-log-service";
import { parseStringArray, toJsonArray } from "./json-utils";
import { getSystemSettings, resolveEffectiveUploadsPath } from "./settings-service";
export interface CreateAssetInput {
  worldId: string;
  campaignId?: string | null;
  title: string;
  description?: string | null;
  type: AssetType;
  storageKey: string;
  mimeType?: string | null;
  size?: number;
  tags?: string[];
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateAssetInput {
  title?: string;
  description?: string | null;
  type?: AssetType;
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

export interface StoreUploadedAssetInput {
  worldId: string;
  campaignId?: string | null;
  buffer: Buffer;
  title: string;
  description?: string | null;
  /**
   * Nutzer-Upload: Magic-Bytes-Validierung mit Policy. Systemgenerierte
   * Dateien (Image Studio, PDF-Import) übergeben stattdessen `storage`.
   */
  validate?: {
    originalFilename?: string | null;
    declaredMimeType?: string | null;
    policy?: UploadPolicyConfig;
    /** Zusätzliche Engführung, z. B. nur Bilder. */
    allowedKinds?: ReadonlySet<DetectedFileKind>;
    allowedKindsError?: string;
  };
  /** Fertiger Schlüssel + Mime für Inhalte, die UWE selbst erzeugt hat. */
  storage?: { storageKey: string; mimeType: string };
  /** Überschreibt den aus dem Mime abgeleiteten Asset-Typ. */
  type?: AssetType;
  metadata?: Prisma.InputJsonValue;
  /** Zusätzliche Audit-Metadaten; `false` schaltet den Audit-Eintrag ab. */
  audit?: Record<string, unknown> | false;
}

/**
 * DER Weg, eine hochgeladene oder erzeugte Datei als Asset abzulegen:
 * validate → settings → resolvePath → ensureDir → write → createAsset → audit.
 *
 * Die Sequenz stand sechsmal kopiert in Studio-Routen und -Libs — mit sechs
 * Gelegenheiten, einen Schritt zu vergessen (der Audit-Eintrag fehlte prompt
 * in der Hälfte der Kopien). Wirft {@link UploadValidationError} bei
 * abgelehnten Dateien; die Aufrufer übersetzen das in ein 400.
 */
export async function storeUploadedAsset(
  db: PrismaClient,
  input: StoreUploadedAssetInput,
) {
  let storageKey: string;
  let mimeType: string;

  if (input.storage) {
    storageKey = input.storage.storageKey;
    mimeType = input.storage.mimeType;
  } else {
    const validated = validateUploadInput({
      buffer: input.buffer,
      originalFilename: input.validate?.originalFilename,
      declaredMimeType: input.validate?.declaredMimeType,
      worldId: input.worldId,
      config: input.validate?.policy,
    });

    if (input.validate?.allowedKinds && !input.validate.allowedKinds.has(validated.kind)) {
      throw new UploadValidationError(
        input.validate.allowedKindsError ?? "Dieser Dateityp ist hier nicht erlaubt.",
        "disallowed_type",
      );
    }

    storageKey = validated.storageKey;
    mimeType = validated.mimeType;
  }

  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(input.worldId, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(storageKey, undefined, uploadsRoot);
  await fs.promises.writeFile(filePath, input.buffer);

  const asset = await createAssetRecord(db, {
    worldId: input.worldId,
    campaignId: input.campaignId ?? null,
    title: input.title,
    description: input.description ?? null,
    type: input.type ?? inferAssetTypeFromMime(mimeType),
    storageKey,
    mimeType,
    size: input.buffer.length,
    metadata: input.metadata,
  });

  if (input.audit !== false) {
    await logAuditEvent(db, {
      action: "upload_created",
      targetType: "asset",
      targetId: asset.id,
      worldId: input.worldId,
      metadata: { title: asset.title, ...(input.audit ?? {}) },
    });
  }

  return asset;
}
