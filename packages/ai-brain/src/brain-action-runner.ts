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
import {
  legacyContextMode,
  providerIdToMode,
  routeAiRequest,
} from "./router";
import { executeAiGatewayRequest, type AiGatewayUserContext } from "./gateway";
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
  pageSlug?: string;
  providerId: AiProviderId;
  model: string;
  userPrompt?: string;
  sessionId?: string;
  /** Kampagnen-Aktionen (requiresCampaign): Slug + Id der Ziel-Kampagne. */
  campaignSlug?: string;
  campaignId?: string;
  /**
   * Vorserialisierter Zusatz-Kontext (z. B. der Kampagnen-Digest aus
   * @uwe/campaign-cockpit). Wird vom Router an den Prompt-Kontext angehängt —
   * so bleibt ai-brain frei von einer Abhängigkeit auf das Feature-Package.
   */
  extraPromptContext?: string;
  useMock?: boolean;
  userId?: string;
  gatewayUser?: AiGatewayUserContext;
  options?: BuildAiContextOptions;
  apiKeyStore?: ApiKeyStore;
}

async function resolveAnchorPageSlug(
  deps: BrainActionRunnerDeps,
  input: RunBrainActionInput,
): Promise<{ pageSlug: string; pageId: string }> {
  if (input.pageSlug?.trim()) {
    const page = await deps.repo.getPageBySlug(input.worldSlug, input.pageSlug);
    if (!page) {
      throw new Error(`Seite ${input.pageSlug} nicht gefunden.`);
    }
    return { pageSlug: page.slug, pageId: page.id };
  }

  if (input.sessionId) {
    const world = await deps.repo.getWorldBySlug(input.worldSlug);
    if (!world) {
      throw new Error(`Welt ${input.worldSlug} nicht gefunden.`);
    }
    const sessions = await deps.repo.listGameSessionsByWorldId(world.id);
    const session = sessions.find((s) => s.id === input.sessionId);
    const linkedPage = session?.linkedPages?.[0]?.page;
    if (linkedPage) {
      return { pageSlug: linkedPage.slug, pageId: linkedPage.id };
    }
  }

  if (input.campaignSlug) {
    // Kampagnen-Anker: das erste Kapitel (story_arc) der Kampagne — der
    // Context-Builder serialisiert dann automatisch den Kampagnen-Block der
    // Ankerseite mit. Fällt auf eine beliebige Kampagnen-Seite zurück; ganz
    // ohne Kampagnen-Seiten greift der Welt-Fallback darunter (der Digest im
    // extraPromptContext trägt den Kampagnen-Kontext ohnehin vollständig).
    const campaign = await deps.repo.getCampaignBySlug(input.worldSlug, input.campaignSlug);
    if (!campaign) {
      throw new Error(`Kampagne ${input.campaignSlug} nicht gefunden.`);
    }
    const chapters = await deps.repo.listPagesByWorld(input.worldSlug, {
      campaignId: campaign.id,
      type: "story_arc",
    });
    const firstChapter = [...chapters].sort(
      (a, b) => (a.sortIndex ?? Number.MAX_SAFE_INTEGER) - (b.sortIndex ?? Number.MAX_SAFE_INTEGER),
    )[0];
    if (firstChapter) {
      return { pageSlug: firstChapter.slug, pageId: firstChapter.id };
    }
    const campaignPages = await deps.repo.listPagesByWorld(input.worldSlug, {
      campaignId: campaign.id,
    });
    if (campaignPages[0]) {
      return { pageSlug: campaignPages[0].slug, pageId: campaignPages[0].id };
    }
  }

  const pages = await deps.repo.listPagesByWorld(input.worldSlug);
  const anchor = pages[0];
  if (!anchor) {
    throw new Error("Keine Anker-Seite für Brain-Kontext gefunden.");
  }
  return { pageSlug: anchor.slug, pageId: anchor.id };
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

  const anchor = await resolveAnchorPageSlug(deps, input);
  const page = await deps.repo.getPageBySlug(input.worldSlug, anchor.pageSlug);
  if (!page) {
    throw new Error(`Seite ${anchor.pageSlug} nicht gefunden.`);
  }

  if (action.requiresSession && !input.sessionId) {
    throw new Error(`Brain-Aktion „${action.label}“ erfordert eine Session.`);
  }
  if (action.requiresCampaign && !input.campaignSlug) {
    throw new Error(`Brain-Aktion „${action.label}“ erfordert eine Kampagne.`);
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
    };

    const routerInput = {
      providerMode: providerIdToMode(input.providerId),
      contextMode: legacyContextMode({ withBrain: true }),
      taskType: action.taskType,
      worldSlug: input.worldSlug,
      pageSlug: anchor.pageSlug,
      sessionId: input.sessionId,
      model: input.model,
      userPrompt: input.userPrompt,
      extraPromptContext: input.extraPromptContext,
      useMock: input.useMock,
      apiKeyStore,
      options: contextOptions,
    };

    const routed = input.gatewayUser
      ? await executeAiGatewayRequest(
          { repo: deps.repo, brainStore: deps.brainStore },
          {
            ...routerInput,
            user: input.gatewayUser,
            feature: "AI_DND_USE",
          },
        )
      : await routeAiRequest({ repo: deps.repo, brainStore: deps.brainStore }, routerInput);

    const { context, result, prompts } = routed;
    const { systemPrompt, userPrompt } = prompts;

    const proposals = buildProposalsFromResult({
      action,
      resultText: result.text,
      pageId: page.id,
      sessionId: input.sessionId,
      worldId: world.id,
      campaignId: input.campaignId,
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
          // Kampagnen-Läufe werden darüber der Kampagne zugeordnet (History-
          // Filter im dnd-generator) — der Seiten-Anker wandert mit der
          // Kapitel-Sortierung und taugt nicht als Schlüssel.
          campaignId: input.campaignId ?? null,
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
