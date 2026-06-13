import type { UweRepository } from "@uwe/database/server";
import { buildAiContext } from "./context/context-builder";
import {
  extractDmOnlyPhrases,
  sanitizeContextForCloud,
  validatePlayerRecapContent,
  validateProviderForContext,
} from "./privacy";
import { createProvider, runAiTask } from "./providers/registry";
import {
  createApiKeyStoreFromEnv,
  isCloudProvider,
  resolveAiBrainSettings,
} from "./settings";
import { buildTaskPrompt, buildTaskSystemPrompt } from "./tasks";
import type {
  AiBrainSettings,
  AiContext,
  AiContextSource,
  AiProviderId,
  AiTaskType,
  ApiKeyStore,
  BuildAiContextOptions,
  GenerateTextResult,
} from "./types";
import { PLAYER_SAFE_TASKS } from "./types";

export * from "./types";
export { buildAiContext, buildAiContextBySlug, listSessionsForBrain } from "./context/context-builder";
export {
  createContextBuilder,
  resolveContextBuilderConfig,
  toAiRunContextSnapshot,
  emptyBrainKnowledgeSource,
  type ContextBuilderService,
  type ContextBuilderDeps,
  type BrainKnowledgeSource,
  type BrainKnowledgeEntry,
  type ContextBuilderConfig,
} from "./context";
export {
  createApiKeyStoreFromEnv,
  InMemoryApiKeyStore,
  isCloudProvider,
  resolveAiBrainSettings,
} from "./settings";
export {
  sanitizeContextForCloud,
  validateProviderForContext,
  contextContainsDmOnly,
  validatePlayerRecapContent,
  extractDmOnlyPhrases,
} from "./privacy";
export { AI_TASK_LABELS, buildTaskPrompt, buildTaskSystemPrompt } from "./tasks";
export { createProvider, MockAiProvider, runAiTask } from "./providers/registry";
export * from "./embeddings";
export {
  getInferenceStatus,
  listInferenceModels,
  runInferenceTestPrompt,
  type InferenceStatus,
  type InferenceTestResult,
} from "./inference";
export {
  resolveInferenceConfig,
  assertInferenceConfigUsable,
  type InferenceConfig,
  type InferenceProviderKind,
} from "./inference-config";
export {
  assertInferenceUrlAllowed,
  classifyInferenceUrl,
  isInferenceUrlAllowed,
  sanitizeInferenceEndpointLabel,
  InferenceUrlBlockedError,
  type InferenceUrlKind,
} from "./inference-url-guard";

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
): Promise<{
  context: AiContext;
  result: GenerateTextResult;
  prompts: { systemPrompt: string; userPrompt: string };
}> {
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

  if (PLAYER_SAFE_TASKS.includes(input.taskType)) {
    const forbidden = extractDmOnlyPhrases(context);
    validatePlayerRecapContent(result.text, forbidden);
  }

  return { context: safeContext, result, prompts: { systemPrompt, userPrompt: prompt } };
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

export {
  saveAiResultAsContentBlock,
  saveAiResultAsIdea,
  saveAiResultAsPlayerRecap,
} from "./save-results";
export {
  BRAIN_ACTION_LIST,
  BRAIN_ACTIONS,
  getBrainAction,
  isBrainActionId,
  type BrainActionDefinition,
  type BrainActionId,
  type AiProposalTargetType,
} from "./actions";
export {
  buildProposalsFromResult,
  markProposalStatus,
  parseProposals,
  type AiProposal,
  type AiProposalStatus,
} from "./proposals";
export { runBrainAction, type RunBrainActionInput, type RunBrainActionResult } from "./brain-action-runner";
export { applyProposal, discardRun, type ApplyProposalInput, type ApplyProposalResult } from "./apply-proposal";
export { createDbBrainKnowledgeSource } from "./context/db-brain-knowledge-source";
