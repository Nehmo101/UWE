import {
  executeAiGatewayRequest,
  isRtxReadinessReady,
  resolveAiBrainSettings,
} from "@uwe/ai-brain";
import {
  createBrainStoreService,
  createUweRepository,
  getSystemSettings,
  prisma,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import { enforceAiRequestLimits } from "@uwe/security";
import { createApiKeyStore } from "./ai-key-store";
import {
  buildLifeBrainChatPrompt,
  type LifeBrainChatMessage,
} from "./life-brain-chat-prompt";
import { loadStudioPersonalBrainPromptContext } from "./personal-brain-ai-context";

export type { LifeBrainChatMessage };

export interface LifeBrainChatRequest {
  messages: LifeBrainChatMessage[];
  providerMode?: "auto" | "local_rtx";
  useMock?: boolean;
}

export type LifeBrainChatResult =
  | {
      kind: "completed";
      text: string;
      provider: string;
      model: string;
      routedVia: string;
    }
  | {
      kind: "unavailable";
      message: string;
    };

/**
 * Life-Brain chat: conversational Q&A over the personal brain.
 * Runs through the AI gateway with contextMode personal_brain — permanently
 * local-only, no cloud fallback (enforced by the router privacy guards).
 */
export async function executeLifeBrainChat(
  body: LifeBrainChatRequest,
  user: { userId: string },
): Promise<LifeBrainChatResult> {
  const messages = body.messages
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0);

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    throw new Error("Mindestens eine Nutzer-Nachricht ist erforderlich.");
  }

  const userPrompt = buildLifeBrainChatPrompt(messages);
  enforceAiRequestLimits({ prompt: userPrompt });

  const systemSettings = await getSystemSettings();
  if (!systemSettings.ai.enabled) {
    throw new Error("KI ist deaktiviert.");
  }

  const rtxReady = await isRtxReadinessReady({ useMock: body.useMock, prisma });
  if (!rtxReady) {
    return {
      kind: "unavailable",
      message:
        "Lokale RTX-Inference ist offline. Das Life-Brain nutzt niemals Cloud-KI — bitte RTX Connector starten.",
    };
  }

  const apiKeyStore = await createApiKeyStore();
  const settings = resolveAiBrainSettings(apiKeyStore, {
    localOnly: resolveLocalOnlyMode(systemSettings),
  });

  const routed = await executeAiGatewayRequest(
    {
      repo: createUweRepository(),
      brainStore: createBrainStoreService(),
      loadPersonalBrainContext: () =>
        loadStudioPersonalBrainPromptContext(prisma, {
          query: lastUser.content,
          retrievalLimit: 8,
        }),
    },
    {
      user,
      // personal_brain is permanently local-only — never honor auto/cloud routing.
      providerMode: "local_rtx",
      contextMode: "personal_brain",
      taskType: "answer_life_question",
      userPrompt,
      useMock: body.useMock,
      feature: "AI_KNOWLEDGE_USE",
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
  };
}
