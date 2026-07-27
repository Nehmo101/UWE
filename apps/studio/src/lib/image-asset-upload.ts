import fs from "node:fs";
import {
  ensureUploadDirectory,
  inferAssetTypeFromMime,
  inferMimeTypeFromFilename,
  resolveAssetFilePath,
  resolveUploadPolicyConfig,
  validateUploadInput,
  UploadValidationError,
  type DetectedFileKind,
  type UploadPolicyConfig,
} from "@uwe/assets";
import {
  getAppRepository,
  getSystemSettings,
  logAuditEvent,
  NON_SANDBOX_WORLD_WHERE,
  prisma,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";
import { getUweEnvOrNull } from "@uwe/env";

const IMAGE_KINDS: ReadonlySet<DetectedFileKind> = new Set(["png", "jpeg", "gif", "webp"]);

function imageOnlyUploadPolicy(): UploadPolicyConfig {
  return {
    ...resolveUploadPolicyConfig(),
    allowedKinds: IMAGE_KINDS,
    allowDocuments: false,
  };
}

export interface UploadedImageAsset {
  assetId: string;
  title: string;
  mimeType: string;
}

export type UploadImageAssetResult =
  | { ok: true; asset: UploadedImageAsset }
  | { ok: false; status: number; error: string };

/**
 * Validate and store an image `File` as a `dm_only` asset, returning the new
 * asset reference. Shared by the Bug Center and Ideen-Management upload routes:
 * only PNG/JPEG/GIF/WebP are accepted and the binary is written under the
 * primary (non-sandbox) world's upload directory.
 */
export async function storeImageAsset(
  file: unknown,
  options: { source: string; defaultTitle: string },
): Promise<UploadImageAssetResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, status: 400, error: "Bild erforderlich." };
  }

  const maxUploadBytes = getUweEnvOrNull()?.maxUploadBytes ?? 25 * 1024 * 1024;
  if (file.size > maxUploadBytes) {
    return {
      ok: false,
      status: 413,
      error: `Datei überschreitet maximale Größe (${Math.floor(maxUploadBytes / (1024 * 1024))} MB).`,
    };
  }

  const world = await prisma.world.findFirst({
    where: NON_SANDBOX_WORLD_WHERE,
    orderBy: { name: "asc" },
  });
  if (!world) {
    return { ok: false, status: 503, error: "Keine Welt für Bild-Speicherung vorhanden." };
  }

  const mimeType = file.type || inferMimeTypeFromFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const title = file.name || options.defaultTitle;

  let validated;
  try {
    validated = validateUploadInput({
      buffer,
      originalFilename: file.name,
      declaredMimeType: mimeType,
      worldId: world.id,
      config: imageOnlyUploadPolicy(),
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return { ok: false, status: 400, error: error.message };
    }
    throw error;
  }

  if (!IMAGE_KINDS.has(validated.kind)) {
    return { ok: false, status: 400, error: "Nur Bilder (PNG, JPEG, GIF, WebP) erlaubt." };
  }

  const repo = getAppRepository();
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  ensureUploadDirectory(world.id, undefined, uploadsRoot);
  const filePath = resolveAssetFilePath(validated.storageKey, undefined, uploadsRoot);
  fs.writeFileSync(filePath, buffer);

  const asset = await repo.createAsset({
    worldId: world.id,
    title,
    type: inferAssetTypeFromMime(validated.mimeType),
    storageKey: validated.storageKey,
    mimeType: validated.mimeType,
    size: buffer.length,
    metadata: { source: options.source },
  });

  await logAuditEvent(prisma, {
    action: "upload_created",
    targetType: "asset",
    targetId: asset.id,
    worldId: world.id,
    metadata: { title: asset.title, source: options.source },
  });

  return {
    ok: true,
    asset: { assetId: asset.id, title: asset.title, mimeType: asset.mimeType ?? validated.mimeType },
  };
}
