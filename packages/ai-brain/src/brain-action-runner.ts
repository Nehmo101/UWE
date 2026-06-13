import type {
  AiRunService,
  BrainStoreService,
  UweRepository,
} from "@uwe/database/server";
import {
  type BrainActionId,
  getBrainAction,
} from "./actions";
import { createContextBuilder } from "./context";
import { createDbBrainKnowledgeSource } from "./context/db-brain-knowledge-source";
import { toAiRunContextSnapshot } from "./context/debug";
import {
  extractDmOnlyPhrases,
  sanitizeContextForCloud,
  validatePlayerRecapContent,
  validateProviderForContext,
} from "./privacy";
import { buildProposalsFromResult } from "./proposals";
import { createProvider, runAiTask } from "./providers/registry";
import {
  createApiKeyStoreFromEnv,
  isCloudProvider,
  resolveAiBrainSettings,
} from "./settings";
import { buildTaskPrompt, buildTaskSystemPrompt } from "./tasks";
import type {
  AiContext,
  AiProviderId,
  ApiKeyStore,
  BuildAiContextOptions,
  GenerateTextResult,
} from "./types";
import { PLAYER_SAFE_TASKS } from "./types";

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

    const brainSource = createDbBrainKnowledgeSource(deps.brainStore, input.worldSlug);
    const contextBuilder = createContextBuilder(deps.repo, { brainSource });

    const contextOptions: BuildAiContextOptions = {
      ...input.options,
      datenschutzMode: settings.datenschutzMode,
      localOnly: settings.localOnly,
      sessionId: input.sessionId,
      audience: action.audience,
      allowDmOnly: action.playerSafe
        ? false
        : (input.allowDmOnly ?? settings.localOnly),
    };

    const context = await contextBuilder.build({
      taskType: action.taskType,
      worldId: world.id,
      pageId: page.id,
      options: contextOptions,
    });

    validateProviderForContext(input.providerId, context, settings);

    const safeContext = isCloudProvider(input.providerId)
      ? sanitizeContextForCloud(context)
      : context;

    const provider = createProvider(input.providerId, apiKeyStore, {
      useMock: input.useMock,
    });

    const userPrompt = buildTaskPrompt(action.taskType, safeContext, input.userPrompt);
    const systemPrompt = buildTaskSystemPrompt(action.taskType);

    const result = await runAiTask(provider, {
      model: input.model,
      prompt: userPrompt,
      systemPrompt,
    });

    if (PLAYER_SAFE_TASKS.includes(action.taskType)) {
      const forbidden = extractDmOnlyPhrases(context);
      validatePlayerRecapContent(result.text, forbidden);
    }

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
      context: safeContext,
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
