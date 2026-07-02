import { NextResponse } from "next/server";
import {
  buildFactionSimulationPrompt,
  createLifeAdminService,
  createUweRepository,
  createFactionStateService,
  createWorldCalendarService,
  detectMissingContent,
  formatInGameDate,
  getStructuredGeneratorSchema,
  listGeneratorActions,
  mapStructuredGeneratorAction,
  parseInGameDate,
  parseWorldCalendarMonths,
  prisma,
  resolveGeneratorContextFromPage,
  validateStructuredGeneratorInput,
  type GeneratorActionId,
} from "@uwe/database/server";
import { getInferenceStatus } from "@uwe/ai-brain";
import { enforceAiRequestLimits } from "@uwe/security";
import { postGenerate } from "./ai-handlers";
import { buildGeneratorUserPrompt, mapGeneratorActionToTaskType } from "./generator-action-map";
import { jsonError } from "./api-response";

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
  structuredInput?: Record<string, string>;
  presetId?: string;
  useMock?: boolean;
  sync?: boolean;
  workerUrl?: string;
}) {
  if (!body.actionId || !body.worldSlug?.trim() || !body.pageSlug?.trim()) {
    return jsonError("actionId, worldSlug und pageSlug sind erforderlich.", 400);
  }

  enforceAiRequestLimits({ workerUrl: body.workerUrl });

  const repo = createUweRepository();
  const page = await repo.getPageBySlug(body.worldSlug, body.pageSlug);
  if (!page) {
    return jsonError("Seite nicht gefunden.", 404);
  }

  const lifeAdmin = createLifeAdminService(prisma);

  let structuredInput = body.structuredInput;
  let presetId: string | undefined;
  const structuredTarget = mapStructuredGeneratorAction(body.actionId);
  if (structuredTarget) {
    const schema = getStructuredGeneratorSchema(structuredTarget);
    const validation = validateStructuredGeneratorInput(schema, body.structuredInput);
    if (!validation.ok) {
      return jsonError(validation.issues.map((issue) => issue.message).join(" "), 400);
    }
    structuredInput = validation.values;

    if (body.presetId) {
      const preset = await lifeAdmin.getGeneratorPreset(body.presetId);
      if (!preset || preset.targetType !== structuredTarget) {
        return jsonError("Generator-Preset nicht gefunden oder passt nicht zum Zieltyp.", 400);
      }
      presetId = preset.id;
    }
  }

  const taskType = mapGeneratorActionToTaskType(body.actionId);
  let userPrompt: string;
  if (body.actionId === "simulate_faction") {
    const world = await repo.getWorldBySlug(body.worldSlug);
    const calendars = createWorldCalendarService(prisma);
    const factions = createFactionStateService(prisma);
    const calendar = world ? await calendars.getByWorldId(world.id) : null;
    const factionState = await factions.getByPageId(page.id);
    const months = parseWorldCalendarMonths(calendar?.months);
    const currentDate = parseInGameDate(calendar?.currentDate);
    userPrompt = buildFactionSimulationPrompt({
      pageTitle: page.title,
      currentDateLabel: formatInGameDate(currentDate, months),
      currentDate,
      calendarName: calendar?.name ?? undefined,
      factionState,
      structuredInput,
    });
  } else {
    userPrompt = buildGeneratorUserPrompt(body.actionId, page.title, structuredInput);
  }
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
    useMock: body.useMock,
    sync: body.sync ?? !inference.online,
  });

  const payload = (await response.json()) as {
    error?: string;
    job?: { id: string };
    runId?: string;
    run?: { id: string };
  };

  if (response.status === 202) {
    if (payload.job?.id) {
      await lifeAdmin.createGeneratorOutput({
        worldId: page.worldId,
        pageId: page.id,
        presetId,
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
    presetId,
    contextType: page.type,
    contextId: page.id,
    generatorAction: body.actionId,
    promptSummary: userPrompt.slice(0, 240),
    aiRunId: payload.runId ?? payload.run?.id ?? undefined,
    output: { status: "completed", runId: payload.runId ?? payload.run?.id ?? null },
  });

  return NextResponse.json(payload);
}
