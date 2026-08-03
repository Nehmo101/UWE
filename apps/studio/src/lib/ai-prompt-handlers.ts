import { NextResponse } from "next/server";
import {
  AiPrivacyError,
  AiProviderError,
  AiRouterError,
  InferenceUrlBlockedError,
  isEngineReadinessReady,
  resolveAiBrainSettings,
  executeAiGatewayRequest,
  AiGatewayAccessDeniedError,
  AiGatewayBudgetExceededError,
  AiGatewayDisabledError,
} from "@uwe/ai-brain";
import {
  createBrainStoreService,
  createJobService,
  createUweRepository,
  getSystemSettings,
  prisma,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import { loadStudioPersonalBrainPromptContext } from "./personal-brain-ai-context";
import { createApiKeyStore } from "./ai-key-store";
import {
  AiAccessDeniedError,
  AiPolicyViolationError,
  enforceAiRequestLimits,
  EngineBoundaryError,
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
      return "answer_life_question" as const;
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

export async function executeAiPrompt(
  body: AiPromptRequestBody,
  user?: { userId: string },
): Promise<AiPromptExecutionResult> {
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
  const apiKeyStore = await createApiKeyStore();
  const settings = resolveAiBrainSettings(apiKeyStore, overrides);

  if (!settings.enabled) {
    throw new Error("KI ist deaktiviert.");
  }

  // Every request needs the Maschinenraum host now — there is no other backend to fall
  // back to, so an offline host always means "queue it and retry later".
  {
    const engineReady = await isEngineReadinessReady({ useMock: body.useMock, prisma });
    if (!engineReady) {
      const jobs = createJobService(prisma);
      const job = await jobs.enqueue({
        type: "ai_run",
        title: `KI-Prompt (${body.contextMode}) — wartet auf Maschinenraum`,
        worldSlug: body.worldSlug?.trim() || null,
        userId: user?.userId ?? null,
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
          "Der Maschinenraum ist offline — Anfrage wurde als Job vorgemerkt. Kein Cloud-Fallback für lokalen Kontext.",
      };
    }
  }

  const repo = createUweRepository();
  const brainStore = createBrainStoreService();

  if (!user) {
    throw new AiGatewayAccessDeniedError(
      "Authentifizierung erforderlich für KI-Anfragen.",
    );
  }

  const gatewayUser = { userId: user.userId };

  const routed = await executeAiGatewayRequest(
    {
      repo,
      brainStore,
      loadPersonalBrainContext: () =>
        loadStudioPersonalBrainPromptContext(prisma, { query: prompt, retrievalLimit: 8 }),
    },
    {
      user: gatewayUser,
      providerMode: "local_engine",
      contextMode: body.contextMode,
      taskType: resolvePromptTaskType(body.contextMode),
      worldSlug: body.worldSlug?.trim() || undefined,
      pageSlug: body.pageSlug?.trim() || undefined,
      userPrompt: prompt,
      useMock: body.useMock,
      maxTokens: body.maxTokens,
      feature: "AI_CHAT_USE",
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
    // The prompt panel only submits UI context modes; "mail" is API-only.
    contextMode: routed.contextMode as AiContextMode,
    providerMode: routed.providerMode,
  };
}

/** Map AI/gateway errors to a consistent HTTP response (shared by prompt + chat routes). */
export function aiPromptErrorResponse(error: unknown): NextResponse {
  if (
    error instanceof AiAccessDeniedError ||
    error instanceof AiPolicyViolationError ||
    error instanceof EngineBoundaryError ||
    error instanceof AiGatewayAccessDeniedError ||
    error instanceof AiGatewayBudgetExceededError ||
    error instanceof AiGatewayDisabledError
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

export async function postAiPrompt(
  body: AiPromptRequestBody,
  user?: { userId: string },
) {
  try {
    const result = await executeAiPrompt(body, user);

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
    return aiPromptErrorResponse(error);
  }
}
