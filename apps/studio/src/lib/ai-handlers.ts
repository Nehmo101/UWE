import { NextResponse } from "next/server";
import {
  createUweRepository,
  getNextContentBlockSortOrder,
  getSystemSettings,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import {
  buildAiContextBySlug,
  createProvider,
  createApiKeyStoreFromEnv,
  generateAiTaskBySlug,
  resolveAiBrainSettings,
  saveAiResultAsContentBlock,
  saveAiResultAsIdea,
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

export async function postContext(body: {
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  allowDmOnly?: boolean;
}) {
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
    },
  );

  return NextResponse.json({ context });
}

export async function postGenerate(body: {
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  allowDmOnly?: boolean;
  useMock?: boolean;
}) {
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
    },
    apiKeyStore: createApiKeyStoreFromEnv(),
    useMock,
  });

  return NextResponse.json({ context, result });
}

export async function postSave(body: {
  mode: "idea" | "content_block";
  taskType: AiTaskType;
  worldSlug: string;
  pageSlug: string;
  title?: string;
  content: string;
  providerId: AiProviderId;
  model: string;
}) {
  const repo = createUweRepository();
  const world = await repo.getWorldBySlug(body.worldSlug);
  const page = await repo.getPageBySlug(body.worldSlug, body.pageSlug);

  if (!world || !page) {
    return jsonError("Welt oder Seite nicht gefunden.", 404);
  }

  if (body.mode === "idea") {
    const idea = await saveAiResultAsIdea(repo, {
      worldId: world.id,
      sourcePageId: page.id,
      title: body.title ?? `KI-Idee: ${page.title}`,
      content: body.content,
      taskType: body.taskType,
    });
    return NextResponse.json({ saved: idea, mode: "idea" });
  }

  const block = await saveAiResultAsContentBlock(repo, {
    pageId: page.id,
    content: body.content,
    taskType: body.taskType,
    providerId: body.providerId,
    model: body.model,
  });

  return NextResponse.json({
    saved: block,
    mode: "content_block",
    sortOrder: await getNextContentBlockSortOrder(page.id),
  });
}
