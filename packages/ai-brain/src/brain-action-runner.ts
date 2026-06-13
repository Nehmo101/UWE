import type {
  AiRunService,
  BrainStoreService,
  UweRepository,
} from "@uwe/database/server";
import {
  type BrainActionId,
  getBrainAction,
} from "./actions";
import { toAiRunContextSnapshot } from "./context/debug";
import { buildProposalsFromResult } from "./proposals";
import { resolveServerAllowDmOnly } from "./privacy";
import {
  legacyContextMode,
  providerIdToMode,
  routeAiRequest,
} from "./router";
import { createApiKeyStoreFromEnv, resolveAiBrainSettings } from "./settings";
import type {
  AiContext,
  AiProviderId,
  ApiKeyStore,
  BuildAiContextOptions,
  GenerateTextResult,
} from "./types";

export interface RunBrainActionInput {
  actionId: BrainActionId;
  worldSlug: string;
  pageSlug: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  sessionId?: string;
  allowDmOnly?: boolean;
  useMock?: boolean;
  userId?: string;
  options?: BuildAiContextOptions;
  apiKeyStore?: ApiKeyStore;
}

export interface RunBrainActionResult {
  runId: string;
  context: AiContext;
  result: GenerateTextResult;
  proposals: ReturnType<typeof buildProposalsFromResult>;
}

export interface BrainActionRunnerDeps {
  repo: UweRepository;
  aiRuns: AiRunService;
  brainStore: BrainStoreService;
  databaseUrl?: string;
}

export async function runBrainAction(
  deps: BrainActionRunnerDeps,
  input: RunBrainActionInput,
): Promise<RunBrainActionResult> {
  const action = getBrainAction(input.actionId);
  const apiKeyStore = input.apiKeyStore ?? createApiKeyStoreFromEnv();

  const settings = resolveAiBrainSettings(apiKeyStore, {
    datenschutzMode: input.options?.datenschutzMode,
    localOnly: input.options?.localOnly,
  });

  const world = await deps.repo.getWorldBySlug(input.worldSlug);
  if (!world) {
    throw new Error(`Welt ${input.worldSlug} nicht gefunden.`);
  }

  const page = await deps.repo.getPageBySlug(input.worldSlug, input.pageSlug);
  if (!page) {
    throw new Error(`Seite ${input.pageSlug} nicht gefunden.`);
  }

  if (action.requiresSession && !input.sessionId) {
    throw new Error(`Brain-Aktion „${action.label}“ erfordert eine Session.`);
  }

  const run = await deps.aiRuns.create({
    worldId: world.id,
    pageId: page.id,
    gameSessionId: input.sessionId ?? null,
    userId: input.userId ?? null,
    source: `brain_action:${action.id}`,
    taskType: action.taskType,
    provider: input.providerId,
    model: input.model,
    targetType: action.defaultProposalTarget,
    targetId: input.sessionId ?? page.id,
  });

  const started = Date.now();

  try {
    await deps.aiRuns.markRunning(run.id);

    const contextOptions: BuildAiContextOptions = {
      ...input.options,
      datenschutzMode: settings.datenschutzMode,
      localOnly: settings.localOnly,
      sessionId: input.sessionId,
      audience: action.audience,
      allowDmOnly: resolveServerAllowDmOnly(settings, false, action.playerSafe),
    };

    const routed = await routeAiRequest(
      { repo: deps.repo, brainStore: deps.brainStore },
      {
        providerMode: providerIdToMode(input.providerId),
        contextMode: legacyContextMode({ withBrain: true }),
        taskType: action.taskType,
        worldSlug: input.worldSlug,
        pageSlug: input.pageSlug,
        sessionId: input.sessionId,
        model: input.model,
        cloudProviderId:
          providerIdToMode(input.providerId) === "cloud" ? input.providerId : undefined,
        userPrompt: input.userPrompt,
        useMock: input.useMock,
        apiKeyStore,
        options: contextOptions,
      },
    );

    const { context, result, prompts } = routed;
    const { systemPrompt, userPrompt } = prompts;

    const proposals = buildProposalsFromResult({
      action,
      resultText: result.text,
      pageId: page.id,
      sessionId: input.sessionId,
      worldId: world.id,
    });

    const contextSnapshot = toAiRunContextSnapshot(context);

    await deps.aiRuns.markCompleted(run.id, {
      resultText: result.text,
      systemPrompt,
      userPrompt,
      contextData: JSON.parse(JSON.stringify(contextSnapshot)),
      durationMs: Date.now() - started,
      resultMeta: JSON.parse(
        JSON.stringify({
          actionId: action.id,
          proposals,
          provider: result.provider,
          finishReason: result.finishReason ?? null,
        }),
      ),
    });

    await deps.aiRuns.setProposals(run.id, proposals);

    return {
      runId: run.id,
      context,
      result,
      proposals,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brain-Aktion fehlgeschlagen";
    await deps.aiRuns.markFailed(run.id, {
      errorMessage: message,
      errorDetails: {
        actionId: action.id,
        name: error instanceof Error ? error.name : "Error",
      },
      durationMs: Date.now() - started,
    });
    throw error;
  }
}
