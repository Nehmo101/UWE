import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { resolveAssetFilePath, ZipSecurityError, assertSafeZipEntryName, resolveZipImportPolicy, detectFileKind } from "@uwe/assets";
import type { BackupBundle, BackupManifest } from "./types";
import {
  BACKUP_ASSETS_DIR,
  BACKUP_DATA_FILE,
  BACKUP_MANIFEST_FILE,
  assetZipPath,
} from "./paths";

export function writeBackupZip(
  bundle: BackupBundle,
  outputPath: string,
  uploadsRoot?: string,
): string {
  const zip = new AdmZip();

  zip.addFile(BACKUP_MANIFEST_FILE, Buffer.from(JSON.stringify(bundle.manifest, null, 2), "utf8"));
  zip.addFile(BACKUP_DATA_FILE, Buffer.from(JSON.stringify(bundle.data, null, 2), "utf8"));

  const copiedAssets: string[] = [];

  const uploadStorageKeys = [
    ...bundle.data.assets.map((asset) => asset.storageKey),
    // Capture upload files live under the fixed `_capture` uploads namespace.
    ...(bundle.data.dailyAdmin?.captureEntries ?? [])
      .map((entry) => entry.storageKey)
      .filter((storageKey): storageKey is string => Boolean(storageKey)),
  ];

  for (const storageKey of uploadStorageKeys) {
    const zipEntry = assetZipPath(storageKey);
    try {
      const sourcePath = resolveAssetFilePath(storageKey, uploadsRoot);
      if (fs.existsSync(sourcePath)) {
        zip.addLocalFile(sourcePath, path.dirname(zipEntry), path.basename(zipEntry));
        copiedAssets.push(zipEntry);
      }
    } catch {
      // Missing asset files are reported during preview/restore.
    }
  }

  bundle.manifest.assetFiles = copiedAssets;
  zip.updateFile(BACKUP_MANIFEST_FILE, Buffer.from(JSON.stringify(bundle.manifest, null, 2), "utf8"));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  zip.writeZip(outputPath);
  return outputPath;
}

export function readBackupZip(input: string | Buffer): BackupBundle {
  const zip = Buffer.isBuffer(input) ? new AdmZip(input) : new AdmZip(input);
  return parseBackupZip(zip);
}

export function parseBackupZip(zip: AdmZip): BackupBundle {
  const manifestEntry = zip.getEntry(BACKUP_MANIFEST_FILE);
  const dataEntry = zip.getEntry(BACKUP_DATA_FILE);

  if (!manifestEntry || !dataEntry) {
    throw new Error("Backup-Archiv ist unvollständig (manifest.json oder data.json fehlt).");
  }

  const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as BackupManifest;
  const data = JSON.parse(dataEntry.getData().toString("utf8")) as BackupBundle["data"];

  return { manifest, data };
}

/**
 * Backup archives are restored with the same trust level as a fresh upload, so
 * re-run the upload path's content check. A crafted backup could otherwise
 * smuggle an HTML/SVG/executable asset (the upload path blocks these) that
 * would later be served inline and execute as stored XSS after a restore.
 */
function assertRestorableAssetContent(data: Buffer, entryPath: string): void {
  const detection = detectFileKind(data);
  if (
    detection.kind === "html" ||
    detection.kind === "svg" ||
    detection.kind === "executable"
  ) {
    throw new ZipSecurityError(
      `Backup contains disallowed content in ${entryPath}.`,
      "blocked_content",
    );
  }
}

export function extractBackupAssets(
  zipInput: string | Buffer,
  targetUploadsRoot: string,
  idMap?: Map<string, string>,
): string[] {
  const policy = resolveZipImportPolicy();
  const zipBuffer = Buffer.isBuffer(zipInput) ? zipInput : fs.readFileSync(zipInput);

  if (zipBuffer.length > policy.maxZipBytes) {
    throw new ZipSecurityError(
      `Backup-ZIP überschreitet die maximale Größe von ${policy.maxZipBytes} Bytes.`,
      "zip_too_large",
    );
  }

  const zip = new AdmZip(zipBuffer);
  const bundle = parseBackupZip(zip);
  const copied: string[] = [];
  let totalUncompressed = 0;

  for (const asset of bundle.data.assets) {
    const zipEntryPath = assetZipPath(asset.storageKey);
    assertSafeZipEntryName(zipEntryPath);

    const entry = zip.getEntry(zipEntryPath);
    if (!entry) continue;

    const data = entry.getData();
    totalUncompressed += data.length;
    if (totalUncompressed > policy.maxUncompressedBytes) {
      throw new ZipSecurityError(
        `Entpackter Backup-Inhalt überschreitet ${policy.maxUncompressedBytes} Bytes.`,
        "zip_bomb",
      );
    }
    assertRestorableAssetContent(data, zipEntryPath);

    const mappedWorldId = idMap?.get(asset.worldId) ?? asset.worldId;
    const storageKey = asset.storageKey.replace(asset.worldId, mappedWorldId);
    const targetPath = resolveAssetFilePath(storageKey, targetUploadsRoot);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, data);
    copied.push(storageKey);
  }

  // Capture upload files use the fixed `_capture` namespace — no world-ID remapping needed.
  for (const entry of bundle.data.dailyAdmin?.captureEntries ?? []) {
    if (!entry.storageKey) continue;

    const zipEntryPath = assetZipPath(entry.storageKey);
    assertSafeZipEntryName(zipEntryPath);

    const zipEntry = zip.getEntry(zipEntryPath);
    if (!zipEntry) continue;

    const data = zipEntry.getData();
    totalUncompressed += data.length;
    if (totalUncompressed > policy.maxUncompressedBytes) {
      throw new ZipSecurityError(
        `Entpackter Backup-Inhalt überschreitet ${policy.maxUncompressedBytes} Bytes.`,
        "zip_bomb",
      );
    }
    assertRestorableAssetContent(data, zipEntryPath);

    const targetPath = resolveAssetFilePath(entry.storageKey, targetUploadsRoot);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, data);
    copied.push(entry.storageKey);
  }

  return copied;
}

export function listZipAssetEntries(zipInput: string | Buffer): string[] {
  const zip = Buffer.isBuffer(zipInput) ? new AdmZip(zipInput) : new AdmZip(zipInput);
  return zip
    .getEntries()
    .map((entry) => entry.entryName)
    .filter((name) => name.startsWith(`${BACKUP_ASSETS_DIR}/`));
}
