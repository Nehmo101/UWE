import { NextResponse } from "next/server";
import {
  createLifeAdminService,
  createUweRepository,
  detectMissingContent,
  listGeneratorActions,
  prisma,
  resolveGeneratorContextFromPage,
  type GeneratorActionId,
} from "@uwe/database/server";
import { getInferenceStatus } from "@uwe/ai-brain";
import { postGenerate } from "./ai-handlers";
import { buildGeneratorUserPrompt, mapGeneratorActionToTaskType } from "./generator-action-map";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getGeneratorPanelData(worldSlug: string, pageSlug: string) {
  const repo = createUweRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  const page = await repo.getPageBySlug(worldSlug, pageSlug);

  if (!world || !page) {
    return null;
  }

  const context = resolveGeneratorContextFromPage({
    pageId: page.id,
    pageType: page.type,
    pageTitle: page.title,
    worldId: world.id,
    worldSlug: world.slug,
  });

  const actions = listGeneratorActions(context);
  const missingHints = detectMissingContent({
    pageType: page.type,
    summary: page.summary,
    contentBlocks: page.contentBlocks.map((block) => ({
      type: block.type,
      content: block.content,
      visibility: block.visibility,
    })),
    prepStatus: page.prepStatus,
  });

  const inference = await getInferenceStatus({
    useMock: process.env.AI_USE_MOCK === "true",
  });

  return {
    context,
    actions,
    missingHints,
    rtxReady: inference.online,
    rtxEnabled: inference.enabled,
  };
}

export async function postGeneratorAction(body: {
  actionId: GeneratorActionId;
  worldSlug: string;
  pageSlug: string;
  useMock?: boolean;
  sync?: boolean;
}) {
  if (!body.actionId || !body.worldSlug?.trim() || !body.pageSlug?.trim()) {
    return jsonError("actionId, worldSlug und pageSlug sind erforderlich.", 400);
  }

  const repo = createUweRepository();
  const page = await repo.getPageBySlug(body.worldSlug, body.pageSlug);
  if (!page) {
    return jsonError("Seite nicht gefunden.", 404);
  }

  const taskType = mapGeneratorActionToTaskType(body.actionId);
  const userPrompt = buildGeneratorUserPrompt(body.actionId, page.title);
  const inference = await getInferenceStatus({ useMock: body.useMock });
  const model =
    process.env.AI_INFERENCE_DEFAULT_MODEL?.trim() ||
    inference.defaultModel?.trim() ||
    "llama3.2";

  const response = await postGenerate({
    taskType,
    worldSlug: body.worldSlug,
    pageSlug: body.pageSlug,
    providerId: "ollama",
    model,
    userPrompt,
    allowDmOnly: true,
    useMock: body.useMock,
    sync: body.sync ?? !inference.online,
  });

  const payload = (await response.json()) as {
    error?: string;
    job?: { id: string };
    runId?: string;
    run?: { id: string };
  };

  const lifeAdmin = createLifeAdminService(prisma);

  if (response.status === 202) {
    if (payload.job?.id) {
      await lifeAdmin.createGeneratorOutput({
        worldId: page.worldId,
        pageId: page.id,
        contextType: page.type,
        contextId: page.id,
        generatorAction: body.actionId,
        promptSummary: userPrompt.slice(0, 240),
        output: { deferredJobId: payload.job.id, status: "pending" },
      });
    }
    return NextResponse.json(payload, { status: 202 });
  }

  if (!response.ok) {
    return jsonError(payload.error ?? "Generierung fehlgeschlagen.", response.status);
  }

  await lifeAdmin.createGeneratorOutput({
    worldId: page.worldId,
    pageId: page.id,
    contextType: page.type,
    contextId: page.id,
    generatorAction: body.actionId,
    promptSummary: userPrompt.slice(0, 240),
    aiRunId: payload.runId ?? payload.run?.id ?? undefined,
    output: { status: "completed", runId: payload.runId ?? payload.run?.id ?? null },
  });

  return NextResponse.json(payload);
}
