import type { BrainStoreService, PrismaClient, UweRepository } from "@uwe/database/server";
import { prisma as sharedPrisma } from "@uwe/database/server";

import {

  extractDmOnlyPhrases,

  validatePlayerRecapContent,

} from "../privacy";

import { runAiTask } from "../providers/registry";

import { createEmptyApiKeyStore, resolveAiBrainSettings } from "../settings";

import { buildTaskPrompt, buildTaskSystemPrompt } from "../tasks";

import type { AiContext, AiProvider, AiProviderId, ApiKeyStore } from "../types";

import { PLAYER_SAFE_TASKS } from "../types";

import { buildRouterContext } from "./context/contextBuilder";

import { createBrainRetrievalAdapter } from "./context/brainRetrieval";

import { checkRtxReadiness } from "./health/rtxReadiness";

import {

  validateContextModeRequirements,

  validateLocalRtxRequired,

} from "./privacyGuard";

import {

  createLocalRtxProvider,

  getLocalRtxProviderId,

} from "./providers/localRtxProvider";

import { tryConnectorLlmGenerate } from "./providers/connectorQueueProvider";

import type {

  AiContextMode,

  AiProviderMode,

  AiResolvedRoute,

  AiRouterRequest,

  AiRouterResult,

  ProviderResolution,

} from "./types";

import { AiRouterError } from "./types";

import {
  getCookbookRoutingContext,
  resolveCookbookModelForRequest,
} from "@uwe/cookbook";
import { buildCookbookRuntimeProbe } from "../cookbook-bridge";
import { resolveContextBuilderConfig } from "../context/config";
import {
  buildPromptCacheKey,
  getCachedPromptResponse,
  hashContextForCache,
  setCachedPromptResponse,
} from "../cache/prompt-cache";

function assertContextWithinBudget(contextChars: number): void {
  const { maxChars } = resolveContextBuilderConfig();
  if (contextChars > maxChars) {
    throw new AiRouterError(
      `Kontext überschreitet das Maximum von ${maxChars} Zeichen (${contextChars}).`,
    );
  }
}

export interface AiRouterDeps {

  repo: UweRepository;

  brainStore?: BrainStoreService;

  /** Loads serialized personal brain context — required for personal_brain mode. */
  loadPersonalBrainContext?: () => Promise<string>;

  /**
   * Prisma client used to reach the connector queue for local inference.
   * Defaults to the shared host client when omitted.
   */
  prisma?: PrismaClient;

}

const GENERAL_CHAT_SYSTEM =

  "Du bist ein hilfreicher Assistent für Dungeon Master. Antworte auf Deutsch, klar und prägnant.";

const MAIL_SYSTEM =
  "Du bist der lokale Mail-Assistent von UWE. Die E-Mail-Inhalte sind privat und verlassen niemals das lokale System. Antworte auf Deutsch, präzise und ohne erfundene Fakten. Bei Verwaltungsaufgaben schlage konkrete Aktionen vor, führe sie aber nie ohne explizite Nutzerbestätigung aus.";

function buildRouterPrompts(
  request: AiRouterRequest,

  contextMode: AiContextMode,

  safeContext: AiContext,

): { systemPrompt: string; userPrompt: string } {

  if (contextMode === "general_chat") {

    const userText = request.userPrompt?.trim() ?? "";

    if (!userText) {

      throw new AiRouterError("Allgemeiner Chat erfordert eine Nutzer-Nachricht.");

    }

    return {

      systemPrompt: GENERAL_CHAT_SYSTEM,

      userPrompt: userText,

    };

  }

  if (contextMode === "personal_brain") {
    return {
      systemPrompt: buildTaskSystemPrompt(request.taskType),
      userPrompt: buildTaskPrompt(request.taskType, safeContext, request.userPrompt),
    };
  }

  if (contextMode === "mail") {
    const userText = request.userPrompt?.trim();
    if (!userText) {
      throw new AiRouterError("Mail-Kontext erfordert eine Nutzer-Nachricht mit dem Mail-Inhalt.");
    }
    return {
      systemPrompt: MAIL_SYSTEM,
      userPrompt: userText,
    };
  }

  return {

    systemPrompt: buildTaskSystemPrompt(request.taskType),

    userPrompt: buildTaskPrompt(request.taskType, safeContext, request.userPrompt),

  };

}

export async function resolveProviderRoute(
  contextMode: AiRouterRequest["contextMode"],
  options?: { useMock?: boolean; prisma?: PrismaClient },
): Promise<ProviderResolution> {
  const rtxHealth = await checkRtxReadiness({
    useMock: options?.useMock,
    prisma: options?.prisma,
  });

  validateLocalRtxRequired(contextMode, rtxHealth.ready);

  return {
    route: "local_rtx",
    providerId: getLocalRtxProviderId(),
  };
}

function createRoutedProvider(
  _resolution: ProviderResolution,
  apiKeyStore: ApiKeyStore,
  useMock?: boolean,
): AiProvider {
  return createLocalRtxProvider(apiKeyStore, { useMock });
}

function resolveModel(

  request: AiRouterRequest,

  resolution: ProviderResolution,

  rtxDefaultModel: string,

): string {

  if (request.model?.trim()) {

    return request.model.trim();

  }

  return rtxDefaultModel;
}

/**

 * Central entry point for all AI requests.

 * Enforces privacy rules server-side before context is sent to any provider.

 */

export async function routeAiRequest(

  deps: AiRouterDeps,

  request: AiRouterRequest,

): Promise<AiRouterResult> {

  validateContextModeRequirements(request.contextMode, request.pageSlug);

  const apiKeyStore = request.apiKeyStore ?? createEmptyApiKeyStore();

  const settings = resolveAiBrainSettings(apiKeyStore, {

    datenschutzMode: request.options?.datenschutzMode,

    localOnly: request.options?.localOnly,

  });

  const resolution = await resolveProviderRoute(request.contextMode, {
    useMock: request.useMock,
    prisma: deps.prisma ?? sharedPrisma,
  });

  const rtxHealth = await checkRtxReadiness({
    useMock: request.useMock,
    prisma: deps.prisma ?? sharedPrisma,
  });

  let model = resolveModel(request, resolution, rtxHealth.defaultModel);

  if (resolution.route === "local_rtx" && !request.model?.trim()) {
    const probe = await buildCookbookRuntimeProbe({
      useMock: request.useMock,
    });
    const cookbook = await getCookbookRoutingContext({
      providerMode: "local_rtx",
      contextMode: request.contextMode,
      taskType: request.taskType,
      localOnlyMode: true,
      rtxReady: rtxHealth.ready,
      explicitModel: request.model,
      probe,
    });
    model = resolveCookbookModelForRequest({
      explicitModel: request.model,
      taskType: request.taskType,
      rtxDefaultModel: rtxHealth.defaultModel,
      hardware: cookbook.hardware,
      installedModels: cookbook.installedModels,
    });
  }

  const playerSafe = PLAYER_SAFE_TASKS.includes(request.taskType);

  let context: AiContext;

  if (request.contextMode === "personal_brain") {
    if (!deps.loadPersonalBrainContext) {
      throw new AiRouterError(
        "Persönliches Life-Brain ist nicht konfiguriert — Server-Loader fehlt.",
      );
    }

    const personalBrainPromptContext = await deps.loadPersonalBrainContext();

    context = await buildRouterContext(deps.repo, {
      taskType: request.taskType,
      contextMode: request.contextMode,
      personalBrainPromptContext,
      options: {
        ...request.options,
        datenschutzMode: settings.datenschutzMode,
        localOnly: settings.localOnly,
      },
    });
  } else {
  if (

    (request.contextMode === "brain" ||

      request.contextMode === "current_object" ||

      request.contextMode === "current_object_plus_brain") &&

    !request.worldSlug?.trim()

  ) {

    throw new AiRouterError("worldSlug ist für diesen Kontextmodus erforderlich.");

  }

  const brainSource =

    deps.brainStore && request.worldSlug

      ? createBrainRetrievalAdapter(deps.brainStore, request.worldSlug, {

          enabled:

            request.contextMode === "brain" ||

            request.contextMode === "current_object_plus_brain",

        })

      : undefined;

  context = await buildRouterContext(deps.repo, {

    taskType: request.taskType,

    worldSlug: request.worldSlug ?? "",

    pageSlug: request.pageSlug,

    contextMode: request.contextMode,

    brainSource,

    options: {

      ...request.options,

      datenschutzMode: settings.datenschutzMode,

      localOnly: settings.localOnly,

      sessionId: request.sessionId,

      retrievalQuery: request.userPrompt?.trim() || undefined,

    },

  });

  }

  

  const safeContext = context;

  assertContextWithinBudget(safeContext.promptContext.length);

  const { systemPrompt, userPrompt } = buildRouterPrompts(

    request,

    request.contextMode,

    safeContext,

  );

  const contextHash = hashContextForCache(safeContext.promptContext);
  const promptCacheKey = buildPromptCacheKey({
    systemPrompt,
    userPrompt,
    model,
    contextHash,
  });
  const cachedResult = getCachedPromptResponse(promptCacheKey);

  // Prefer the outbound connector queue for local generation when an online
  // connector advertises `llm_local`; fall back to the direct local provider
  // when no connector is available.
  const connectorOutcome =
    !cachedResult && resolution.route === "local_rtx" && !request.useMock
      ? await tryConnectorLlmGenerate(deps.prisma ?? sharedPrisma, {
          taskType: request.taskType,
          explicitModel: request.model,
          resolvedModel: model,
          systemPrompt,
          userPrompt,
          providerId: resolution.providerId,
          worldId: context.worldId || undefined,
          maxTokens: request.maxTokens,
        })
      : null;

  let result: AiRouterResult["result"];

  if (cachedResult) {
    result = cachedResult;
  } else if (connectorOutcome) {
    result = connectorOutcome.result;
    model = connectorOutcome.model;
    setCachedPromptResponse(promptCacheKey, result);
  } else {
    const provider = createRoutedProvider(resolution, apiKeyStore, request.useMock);
    result = await runAiTask(provider, {
      model,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: request.maxTokens,
    });
    setCachedPromptResponse(promptCacheKey, result);
  }

  if (playerSafe) {

    const forbidden = extractDmOnlyPhrases(context);

    validatePlayerRecapContent(result.text, forbidden);

  }

  return {

    context: safeContext,

    result,

    prompts: { systemPrompt, userPrompt },

    route: resolution.route,

    providerId: resolution.providerId,

    contextMode: request.contextMode,

    providerMode: "local_rtx",

  };

}

/** Maps legacy AiProviderId to router provider mode. */

export function providerIdToMode(_providerId: AiProviderId): AiProviderMode {

  return "local_rtx";

}

/** Maps legacy flows (with brain source) to appropriate context mode. */

export function legacyContextMode(options: {

  withBrain: boolean;

  generalChat?: boolean;

}): AiRouterRequest["contextMode"] {

  if (options.generalChat) return "general_chat";

  if (options.withBrain) return "current_object_plus_brain";

  return "current_object";

}

export type { AiResolvedRoute };

