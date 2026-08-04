import { NextResponse } from "next/server";
import {
  createAiRunService,
  createBrainStoreService,
  createJobService,
  createUweRepository,
  prisma,
} from "@uwe/database/server";
import {
  AiPrivacyError,
  AiRouterError,
  applyProposal,
  BRAIN_ACTION_LIST,
  discardRun,
  isBrainActionId,
  AiGatewayAccessDeniedError,
  AiGatewayBudgetExceededError,
  AiGatewayDisabledError,
  type AiProviderId,
} from "@uwe/ai-brain";
import { enqueueAndDispatch, runJob } from "./job-executor";
import { jsonError, worldNotFound } from "./api-response";

function handleBrainError(error: unknown) {
  if (error instanceof AiPrivacyError) {
    return jsonError(error.message, 403);
  }
  if (error instanceof AiRouterError) {
    return jsonError(error.message, 403);
  }
  if (
    error instanceof AiGatewayAccessDeniedError ||
    error instanceof AiGatewayBudgetExceededError ||
    error instanceof AiGatewayDisabledError
  ) {
    return jsonError(error.message, 403);
  }
  if (error instanceof Error) {
    return jsonError(error.message, 400);
  }
  throw error;
}

function createBrainDeps() {
  const repo = createUweRepository();
  return {
    repo,
    aiRuns: createAiRunService(),
    brainStore: createBrainStoreService(),
  };
}

export async function getBrainActions() {
  return NextResponse.json({ actions: BRAIN_ACTION_LIST });
}

export async function postBrainRun(
  body: {
    actionId: string;
    worldSlug: string;
    pageSlug?: string;
    providerId: AiProviderId;
    model: string;
    userPrompt?: string;
    sessionId?: string;
    useMock?: boolean;
    sync?: boolean;
  },
  actorUserId?: string | null,
) {
  try {
    if (!isBrainActionId(body.actionId)) {
      return jsonError(`Unbekannte Brain-Aktion: ${body.actionId}`);
    }

    const action = BRAIN_ACTION_LIST.find((entry) => entry.id === body.actionId);
    const title = `${action?.label ?? body.actionId} · ${body.pageSlug ?? body.sessionId ?? body.worldSlug}`;

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
        return jsonError(completed.errorMessage ?? "Brain-Aktion fehlgeschlagen.", 500);
      }
      const result = completed?.result as Record<string, unknown> | null;
      return NextResponse.json(result ?? { job: completed });
    }

    const job = await enqueueAndDispatch({
      type: "ai_run",
      title,
      worldSlug: body.worldSlug,
      userId: actorUserId ?? null,
      payload: body,
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return handleBrainError(error);
  }
}

export async function getBrainRuns(query: {
  worldSlug?: string;
  pageSlug?: string;
  limit?: number;
}) {
  const deps = createBrainDeps();
  let worldId: string | undefined;
  let pageId: string | undefined;

  if (query.worldSlug) {
    const world = await deps.repo.getWorldBySlug(query.worldSlug);
    if (!world) {
      return worldNotFound();
    }
    worldId = world.id;

    if (query.pageSlug) {
      const page = await deps.repo.getPageBySlug(query.worldSlug, query.pageSlug);
      pageId = page?.id;
    }
  }

  const { runs, total } = await deps.aiRuns.list({
    worldId,
    pageId,
    limit: query.limit ?? 20,
  });

  return NextResponse.json({ runs, total });
}

export async function getBrainRunById(runId: string) {
  const deps = createBrainDeps();
  const run = await deps.aiRuns.getById(runId);
  if (!run) {
    return jsonError("AI-Run nicht gefunden.", 404);
  }
  return NextResponse.json({ run });
}

export async function postApplyProposal(body: {
  runId: string;
  proposalId: string;
  editedContent?: string;
  ideaTitle?: string;
}) {
  try {
    const deps = createBrainDeps();
    const result = await applyProposal(deps, {
      runId: body.runId,
      proposalId: body.proposalId,
      editedContent: body.editedContent,
      ideaTitle: body.ideaTitle,
    });
    const run = await deps.aiRuns.getById(body.runId);
    return NextResponse.json({ ...result, run });
  } catch (error) {
    return handleBrainError(error);
  }
}

export async function postDiscardRun(runId: string) {
  try {
    const deps = createBrainDeps();
    await discardRun(deps, runId);
    const run = await deps.aiRuns.getById(runId);
    return NextResponse.json({ run });
  } catch (error) {
    return handleBrainError(error);
  }
}
