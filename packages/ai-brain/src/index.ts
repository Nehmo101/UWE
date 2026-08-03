import type { UweRepository } from "@uwe/database/server";
import {
  legacyContextMode,
  providerIdToMode,
} from "./router";
import {
  AI_GATEWAY_SYSTEM_USER,
  executeAiGatewayRequest,
  type AiGatewayUserContext,
  type AiGatewayDeps,
} from "./gateway";
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

export {
  buildEngineCaptureProposalPrompt,
  parseEngineCaptureProposalResponse,
} from "./capture-triage/engine-proposal";
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
  resolveAiBrainSettings,
} from "./settings";
export {
  contextContainsLocalKnowledge,
  validatePlayerRecapContent,
  extractDmOnlyPhrases,
} from "./privacy";
export {
  AI_TASK_LABELS,
  buildTaskPrompt,
  buildTaskSystemPrompt,
  JSON_RESULT_TASKS,
  requiresJsonResult,
} from "./tasks";
/* The one reader for model JSON. Exported so nobody writes a fourth
   `raw.match(/\{[\s\S]*\}/)` — there were three before 28.07.2026. */
export {
  buildJsonRepairPrompt,
  extractJsonObjectText,
  generateWithJsonRepair,
  parseModelJson,
  readModelJson,
  stripCodeFence,
  type ModelJsonFailure,
  type ModelJsonFailureReason,
  type ModelJsonResult,
  type ModelJsonSuccess,
} from "./model-json";
export {
  appendResearchSources,
  buildResearchSynthesisPrompt,
  type ResearchSourceInput,
} from "./research-synthesis";
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
  validateContextModeRequirements,
  validateLocalEngineRequired,
  buildRouterContext,
  createBrainRetrievalAdapter,
  createLocalEngineProvider,
  checkEngineHealth,
  checkEngineReadiness,
  isEngineReady,
  isEngineReadinessReady,
  isEngineWorkerConfigured,
  type EngineReadinessStatus,
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
  /** Include DnD brain retrieval alongside page context (default: true). */
  withBrain?: boolean;
  feature?: string;
  /** Optional gateway deps for tests or isolated DB routing. */
  gatewayService?: AiGatewayDeps["gatewayService"];
  prisma?: AiGatewayDeps["prisma"];
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
    contextMode: legacyContextMode({ withBrain: input.withBrain ?? true }),
    taskType: input.taskType,
    worldSlug,
    pageSlug,
    model: input.model,
    userPrompt: input.userPrompt,
    useMock: input.useMock,
    apiKeyStore: input.apiKeyStore,
    options: input.options,
  };

  const routed = await executeAiGatewayRequest(
    {
      repo,
      gatewayService: input.gatewayService,
      prisma: input.prisma,
    } as AiGatewayDeps,
    {
      ...routerRequest,
      user: input.user ?? AI_GATEWAY_SYSTEM_USER,
      feature: input.feature ?? "AI_DND_USE",
    },
  );

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
  resolveConnectorAwareImageProviderConfig,
  runAiGatewayFallbackTest,
  AI_GATEWAY_SYSTEM_USER,
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
} from "./gateway";
