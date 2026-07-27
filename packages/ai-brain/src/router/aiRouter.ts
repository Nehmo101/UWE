import type { BrainStoreService, PrismaClient, UweRepository } from "@uwe/database/server";
import { prisma as sharedPrisma } from "@uwe/database/server";

import {

  extractDmOnlyPhrases,

  resolveServerAllowDmOnly,

  validatePlayerRecapContent,

  validateProviderForContext,

} from "../privacy";

import { runAiTask } from "../providers/registry";

import {

  createApiKeyStoreFromEnv,

  isCloudProvider,

  resolveAiBrainSettings,

} from "../settings";

import { buildTaskPrompt, buildTaskSystemPrompt, requiresJsonResult } from "../tasks";

import { generateWithJsonRepair, parseModelJson } from "../model-json";

import type { AiContext, AiProvider, AiProviderId, ApiKeyStore } from "../types";

import { PLAYER_SAFE_TASKS } from "../types";

import { buildRouterContext } from "./context/contextBuilder";

import { createBrainRetrievalAdapter } from "./context/brainRetrieval";

import { checkRtxReadiness } from "./health/rtxReadiness";

import {

  validateContextModeRequirements,

  validateLocalRtxRequired,

  validateProviderContextCombination,

  validateResolvedRouteForContext,

} from "./privacyGuard";

import {

  createCloudProvider,

  resolveCloudProviderId,

} from "./providers/cloudProvider";

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

import { AiRouterError, LOCAL_ONLY_CONTEXT_MODES } from "./types";

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



function createEmptyGeneralChatContext(request: AiRouterRequest): AiContext {

  return {

    taskType: request.taskType,

    worldId: "",

    primaryPageId: "",

    pages: [],

    sources: [],

    promptContext: "",

    truncated: false,

    datenschutzMode: true,

    allowDmOnly: false,

  };

}



function buildRouterPrompts(

  request: AiRouterRequest,

  route: AiResolvedRoute,

  contextMode: AiContextMode,

  safeContext: AiContext,

): { systemPrompt: string; userPrompt: string } {

  if (route === "cloud") {
    if (contextMode === "general_chat") {
      const userText = request.userPrompt?.trim();

      if (!userText) {

        throw new AiRouterError(

          "Cloud-Chat erfordert eine Nutzer-Nachricht — lokaler Kontext wird nicht übermittelt.",

        );

      }

      return {

        systemPrompt: GENERAL_CHAT_SYSTEM,

        userPrompt: userText,

      };
    }

    // For DnD context modes (brain, current_object, current_object_plus_brain) on cloud route,
    // send full task prompts with context — owner policy allows campaign context to cloud
    // when gateway privacy level is CLOUD_ALLOWED. personal_brain is blocked upstream and
    // never reaches this path.
    return {
      systemPrompt: buildTaskSystemPrompt(request.taskType),
      userPrompt: buildTaskPrompt(request.taskType, safeContext, request.userPrompt),
    };
  }



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

  providerMode: AiProviderMode,

  contextMode: AiRouterRequest["contextMode"],

  apiKeyStore: ApiKeyStore,

  options?: { useMock?: boolean; cloudProviderId?: AiProviderId; prisma?: PrismaClient },

): Promise<ProviderResolution> {
  validateProviderContextCombination(providerMode, contextMode);

  const rtxHealth = await checkRtxReadiness({
    useMock: options?.useMock,
    prisma: options?.prisma,
  });

  const rtxOnline = rtxHealth.ready;



  validateLocalRtxRequired(providerMode, contextMode, rtxOnline);



  switch (providerMode) {

    case "cloud":

      return {

        route: "cloud",

        providerId: resolveCloudProviderId(apiKeyStore, options?.cloudProviderId),

      };



    case "local_rtx":

      if (!rtxOnline) {

        throw new AiRouterError(rtxHealth.message || "Lokale RTX-Inference ist nicht bereit.");

      }

      return {

        route: "local_rtx",

        providerId: getLocalRtxProviderId(),

      };



    case "auto":

      if (rtxOnline) {

        return {

          route: "local_rtx",

          providerId: getLocalRtxProviderId(),

        };

      }

      return {

        route: "cloud",

        providerId: resolveCloudProviderId(apiKeyStore, options?.cloudProviderId),

      };



    default:

      throw new AiRouterError(`Unbekannter Provider-Modus: ${providerMode satisfies never}`);

  }

}



function createRoutedProvider(

  resolution: ProviderResolution,

  apiKeyStore: ApiKeyStore,

  useMock?: boolean,

): AiProvider {

  if (resolution.route === "local_rtx") {

    return createLocalRtxProvider(apiKeyStore, { useMock });

  }

  return createCloudProvider(apiKeyStore, resolution.providerId, { useMock });

}



function resolveModel(

  request: AiRouterRequest,

  resolution: ProviderResolution,

  rtxDefaultModel: string,

): string {

  if (request.model?.trim()) {

    return request.model.trim();

  }



  if (resolution.route === "local_rtx") {

    return rtxDefaultModel;

  }



  const cloudDef = resolveAiBrainSettings(request.apiKeyStore ?? createApiKeyStoreFromEnv())

    .providers.find((p) => p.id === resolution.providerId);

  return cloudDef?.defaultModel ?? process.env.CLOUD_AI_MODEL?.trim() ?? "gpt-4o-mini";

}



/**

 * Central entry point for all AI requests.

 * Enforces privacy rules server-side before context is sent to any provider.

 */

export async function routeAiRequest(

  deps: AiRouterDeps,

  request: AiRouterRequest,

): Promise<AiRouterResult> {

  validateProviderContextCombination(request.providerMode, request.contextMode);

  validateContextModeRequirements(request.contextMode, request.pageSlug);



  const apiKeyStore = request.apiKeyStore ?? createApiKeyStoreFromEnv();

  const settings = resolveAiBrainSettings(apiKeyStore, {

    datenschutzMode: request.options?.datenschutzMode,

    localOnly: request.options?.localOnly,

  });



  if (settings.localOnly && request.providerMode === "cloud") {

    throw new AiRouterError(

      "Local-only-Modus aktiv: Cloud-KI ist deaktiviert.",

    );

  }



  const resolution = await resolveProviderRoute(

    request.providerMode,

    request.contextMode,

    apiKeyStore,

    {

      useMock: request.useMock,

      cloudProviderId: request.cloudProviderId,

      prisma: deps.prisma ?? sharedPrisma,

    },

  );



  validateResolvedRouteForContext(resolution.route, request.contextMode);



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
      providerMode: request.providerMode,
      contextMode: request.contextMode,
      taskType: request.taskType,
      localOnlyMode: settings.localOnly,
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

  const serverAllowDmOnly = resolveServerAllowDmOnly(

    settings,

    resolution.route === "cloud",

    playerSafe,

  );



  let context: AiContext;



  if (resolution.route === "cloud" && request.contextMode === "general_chat") {

    context = createEmptyGeneralChatContext(request);

  } else {

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
          allowDmOnly: true,
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

        allowDmOnly: serverAllowDmOnly,

        retrievalQuery: request.userPrompt?.trim() || undefined,

      },

    });

    }

  }



  // Local-only modes (personal_brain, mail) are already blocked upstream;
  // DnD modes may go to cloud when policy allows.
  validateProviderForContext(resolution.providerId, context, {
    ...settings,
    allowLocalContextOnCloud: !LOCAL_ONLY_CONTEXT_MODES.includes(request.contextMode),
  });



  const safeContext = context;

  assertContextWithinBudget(safeContext.promptContext.length);



  const { systemPrompt, userPrompt } = buildRouterPrompts(

    request,

    resolution.route,

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

  const jsonWanted = requiresJsonResult(request.taskType);

  /**
   * One generation attempt, whichever backend applies.
   *
   * Prefer the outbound connector queue for local generation when an online
   * connector advertises `llm_local`; fall back to the direct local provider
   * when no connector is available. Pulled into a closure so the JSON repair
   * attempt below runs down exactly the same path as the first one — a retry
   * that silently switched backends would be a different experiment.
   */
  async function generateOnce(promptText: string): Promise<AiRouterResult["result"]> {
    if (resolution.route === "local_rtx" && !request.useMock) {
      /* The connector's `llm_generate` payload has no response-format field
         (`tools/uwe-rtx-connector/src/openai-compatible-llm.ts` reads prompt,
         system, model, maxTokens and ignores the rest), so JSON cannot be
         enforced on this path — only asked for and repaired. */
      const outcome = await tryConnectorLlmGenerate(deps.prisma ?? sharedPrisma, {
        taskType: request.taskType,
        explicitModel: request.model,
        resolvedModel: model,
        systemPrompt,
        userPrompt: promptText,
        providerId: resolution.providerId,
        worldId: context.worldId || undefined,
        maxTokens: request.maxTokens,
      });
      if (outcome) {
        model = outcome.model;
        return outcome.result;
      }
    }

    const provider = createRoutedProvider(resolution, apiKeyStore, request.useMock);
    return runAiTask(provider, {
      model,
      prompt: promptText,
      systemPrompt,
      maxTokens: request.maxTokens,
      ...(jsonWanted ? { responseFormat: "json" as const } : {}),
    });
  }

  let result: AiRouterResult["result"];
  let jsonRepairAttempted = false;
  let jsonOk = true;

  if (cachedResult) {
    result = cachedResult;
    jsonOk = jsonWanted ? parseModelJson(result.text).ok : true;
  } else {
    /* The repair lives in `generateWithJsonRepair`, which calls `generate` at
       most twice — the bound is enforced there, in one place, so it cannot
       quietly grow into a loop here. Only the accepted answer is cached; a
       rejected first attempt must not be served to the next request. */
    const outcome = await generateWithJsonRepair({
      wantsJson: jsonWanted,
      prompt: userPrompt,
      generate: generateOnce,
    });
    result = outcome.result;
    jsonRepairAttempted = outcome.repairAttempted;
    jsonOk = outcome.ok;

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

    providerMode: request.providerMode,

    jsonMode: {
      requested: jsonWanted,
      repairAttempted: jsonRepairAttempted,
      ok: jsonOk,
    },

  };

}



/** Maps legacy AiProviderId to router provider mode. */

export function providerIdToMode(providerId: AiProviderId): AiProviderMode {

  return isCloudProvider(providerId) ? "cloud" : "local_rtx";

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


