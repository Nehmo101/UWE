import type { AiProviderId, ApiKeyStore } from "../types";
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
} from "@uwe/database/server";
import type { AiRouterRequest, AiRouterResult } from "../router/types";
import { routeAiRequest, type AiRouterDeps } from "../router/aiRouter";
import { checkRtxHealth } from "../router/health/rtxHealthcheck";
import { createApiKeyStoreFromEnv } from "../settings";
import type { AiProviderMode } from "../router/types";
import { AiRouterError } from "../router/types";
import {
  runImageStudioTask,
  resolveImageProviderConfig,
  type ImageStudioRequest,
  type ImageStudioResult,
  type ImageProviderMode,
} from "@uwe/image-studio";
import type { CreateUsageLogInput } from "@uwe/database/server";

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
  isMasterAdminRole,
};

export interface AiGatewayUserContext {
  userId: string;
  role: string;
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

/** Build API key store: DB cloud providers take precedence over ENV. */
export async function createGatewayApiKeyStore(
  gatewayService?: AiGatewayService,
): Promise<ApiKeyStore> {
  const store = createApiKeyStoreFromEnv();
  const service = gatewayService ?? createAiGatewayService();
  const providers = await service.listCloudProviders();

  for (const provider of providers) {
    if (!provider.isEnabled || !provider.hasApiKey) {
      continue;
    }
    const key = await service.resolveCloudProviderApiKey(provider.providerId);
    if (key) {
      store.set(provider.providerId as AiProviderId, key);
    }
  }

  return store;
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

  await gateway.assertBudgetAvailable(request.user.userId);

  const config = await gateway.getConfig();
  const privacyCategory = resolveFeatureCategory({
    contextMode: request.contextMode,
    feature: request.feature,
    taskType: request.taskType,
  });
  const privacyLevel = config.privacyRules[privacyCategory] ?? DEFAULT_PRIVACY_RULES[privacyCategory];

  if (privacyLevel === "LOCAL_REQUIRED" && request.providerMode === "cloud") {
    throw new AiRouterError(
      `Privacy-Regel „${privacyCategory}“ erfordert lokale RTX — Cloud ist nicht erlaubt.`,
    );
  }

  if (privacyLevel === "CLOUD_FORBIDDEN" && request.providerMode === "cloud") {
    throw new AiRouterError(
      `Privacy-Regel „${privacyCategory}“ verbietet Cloud-KI für diesen Kontext.`,
    );
  }

  const cloudFallbackAllowed = await gateway.isCloudFallbackAllowed({
    userId: request.user.userId,
    role: request.user.role,
    contextMode: request.contextMode,
    feature: request.feature,
    taskType: request.taskType,
  });

  const effectiveProviderMode = resolveEffectiveProviderMode(
    config,
    request.providerMode,
    cloudFallbackAllowed,
    privacyLevel,
  );

  const apiKeyStore = request.apiKeyStore ?? (await createGatewayApiKeyStore(gateway));

  const routerRequest: AiRouterRequest = {
    ...request,
    providerMode: effectiveProviderMode,
    apiKeyStore,
    options: {
      ...request.options,
      localOnly: config.routingMode === "LOCAL_ONLY" || !cloudFallbackAllowed,
      datenschutzMode: privacyLevel !== "CLOUD_ALLOWED",
    },
  };

  let result: AiRouterResult | undefined;
  let success = true;
  let errorMessage: string | undefined;

  try {
    result = await routeAiRequestWithGatewayRouting(deps, routerRequest, {
      cloudFallbackAllowed,
      routingMode: config.routingMode,
    });
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
        userId: request.user.userId,
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
        userId: request.user.userId,
        feature: request.feature ?? privacyCategory,
        taskType: request.taskType,
        provider: request.cloudProviderId ?? "unknown",
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
      cloudFallbackUsed: result.route === "cloud",
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

  await gateway.assertBudgetAvailable(input.user.userId);

  const config = await gateway.getConfig();
  const privacyCategory = resolveFeatureCategory({
    contextMode: input.contextMode,
    feature: input.feature,
    taskType: input.taskType,
  });
  const privacyLevel = config.privacyRules[privacyCategory] ?? DEFAULT_PRIVACY_RULES[privacyCategory];

  const requested = (input.requestedProviderMode ?? "auto") as AiProviderMode;
  if (privacyLevel === "LOCAL_REQUIRED" && requested === "cloud") {
    throw new AiRouterError(
      `Privacy-Regel „${privacyCategory}“ erfordert lokale RTX — Cloud ist nicht erlaubt.`,
    );
  }
  if (privacyLevel === "CLOUD_FORBIDDEN" && requested === "cloud") {
    throw new AiRouterError(
      `Privacy-Regel „${privacyCategory}“ verbietet Cloud-KI für diesen Kontext.`,
    );
  }

  const cloudFallbackAllowed = await gateway.isCloudFallbackAllowed({
    userId: input.user.userId,
    role: input.user.role,
    contextMode: input.contextMode,
    feature: input.feature,
    taskType: input.taskType,
  });

  const effectiveProviderMode = resolveEffectiveProviderMode(
    config,
    requested,
    cloudFallbackAllowed,
    privacyLevel,
  );

  return {
    config,
    privacyCategory,
    privacyLevel,
    cloudFallbackAllowed,
    effectiveProviderMode,
  };
}

async function buildGatewayImageProviderConfig(
  gateway: AiGatewayService,
  cloudFallbackAllowed: boolean,
  privacyLevel: AiPrivacyLevel,
  config: AiGatewayConfigRecord,
): Promise<ReturnType<typeof resolveImageProviderConfig>> {
  const envConfig = resolveImageProviderConfig();
  const apiKeyStore = await createGatewayApiKeyStore(gateway);
  const cloudApiKey =
    apiKeyStore.get("openai") ??
    envConfig.cloudApiKey ??
    undefined;
  const allowCloud =
    config.routingMode !== "LOCAL_ONLY" &&
    config.routingMode !== "DISABLED" &&
    config.cloudFallbackEnabled &&
    cloudFallbackAllowed &&
    privacyLevel === "CLOUD_ALLOWED";

  return {
    ...envConfig,
    allowCloud: allowCloud && Boolean(cloudApiKey),
    cloudApiKey,
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
 * Research jobs — gateway permission, privacy, budget, usage log (web search, no LLM).
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

function resolveEffectiveProviderMode(
  config: AiGatewayConfigRecord,
  requested: AiProviderMode,
  cloudFallbackAllowed: boolean,
  privacyLevel: AiPrivacyLevel,
): AiProviderMode {
  if (config.routingMode === "DISABLED") {
    throw new AiGatewayDisabledError("KI ist systemweit deaktiviert.");
  }
  if (config.routingMode === "LOCAL_ONLY" || privacyLevel === "LOCAL_REQUIRED") {
    return "local_rtx";
  }
  if (privacyLevel === "CLOUD_FORBIDDEN") {
    return requested === "cloud" ? "local_rtx" : requested === "local_rtx" ? "local_rtx" : "auto";
  }
  if (config.routingMode === "CLOUD_ONLY") {
    return "cloud";
  }
  if (requested === "cloud") {
    return cloudFallbackAllowed ? "cloud" : "local_rtx";
  }
  if (requested === "local_rtx") {
    return "local_rtx";
  }
  // LOCAL_THEN_CLOUD + auto
  return "auto";
}

async function routeAiRequestWithGatewayRouting(
  deps: AiRouterDeps,
  request: AiRouterRequest,
  options: { cloudFallbackAllowed: boolean; routingMode: AiRoutingMode },
): Promise<AiRouterResult> {
  const apiKeyStore = request.apiKeyStore ?? createApiKeyStoreFromEnv();

  if (options.routingMode === "CLOUD_ONLY") {
    if (request.options?.localOnly || request.contextMode !== "general_chat") {
      throw new AiRouterError(
        "Cloud-only-Routing ist für diesen Kontextmodus nicht erlaubt.",
      );
    }
    return routeAiRequest(deps, { ...request, providerMode: "cloud", apiKeyStore });
  }

  if (options.routingMode === "LOCAL_ONLY" || !options.cloudFallbackAllowed) {
    if (request.providerMode === "auto") {
      const rtxHealth = await checkRtxHealth({ useMock: request.useMock });
      if (!rtxHealth.ready) {
        throw new AiRouterError(
          rtxHealth.message ||
            "Lokale RTX-Inference ist nicht erreichbar. Cloud-Fallback ist nicht freigeschaltet.",
        );
      }
      return routeAiRequest(deps, { ...request, providerMode: "local_rtx", apiKeyStore });
    }
  }

  // Standard path — routeAiRequest handles auto local→cloud when allowed
  if (request.providerMode === "auto" && !options.cloudFallbackAllowed) {
    const rtxHealth = await checkRtxHealth({ useMock: request.useMock });
    if (!rtxHealth.ready) {
      throw new AiRouterError(
        "RTX offline und Cloud-Fallback nicht erlaubt. Bitte RTX prüfen oder Master-Admin kontaktieren.",
      );
    }
    return routeAiRequest(deps, { ...request, providerMode: "local_rtx", apiKeyStore });
  }

  return routeAiRequest(deps, request);
}

/** Sanitized gateway status for client (no secrets). */
export async function getAiGatewayStatusForClient(
  gatewayService?: AiGatewayService,
): Promise<{
  config: Omit<AiGatewayConfigRecord, "updatedAt"> & { updatedAt: string };
  providers: Awaited<ReturnType<AiGatewayService["listCloudProviders"]>>;
  budget: Awaited<ReturnType<AiGatewayService["getBudgetStatus"]>>;
  rtxHealth: Awaited<ReturnType<typeof checkRtxHealth>>;
}> {
  const gateway = gatewayService ?? createAiGatewayService();
  const [config, providers, budget, rtxHealth] = await Promise.all([
    gateway.getConfig(),
    gateway.listCloudProviders(),
    gateway.getBudgetStatus(),
    checkRtxHealth(),
  ]);

  return {
    config: {
      ...config,
      updatedAt: config.updatedAt.toISOString(),
    },
    providers,
    budget,
    rtxHealth,
  };
}

export async function runAiGatewayFallbackTest(
  deps: AiGatewayDeps,
  user: AiGatewayUserContext,
): Promise<{ localOk: boolean; cloudOk: boolean; message: string }> {
  const rtxHealth = await checkRtxHealth();
  let cloudOk = false;

  try {
    await executeAiGatewayRequest(deps, {
      user,
      providerMode: "cloud",
      contextMode: "general_chat",
      taskType: "improve_lore_text",
      userPrompt: "Antworte nur mit: OK",
      useMock: process.env.AI_USE_MOCK === "true",
      feature: "admin_diagnostics",
    });
    cloudOk = true;
  } catch {
    cloudOk = false;
  }

  return {
    localOk: rtxHealth.ready,
    cloudOk,
    message: [
      rtxHealth.ready ? "RTX erreichbar." : "RTX nicht erreichbar.",
      cloudOk ? "Cloud-Fallback-Test erfolgreich." : "Cloud-Fallback-Test fehlgeschlagen oder nicht konfiguriert.",
    ].join(" "),
  };
}
