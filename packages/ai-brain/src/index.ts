import type { UweRepository } from "@uwe/database/server";
import { buildAiContext, buildAiContextBySlug } from "./context/buildAiContext";
import { sanitizeContextForCloud, validateProviderForContext } from "./privacy";
import { createProvider, runAiTask } from "./providers/registry";
import {
  createApiKeyStoreFromEnv,
  InMemoryApiKeyStore,
  isCloudProvider,
  resolveAiBrainSettings,
} from "./settings";
import { buildTaskPrompt, buildTaskSystemPrompt } from "./tasks";
import type {
  AiBrainSettings,
  AiContext,
  AiProviderId,
  AiTaskType,
  ApiKeyStore,
  BuildAiContextOptions,
  GenerateTextResult,
} from "./types";

export * from "./types";
export { buildAiContext, buildAiContextBySlug } from "./context/buildAiContext";
export {
  createApiKeyStoreFromEnv,
  InMemoryApiKeyStore,
  isCloudProvider,
  resolveAiBrainSettings,
} from "./settings";
export { sanitizeContextForCloud, validateProviderForContext, contextContainsDmOnly } from "./privacy";
export { AI_TASK_LABELS, buildTaskPrompt, buildTaskSystemPrompt } from "./tasks";
export { createProvider, MockAiProvider, runAiTask } from "./providers/registry";

export interface GenerateAiTaskInput {
  taskType: AiTaskType;
  worldId: string;
  pageId: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  options?: BuildAiContextOptions;
  apiKeyStore?: ApiKeyStore;
  useMock?: boolean;
}

export interface GenerateAiTaskBySlugInput extends Omit<GenerateAiTaskInput, "worldId" | "pageId"> {
  worldSlug: string;
  pageSlug: string;
}

export async function generateAiTask(
  repo: UweRepository,
  input: GenerateAiTaskInput,
): Promise<{ context: AiContext; result: GenerateTextResult }> {
  const settings = resolveAiBrainSettings(input.apiKeyStore ?? createApiKeyStoreFromEnv(), {
    datenschutzMode: input.options?.datenschutzMode,
    localOnly: input.options?.localOnly,
  });

  const context = await buildAiContext(repo, input.taskType, input.worldId, input.pageId, {
    ...input.options,
    datenschutzMode: settings.datenschutzMode,
    localOnly: settings.localOnly,
  });

  validateProviderForContext(input.providerId, context, settings);

  const safeContext = isCloudProvider(input.providerId)
    ? sanitizeContextForCloud(context)
    : context;

  const provider = createProvider(
    input.providerId,
    input.apiKeyStore ?? createApiKeyStoreFromEnv(),
    { useMock: input.useMock },
  );

  const prompt = buildTaskPrompt(input.taskType, safeContext, input.userPrompt);
  const systemPrompt = buildTaskSystemPrompt(input.taskType);

  const result = await runAiTask(provider, {
    model: input.model,
    prompt,
    systemPrompt,
  });

  return { context: safeContext, result };
}

export async function generateAiTaskBySlug(
  repo: UweRepository,
  input: GenerateAiTaskBySlugInput,
): Promise<{ context: AiContext; result: GenerateTextResult }> {
  const world = await repo.getWorldBySlug(input.worldSlug);
  if (!world) {
    throw new Error(`Welt ${input.worldSlug} nicht gefunden.`);
  }
  const page = await repo.getPageBySlug(input.worldSlug, input.pageSlug);
  if (!page) {
    throw new Error(`Seite ${input.pageSlug} nicht gefunden.`);
  }

  return generateAiTask(repo, {
    ...input,
    worldId: world.id,
    pageId: page.id,
  });
}

export function getAiBrainSettings(apiKeyStore?: ApiKeyStore): AiBrainSettings {
  return resolveAiBrainSettings(apiKeyStore ?? createApiKeyStoreFromEnv());
}

export async function saveAiResultAsIdea(
  repo: UweRepository,
  input: {
    worldId: string;
    sourcePageId: string;
    title: string;
    content: string;
    taskType: AiTaskType;
    pageType?: "note" | "lore" | "npc" | "location" | "encounter";
  },
) {
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `idee-${slugBase}-${Date.now().toString(36)}`;

  return repo.createIdeaPage({
    worldId: input.worldId,
    title: input.title,
    slug,
    type: input.pageType ?? "note",
    content: input.content,
    sourcePageId: input.sourcePageId,
    taskType: input.taskType,
    visibility: "dm_only",
  });
}

export async function saveAiResultAsContentBlock(
  repo: UweRepository,
  input: {
    pageId: string;
    content: string;
    taskType: AiTaskType;
    providerId: AiProviderId;
    model: string;
  },
) {
  const sortOrder = await repo.getNextContentBlockSortOrder(input.pageId);
  return repo.addContentBlock(input.pageId, {
    type: "ai_summary",
    sortOrder,
    content: input.content,
    visibility: "dm_only",
    metadata: {
      source: "ai_brain",
      taskType: input.taskType,
      provider: input.providerId,
      model: input.model,
      generatedAt: new Date().toISOString(),
      isCanon: false,
    },
  });
}
