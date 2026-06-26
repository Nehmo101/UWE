import { NextResponse } from "next/server";
import fs from "node:fs";
import {
  createActivityLogService,
  createJobService,
  createPrismaClient,
  logAuditEvent,
  prisma,
} from "@uwe/database/server";
import {
  canCreateBackup,
  canDownloadBackup,
  canPreviewRestore,
  canRestoreBackup,
  listStoredBackups,
  loadBackupFromBuffer,
  loadBackupFromFile,
  normalizeRetentionCount,
  previewRestoreOnly,
  type BackupType,
} from "@uwe/backup";
import type { UweRole } from "@uwe/auth";
import { getUserFromRequestCookieHeader } from "./auth-session";
import { enqueueAndDispatch, runJob } from "./job-executor";
import { jsonError } from "./api-response";

export interface BackupCreateBody {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
  format?: "zip" | "json";
  sync?: boolean;
}

export async function getBackupList() {
  const backups = listStoredBackups();
  return NextResponse.json({ backups });
}

export async function getBackupPermissions(request: Request) {
  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  const role: UweRole = (user?.role as UweRole | undefined) ?? "guest";
  return NextResponse.json({
    role,
    canCreate: canCreateBackup(role),
    canDownload: canDownloadBackup(role),
    canRestore: canRestoreBackup(role),
    canPreview: canPreviewRestore(role),
    retentionCount: normalizeRetentionCount(process.env.UWE_BACKUP_RETENTION),
    encryptionConfigured: !!process.env.UWE_BACKUP_ENCRYPTION_KEY,
  });
}

function backupJobTitle(body: BackupCreateBody): string {
  const scope =
    body.type === "full"
      ? "Vollbackup"
      : body.type === "world"
        ? `Welt ${body.worldSlug}`
        : `Kampagne ${body.campaignSlug}`;
  return `Backup: ${scope}`;
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

  try {
    if (body.sync) {
      const jobs = createJobService(prisma);
      const job = await jobs.enqueue({
        type: "backup",
        title: backupJobTitle(body),
        worldSlug: body.worldSlug,
        payload: {
          type: body.type,
          worldSlug: body.worldSlug,
          campaignSlug: body.campaignSlug,
          format: body.format ?? "zip",
        },
      });
      const completed = await runJob(job.id);
      if (completed?.status === "failed") {
        return NextResponse.json({ error: completed.errorMessage ?? "Backup fehlgeschlagen." }, { status: 500 });
      }
      const result = completed?.result as { filename?: string; path?: string; manifest?: unknown } | null;
      return NextResponse.json({
        job: completed,
        backup: result
          ? {
              id: result.filename,
              filename: result.filename,
              path: result.path,
              manifest: result.manifest,
            }
          : null,
      });
    }

    const job = await enqueueAndDispatch({
      type: "backup",
      title: backupJobTitle(body),
      worldSlug: body.worldSlug,
      payload: {
        type: body.type,
        worldSlug: body.worldSlug,
        campaignSlug: body.campaignSlug,
        format: body.format ?? "zip",
      },
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backup-Erstellung fehlgeschlagen.";
    await createActivityLogService(prisma).log({
      action: "error",
      targetType: "system",
      summary: `Backup-Erstellung fehlgeschlagen: ${message}`,
    });
    return NextResponse.json({ error: message }, { status: 500 });
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
  sync?: boolean;
  sendPasswordSetupEmails?: boolean;
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
    const title = body.targetWorldSlug
      ? `Restore: Welt ${body.targetWorldSlug}`
      : "Restore: Backup";

    if (body.sync) {
      const jobs = createJobService(prisma);
      const job = await jobs.enqueue({
        type: "backup_restore",
        title,
        worldSlug: body.targetWorldSlug,
        payload: body as unknown as Record<string, unknown>,
        maxAttempts: 1,
      });

      await logAuditEvent(prisma, {
        action: "restore_started",
        targetType: "backup",
        targetId: job.id,
        metadata: {
          backupId: body.backupId,
          targetWorldSlug: body.targetWorldSlug,
          sync: true,
        },
      });

      const completed = await runJob(job.id);
      if (completed?.status === "failed") {
        return NextResponse.json(
          { error: completed.errorMessage ?? "Restore fehlgeschlagen." },
          { status: 500 },
        );
      }
      return NextResponse.json({ job: completed, result: completed?.result });
    }

    const job = await enqueueAndDispatch({
      type: "backup_restore",
      title,
      worldSlug: body.targetWorldSlug,
      payload: body as unknown as Record<string, unknown>,
      maxAttempts: 1,
    });

    await logAuditEvent(prisma, {
      action: "restore_started",
      targetType: "backup",
      targetId: job.id,
      metadata: {
        backupId: body.backupId,
        targetWorldSlug: body.targetWorldSlug,
        async: true,
      },
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore fehlgeschlagen.";
    await createActivityLogService(prisma).log({
      action: "error",
      targetType: "system",
      summary: `Restore fehlgeschlagen: ${message}`,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
