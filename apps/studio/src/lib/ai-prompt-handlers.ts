import { NextResponse } from "next/server";
import {
  AiPrivacyError,
  AiProviderError,
  AiRouterError,
  createApiKeyStoreFromEnv,
  InferenceUrlBlockedError,
  resolveAiBrainSettings,
  routeAiRequest,
} from "@uwe/ai-brain";
import {
  createBrainStoreService,
  createUweRepository,
  getSystemSettings,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import type { AiContextMode, AiProviderMode } from "./ai-prompt-ui";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

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
    default:
      return "improve_lore_text" as const;
  }
}

export async function postAiPrompt(body: {
  prompt: string;
  providerMode: AiProviderMode;
  contextMode: AiContextMode;
  worldSlug?: string;
  pageSlug?: string;
  useMock?: boolean;
}) {
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return jsonError("prompt ist erforderlich.", 400);
  }

  if (!body.providerMode || !body.contextMode) {
    return jsonError("providerMode und contextMode sind erforderlich.", 400);
  }

  if (
    (body.contextMode === "current_object" || body.contextMode === "current_object_plus_brain") &&
    (!body.worldSlug?.trim() || !body.pageSlug?.trim())
  ) {
    return jsonError("worldSlug und pageSlug sind für Objekt-Kontext erforderlich.", 400);
  }

  if (body.contextMode === "brain" && !body.worldSlug?.trim()) {
    return jsonError("worldSlug ist für Brain-Kontext erforderlich.", 400);
  }

  const overrides = await getSettingsOverrides();
  const apiKeyStore = createApiKeyStoreFromEnv();
  const settings = resolveAiBrainSettings(apiKeyStore, overrides);

  if (!settings.enabled) {
    return jsonError("KI ist deaktiviert.", 503);
  }

  const repo = createUweRepository();
  const brainStore = createBrainStoreService();

  try {
    const routed = await routeAiRequest(
      { repo, brainStore },
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

    return NextResponse.json({
      text: routed.result.text,
      provider: routed.result.provider,
      model: routed.result.model,
      routedVia: routed.route,
      contextMode: routed.contextMode,
      providerMode: routed.providerMode,
    });
  } catch (error) {
    if (error instanceof AiPrivacyError || error instanceof AiRouterError) {
      return jsonError(error.message, 403);
    }
    if (error instanceof InferenceUrlBlockedError) {
      return jsonError(error.message, 403);
    }
    if (error instanceof AiProviderError) {
      return jsonError(error.message, 502);
    }
    throw error;
  }
}
