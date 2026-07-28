import fs from "node:fs";
import { resolveAssetFilePath } from "@uwe/assets";
import { familyPrisma } from "@uwe/database/family-client";
import {
  getSystemSettings,
  prisma,
  resolveEffectiveUploadsPath,
} from "@uwe/database/server";

export interface ScanFileData {
  storageKey: string;
  mimeType: string;
  title: string;
  filePath: string;
}

/**
 * Load storage metadata for a scan and resolve its on-disk path. Returns null
 * when the scan does not exist, has no stored file, or the storage key is
 * invalid. Data-access only — the Scan-Inbox business logic lives in
 * `@uwe/scan-inbox`.
 */
export async function resolveScanFile(id: string): Promise<ScanFileData | null> {
  const row = await familyPrisma.scanDocument.findUnique({
    where: { id },
    select: { storageKey: true, mimeType: true, title: true },
  });
  if (!row?.storageKey) return null;

  const settings = await getSystemSettings(prisma);
  const uploadsRoot = resolveEffectiveUploadsPath(settings);

  try {
    const filePath = resolveAssetFilePath(row.storageKey, undefined, uploadsRoot);
    return {
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      title: row.title,
      filePath,
    };
  } catch {
    return null;
  }
}

/** Read the original scan file into memory, or null when it is missing. */
export async function readScanFileBuffer(id: string): Promise<Buffer | null> {
  const data = await resolveScanFile(id);
  if (!data || !fs.existsSync(data.filePath)) return null;
  return fs.readFileSync(data.filePath);
}
