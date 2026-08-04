import { NextResponse } from "next/server";
import {
  createAiReviewService,
  createAiRunServiceFromClient,
  createJobService,
  createUweRepository,
  getSystemSettings,
  logAuditEvent,
  prisma,
  resolveLocalOnlyMode,
  type AiRunStatus,
} from "@uwe/database/server";
import {
  AiPrivacyError,
  AiProviderError,
  AiRouterError,
  AI_TASK_LABELS,
  buildAiContextBySlug,
  createProvider,
  InferenceUrlBlockedError,
  listSessionsForBrain,
  resolveAiBrainSettings,
  type AiProviderId,
  type AiTaskType,
} from "@uwe/ai-brain";
import {
} from "@uwe/security";
import { enqueueAndDispatch, runJob } from "./job-executor";
import { jsonError, worldNotFound } from "./api-response";
import { createApiKeyStore } from "./ai-key-store";

async function getAiSettingsOverrides() {
  const systemSettings = await getSystemSettings();
  return {
    localOnly: resolveLocalOnlyMode(systemSettings),
    enabled: systemSettings.ai.enabled,
  };
}

function aiRuns() {
  return createAiRunServiceFromClient(prisma);
}

function aiReview() {
  return createAiReviewService(prisma);
}

function serializeRun(run: Awaited<ReturnType<ReturnType<typeof aiRuns>["getById"]>>) {
  if (!run) return null;
  return {
    ...run,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    appliedAt: run.appliedAt?.toISOString() ?? null,
    discardedAt: run.discardedAt?.toISOString() ?? null,
  };
}


function handleAiError(error: unknown) {
  if (error instanceof AiPrivacyError) {
    return jsonError(error.message, 403);
  }
  if (error instanceof AiRouterError) {
    return jsonError(error.message, 403);
  }
  if (error instanceof InferenceUrlBlockedError) {
    return jsonError(error.message, 403);
  }
  if (error instanceof AiProviderError) {
    return jsonError(error.message, 502);
  }
  throw error;
}

export async function getSettings() {
  const overrides = await getAiSettingsOverrides();
  const settings = resolveAiBrainSettings(await createApiKeyStore(), overrides);
  return NextResponse.json({ settings });
}

export async function getModels(providerId: AiProviderId, useMock = false) {
  const overrides = await getAiSettingsOverrides();
  const apiKeyStore = await createApiKeyStore();
  const settings = resolveAiBrainSettings(apiKeyStore, overrides);
  if (settings.localOnly && !settings.providers.find((p) => p.id === providerId)?.isLocal) {
    return jsonError("Local-only-Modus: Cloud-Provider nicht verfügbar.", 403);
  }

  try {
    const provider = createProvider(providerId, apiKeyStore, { useMock });
    const models = await provider.listModels();
    const health = await provider.healthCheck();
    return NextResponse.json({ models, health });
  } catch (error) {
    return handleAiError(error);
  }
}

export async function getSessions(worldSlug: string, pageSlug?: string) {
  const repo = createUweRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return worldNotFound();
  }

  let pageId: string | undefined;
  if (pageSlug) {
    const page = await repo.getPageBySlug(worldSlug, pageSlug);
    pageId = page?.id;
  }

  const sessions = await listSessionsForBrain(repo, worldSlug, pageId);
  return NextResponse.json({ sessions });
}

export async function postContext(body: {
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  sessionId?: string;
}) {
  try {
    const repo = createUweRepository();
    const overrides = await getAiSettingsOverrides();
    const settings = resolveAiBrainSettings(await createApiKeyStore(), overrides);

    const context = await buildAiContextBySlug(
      repo,
      body.taskType,
      body.worldSlug,
      body.pageSlug,
      {
        datenschutzMode: settings.datenschutzMode,
        localOnly: settings.localOnly,
        sessionId: body.sessionId,
      },
    );

    return NextResponse.json({ context });
  } catch (error) {
    return handleAiError(error);
  }
}

export async function postGenerate(
  body: {
    taskType: AiTaskType;
    worldSlug: string;
    pageSlug: string;
    providerId: AiProviderId;
    model: string;
    userPrompt?: string;
    sessionId?: string;
    useMock?: boolean;
    discardProposalId?: string;
    sync?: boolean;
  },
  actorUserId?: string | null,
) {
  const repo = createUweRepository();
  const world = await repo.getWorldBySlug(body.worldSlug);
  const page = await repo.getPageBySlug(body.worldSlug, body.pageSlug);

  if (!world || !page) {
    return jsonError("Welt oder Seite nicht gefunden.", 404);
  }

  const title = `${AI_TASK_LABELS[body.taskType]} · ${body.pageSlug}`;

  try {
    if (body.sync) {
      const jobs = createJobService(prisma);
      const job = await jobs.enqueue({
        type: "ai_run",
        title,
        worldSlug: body.worldSlug,
        userId: actorUserId ?? null,
        payload: body,
      });
      const completed = await runJob(job.id);
      if (completed?.status === "failed") {
        return jsonError(completed.errorMessage ?? "Generierung fehlgeschlagen.", 500);
      }
      const result = completed?.result as Record<string, unknown> | null;
      return NextResponse.json({
        job: completed,
        ...(result ?? {}),
        runId: result?.runId,
        run: result?.runId ? await aiRuns().getById(String(result.runId)).then(serializeRun) : null,
      });
    }

    const job = await enqueueAndDispatch({
      type: "ai_run",
      title,
      worldSlug: body.worldSlug,
      userId: actorUserId ?? null,
      payload: body,
    });

    await logAuditEvent(prisma, {
      action: "ai_request",
      targetType: "ai_run",
      targetId: job.id,
      worldId: world.id,
      metadata: {
        taskType: body.taskType,
        providerId: body.providerId,
        model: body.model,
        pageSlug: body.pageSlug,
        promptLength: body.userPrompt?.length ?? 0,
      },
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return handleAiError(error);
  }
}

export async function postSave(body: {
  proposalId: string;
  mode: "idea" | "content_block" | "player_recap" | "replace_content";
  title?: string;
  content?: string;
  sessionId?: string;
}) {
  try {
    if (!body.proposalId || !body.mode) {
      return jsonError("proposalId und mode sind erforderlich.", 400);
    }

    const result = await aiReview().applyProposal(body.proposalId, {
      mode: body.mode,
      title: body.title,
      editedText: body.content,
      sessionId: body.sessionId,
    });

    if (!result.ok) {
      return jsonError(result.message, 400);
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      proposal: result.proposal,
      undoEntryId: result.undoEntryId,
      appliedTargetType: result.appliedTargetType,
      appliedTargetId: result.appliedTargetId,
      mode: body.mode,
    });
  } catch (error) {
    return handleAiError(error);
  }
}

export async function postDiscard(body: { proposalId: string; reason?: string }) {
  if (!body.proposalId) {
    return jsonError("proposalId ist erforderlich.", 400);
  }

  const result = await aiReview().discardProposal(body.proposalId, { reason: body.reason });
  if (!result.ok) {
    return jsonError(result.message, 400);
  }
  return NextResponse.json(result);
}

export async function getProposal(proposalId: string) {
  const proposal = await aiReview().getProposal(proposalId);
  if (!proposal) {
    return jsonError("Vorschlag nicht gefunden.", 404);
  }
  return NextResponse.json({ proposal });
}

export async function getRuns(query: {
  worldSlug?: string;
  pageId?: string;
  gameSessionId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const repo = createUweRepository();
  let worldId: string | undefined;

  if (query.worldSlug) {
    const world = await repo.getWorldBySlug(query.worldSlug);
    if (!world) {
      return worldNotFound();
    }
    worldId = world.id;
  }

  const { runs, total } = await aiRuns().list({
    worldId,
    pageId: query.pageId,
    gameSessionId: query.gameSessionId,
    status: query.status as AiRunStatus | undefined,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  });

  return NextResponse.json({
    runs: runs.map((run) => serializeRun(run)!),
    total,
  });
}

export async function getRun(runId: string) {
  const run = await aiRuns().getById(runId);
  if (!run) {
    return jsonError("AI Run nicht gefunden.", 404);
  }
  return NextResponse.json({ run: serializeRun(run) });
}

export async function patchRun(
  runId: string,
  body: { status: "applied" | "discarded" | "cancelled"; rejectionComment?: string },
) {
  const runs = aiRuns();
  const existing = await runs.getById(runId);
  if (!existing) {
    return jsonError("AI Run nicht gefunden.", 404);
  }

  switch (body.status) {
    case "applied":
      return NextResponse.json({ run: serializeRun(await runs.markApplied(runId)) });
    case "discarded":
      return NextResponse.json({
        run: serializeRun(await runs.markDiscarded(runId, body.rejectionComment)),
      });
    case "cancelled":
      return NextResponse.json({ run: serializeRun(await runs.markCancelled(runId)) });
    default:
      return jsonError("Ungültiger Status. Erlaubt: applied, discarded, cancelled.", 400);
  }
}
