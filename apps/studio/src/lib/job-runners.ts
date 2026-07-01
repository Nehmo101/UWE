import fs from "node:fs";
import path from "node:path";
import {
  createActivityLogService,
  createAiReviewService,
  createAiRunServiceFromClient,
  createBrainStoreService,
  buildCaptureAiProposal,
  createCaptureTriageService,
  createLifeAdminService,
  createMailService,
  createPersonalBrainService,
  createPrismaClient,
  createUndoService,
  createUweRepository,
  createWorldInspectorService,
  getSystemSettings,
  logAuditEvent,
  prisma,
  resolveEffectiveBackupsPath,
  resolveLocalOnlyMode,
  type JobService,
  type JobView,
} from "@uwe/database/server";
import {
  AI_TASK_LABELS,
  generateAiTaskBySlug,
  indexBrainDocument,
  indexPersonalBrainDocument,
  isBrainActionId,
  reindexBrainWorld,
  reindexPersonalBrain,
  resolveAiBrainSettings,
  runBrainAction,
  buildRtxCaptureProposalPrompt,
  parseRtxCaptureProposalResponse,
  type AiProviderId,
  type AiTaskType,
} from "@uwe/ai-brain";
import { createApiKeyStore } from "./ai-key-store";
import {
  executeImport,
  parseImportContent,
  type ImportExecuteOptions,
  type ImportFormat,
} from "@uwe/knoteforge-import";
import { resolveGatewayUserById } from "./ai-gateway-user";
import {
  runAgentJob,
  runCalendarSyncJob,
  runImageStudioJob,
  runMailSyncJob,
  runResearchJob,
} from "./integration-job-runners";
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
import { listStudioBackups } from "./backup-paths";

export interface JobRunnerContext {
  jobs: JobService;
  jobId: string;
  job: JobView;
}

async function assertNotCancelled(jobs: JobService, jobId: string): Promise<void> {
  if (await jobs.isCancelled(jobId)) {
    throw new Error("Job wurde abgebrochen.");
  }
}

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

export interface BackupCreateBody {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
  format?: "zip" | "json";
}

export async function runImportJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as ImportJobPayload;
  if (!payload.format || !payload.content || !payload.worldSlug) {
    throw new Error("Import-Payload unvollständig.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 15, "Import-Datei lesen");
  const repo = createUweRepository();
  const { bundle } = parseImportContent(payload.format, payload.content);

  const options: ImportExecuteOptions = {
    confirmed: true,
    itemIds: payload.itemIds,
    autoResolveSlugConflicts: payload.autoResolveSlugConflicts ?? true,
    allowUpdates: payload.allowUpdates ?? true,
  };

  await ctx.jobs.updateProgress(ctx.jobId, 50, "Daten importieren");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const result = await executeImport(repo, bundle, payload.worldSlug, payload.format, options);
  const world = await repo.getWorldBySlug(payload.worldSlug);

  let undoEntryId: string | undefined;
  if (result.undo && world && (result.undo.createdPageIds.length > 0 || result.undo.updatedPages.length > 0)) {
    const undoService = createUndoService(prisma);
    const undoEntry = await undoService.captureImportExecute({
      worldId: world.id,
      jobId: ctx.jobId,
      createdPageIds: result.undo.createdPageIds,
      updatedPages: result.undo.updatedPages as import("@uwe/database/server").ImportPageUpdateSnapshot[],
    });
    undoEntryId = undoEntry.id;
  }

  await createActivityLogService(prisma).log({
    worldSlug: payload.worldSlug,
    action: "import_executed",
    targetType: "world",
    targetLabel: payload.worldSlug,
    targetHref: `/worlds/${payload.worldSlug}`,
    summary: `Import (${payload.format}) in Welt „${payload.worldSlug}" ausgeführt.`,
    undoEntryId,
  });

  await logAuditEvent(prisma, {
    action: "import_completed",
    targetType: "import",
    targetId: ctx.jobId,
    worldId: world?.id,
    metadata: { format: payload.format, jobId: ctx.jobId },
  });

  return { result };
}

export interface ImportJobPayload {
  format: ImportFormat;
  content: string;
  worldSlug: string;
  itemIds?: string[];
  autoResolveSlugConflicts?: boolean;
  allowUpdates?: boolean;
}

export async function runBrainActionJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as BrainActionJobPayload;
  if (!payload.actionId || !payload.worldSlug || !payload.pageSlug || !payload.providerId || !payload.model) {
    throw new Error("Brain-Aktions-Job-Payload unvollständig.");
  }

  if (!isBrainActionId(payload.actionId)) {
    throw new Error(`Unbekannte Brain-Aktion: ${payload.actionId}`);
  }

  const overrides = await getAiSettingsOverrides();
  const settings = resolveAiBrainSettings(await createApiKeyStore(), overrides);
  const useMock = payload.useMock ?? process.env.AI_USE_MOCK === "true";
  const deps = {
    repo: createUweRepository(),
    aiRuns: createAiRunServiceFromClient(prisma),
    brainStore: createBrainStoreService(),
  };

  await ctx.jobs.updateProgress(ctx.jobId, 15, "Brain-Aktion starten");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);

  const result = await runBrainAction(deps, {
    actionId: payload.actionId,
    worldSlug: payload.worldSlug,
    pageSlug: payload.pageSlug,
    providerId: payload.providerId,
    model: payload.model,
    userPrompt: payload.userPrompt,
    sessionId: payload.sessionId,
    userId: ctx.job.userId ?? undefined,
    gatewayUser: gatewayUser ?? undefined,
    useMock,
    options: {
      allowDmOnly: settings.localOnly,
      datenschutzMode: settings.datenschutzMode,
      localOnly: settings.localOnly,
    },
  });

  await prisma.job.update({
    where: { id: ctx.jobId },
    data: { relatedType: "ai_run", relatedId: result.runId },
  });

  const review = createAiReviewService(prisma);
  await review.syncJsonProposalsFromRun(result.runId, result.proposals);

  const run = await deps.aiRuns.getById(result.runId);
  await ctx.jobs.updateProgress(ctx.jobId, 100, "Brain-Aktion abgeschlossen");

  return {
    runId: result.runId,
    run,
    context: result.context,
    result: result.result,
    proposals: result.proposals,
  };
}

async function getAiSettingsOverrides() {
  const systemSettings = await getSystemSettings();
  return {
    localOnly: resolveLocalOnlyMode(systemSettings),
    enabled: systemSettings.ai.enabled,
  };
}

export interface BrainActionJobPayload {
  actionId: string;
  worldSlug: string;
  pageSlug: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  sessionId?: string;
  allowDmOnly?: boolean;
  useMock?: boolean;
}

export interface DeferredAiPromptJobPayload {
  deferredAiPrompt: true;
  prompt: string;
  providerMode: "auto" | "local_rtx" | "cloud";
  contextMode:
    | "general_chat"
    | "brain"
    | "current_object"
    | "current_object_plus_brain"
    | "personal_brain";
  worldSlug?: string;
  pageSlug?: string;
  useMock?: boolean;
}

async function runDeferredAiPromptJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as DeferredAiPromptJobPayload;
  if (!payload.prompt?.trim()) {
    throw new Error("Deferred KI-Prompt ohne prompt.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 10, "Warte auf RTX…");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);
  if (!gatewayUser) {
    throw new Error("Deferred KI-Prompt: job.userId fehlt — Gateway-Kontext nicht verfügbar.");
  }

  const { executeAiPrompt } = await import("./ai-prompt-handlers");
  const result = await executeAiPrompt(
    {
      prompt: payload.prompt,
      providerMode: payload.providerMode,
      contextMode: payload.contextMode,
      worldSlug: payload.worldSlug,
      pageSlug: payload.pageSlug,
      useMock: payload.useMock,
    },
    gatewayUser,
  );

  if (result.kind === "deferred") {
    throw new Error("RTX weiterhin offline — Job wird erneut versucht.");
  }

  await ctx.jobs.updateProgress(ctx.jobId, 100, "KI-Prompt abgeschlossen");
  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    routedVia: result.routedVia,
    contextMode: result.contextMode,
  };
}

async function runCaptureTriageProposalJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { captureId?: string; useMock?: boolean };
  const captureId = payload.captureId;
  if (!captureId) {
    throw new Error("captureId fehlt im Capture-Triage-Job.");
  }

  const lifeAdmin = createLifeAdminService(prisma);
  const capture = await lifeAdmin.getCapture(captureId);
  if (!capture) {
    throw new Error(`Capture ${captureId} nicht gefunden.`);
  }

  const fallback = buildCaptureAiProposal(capture);
  const prompt = buildRtxCaptureProposalPrompt({
    title: capture.title,
    content: capture.content,
    captureType: capture.captureType,
    url: capture.url,
  });

  await ctx.jobs.updateProgress(ctx.jobId, 20, "RTX-Klassifikation…");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);
  if (!gatewayUser) {
    throw new Error("Capture-Triage: job.userId fehlt — Gateway-Kontext nicht verfügbar.");
  }

  const { executeAiPrompt } = await import("./ai-prompt-handlers");
  const result = await executeAiPrompt(
    {
      prompt,
      providerMode: "local_rtx",
      contextMode: "general_chat",
      useMock: payload.useMock ?? process.env.AI_USE_MOCK === "true",
    },
    gatewayUser,
  );

  if (result.kind === "deferred") {
    throw new Error("RTX offline — Capture-Vorschlag wird erneut versucht.");
  }

  const proposal = parseRtxCaptureProposalResponse(result.text, fallback);
  await createCaptureTriageService(prisma).applyAiProposal(captureId, proposal);
  await ctx.jobs.updateProgress(ctx.jobId, 100, "Capture-Vorschlag aktualisiert");
  return { captureId, source: proposal.source, suggestedTarget: proposal.suggestedTarget };
}

export async function runAiRunJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as AiRunJobPayload &
    BrainActionJobPayload &
    DeferredAiPromptJobPayload;
  if (payload.deferredAiPrompt) {
    return runDeferredAiPromptJob(ctx);
  }
  if (payload.actionId) {
    return runBrainActionJob(ctx);
  }
  if ((payload as { captureTriageProposal?: boolean; captureId?: string }).captureTriageProposal) {
    return runCaptureTriageProposalJob(ctx);
  }
  if (!payload.taskType || !payload.worldSlug || !payload.pageSlug || !payload.providerId || !payload.model) {
    throw new Error("KI-Job-Payload unvollständig.");
  }

  const repo = createUweRepository();
  const aiRuns = createAiRunServiceFromClient(prisma);
  const review = createAiReviewService(prisma);
  const systemSettings = await getSystemSettings();
  const overrides = {
    localOnly: resolveLocalOnlyMode(systemSettings),
    enabled: systemSettings.ai.enabled,
  };
  const settings = resolveAiBrainSettings(await createApiKeyStore(), overrides);
  const useMock = payload.useMock ?? process.env.AI_USE_MOCK === "true";

  const world = await repo.getWorldBySlug(payload.worldSlug);
  const page = await repo.getPageBySlug(payload.worldSlug, payload.pageSlug);
  if (!world || !page) {
    throw new Error("Welt oder Seite nicht gefunden.");
  }

  if (payload.discardProposalId) {
    await review.discardProposal(payload.discardProposalId, { action: "rerun" });
  }

  const aiRun = await aiRuns.create({
    worldId: world.id,
    pageId: page.id,
    gameSessionId: payload.sessionId ?? null,
    source: "job_queue",
    taskType: payload.taskType,
    provider: payload.providerId,
    model: payload.model,
    userPrompt: payload.userPrompt ?? null,
    targetType: "page",
    targetId: page.id,
  });

  await prisma.job.update({
    where: { id: ctx.jobId },
    data: { relatedType: "ai_run", relatedId: aiRun.id },
  });

  await ctx.jobs.appendLog(
    ctx.jobId,
    "info",
    `AI Run ${aiRun.id} angelegt (${AI_TASK_LABELS[payload.taskType]}).`,
  );

  await aiRuns.markRunning(aiRun.id);
  await ctx.jobs.updateProgress(ctx.jobId, 20, "Kontext sammeln");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const started = Date.now();

  let gatewayUser: { userId: string; role: string } | undefined;
  const resolved = await resolveGatewayUserById(ctx.job.userId);
  if (resolved) {
    gatewayUser = resolved;
  }

  try {
    const generated = await generateAiTaskBySlug(repo, {
      taskType: payload.taskType,
      worldSlug: payload.worldSlug,
      pageSlug: payload.pageSlug,
      providerId: payload.providerId,
      model: payload.model,
      userPrompt: payload.userPrompt,
      user: gatewayUser,
      feature: "AI_DND_USE",
      options: {
        allowDmOnly: settings.localOnly,
        datenschutzMode: settings.datenschutzMode,
        localOnly: settings.localOnly,
        sessionId: payload.sessionId,
      },
      apiKeyStore: await createApiKeyStore(),
      useMock,
    }) as Awaited<ReturnType<typeof generateAiTaskBySlug>> & {
      prompts: { systemPrompt: string; userPrompt: string };
    };

    const { context, result, prompts } = generated;
    const durationMs = Date.now() - started;

    const completedRun = await aiRuns.markCompleted(aiRun.id, {
      resultText: result.text,
      resultMeta: {
        finishReason: result.finishReason ?? null,
        provider: result.provider,
        model: result.model,
      },
      contextData: JSON.parse(JSON.stringify(context)),
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      durationMs,
    });

    const { proposal } = await review.createProposalFromRun({
      aiRunId: completedRun.id,
      worldId: world.id,
      pageId: page.id,
      sessionId: payload.sessionId,
      taskType: payload.taskType,
      resultText: result.text,
    });

    await ctx.jobs.updateProgress(ctx.jobId, 100, "KI-Aufgabe abgeschlossen");

    return {
      aiRunId: completedRun.id,
      runId: completedRun.id,
      context,
      result,
      proposal,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "KI-Aufgabe fehlgeschlagen.";
    await aiRuns.markFailed(aiRun.id, {
      errorMessage: message,
      durationMs,
    });
    throw error;
  }
}

export interface AiRunJobPayload {
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  allowDmOnly?: boolean;
  sessionId?: string;
  useMock?: boolean;
  discardProposalId?: string;
}

export interface MailSendJobPayload {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  text?: string;
  html?: string;
  worldId?: string | null;
  templateId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  confirmDmOnly?: boolean;
  containsDmOnlyHint?: boolean;
}

export async function runMailSendJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as MailSendJobPayload;
  if (!payload.to?.length || !payload.subject) {
    throw new Error("Mail-Payload unvollständig (Empfänger/Betreff fehlen).");
  }

  const mailService = createMailService(prisma);

  await ctx.jobs.updateProgress(ctx.jobId, 30, "Mail versenden");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const outcome = await mailService.sendMail({
    to: payload.to,
    subject: payload.subject,
    bodyText: payload.bodyText ?? payload.text ?? "",
    bodyHtml: payload.bodyHtml ?? payload.html,
    worldId: payload.worldId ?? null,
    templateId: payload.templateId ?? null,
    sourceType: payload.sourceType ?? null,
    sourceId: payload.sourceId ?? null,
    confirmDmOnly: payload.confirmDmOnly,
    containsDmOnlyHint: payload.containsDmOnlyHint,
  });

  if (!outcome.ok) {
    throw new Error(outcome.error ?? "Mail-Versand fehlgeschlagen.");
  }

  return {
    logId: outcome.log.id,
    status: outcome.log.status,
  };
}

export async function runEmbeddingJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as {
    documentId?: string;
    personalBrainDocumentId?: string;
    reindexPersonalBrain?: boolean;
    useMock?: boolean;
  };

  await ctx.jobs.updateProgress(ctx.jobId, 25, "Chunks und Embeddings berechnen");

  if (payload.reindexPersonalBrain) {
    const personalBrain = createPersonalBrainService(prisma);
    const result = await reindexPersonalBrain(personalBrain, undefined, {
      useMock: payload.useMock,
      force: true,
    });
    return result as unknown as Record<string, unknown>;
  }

  if (payload.personalBrainDocumentId) {
    const personalBrain = createPersonalBrainService(prisma);
    const result = await indexPersonalBrainDocument(
      personalBrain,
      payload.personalBrainDocumentId,
      undefined,
      { useMock: payload.useMock },
    );
    return result as unknown as Record<string, unknown>;
  }

  if (!payload.documentId) {
    throw new Error("documentId oder personalBrainDocumentId fehlt im Embedding-Job.");
  }

  const brainStore = createBrainStoreService();
  const result = await indexBrainDocument(brainStore, payload.documentId, undefined, {
    useMock: payload.useMock,
  });

  return result as unknown as Record<string, unknown>;
}

export async function runReindexJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as {
    worldSlug?: string;
    campaignId?: string | null;
    useMock?: boolean;
    force?: boolean;
  };

  if (!payload.worldSlug) {
    throw new Error("worldSlug fehlt im Reindex-Job.");
  }

  const brainStore = createBrainStoreService();
  await ctx.jobs.updateProgress(ctx.jobId, 10, "Brain-Dokumente laden");

  const result = await reindexBrainWorld(brainStore, payload.worldSlug, undefined, {
    campaignId: payload.campaignId,
    useMock: payload.useMock,
    force: payload.force ?? true,
  });

  await ctx.jobs.updateProgress(ctx.jobId, 100, "Reindex abgeschlossen");

  return result as unknown as Record<string, unknown>;
}

export async function runCanonCheckJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as { worldSlug?: string };
  if (!payload.worldSlug) {
    throw new Error("worldSlug fehlt im Kanonprüfungs-Job.");
  }

  const inspector = createWorldInspectorService(prisma);
  await ctx.jobs.updateProgress(ctx.jobId, 30, "Welt analysieren");

  const report = await inspector.inspectWorld(payload.worldSlug);
  if (!report) {
    throw new Error(`Welt ${payload.worldSlug} nicht gefunden.`);
  }

  const findings = [...report.safetyFindings, ...report.canonFindings];

  return {
    worldSlug: payload.worldSlug,
    findingCount: findings.length,
    criticalCount: findings.filter((f) => f.severity === "critical").length,
    findings: findings.slice(0, 50),
  };
}

export async function runBackupRestoreJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as RestoreJobPayload;
  if (!payload.confirmed) {
    throw new Error("Restore erfordert confirmed: true.");
  }

  const { bundle, zipBuffer } = await loadBackupForRestore(payload);
  const db = createPrismaClient();

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

export interface RestoreJobPayload {
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

export async function executeJobRunners(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  switch (ctx.job.type) {
    case "backup":
      return runBackupJob(ctx);
    case "import":
      return runImportJob(ctx);
    case "ai_run":
      return runAiRunJob(ctx);
    case "mail_send":
      return runMailSendJob(ctx);
    case "mail_sync":
      return runMailSyncJob(ctx);
    case "embedding":
      return runEmbeddingJob(ctx);
    case "reindex":
      return runReindexJob(ctx);
    case "canon_check":
      return runCanonCheckJob(ctx);
    case "backup_restore":
      return runBackupRestoreJob(ctx);
    case "image_studio":
      return runImageStudioJob(ctx);
    case "agent_job":
      return runAgentJob(ctx);
    case "calendar_sync":
      return runCalendarSyncJob(ctx);
    case "research":
      return runResearchJob(ctx);
    default:
      throw new Error(`Unbekannter Job-Typ: ${ctx.job.type}`);
  }
}
