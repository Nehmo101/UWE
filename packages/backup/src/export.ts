import fs from "node:fs";
import path from "node:path";
import { createPrismaClient } from "@uwe/database/server";
import { collectBackupData } from "./collect";
import { readBackupZip, writeBackupZip } from "./archive";
import { writeFileAtomic } from "./atomic-write";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  encryptionKeyConfigured,
  isEncryptedBackupPayload,
} from "./encrypt";
import { applyBackupRetention, normalizeRetentionCount } from "./retention";
import { validateBackupBundleOrThrow } from "./validate";
import {
  buildBackupFilename,
  resolveBackupsDirectory,
  resolveBackupsDir,
  resolveSchemaVersion,
} from "./paths";
import type {
  BackupBundle,
  BackupManifest,
  CreateBackupOptions,
  StoredBackupInfo,
} from "./types";

const UWE_VERSION = "0.1.0";

export async function createBackupBundle(
  databaseUrl: string | undefined,
  options: CreateBackupOptions,
): Promise<BackupBundle> {
  const db = createPrismaClient(databaseUrl);

  try {
    const { data, stats, settings } = await collectBackupData(db, {
      type: options.type,
      worldSlug: options.worldSlug,
      campaignSlug: options.campaignSlug,
      includePlayerNotes: options.includePlayerNotes,
    });

    const manifest: BackupManifest = {
      version: "1.0",
      uweVersion: UWE_VERSION,
      schemaVersion: resolveSchemaVersion(),
      type: options.type,
      createdAt: new Date().toISOString(),
      worldSlug: options.worldSlug,
      campaignSlug: options.campaignSlug,
      includesUsers: data.users.length > 0,
      includesAuthSessions: false,
      includesSettings: Boolean(settings),
      includesPlayerNotes: Boolean(options.includePlayerNotes && (data.playerNotes?.length ?? 0) > 0),
      shareLinkTokensRegenerated: (data.shareLinks?.length ?? 0) > 0,
      encrypted: Boolean(options.encrypt || encryptionKeyConfigured()),
      stats,
      assetFiles: [],
    };

    const bundle: BackupBundle = { manifest, data, settings };
    validateBackupBundleOrThrow(bundle);
    return bundle;
  } finally {
    await db.$disconnect();
  }
}

export async function exportBackupJson(
  databaseUrl: string | undefined,
  options: CreateBackupOptions,
): Promise<BackupBundle> {
  return createBackupBundle(databaseUrl, options);
}

function shouldEncrypt(options: CreateBackupOptions): boolean {
  return Boolean(options.encrypt || encryptionKeyConfigured() || options.encryptionPassword);
}

function writeEncryptedOrPlain(
  outputPath: string,
  content: Buffer,
  options: CreateBackupOptions,
): void {
  if (shouldEncrypt(options)) {
    const encrypted = encryptBackupPayload(content, {
      password: options.encryptionPassword,
    });
    writeFileAtomic(outputPath, encrypted);
    return;
  }

  writeFileAtomic(outputPath, content);
}

export async function exportBackupZip(
  databaseUrl: string | undefined,
  options: CreateBackupOptions,
): Promise<{ bundle: BackupBundle; outputPath: string }> {
  const bundle = await createBackupBundle(databaseUrl, options);
  const backupsDir = resolveBackupsDirectory({
    backupsDir: options.backupsDir,
    baseDir: options.outputDir,
  });
  const filename = buildBackupFilename(bundle.manifest).replace(/\.zip$/, ".json");

  if (options.format === "json") {
    const jsonPath = path.join(backupsDir, filename);
    const jsonContent = Buffer.from(JSON.stringify(bundle, null, 2), "utf8");
    writeEncryptedOrPlain(jsonPath, jsonContent, options);
    return { bundle, outputPath: jsonPath };
  }

  const zipFilename = buildBackupFilename(bundle.manifest);
  const outputPath = path.join(backupsDir, zipFilename);
  const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  writeBackupZip(bundle, tempPath, options.uploadsRoot);
  const zipBuffer = fs.readFileSync(tempPath);

  if (shouldEncrypt(options)) {
    const encrypted = encryptBackupPayload(zipBuffer, {
      password: options.encryptionPassword,
    });
    writeFileAtomic(outputPath + ".enc", encrypted);
    fs.unlinkSync(tempPath);
    return { bundle, outputPath: outputPath + ".enc" };
  }

  fs.renameSync(tempPath, outputPath);

  const retention = normalizeRetentionCount(options.retentionCount);
  const backups = listStoredBackups(backupsDir);
  applyBackupRetention(backups, retention);

  return { bundle, outputPath };
}

function parseStoredBackupEntry(dir: string, entry: fs.Dirent): StoredBackupInfo | null {
  const filePath = path.join(dir, entry.name);
  const stat = fs.statSync(filePath);
  const raw = fs.readFileSync(filePath);

  if (entry.name.endsWith(".enc")) {
    return {
      id: entry.name,
      filename: entry.name,
      path: filePath,
      manifest: {
        version: "1.0" as const,
        uweVersion: UWE_VERSION,
        schemaVersion: "unknown",
        type: "full" as const,
        createdAt: stat.mtime.toISOString(),
        includesUsers: false,
        includesAuthSessions: false,
        includesSettings: false,
        encrypted: true,
        stats: {
          worlds: 0,
          campaigns: 0,
          pages: 0,
          contentBlocks: 0,
          pageLinks: 0,
          assets: 0,
          gameSessions: 0,
          labels: 0,
          labelTemplates: 0,
          printLists: 0,
          soundboardButtons: 0,
          pageTemplates: 0,
          worldMemberships: 0,
          shareLinks: 0,
          playerNotes: 0,
        },
        assetFiles: [],
      },
      size: stat.size,
      createdAt: stat.mtime.toISOString(),
    };
  }

  const content = isEncryptedBackupPayload(raw) ? decryptBackupPayload(raw) : raw;

  if (entry.name.endsWith(".json")) {
    const bundle = JSON.parse(content.toString("utf8")) as BackupBundle;
    validateBackupBundleOrThrow(bundle);
    return {
      id: entry.name,
      filename: entry.name,
      path: filePath,
      manifest: bundle.manifest,
      size: stat.size,
      createdAt: bundle.manifest.createdAt,
    };
  }

  const bundle = readBackupZip(content);
  validateBackupBundleOrThrow(bundle);
  return {
    id: entry.name,
    filename: entry.name,
    path: filePath,
    manifest: bundle.manifest,
    size: stat.size,
    createdAt: bundle.manifest.createdAt,
  };
}

export function listStoredBackups(explicitBackupsDir?: string): StoredBackupInfo[] {
  const dir = explicitBackupsDir ?? resolveBackupsDir();

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    if (!fs.existsSync(dir)) {
      return [];
    }
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(
      (entry) =>
        entry.isFile() && /\.(zip|json|enc)$/i.test(entry.name) && !entry.name.startsWith("."),
    )
    .flatMap((entry) => {
      try {
        const parsed = parseStoredBackupEntry(dir, entry);
        return parsed ? [parsed] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function loadRawBackupFile(
  filePath: string,
  encryptionPassword?: string,
): { bundle: BackupBundle; zipBuffer?: Buffer } {
  const raw = fs.readFileSync(filePath);
  const decrypted = isEncryptedBackupPayload(raw)
    ? decryptBackupPayload(raw, { password: encryptionPassword })
    : raw;

  if (filePath.endsWith(".json")) {
    const bundle = JSON.parse(decrypted.toString("utf8")) as BackupBundle;
    validateBackupBundleOrThrow(bundle);
    return { bundle };
  }

  const bundle = readBackupZip(decrypted);
  validateBackupBundleOrThrow(bundle);
  return {
    bundle,
    zipBuffer: filePath.endsWith(".zip") ? decrypted : undefined,
  };
}

export function loadBackupFromFile(
  filePath: string,
  encryptionPassword?: string,
): BackupBundle {
  return loadRawBackupFile(filePath, encryptionPassword).bundle;
}

export function loadBackupFromBuffer(
  buffer: Buffer,
  filename?: string,
  encryptionPassword?: string,
): BackupBundle {
  const decrypted = isEncryptedBackupPayload(buffer)
    ? decryptBackupPayload(buffer, { password: encryptionPassword })
    : buffer;

  if (filename?.endsWith(".json")) {
    const bundle = JSON.parse(decrypted.toString("utf8")) as BackupBundle;
    validateBackupBundleOrThrow(bundle);
    return bundle;
  }

  const bundle = readBackupZip(decrypted);
  validateBackupBundleOrThrow(bundle);
  return bundle;
}

export function loadBackupZipBufferFromFile(
  filePath: string,
  encryptionPassword?: string,
): Buffer | undefined {
  const raw = fs.readFileSync(filePath);
  const decrypted = isEncryptedBackupPayload(raw)
    ? decryptBackupPayload(raw, { password: encryptionPassword })
    : raw;

  if (filePath.endsWith(".zip") || filePath.endsWith(".enc")) {
    return decrypted;
  }

  return undefined;
}
