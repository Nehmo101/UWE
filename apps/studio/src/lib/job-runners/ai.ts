import {
  createAiReviewService,
  createAiRunServiceFromClient,
  createBrainStoreService,
  buildCaptureAiProposal,
  createCaptureTriageService,
  combineBlockContent,
  createLifeAdminService,
  createPersonalBrainService,
  createUweRepository,
  createWorldInspectorService,
  getSystemSettings,
  prisma,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
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
  buildEngineCaptureProposalPrompt,
  parseEngineCaptureProposalResponse,
  type AiProviderId,
  type AiTaskType,
} from "@uwe/ai-brain";
import { createApiKeyStore } from "../ai-key-store";
import { resolveGatewayUserById } from "../ai-gateway-user";
import { assertNotCancelled, type JobRunnerContext } from "./context";

export async function runBrainActionJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as BrainActionJobPayload;
  // `pageSlug` ist optional (J4): runBrainAction sucht sich sonst selbst eine
  // Ankerseite. Eine Terra-Karte hat keine Wiki-Seite.
  if (!payload.actionId || !payload.worldSlug || !payload.providerId || !payload.model) {
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

interface BrainActionJobPayload {
  actionId: string;
  worldSlug: string;
  pageSlug?: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  sessionId?: string;
  useMock?: boolean;
}

interface DeferredAiPromptJobPayload {
  deferredAiPrompt: true;
  prompt: string;
  providerMode: "auto" | "local_engine" | "cloud";
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

  await ctx.jobs.updateProgress(ctx.jobId, 10, "Warte auf Maschinenraum…");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);
  if (!gatewayUser) {
    throw new Error("Deferred KI-Prompt: job.userId fehlt — Gateway-Kontext nicht verfügbar.");
  }

  const { executeAiPrompt } = await import("../ai-prompt-handlers");
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
    throw new Error("Maschinenraum weiterhin offline — Job wird erneut versucht.");
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

  const lifeAdmin = createLifeAdminService(brainPrisma, prisma);
  const capture = await lifeAdmin.getCapture(captureId);
  if (!capture) {
    throw new Error(`Capture ${captureId} nicht gefunden.`);
  }

  const fallback = buildCaptureAiProposal(capture);
  const prompt = buildEngineCaptureProposalPrompt({
    title: capture.title,
    content: capture.content,
    captureType: capture.captureType,
    url: capture.url,
  });

  await ctx.jobs.updateProgress(ctx.jobId, 20, "Maschinenraum-Klassifikation…");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const gatewayUser = await resolveGatewayUserById(ctx.job.userId);
  if (!gatewayUser) {
    throw new Error("Capture-Triage: job.userId fehlt — Gateway-Kontext nicht verfügbar.");
  }

  const { executeAiPrompt } = await import("../ai-prompt-handlers");
  const result = await executeAiPrompt(
    {
      prompt,
      providerMode: "local_engine",
      contextMode: "general_chat",
      useMock: payload.useMock ?? process.env.AI_USE_MOCK === "true",
    },
    gatewayUser,
  );

  if (result.kind === "deferred") {
    throw new Error("Maschinenraum offline — Capture-Vorschlag wird erneut versucht.");
  }

  const proposal = parseEngineCaptureProposalResponse(result.text, fallback);
  await createCaptureTriageService(prisma).applyAiProposal(captureId, proposal);
  await ctx.jobs.updateProgress(ctx.jobId, 100, "Capture-Vorschlag aktualisiert");
  return { captureId, source: proposal.source, suggestedTarget: proposal.suggestedTarget };
}

export async function runAiRunJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as AiRunJobPayload &
    BrainActionJobPayload &
    DeferredAiPromptJobPayload &
    {
      originalContent?: string;
      previousPublishStatus?: string;
    };
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

  let gatewayUser: { userId: string } | undefined;
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

    const originalContent =
      payload.originalContent ?? combineBlockContent(page.contentBlocks);

    const { proposal } = await review.createProposalFromRun({
      aiRunId: completedRun.id,
      worldId: world.id,
      pageId: page.id,
      sessionId: payload.sessionId,
      taskType: payload.taskType,
      resultText: result.text,
      originalContent,
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

interface AiRunJobPayload {
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  sessionId?: string;
  useMock?: boolean;
  discardProposalId?: string;
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
    const personalBrain = createPersonalBrainService(brainPrisma);
    const result = await reindexPersonalBrain(personalBrain, undefined, {
      useMock: payload.useMock,
      force: true,
    });
    return result as unknown as Record<string, unknown>;
  }

  if (payload.personalBrainDocumentId) {
    const personalBrain = createPersonalBrainService(brainPrisma);
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

  const findings = report.canonFindings;

  return {
    worldSlug: payload.worldSlug,
    findingCount: findings.length,
    criticalCount: findings.filter((f) => f.severity === "critical").length,
    findings: findings.slice(0, 50),
  };
}
