import {
  resolveUploadPolicyConfig,
  inferMimeTypeFromFilename,
  UploadValidationError,
  type DetectedFileKind,
  type UploadPolicyConfig,
} from "@uwe/assets";
import {
  NON_SANDBOX_WORLD_WHERE,
  prisma,
  storeUploadedAsset,
} from "@uwe/database/server";
import { getUweEnvOrNull } from "@uwe/env";

const IMAGE_KINDS: ReadonlySet<DetectedFileKind> = new Set(["png", "jpeg", "gif", "webp"]);

const IMAGE_ONLY_ERROR = "Nur Bilder (PNG, JPEG, GIF, WebP) erlaubt.";

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
 * primary (non-sandbox) world's upload directory. Die eigentliche Sequenz
 * (validate → write → createAsset → audit) lebt in `storeUploadedAsset`.
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const title = file.name || options.defaultTitle;

  try {
    const asset = await storeUploadedAsset(prisma, {
      worldId: world.id,
      buffer,
      title,
      validate: {
        originalFilename: file.name,
        declaredMimeType: file.type || inferMimeTypeFromFilename(file.name),
        policy: imageOnlyUploadPolicy(),
        allowedKinds: IMAGE_KINDS,
        allowedKindsError: IMAGE_ONLY_ERROR,
      },
      metadata: { source: options.source },
      audit: { source: options.source },
    });

    return {
      ok: true,
      asset: { assetId: asset.id, title: asset.title, mimeType: asset.mimeType ?? "" },
    };
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return { ok: false, status: 400, error: error.message };
    }
    throw error;
  }
}
