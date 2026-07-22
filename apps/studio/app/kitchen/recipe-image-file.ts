import { inferMimeTypeFromFilename, resolveAssetFilePath } from "@uwe/assets";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  getSystemSettings,
  prisma,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";

export interface RecipeImageFileData {
  storageKey: string;
  mimeType: string;
  title: string;
  filePath: string;
}

/**
 * Löst das hinterlegte Rezeptbild auf einen On-Disk-Pfad auf. Gibt null zurück,
 * wenn das Rezept fehlt, kein Bild hat oder der Storage-Key ungültig ist.
 * Reiner Data-Access — die Küchen-Logik lebt in `@uwe/kitchen`.
 */
export async function resolveRecipeImageFile(id: string): Promise<RecipeImageFileData | null> {
  const row = await brainPrisma.recipe.findUnique({
    where: { id },
    select: { imageStorageKey: true, title: true },
  });
  if (!row?.imageStorageKey) return null;

  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  try {
    const filePath = resolveAssetFilePath(row.imageStorageKey, undefined, uploadsRoot);
    return {
      storageKey: row.imageStorageKey,
      mimeType: inferMimeTypeFromFilename(row.imageStorageKey) ?? "application/octet-stream",
      title: row.title,
      filePath,
    };
  } catch {
    return null;
  }
}
