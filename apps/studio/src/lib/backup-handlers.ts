import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createPrismaClient } from "@uwe/database/server";
import {
  executeRestore,
  exportBackupJson,
  exportBackupZip,
  listStoredBackups,
  loadBackupFromBuffer,
  loadBackupFromFile,
  previewRestoreOnly,
  resolveBackupsDir,
  type BackupType,
  type CreateBackupOptions,
} from "@uwe/backup";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export interface BackupCreateBody {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
  format?: "zip" | "json";
}

export async function getBackupList() {
  const backups = listStoredBackups();
  return NextResponse.json({ backups });
}

export async function postBackupCreate(body: BackupCreateBody) {
  if (!body.type) {
    return jsonError("type ist erforderlich.");
  }

  if ((body.type === "world" || body.type === "campaign") && !body.worldSlug) {
    return jsonError("worldSlug ist für Welt- und Kampagnen-Backups erforderlich.");
  }

  if (body.type === "campaign" && !body.campaignSlug) {
    return jsonError("campaignSlug ist für Kampagnen-Backups erforderlich.");
  }

  const options: CreateBackupOptions = {
    type: body.type,
    worldSlug: body.worldSlug,
    campaignSlug: body.campaignSlug,
    format: body.format ?? "zip",
  };

  try {
    if (options.format === "json") {
      const bundle = await exportBackupJson(undefined, options);
      const backupsDir = resolveBackupsDir();
      fs.mkdirSync(backupsDir, { recursive: true });
      const filename = `uwe-backup-${body.type}-${Date.now()}.json`;
      const outputPath = path.join(backupsDir, filename);
      fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf8");
      return NextResponse.json({
        backup: {
          id: filename,
          filename,
          path: outputPath,
          manifest: bundle.manifest,
        },
      });
    }

    const { bundle, outputPath } = await exportBackupZip(undefined, options);
    return NextResponse.json({
      backup: {
        id: path.basename(outputPath),
        filename: path.basename(outputPath),
        path: outputPath,
        manifest: bundle.manifest,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Backup-Erstellung fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}

export async function getBackupDownload(backupId: string) {
  const backups = listStoredBackups();
  const backup = backups.find((entry) => entry.id === backupId || entry.filename === backupId);

  if (!backup || !fs.existsSync(backup.path)) {
    return jsonError("Backup wurde nicht gefunden.", 404);
  }

  const buffer = fs.readFileSync(backup.path);
  const contentType = backup.filename.endsWith(".json")
    ? "application/json"
    : "application/zip";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${backup.filename}"`,
    },
  });
}

export interface RestoreRequestBody {
  backupId?: string;
  contentBase64?: string;
  filename?: string;
  confirmed?: boolean;
  targetWorldSlug?: string;
  autoResolveSlugConflicts?: boolean;
  allowUpdates?: boolean;
  skipExisting?: boolean;
}

async function loadBackupFromRequest(body: RestoreRequestBody) {
  if (body.backupId) {
    const backups = listStoredBackups();
    const backup = backups.find(
      (entry) => entry.id === body.backupId || entry.filename === body.backupId,
    );
    if (!backup) {
      throw new Error("Backup wurde nicht gefunden.");
    }
    return {
      bundle: loadBackupFromFile(backup.path),
      zipBuffer: backup.filename.endsWith(".zip") ? fs.readFileSync(backup.path) : undefined,
      filename: backup.filename,
    };
  }

  if (body.contentBase64) {
    const buffer = Buffer.from(body.contentBase64, "base64");
    return {
      bundle: loadBackupFromBuffer(buffer, body.filename),
      zipBuffer: body.filename?.endsWith(".zip") ? buffer : undefined,
      filename: body.filename,
    };
  }

  throw new Error("backupId oder contentBase64 ist erforderlich.");
}

export async function postRestorePreview(body: RestoreRequestBody) {
  try {
    const { bundle } = await loadBackupFromRequest(body);
    const db = createPrismaClient();
    const preview = await previewRestoreOnly(db, bundle, body.targetWorldSlug);
    await db.$disconnect();
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Restore-Vorschau fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}

export async function postRestoreExecute(body: RestoreRequestBody) {
  if (!body.confirmed) {
    return jsonError("Restore erfordert confirmed: true. Führe zuerst eine Vorschau durch.");
  }

  try {
    const { bundle, zipBuffer } = await loadBackupFromRequest(body);
    const db = createPrismaClient();

    const result = await executeRestore(
      db,
      bundle,
      {
        confirmed: true,
        targetWorldSlug: body.targetWorldSlug,
        autoResolveSlugConflicts: body.autoResolveSlugConflicts ?? true,
        allowUpdates: body.allowUpdates ?? false,
        skipExisting: body.skipExisting ?? false,
      },
      zipBuffer,
      process.env.UWE_UPLOADS_ROOT ?? process.env.UPLOADS_DIR,
    );

    await db.$disconnect();
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Restore fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}
