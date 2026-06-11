import fs from "node:fs";
import path from "node:path";
import { createPrismaClient } from "@uwe/database/server";
import { collectBackupData } from "./collect";
import { readBackupZip, writeBackupZip } from "./archive";
import { findSecretIssuesInJson } from "./sanitize";
import {
  buildBackupFilename,
  ensureBackupsDir,
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
    const { data, stats } = await collectBackupData(db, {
      type: options.type,
      worldSlug: options.worldSlug,
      campaignSlug: options.campaignSlug,
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
      stats,
      assetFiles: [],
    };

    const json = JSON.stringify(data);
    const secretIssues = findSecretIssuesInJson(json);
    if (secretIssues.length > 0) {
      throw new Error(`Backup enthält sensible Daten: ${secretIssues.join(", ")}`);
    }

    return { manifest, data };
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

export async function exportBackupZip(
  databaseUrl: string | undefined,
  options: CreateBackupOptions,
): Promise<{ bundle: BackupBundle; outputPath: string }> {
  const bundle = await createBackupBundle(databaseUrl, options);
  const backupsDir = ensureBackupsDir(options.outputDir);
  const filename = buildBackupFilename(bundle.manifest).replace(/\.zip$/, ".json");

  if (options.format === "json") {
    const jsonPath = path.join(backupsDir, filename);
    fs.writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), "utf8");
    return { bundle, outputPath: jsonPath };
  }

  const zipFilename = buildBackupFilename(bundle.manifest);
  const outputPath = path.join(backupsDir, zipFilename);
  writeBackupZip(bundle, outputPath, options.uploadsRoot);
  return { bundle, outputPath };
}

export function listStoredBackups(backupsDir?: string): StoredBackupInfo[] {
  const dir = ensureBackupsDir(backupsDir);
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /\.(zip|json)$/i.test(entry.name))
    .map((entry) => {
      const filePath = path.join(dir, entry.name);
      const stat = fs.statSync(filePath);

      if (entry.name.endsWith(".json")) {
        const bundle = JSON.parse(fs.readFileSync(filePath, "utf8")) as BackupBundle;
        return {
          id: entry.name,
          filename: entry.name,
          path: filePath,
          manifest: bundle.manifest,
          size: stat.size,
          createdAt: bundle.manifest.createdAt,
        };
      }

      const bundle = readBackupZip(filePath);
      return {
        id: entry.name,
        filename: entry.name,
        path: filePath,
        manifest: bundle.manifest,
        size: stat.size,
        createdAt: bundle.manifest.createdAt,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadBackupFromFile(filePath: string): BackupBundle {
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as BackupBundle;
    if (!parsed.manifest || !parsed.data) {
      throw new Error("JSON-Backup hat ein ungültiges Format.");
    }
    return parsed;
  }

  return readBackupZip(filePath);
}

export function loadBackupFromBuffer(buffer: Buffer, filename?: string): BackupBundle {
  if (filename?.endsWith(".json")) {
    const parsed = JSON.parse(buffer.toString("utf8")) as BackupBundle;
    if (!parsed.manifest || !parsed.data) {
      throw new Error("JSON-Backup hat ein ungültiges Format.");
    }
    return parsed;
  }

  return readBackupZip(buffer);
}
