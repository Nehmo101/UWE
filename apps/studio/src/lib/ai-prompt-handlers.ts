import { NextResponse } from "next/server";
import {
  AiPrivacyError,
  AiProviderError,
  AiRouterError,
  contextModeRequiresLocalContext,
  createApiKeyStoreFromEnv,
  InferenceUrlBlockedError,
  isRtxReady,
  resolveAiBrainSettings,
  routeAiRequest,
  semanticSearchPersonalBrainChunks,
} from "@uwe/ai-brain";
import {
  createBrainStoreService,
  createJobService,
  createLifeAdminService,
  createPersonalBrainService,
  createUweRepository,
  getSystemSettings,
  loadPersonalBrainPromptContext,
  prisma,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import {
  AiAccessDeniedError,
  AiPolicyViolationError,
  enforceAiRequestLimits,
  RtxBoundaryError,
} from "@uwe/security";
import type { AiContextMode, AiProviderMode } from "./ai-prompt-ui";
import { aiPolicyErrorResponse } from "./ai-security";
import { jsonError } from "./api-response";

async function getSettingsOverrides() {
  const systemSettings = await getSystemSettings();
  return {
    localOnly: resolveLocalOnlyMode(systemSettings),
    enabled: systemSettings.ai.enabled,
  };
}

function resolvePromptTaskType(contextMode: AiContextMode) {
  switch (contextMode) {
    case "brain":
      return "summarize_page" as const;
    case "current_object":
      return "summarize_page" as const;
    case "current_object_plus_brain":
      return "improve_lore_text" as const;
    case "personal_brain":
      return "improve_lore_text" as const;
    default:
      return "improve_lore_text" as const;
  }
}

export interface AiPromptRequestBody {
  prompt: string;
  providerMode: AiProviderMode;
  contextMode: AiContextMode;
  worldSlug?: string;
  pageSlug?: string;
  useMock?: boolean;
  model?: string;
  maxTokens?: number;
}

export type AiPromptExecutionResult =
  | {
      kind: "completed";
      text: string;
      provider: string;
      model: string;
      routedVia: string;
      contextMode: AiContextMode;
      providerMode: AiProviderMode;
    }
  | {
      kind: "deferred";
      jobId: string;
      message: string;
    };

export async function executeAiPrompt(body: AiPromptRequestBody): Promise<AiPromptExecutionResult> {
  const prompt = body.prompt?.trim();
  if (!prompt) {
    throw new Error("prompt ist erforderlich.");
  }

  if (!body.providerMode || !body.contextMode) {
    throw new Error("providerMode und contextMode sind erforderlich.");
  }

  enforceAiRequestLimits({
    prompt,
    model: body.model,
    maxTokens: body.maxTokens,
  });

  if (
    (body.contextMode === "current_object" || body.contextMode === "current_object_plus_brain") &&
    (!body.worldSlug?.trim() || !body.pageSlug?.trim())
  ) {
    throw new Error("worldSlug und pageSlug sind für Objekt-Kontext erforderlich.");
  }

  if (body.contextMode === "brain" && !body.worldSlug?.trim()) {
    throw new Error("worldSlug ist für Brain-Kontext erforderlich.");
  }

  const overrides = await getSettingsOverrides();
  const apiKeyStore = createApiKeyStoreFromEnv();
  const settings = resolveAiBrainSettings(apiKeyStore, overrides);

  if (!settings.enabled) {
    throw new Error("KI ist deaktiviert.");
  }

  const needsLocalRtx =
    body.providerMode === "local_rtx" ||
    (body.providerMode === "auto" && contextModeRequiresLocalContext(body.contextMode));

  if (needsLocalRtx && contextModeRequiresLocalContext(body.contextMode)) {
    const rtxReady = await isRtxReady({ useMock: body.useMock });
    if (!rtxReady) {
      const jobs = createJobService(prisma);
      const job = await jobs.enqueue({
        type: "ai_run",
        title: `KI-Prompt (${body.contextMode}) — wartet auf RTX`,
        worldSlug: body.worldSlug?.trim() || null,
        payload: {
          deferredAiPrompt: true,
          prompt: body.prompt,
          providerMode: body.providerMode,
          contextMode: body.contextMode,
          worldSlug: body.worldSlug,
          pageSlug: body.pageSlug,
          useMock: body.useMock ?? false,
        },
      });

      return {
        kind: "deferred",
        jobId: job.id,
        message:
          "RTX ist offline — Anfrage wurde als Job vorgemerkt. Kein Cloud-Fallback für lokalen Kontext.",
      };
    }
  }

  const repo = createUweRepository();
  const brainStore = createBrainStoreService();
  const lifeAdmin = createLifeAdminService(prisma);
  const personalBrain = createPersonalBrainService(prisma);

  const routed = await routeAiRequest(
    {
      repo,
      brainStore,
      loadPersonalBrainContext: () =>
        loadPersonalBrainPromptContext({
          query: prompt,
          retrievalLimit: 8,
          loadDocs: () =>
            lifeAdmin.listPersonalBrainDocuments({ limit: 30 }).then((docs) =>
              docs.map((doc) => ({
                title: doc.title,
                content: doc.content,
                category: doc.category,
              })),
            ),
          loadFacts: () =>
            lifeAdmin.listPersonalBrainFacts({ limit: 30 }).then((facts) =>
              facts.map((fact) => ({
                title: fact.title,
                content: fact.content,
                factType: fact.factType,
              })),
            ),
          searchChunks: async (query, limit) => {
            const results = await semanticSearchPersonalBrainChunks(personalBrain, {
              query,
              limit,
            });
            return results.map((entry) => ({
              documentTitle: entry.documentTitle,
              category: entry.category,
              content: entry.content,
              score: entry.score,
            }));
          },
        }),
    },
    {
      providerMode: body.providerMode,
      contextMode: body.contextMode,
      taskType: resolvePromptTaskType(body.contextMode),
      worldSlug: body.worldSlug?.trim() || undefined,
      pageSlug: body.pageSlug?.trim() || undefined,
      userPrompt: prompt,
      useMock: body.useMock,
      apiKeyStore,
      options: {
        datenschutzMode: settings.datenschutzMode,
        localOnly: settings.localOnly,
      },
    },
  );

  return {
    kind: "completed",
    text: routed.result.text,
    provider: routed.result.provider,
    model: routed.result.model,
    routedVia: routed.route,
    contextMode: routed.contextMode,
    providerMode: routed.providerMode,
  };
}

export async function postAiPrompt(body: AiPromptRequestBody) {
  try {
    const result = await executeAiPrompt(body);

    if (result.kind === "deferred") {
      return NextResponse.json(
        {
          deferred: true,
          jobId: result.jobId,
          message: result.message,
        },
        { status: 202 },
      );
    }

    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      routedVia: result.routedVia,
      contextMode: result.contextMode,
      providerMode: result.providerMode,
    });
  } catch (error) {
    if (
      error instanceof AiAccessDeniedError ||
      error instanceof AiPolicyViolationError ||
      error instanceof RtxBoundaryError
    ) {
      return aiPolicyErrorResponse(error);
    }
    if (error instanceof AiPrivacyError || error instanceof AiRouterError) {
      return jsonError(error.message, 403);
    }
    if (error instanceof InferenceUrlBlockedError) {
      return jsonError(error.message, 403);
    }
    if (error instanceof AiProviderError) {
      return jsonError(error.message, 502);
    }
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }
    throw error;
  }
}
