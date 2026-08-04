import fs from "node:fs";
import path from "node:path";
import {
  createActivityLogService,
  createPrismaClient,
  getSystemSettings,
  logAuditEvent,
  prisma,
  resolveEffectiveBackupsPath,
} from "@uwe/database/server";
import { createBrainPrismaClient } from "@uwe/database/brain-client";
import { createFamilyPrismaClient } from "@uwe/database/family-client";
import {
  executeRestore,
  exportBackupJson,
  exportBackupZip,
  createPreRestoreSafetyCopy,
  loadBackupFromBuffer,
  loadBackupFromFile,
  type BackupType,
  type CreateBackupOptions,
} from "@uwe/backup";
import { listStudioBackups } from "../backup-paths";
import { assertNotCancelled, type JobRunnerContext } from "./context";

export async function runBackupJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as BackupCreateBody;
  if (!payload.type) {
    throw new Error("Backup-Typ fehlt im Job-Payload.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 10, "Backup vorbereiten");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const systemSettings = await getSystemSettings();
  const scheduled = Boolean((ctx.job.payload as { scheduled?: boolean } | null)?.scheduled);
  const backupsDir = resolveEffectiveBackupsPath(systemSettings);

  const options: CreateBackupOptions = {
    type: payload.type,
    worldSlug: payload.worldSlug,
    campaignSlug: payload.campaignSlug,
    format: payload.format ?? "zip",
    retentionCount: systemSettings.backup.retentionCount,
    backupsDir,
  };

  if (options.format === "json") {
    const bundle = await exportBackupJson(undefined, options);
    fs.mkdirSync(backupsDir, { recursive: true });
    const filename = `uwe-backup-${payload.type}-${Date.now()}.json`;
    const outputPath = path.join(backupsDir, filename);
    fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf8");

    await createActivityLogService(prisma).log({
      worldSlug: payload.worldSlug ?? null,
      action: "backup_created",
      targetType: "system",
      targetLabel: filename,
      targetHref: "/backup",
      summary: scheduled
        ? `Geplantes Backup erstellt (${payload.type}): ${filename}.`
        : `Backup erstellt (${payload.type}): ${filename}.`,
    });

    await logAuditEvent(prisma, {
      action: "backup_created",
      targetType: "backup",
      targetId: filename,
      metadata: { type: payload.type, format: "json", filename, scheduled },
    });

    return { filename, path: outputPath, manifest: bundle.manifest };
  }

  await ctx.jobs.updateProgress(ctx.jobId, 40, "Daten exportieren");
  const { bundle, outputPath } = await exportBackupZip(undefined, options);
  const filename = path.basename(outputPath);

  await createActivityLogService(prisma).log({
    worldSlug: payload.worldSlug ?? null,
    action: "backup_created",
    targetType: "system",
    targetLabel: filename,
    targetHref: "/backup",
    summary: scheduled
      ? `Geplantes Backup erstellt (${payload.type}): ${filename}.`
      : `Backup erstellt (${payload.type}): ${filename}.`,
  });

  await logAuditEvent(prisma, {
    action: "backup_created",
    targetType: "backup",
    targetId: filename,
    metadata: { type: payload.type, format: "zip", filename, scheduled },
  });

  return { filename, path: outputPath, manifest: bundle.manifest };
}

interface BackupCreateBody {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
  format?: "zip" | "json";
}

export async function runBackupRestoreJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as RestoreJobPayload;
  if (!payload.confirmed) {
    throw new Error("Restore erfordert confirmed: true.");
  }

  const { bundle, zipBuffer } = await loadBackupForRestore(payload);
  const db = createPrismaClient();
  const brainDb = createBrainPrismaClient();
  const familyDb = createFamilyPrismaClient();

  await ctx.jobs.updateProgress(ctx.jobId, 20, "Safety-Backup vor Restore erstellen");
  await assertNotCancelled(ctx.jobs, ctx.jobId);
  const safetyCopy = await createPreRestoreSafetyCopy();

  await ctx.jobs.appendLog(
    ctx.jobId,
    "info",
    `Pre-Restore-Safety-Copy erstellt: ${safetyCopy.filename}`,
  );
  await ctx.jobs.updateProgress(ctx.jobId, 35, "Backup wiederherstellen");

  let result: Awaited<ReturnType<typeof executeRestore>>;
  try {
    result = await executeRestore(
      db,
      brainDb,
      familyDb,
      bundle,
      {
        confirmed: true,
        targetWorldSlug: payload.targetWorldSlug,
        autoResolveSlugConflicts: payload.autoResolveSlugConflicts ?? true,
        allowUpdates: payload.allowUpdates ?? false,
        skipExisting: payload.skipExisting ?? false,
        sendPasswordSetupEmails: payload.sendPasswordSetupEmails ?? false,
        passwordResetRequestUrl:
          process.env.NEXT_PUBLIC_STUDIO_URL?.replace(/\/$/, "") + "/forgot-password",
      },
      zipBuffer,
      process.env.UWE_UPLOADS_ROOT ?? process.env.UPLOADS_DIR,
    );
  } finally {
    await db.$disconnect();
    await brainDb.$disconnect();
    await familyDb.$disconnect();
  }

  await createActivityLogService(prisma).log({
    worldSlug: payload.targetWorldSlug ?? null,
    action: "backup_restored",
    targetType: "system",
    targetLabel: payload.backupId ?? payload.filename ?? null,
    targetHref: "/backup",
    summary: `Backup wiederhergestellt${payload.targetWorldSlug ? ` (Welt ${payload.targetWorldSlug})` : ""}.`,
  });

  await logAuditEvent(prisma, {
    action: "restore_completed",
    targetType: "backup",
    targetId: payload.backupId ?? payload.filename ?? ctx.jobId,
    metadata: {
      targetWorldSlug: payload.targetWorldSlug,
      jobId: ctx.jobId,
      safetyCopyFilename: safetyCopy.filename,
    },
  });

  return { result, safetyCopy };
}

interface RestoreJobPayload {
  backupId?: string;
  contentBase64?: string;
  filename?: string;
  confirmed?: boolean;
  targetWorldSlug?: string;
  autoResolveSlugConflicts?: boolean;
  allowUpdates?: boolean;
  skipExisting?: boolean;
  sendPasswordSetupEmails?: boolean;
}

async function loadBackupForRestore(payload: RestoreJobPayload) {
  if (payload.backupId) {
    const backups = await listStudioBackups();
    const backup = backups.find(
      (entry) => entry.id === payload.backupId || entry.filename === payload.backupId,
    );
    if (!backup) {
      throw new Error("Backup wurde nicht gefunden.");
    }
    return {
      bundle: loadBackupFromFile(backup.path),
      zipBuffer: backup.filename.endsWith(".zip") ? fs.readFileSync(backup.path) : undefined,
    };
  }

  if (payload.contentBase64) {
    const buffer = Buffer.from(payload.contentBase64, "base64");
    return {
      bundle: loadBackupFromBuffer(buffer, payload.filename),
      zipBuffer: payload.filename?.endsWith(".zip") ? buffer : undefined,
    };
  }

  throw new Error("backupId oder contentBase64 ist erforderlich.");
}
