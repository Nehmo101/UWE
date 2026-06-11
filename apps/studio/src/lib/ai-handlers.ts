import { NextResponse } from "next/server";
import {
  createUweRepository,
  getNextContentBlockSortOrder,
  getSystemSettings,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import {
  AiPrivacyError,
  buildAiContextBySlug,
  createProvider,
  createApiKeyStoreFromEnv,
  generateAiTaskBySlug,
  listSessionsForBrain,
  resolveAiBrainSettings,
  saveAiResultAsContentBlock,
  saveAiResultAsIdea,
  saveAiResultAsPlayerRecap,
  SESSION_AWARE_TASKS,
  type AiContextSource,
  type AiProviderId,
  type AiTaskType,
} from "@uwe/ai-brain";

async function getAiSettingsOverrides() {
  const systemSettings = await getSystemSettings();
  return {
    localOnly: resolveLocalOnlyMode(systemSettings),
    enabled: systemSettings.ai.enabled,
  };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function handleAiError(error: unknown) {
  if (error instanceof AiPrivacyError) {
    return jsonError(error.message, 403);
  }
  throw error;
}

export async function getSettings() {
  const overrides = await getAiSettingsOverrides();
  const settings = resolveAiBrainSettings(createApiKeyStoreFromEnv(), overrides);
  return NextResponse.json({ settings });
}

export async function getModels(providerId: AiProviderId, useMock = false) {
  const overrides = await getAiSettingsOverrides();
  const settings = resolveAiBrainSettings(createApiKeyStoreFromEnv(), overrides);
  if (settings.localOnly && !settings.providers.find((p) => p.id === providerId)?.isLocal) {
    return jsonError("Local-only-Modus: Cloud-Provider nicht verfügbar.", 403);
  }

  const provider = createProvider(providerId, createApiKeyStoreFromEnv(), { useMock });
  const models = await provider.listModels();
  const health = await provider.healthCheck();
  return NextResponse.json({ models, health });
}

export async function getSessions(worldSlug: string, pageSlug?: string) {
  const repo = createUweRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return jsonError("Welt nicht gefunden.", 404);
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
  allowDmOnly?: boolean;
  sessionId?: string;
}) {
  try {
    const repo = createUweRepository();
    const overrides = await getAiSettingsOverrides();
    const settings = resolveAiBrainSettings(createApiKeyStoreFromEnv(), overrides);

    const context = await buildAiContextBySlug(
      repo,
      body.taskType,
      body.worldSlug,
      body.pageSlug,
      {
        allowDmOnly: body.allowDmOnly ?? settings.localOnly,
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

export async function postGenerate(body: {
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  allowDmOnly?: boolean;
  sessionId?: string;
  useMock?: boolean;
}) {
  try {
    const repo = createUweRepository();
    const overrides = await getAiSettingsOverrides();
    const settings = resolveAiBrainSettings(createApiKeyStoreFromEnv(), overrides);
    const useMock = body.useMock ?? process.env.AI_USE_MOCK === "true";

    const { context, result } = await generateAiTaskBySlug(repo, {
      taskType: body.taskType,
      worldSlug: body.worldSlug,
      pageSlug: body.pageSlug,
      providerId: body.providerId,
      model: body.model,
      userPrompt: body.userPrompt,
      options: {
        allowDmOnly: body.allowDmOnly ?? settings.localOnly,
        datenschutzMode: settings.datenschutzMode,
        localOnly: settings.localOnly,
        sessionId: body.sessionId,
      },
      apiKeyStore: createApiKeyStoreFromEnv(),
      useMock,
    });

    return NextResponse.json({ context, result });
  } catch (error) {
    return handleAiError(error);
  }
}

export async function postSave(body: {
  mode: "idea" | "content_block" | "player_recap";
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  title?: string;
  content: string;
  providerId: AiProviderId;
  model: string;
  sessionId?: string;
  sources?: AiContextSource[];
}) {
  try {
    const repo = createUweRepository();
    const world = await repo.getWorldBySlug(body.worldSlug);
    const page = await repo.getPageBySlug(body.worldSlug, body.pageSlug);

    if (!world || !page) {
      return jsonError("Welt oder Seite nicht gefunden.", 404);
    }

    const sources = body.sources ?? [];

    if (body.mode === "idea") {
      const idea = await saveAiResultAsIdea(repo, {
        worldId: world.id,
        sourcePageId: page.id,
        title: body.title ?? `KI-Idee: ${page.title}`,
        content: body.content,
        taskType: body.taskType,
        sources,
        sessionId: body.sessionId,
        providerId: body.providerId,
        model: body.model,
      });
      return NextResponse.json({ saved: idea, mode: "idea" });
    }

    if (body.mode === "player_recap") {
      if (!body.sessionId) {
        return jsonError("sessionId ist für Spieler-Recap erforderlich.", 400);
      }
      if (!SESSION_AWARE_TASKS.includes(body.taskType) && body.taskType !== "generate_player_recap") {
        return jsonError("Ungültiger Task-Typ für Spieler-Recap.", 400);
      }

      const saved = await saveAiResultAsPlayerRecap(repo, {
        sessionId: body.sessionId,
        content: body.content,
        taskType: body.taskType,
        providerId: body.providerId,
        model: body.model,
        sources,
        sourcePageId: page.id,
      });

      return NextResponse.json({ saved: saved.session, metadata: saved.metadata, mode: "player_recap" });
    }

    const block = await saveAiResultAsContentBlock(repo, {
      pageId: page.id,
      content: body.content,
      taskType: body.taskType,
      providerId: body.providerId,
      model: body.model,
      sources,
      sessionId: body.sessionId,
      sourcePageId: page.id,
    });

    return NextResponse.json({
      saved: block,
      mode: "content_block",
      sortOrder: await getNextContentBlockSortOrder(page.id),
    });
  } catch (error) {
    return handleAiError(error);
  }
}
