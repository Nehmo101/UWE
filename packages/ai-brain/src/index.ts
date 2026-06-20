import type { UweRepository } from "@uwe/database/server";
import {
  legacyContextMode,
  providerIdToMode,
  routeAiRequest,
} from "./router";
import { executeAiGatewayRequest, type AiGatewayUserContext, type AiGatewayDeps } from "./gateway";
import {
  createApiKeyStoreFromEnv,
  resolveAiBrainSettings,
} from "./settings";
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
  contextContainsLocalKnowledge,
  resolveServerAllowDmOnly,
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
export {
  routeAiRequest,
  resolveProviderRoute,
  providerIdToMode,
  legacyContextMode,
  validateProviderContextCombination,
  validateResolvedRouteForContext,
  validateContextModeRequirements,
  validateLocalRtxRequired,
  contextModeRequiresLocalContext,
  isCloudRouteAllowedForContext,
  buildRouterContext,
  createBrainRetrievalAdapter,
  createLocalRtxProvider,
  createCloudProvider,
  resolveCloudProviderId,
  checkRtxHealth,
  isRtxReady,
  AiRouterError,
  type AiProviderMode,
  type AiContextMode,
  type AiRouterRequest,
  type AiRouterResult,
  type AiRouterDeps,
} from "./router";

export * from "./dnd-generator";

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
  /** When set, routes through AI Gateway (permissions, budget, logging). */
  user?: AiGatewayUserContext;
  feature?: string;
}

export interface GenerateAiTaskBySlugInput extends Omit<GenerateAiTaskInput, "worldId" | "pageId"> {
  worldSlug: string;
  pageSlug: string;
}

async function resolveSlugsFromIds(
  repo: UweRepository,
  worldId: string,
  pageId: string,
): Promise<{ worldSlug: string; pageSlug: string }> {
  const page = await repo.getPageById(pageId);
  if (!page || page.worldId !== worldId) {
    throw new Error(`Seite ${pageId} gehört nicht zur Welt ${worldId} oder existiert nicht.`);
  }

  const worlds = await repo.listWorlds();
  const world = worlds.find((w) => w.id === worldId);
  if (!world) {
    throw new Error(`Welt ${worldId} nicht gefunden.`);
  }

  return { worldSlug: world.slug, pageSlug: page.slug };
}

export async function generateAiTask(
  repo: UweRepository,
  input: GenerateAiTaskInput,
): Promise<{
  context: AiContext;
  result: GenerateTextResult;
  prompts: { systemPrompt: string; userPrompt: string };
}> {
  const { worldSlug, pageSlug } = await resolveSlugsFromIds(
    repo,
    input.worldId,
    input.pageId,
  );

  const routerRequest = {
    providerMode: providerIdToMode(input.providerId),
    contextMode: legacyContextMode({ withBrain: false }),
    taskType: input.taskType,
    worldSlug,
    pageSlug,
    model: input.model,
    cloudProviderId: providerIdToMode(input.providerId) === "cloud" ? input.providerId : undefined,
    userPrompt: input.userPrompt,
    useMock: input.useMock,
    apiKeyStore: input.apiKeyStore,
    options: input.options,
  };

  const routed = input.user
    ? await executeAiGatewayRequest(
        { repo } as AiGatewayDeps,
        {
          ...routerRequest,
          user: input.user,
          feature: input.feature ?? "AI_DND_USE",
        },
      )
    : await routeAiRequest({ repo }, routerRequest);

  return {
    context: routed.context,
    result: routed.result,
    prompts: routed.prompts,
  };
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
export {
  executeAiGatewayRequest,
  executeAiGatewayImageRequest,
  executeAiGatewayResearchJob,
  createGatewayApiKeyStore,
  getAiGatewayStatusForClient,
  runAiGatewayFallbackTest,
  simulateGatewayRouting,
  AiGatewayAccessDeniedError,
  AiGatewayBudgetExceededError,
  AiGatewayDisabledError,
  DEFAULT_PRIVACY_RULES,
  AI_FEATURE_PERMISSIONS,
  AI_FEATURE_PERMISSION_LABELS,
  MASTER_ADMIN_PERMISSIONS,
  resolveFeatureCategory,
  resolveRequiredPermission,
  isMasterAdminRole,
  type AiGatewayRequest,
  type AiGatewayResult,
  type AiGatewayImageRequest,
  type AiGatewayImageResult,
  type AiGatewayResearchContext,
  type AiGatewayDeps,
  type AiGatewayUserContext,
  type AiRoutingMode,
  type AiPrivacyLevel,
  type AiFeatureCategory,
  type AiFeaturePermission,
  type AiGatewaySimulationCase,
} from "./gateway";
