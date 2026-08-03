/**
 * Runs one Brain assistant turn.
 *
 * Hard invariant: **local only**. `providerMode` is pinned to `local_engine` and the
 * context mode is always a local-only one, so the router's privacy guards can
 * never route a Brain conversation to a cloud provider — matching ADR 006 and
 * the existing Life-Brain chat.
 *
 * There is no streaming: the connector queue is request/response, so a turn is
 * one blocking call. The vision leg caps its own wait at 60 s (see
 * `attachments.ts`) to stay below the ~100 s Cloudflare edge timeout; the LLM leg
 * uses the connector default of 120 s, which a tunneled Brain can still cut short
 * on a very slow local model.
 */

import {
  executeAiGatewayRequest,
  isEngineReadinessReady,
  resolveAiBrainSettings,
  type ApiKeyStore,
} from "@uwe/ai-brain";
import { isConnectorVisionAvailable } from "@uwe/ai-brain/router";
import type { BrainPrismaClient } from "@uwe/database/brain-client";
import {
  createBrainStoreService,
  createUweRepository,
  getSystemSettings,
  resolveLocalOnlyMode,
  type PrismaClient,
} from "@uwe/database/server";
import { enforceAiRequestLimits } from "@uwe/security";

import type {
  AssistantContextMode,
  AssistantMessageView,
  AssistantTurnResult,
} from "./assistant-types";
import { extractAttachmentText } from "./attachments";
import {
  ASSISTANT_DEFAULT_SYSTEM_PROMPT,
  buildAssistantPrompt,
  type PromptAttachmentBlock,
} from "./chat-prompt";
import { BrainAssistantService, deriveConversationTitle } from "./conversation-service";
import { resolveAssistantModel } from "./model-service";
import { loadAssistantRagContext } from "./rag-context";

export interface RunAssistantTurnInput {
  conversationId: string;
  question: string;
  attachmentIds?: string[];
  user: { userId: string };
  useMock?: boolean;
  uploadsRoot?: string;
}

export interface AssistantRunnerDeps {
  db: PrismaClient;
  brainDb: BrainPrismaClient;
  createApiKeyStore: () => Promise<ApiKeyStore>;
}

function unavailable(message: string): AssistantTurnResult {
  return { kind: "unavailable", message };
}

/**
 * Resolve every attachment of this turn into prompt blocks. Failures are folded
 * into the block text rather than thrown — one unreadable file must not cost the
 * owner their question.
 */
async function collectAttachmentBlocks(
  deps: AssistantRunnerDeps,
  service: BrainAssistantService,
  input: {
    conversationId: string;
    attachmentIds: string[];
    question: string;
    visionModel: string | null;
    uploadsRoot?: string;
  },
): Promise<PromptAttachmentBlock[]> {
  const attachments = await service.listPendingAttachments(
    input.conversationId,
    input.attachmentIds,
  );
  const blocks: PromptAttachmentBlock[] = [];

  for (const attachment of attachments) {
    if (attachment.extractedText) {
      // Already analyzed in an earlier turn — never re-run a GPU job for it.
      blocks.push({
        kind: attachment.kind,
        filename: attachment.originalFilename,
        text: attachment.extractedText,
      });
      continue;
    }

    const result = await extractAttachmentText(deps.db, {
      storageKey: attachment.storageKey,
      mimeType: attachment.mimeType,
      kind: attachment.kind,
      visionModel: input.visionModel,
      prompt: attachment.kind === "image" ? input.question : undefined,
      ...(input.uploadsRoot ? { uploadsRoot: input.uploadsRoot } : {}),
    });

    const text = result.text || `(nicht auswertbar: ${result.error ?? "unbekannter Fehler"})`;
    await service.setAttachmentText(attachment.id, text, result.jobId);
    blocks.push({ kind: attachment.kind, filename: attachment.originalFilename, text });
  }

  return blocks;
}

function contextModeFor(mode: AssistantContextMode): "personal_brain" | "general_chat" {
  return mode === "life_brain" ? "personal_brain" : "general_chat";
}

/**
 * Execute one turn: persist the question, assemble the prompt, call the local
 * model and persist the answer.
 */
export async function runAssistantTurn(
  deps: AssistantRunnerDeps,
  input: RunAssistantTurnInput,
): Promise<AssistantTurnResult> {
  const question = input.question.trim();
  const attachmentIds = input.attachmentIds ?? [];
  if (!question && attachmentIds.length === 0) {
    return unavailable("Bitte eine Frage eingeben oder eine Datei anhängen.");
  }

  const service = new BrainAssistantService(deps.brainDb);
  const conversation = await service.getConversation(input.conversationId);
  if (!conversation) {
    return unavailable("Diese Unterhaltung existiert nicht mehr.");
  }

  const systemSettings = await getSystemSettings();
  if (!systemSettings.ai.enabled) {
    return unavailable("KI ist in den Einstellungen deaktiviert.");
  }

  const engineReady = await isEngineReadinessReady({ useMock: input.useMock, prisma: deps.db });
  if (!engineReady) {
    return unavailable(
      "Lokale KI ist offline. Der Brain-Assistent nutzt niemals Cloud-KI — bitte den Command Center bzw. Maschinenraum starten.",
    );
  }

  const profile = await service.getProfile();
  const conversationRef =
    conversation.connectorId && conversation.modelId
      ? {
          connectorId: conversation.connectorId,
          modelId: conversation.modelId,
          label: conversation.modelLabel ?? conversation.modelId,
        }
      : null;

  const chatModel = await resolveAssistantModel(deps.db, {
    conversationRef,
    profileRef: profile.chat,
    slot: "chat",
  });

  // Only worth resolving when something could actually need it — and a vision
  // model is useless without an online connector that advertises the capability.
  const visionModel =
    attachmentIds.length > 0 && (await isConnectorVisionAvailable(deps.db))
      ? await resolveAssistantModel(deps.db, {
          conversationRef: null,
          profileRef: profile.vision,
          slot: "vision",
        })
      : null;

  // Persist the question first so it survives a failed generation.
  const userMessage = await service.appendMessage({
    conversationId: input.conversationId,
    role: "user",
    content: question,
    attachmentIds,
  });
  if (conversation.messageCount === 0 && question) {
    await service.renameConversation(input.conversationId, deriveConversationTitle(question));
  }

  const blocks = await collectAttachmentBlocks(deps, service, {
    conversationId: input.conversationId,
    attachmentIds,
    question,
    visionModel: visionModel?.name ?? null,
    ...(input.uploadsRoot ? { uploadsRoot: input.uploadsRoot } : {}),
  });

  const history = [...conversation.messages, userMessage].map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const ragContext =
    conversation.contextMode === "life_brain"
      ? await loadAssistantRagContext(deps.brainDb, deps.db, { query: question, retrievalLimit: 8 })
      : null;

  const userPrompt = buildAssistantPrompt({
    messages: history,
    attachments: blocks,
    ragContext,
    systemPrompt: profile.systemPrompt || ASSISTANT_DEFAULT_SYSTEM_PROMPT,
  });

  const startedAt = Date.now();
  try {
    enforceAiRequestLimits({ prompt: userPrompt });

    const apiKeyStore = await deps.createApiKeyStore();
    const settings = resolveAiBrainSettings(apiKeyStore, {
      localOnly: resolveLocalOnlyMode(systemSettings),
    });

    const routed = await executeAiGatewayRequest(
      {
        repo: createUweRepository(),
        brainStore: createBrainStoreService(),
        loadPersonalBrainContext: () => Promise.resolve(ragContext ?? ""),
        prisma: deps.db,
      },
      {
        user: input.user,
        // Pinned: the Brain assistant is local-only and has no cloud fallback.
        providerMode: "local_engine",
        contextMode: contextModeFor(conversation.contextMode),
        taskType: "answer_life_question",
        userPrompt,
        ...(chatModel.name ? { model: chatModel.name } : {}),
        useMock: input.useMock,
        feature: "AI_KNOWLEDGE_USE",
        options: {
          datenschutzMode: settings.datenschutzMode,
          localOnly: settings.localOnly,
        },
      },
    );

    const message = await service.appendMessage({
      conversationId: input.conversationId,
      role: "assistant",
      content: routed.result.text,
      model: routed.result.model,
      route: blocks.some((block) => block.kind === "image") ? "vision+llm" : "llm",
      durationMs: Date.now() - startedAt,
    });
    return { kind: "completed", message };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Die lokale KI konnte nicht antworten.";
    const message = await service.appendMessage({
      conversationId: input.conversationId,
      role: "assistant",
      content: "",
      durationMs: Date.now() - startedAt,
      errorMessage,
    });
    return { kind: "completed", message };
  }
}

export type { AssistantMessageView };
