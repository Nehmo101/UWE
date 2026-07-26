import type {
  AiFeatureCategory,
  AiFeaturePermission,
  AiGatewayConfigRecord,
  AiGatewayService,
  AiPrivacyLevel,
  AiRoutingMode,
} from "@uwe/database/server";
import {
  AiGatewayAccessDeniedError,
  AiGatewayBudgetExceededError,
  AiGatewayDisabledError,
  createAiGatewayService,
  DEFAULT_PRIVACY_RULES,
  resolveFeatureCategory,
  AI_FEATURE_PERMISSIONS,
  AI_FEATURE_PERMISSION_LABELS,
  MASTER_ADMIN_PERMISSIONS,
  resolveRequiredPermission,
  isMasterAdminRole,
  resolveFeatureModelOverride,
} from "@uwe/database/server";
import type { AiRouterRequest, AiRouterResult } from "../router/types";
import { routeAiRequest, type AiRouterDeps } from "../router/aiRouter";
import type { AiProviderMode } from "../router/types";
import { AiRouterError } from "../router/types";
import {
  runImageStudioTask,
  type ImageStudioRequest,
  type ImageStudioResult,
  type ImageProviderMode,
} from "@uwe/image-studio";
import type { CreateUsageLogInput } from "@uwe/database/server";
import { buildGatewayImageProviderConfig } from "./aiGatewayImageConfig";
import { createGatewayApiKeyStore } from "./apiKeyStore";

export { createGatewayApiKeyStore } from "./apiKeyStore";
export { resolveConnectorAwareImageProviderConfig } from "./aiGatewayImageConfig";

export type {
  AiRoutingMode,
  AiPrivacyLevel,
  AiFeatureCategory,
  AiFeaturePermission,
  AiGatewayConfigRecord,
};

export {
  AiGatewayAccessDeniedError,
  AiGatewayBudgetExceededError,
  AiGatewayDisabledError,
  DEFAULT_PRIVACY_RULES,
  AI_FEATURE_PERMISSIONS,
  AI_FEATURE_PERMISSION_LABELS,
  MASTER_ADMIN_PERMISSIONS,
  resolveFeatureCategory,
  resolveRequiredPermission,
  isMasterAdminRole, resolveFeatureModelOverride,
};

export interface AiGatewayUserContext {
  userId: string;
  role: string;
}

/** Fallback actor for background/system AI jobs without a real user session. */
export const AI_GATEWAY_SYSTEM_USER: AiGatewayUserContext = {
  userId: "system",
  role: "owner",
};

function resolveGatewayUsageUserId(user: AiGatewayUserContext): string | null {
  return user.userId === AI_GATEWAY_SYSTEM_USER.userId ? null : user.userId;
}

export interface AiGatewayRequest extends AiRouterRequest {
  user: AiGatewayUserContext;
  feature?: string;
}

export interface AiGatewayDeps extends AiRouterDeps {
  gatewayService?: AiGatewayService;
}

export interface AiGatewayResult extends AiRouterResult {
  gatewayMeta: {
    routingMode: AiRoutingMode;
    cloudFallbackUsed: boolean;
    privacyCategory: AiFeatureCategory;
    privacyLevel: AiPrivacyLevel;
    durationMs: number;
  };
}

function estimateCostUsd(input: {
  providerId: string;
  route: string;
  inputTokens?: number;
  outputTokens?: number;
  promptChars?: number;
  resultChars?: number;
}): number | null {
  if (input.route !== "cloud") {
    return 0;
  }
  const inTok =
    input.inputTokens ??
    Math.ceil((input.promptChars ?? 0) / 4);
  const outTok =
    input.outputTokens ??
    Math.ceil((input.resultChars ?? 0) / 4);
  if (inTok === 0 && outTok === 0) {
    return null;
  }
  const ratePer1M = input.providerId === "anthropic" ? 3.0 : 1.5;
  return ((inTok + outTok) / 1_000_000) * ratePer1M;
}

/**
 * Central AI Gateway — all AI calls should pass through here.
 * Permission → Privacy → Budget → RTX Health → Provider → Usage Log
 */
export async function executeAiGatewayRequest(
  deps: AiGatewayDeps,
  request: AiGatewayRequest,
): Promise<AiGatewayResult> {
  const gateway = deps.gatewayService ?? createAiGatewayService();
  const started = Date.now();

  await gateway.assertFeatureAccess({
    userId: request.user.userId,
    role: request.user.role,
    feature: request.feature,
    contextMode: request.contextMode,
    taskType: request.taskType,
  });


  const config = await gateway.getConfig();
  const privacyCategory = resolveFeatureCategory({
    contextMode: request.contextMode,
    feature: request.feature,
    taskType: request.taskType,
  });
  const privacyLevel = config.privacyRules[privacyCategory] ?? DEFAULT_PRIVACY_RULES[privacyCategory];




  assertGatewayEnabled(config);

  const apiKeyStore = request.apiKeyStore ?? (await createGatewayApiKeyStore(gateway));

  const routerRequest: AiRouterRequest = {
    ...request,
    providerMode: "local_rtx",
    model: resolveFeatureModelOverride(config, privacyCategory)?.model ?? request.model,
    apiKeyStore,
    options: {
      ...request.options,
      localOnly: true,
      datenschutzMode: true,
    },
  };

  let result: AiRouterResult | undefined;
  let success = true;
  let errorMessage: string | undefined;

  try {
    result = await routeAiRequest(deps, routerRequest);
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
    throw error;
  } finally {
    const durationMs = Date.now() - started;
    if (success && result) {
      const inputTokens = result.result.usage?.promptTokens ?? null;
      const outputTokens = result.result.usage?.completionTokens ?? null;
      await gateway.logUsage({
        userId: resolveGatewayUsageUserId(request.user),
        feature: request.feature ?? privacyCategory,
        taskType: request.taskType,
        provider: result.providerId,
        model: result.result.model ?? request.model ?? "unknown",
        route: result.route,
        contextMode: request.contextMode,
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCostUsd({
          providerId: result.providerId,
          route: result.route,
          inputTokens: inputTokens ?? undefined,
          outputTokens: outputTokens ?? undefined,
          promptChars:
            (request.userPrompt?.length ?? 0) +
            (result.prompts?.systemPrompt?.length ?? 0) +
            (result.prompts?.userPrompt?.length ?? 0),
          resultChars: result.result.text?.length ?? 0,
        }),
        success: true,
        durationMs,
      });
    } else if (!success) {
      await gateway.logUsage({
        userId: resolveGatewayUsageUserId(request.user),
        feature: request.feature ?? privacyCategory,
        taskType: request.taskType,
        provider: "local_rtx",
        model: request.model ?? "unknown",
        route: "unknown",
        contextMode: request.contextMode,
        success: false,
        errorMessage,
        durationMs,
      });
    }
  }

  if (!result) {
    throw new AiRouterError("KI-Anfrage ohne Ergebnis abgebrochen.");
  }

  return {
    ...result,
    gatewayMeta: {
      routingMode: config.routingMode,
      cloudFallbackUsed: false,
      privacyCategory,
      privacyLevel,
      durationMs: Date.now() - started,
    },
  };
}

export interface AiGatewayImageRequest extends Omit<ImageStudioRequest, "providerMode"> {
  user: AiGatewayUserContext;
  providerMode?: ImageProviderMode;
  feature?: string;
}

export interface AiGatewayImageResult extends ImageStudioResult {
  gatewayMeta: {
    routingMode: AiRoutingMode;
    cloudFallbackUsed: boolean;
    privacyCategory: AiFeatureCategory;
    privacyLevel: AiPrivacyLevel;
    durationMs: number;
  };
}

export interface AiGatewayResearchContext {
  user: AiGatewayUserContext;
  contextMode: "dnd_brain" | "life_brain" | "open_web";
  feature?: string;
  queryChars?: number;
}

function resolveResearchFeature(contextMode: AiGatewayResearchContext["contextMode"]): string {
  return contextMode === "dnd_brain" ? "AI_DND_USE" : "AI_KNOWLEDGE_USE";
}

function resolveResearchPrivacyContextMode(
  contextMode: AiGatewayResearchContext["contextMode"],
): string {
  switch (contextMode) {
    case "life_brain":
      return "personal_brain";
    case "open_web":
      return "general_chat";
    default:
      return "brain";
  }
}

async function prepareAiGatewayExecution(
  gateway: AiGatewayService,
  input: {
    user: AiGatewayUserContext;
    feature: string;
    contextMode?: string;
    taskType?: string;
    requestedProviderMode?: AiProviderMode | ImageProviderMode;
  },
): Promise<{
  config: AiGatewayConfigRecord;
  privacyCategory: AiFeatureCategory;
  privacyLevel: AiPrivacyLevel;
  cloudFallbackAllowed: boolean;
  effectiveProviderMode: "auto" | "local_rtx" | "cloud";
}> {
  await gateway.assertFeatureAccess({
    userId: input.user.userId,
    role: input.user.role,
    feature: input.feature,
    contextMode: input.contextMode,
    taskType: input.taskType,
  });


  const config = await gateway.getConfig();
  const privacyCategory = resolveFeatureCategory({
    contextMode: input.contextMode,
    feature: input.feature,
    taskType: input.taskType,
  });
  const privacyLevel = config.privacyRules[privacyCategory] ?? DEFAULT_PRIVACY_RULES[privacyCategory];



  assertGatewayEnabled(config);

  return {
    config,
    privacyCategory,
    privacyLevel,
    cloudFallbackAllowed: false,
    effectiveProviderMode: "local_rtx" as AiProviderMode,
  };
}

/**
 * Image Studio via AI Gateway — permissions, privacy, budget, usage log.
 */
export async function executeAiGatewayImageRequest(
  request: AiGatewayImageRequest,
  gatewayService?: AiGatewayService,
): Promise<AiGatewayImageResult> {
  const gateway = gatewayService ?? createAiGatewayService();
  const started = Date.now();
  const feature = request.feature ?? "AI_IMAGE_USE";

  const prepared = await prepareAiGatewayExecution(gateway, {
    user: request.user,
    feature,
    contextMode: request.contextMode ?? "prompt_only",
    taskType: `image_${request.task}`,
    requestedProviderMode: request.providerMode,
  });

  const imageConfig = await buildGatewayImageProviderConfig(
    gateway,
    prepared.cloudFallbackAllowed,
    prepared.privacyLevel,
    prepared.config,
  );

  let result: ImageStudioResult | undefined;
  let success = true;
  let errorMessage: string | undefined;

  try {
    result = await runImageStudioTask(
      {
        ...request,
        providerMode: prepared.effectiveProviderMode,
      },
      imageConfig,
    );
    if (!result.success) {
      success = false;
      errorMessage = result.error ?? "Bildgenerierung fehlgeschlagen.";
      throw new AiRouterError(errorMessage);
    }
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
    throw error;
  } finally {
    const durationMs = Date.now() - started;
    const route =
      result?.providerUsed === "cloud"
        ? "cloud"
        : result?.providerUsed === "local_rtx"
          ? "local_rtx"
          : "unknown";
    const logInput: CreateUsageLogInput = {
      userId: request.user.userId,
      feature,
      taskType: `image_${request.task}`,
      provider: result?.providerUsed ?? "unknown",
      model: imageConfig.cloudModel ?? "image-studio",
      route,
      contextMode: request.contextMode ?? "prompt_only",
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: estimateCostUsd({
        providerId: "openai",
        route,
        promptChars: request.prompt.length + (request.contextSnippet?.length ?? 0),
        resultChars: result?.imageBase64 ? Math.ceil(result.imageBase64.length * 0.75) : 0,
      }),
      success,
      errorMessage: success ? undefined : errorMessage,
      durationMs,
    };
    await gateway.logUsage(logInput);
  }

  if (!result?.success) {
    throw new AiRouterError(errorMessage ?? "Bildgenerierung fehlgeschlagen.");
  }

  return {
    ...result,
    gatewayMeta: {
      routingMode: prepared.config.routingMode,
      cloudFallbackUsed: result.providerUsed === "cloud",
      privacyCategory: prepared.privacyCategory,
      privacyLevel: prepared.privacyLevel,
      durationMs: Date.now() - started,
    },
  };
}

/**
 * Research jobs — gateway permission, privacy, budget, usage log for the
 * web-search step. The LLM synthesis inside `run` goes through
 * executeAiGatewayRequest and is logged separately.
 */
export async function executeAiGatewayResearchJob<T>(
  context: AiGatewayResearchContext,
  run: () => Promise<T>,
  gatewayService?: AiGatewayService,
): Promise<T> {
  const gateway = gatewayService ?? createAiGatewayService();
  const started = Date.now();
  const feature = context.feature ?? resolveResearchFeature(context.contextMode);
  const privacyContextMode = resolveResearchPrivacyContextMode(context.contextMode);

  await prepareAiGatewayExecution(gateway, {
    user: context.user,
    feature,
    contextMode: privacyContextMode,
    taskType: "research_web",
  });

  let success = true;
  let errorMessage: string | undefined;
  let result: T | undefined;

  try {
    result = await run();
    return result;
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : "Research fehlgeschlagen.";
    throw error;
  } finally {
    const durationMs = Date.now() - started;
    await gateway.logUsage({
      userId: context.user.userId,
      feature,
      taskType: "research_web",
      provider: "searxng",
      model: "web-search",
      route: "web",
      contextMode: context.contextMode,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: 0,
      success,
      errorMessage: success ? undefined : errorMessage,
      durationMs,
    });
  }
}

/**
 * The gateway used to choose between local and cloud providers under budget and
 * privacy policy. Cloud providers are gone — the RTX host is the only backend —
 * so the only decision left is whether AI is switched on at all.
 */
function assertGatewayEnabled(config: AiGatewayConfigRecord): void {
  if (config.routingMode === "DISABLED") {
    throw new AiGatewayDisabledError("KI ist systemweit deaktiviert.");
  }
}

