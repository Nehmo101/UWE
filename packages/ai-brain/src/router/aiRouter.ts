import type { BrainStoreService, UweRepository } from "@uwe/database/server";

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

import { buildTaskPrompt, buildTaskSystemPrompt } from "../tasks";

import type { AiContext, AiProvider, AiProviderId, ApiKeyStore } from "../types";

import { PLAYER_SAFE_TASKS } from "../types";

import { buildRouterContext } from "./context/contextBuilder";

import { createBrainRetrievalAdapter } from "./context/brainRetrieval";

import { checkRtxHealth } from "./health/rtxHealthcheck";

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



export interface AiRouterDeps {

  repo: UweRepository;

  brainStore?: BrainStoreService;

  /** Loads serialized personal brain context — required for personal_brain mode. */
  loadPersonalBrainContext?: () => Promise<string>;

}



const GENERAL_CHAT_SYSTEM =

  "Du bist ein hilfreicher Assistent für Dungeon Master. Antworte auf Deutsch, klar und prägnant.";



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



  return {

    systemPrompt: buildTaskSystemPrompt(request.taskType),

    userPrompt: buildTaskPrompt(request.taskType, safeContext, request.userPrompt),

  };

}



export async function resolveProviderRoute(

  providerMode: AiProviderMode,

  contextMode: AiRouterRequest["contextMode"],

  apiKeyStore: ApiKeyStore,

  options?: { useMock?: boolean; cloudProviderId?: AiProviderId },

): Promise<ProviderResolution> {
  validateProviderContextCombination(providerMode, contextMode);

  const rtxHealth = await checkRtxHealth({ useMock: options?.useMock });

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

    },

  );



  validateResolvedRouteForContext(resolution.route, request.contextMode);



  const rtxHealth = await checkRtxHealth({ useMock: request.useMock });

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

      },

    });

    }

  }



  validateProviderForContext(resolution.providerId, context, settings);



  const safeContext = context;



  const provider = createRoutedProvider(resolution, apiKeyStore, request.useMock);

  const { systemPrompt, userPrompt } = buildRouterPrompts(

    request,

    resolution.route,

    request.contextMode,

    safeContext,

  );



  const result = await runAiTask(provider, {

    model,

    prompt: userPrompt,

    systemPrompt,

  });



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


