import type { UweRepository } from "@uwe/database/server";
import { createContextBuilder } from "../../context/context-builder";
import {
  emptyBrainKnowledgeSource,
  serializeBrainEntries,
  type BrainKnowledgeSource,
} from "../../context/brain-knowledge-source";
import { serializePageForBudget } from "../../context/budget";
import { serializeSession } from "../../context/sessionContext";
import type { AiContext, AiTaskType, BuildAiContextOptions } from "../../types";
import type { AiContextMode } from "../types";

export interface RouterContextBuildInput {
  taskType: AiTaskType;
  worldSlug?: string;
  pageSlug?: string;
  contextMode: AiContextMode;
  brainSource?: BrainKnowledgeSource;
  personalBrainPromptContext?: string;
  options?: BuildAiContextOptions;
}

function serializeWorldBlock(context: AiContext): string {
  if (!context.world) return "";
  return [
    `# Welt: ${context.world.name} (${context.world.worldId})`,
    context.world.description ? `Beschreibung: ${context.world.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function rebuildPromptContext(context: AiContext, mode: AiContextMode): string {
  const parts: string[] = [];

  if (mode !== "general_chat" || context.world) {
    parts.push(serializeWorldBlock(context));
  }

  if (context.campaign && mode !== "general_chat") {
    parts.push(
      [
        `# Kampagne: ${context.campaign.name} (${context.campaign.campaignId})`,
        context.campaign.description ? `Beschreibung: ${context.campaign.description}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (context.session && mode !== "general_chat" && mode !== "brain") {
    parts.push(serializeSession(context.session, { allowDmOnly: context.allowDmOnly }));
  }

  const includeBrain =
    mode === "brain" || mode === "current_object_plus_brain";
  if (includeBrain && context.brainEntries?.length) {
    parts.push(serializeBrainEntries(context.brainEntries));
  }

  const includePages =
    mode === "current_object" || mode === "current_object_plus_brain";
  if (includePages && context.pages.length) {
    parts.push(context.pages.map(serializePageForBudget).join("\n\n"));
  }

  return parts.filter(Boolean).join("\n\n");
}

function applyContextMode(context: AiContext, mode: AiContextMode): AiContext {
  switch (mode) {
    case "general_chat":
      return {
        ...context,
        pages: [],
        brainEntries: [],
        session: undefined,
        sessionId: undefined,
        campaign: undefined,
        sources: [],
        promptContext: rebuildPromptContext(
          { ...context, pages: [], brainEntries: [], session: undefined, campaign: undefined },
          mode,
        ),
      };

    case "brain":
      return {
        ...context,
        pages: [],
        session: undefined,
        sessionId: undefined,
        sources: (context.brainEntries ?? []).map((entry) => ({
          pageId: context.primaryPageId,
          brainEntryId: entry.entryId,
        })),
        promptContext: rebuildPromptContext(
          { ...context, pages: [], session: undefined },
          mode,
        ),
      };

    case "current_object":
      return {
        ...context,
        brainEntries: [],
        sources: context.pages.map((page) => ({
          pageId: page.pageId,
          blockIds: page.contentBlocks.map((block) => block.blockId),
        })),
        promptContext: rebuildPromptContext({ ...context, brainEntries: [] }, mode),
      };

    case "current_object_plus_brain":
      return {
        ...context,
        promptContext: rebuildPromptContext(context, mode),
      };

    case "personal_brain":
      return {
        taskType: context.taskType,
        worldId: "",
        primaryPageId: "",
        pages: [],
        brainEntries: [],
        session: undefined,
        campaign: undefined,
        sources: [],
        promptContext: context.promptContext,
        truncated: false,
        datenschutzMode: context.datenschutzMode,
        allowDmOnly: true,
      };

    default:
      return context;
  }
}

function contextModeUsesBrain(mode: AiContextMode): boolean {
  return mode === "brain" || mode === "current_object_plus_brain";
}

function contextModeUsesPages(mode: AiContextMode): boolean {
  return mode === "current_object" || mode === "current_object_plus_brain";
}

/**
 * Builds AI context for the router, reusing the existing context builder
 * and filtering output by context mode.
 */
export async function buildRouterContext(
  repo: UweRepository,
  input: RouterContextBuildInput,
): Promise<AiContext> {
  const brainSource = contextModeUsesBrain(input.contextMode)
    ? (input.brainSource ?? emptyBrainKnowledgeSource)
    : emptyBrainKnowledgeSource;

  const builder = createContextBuilder(repo, { brainSource });

  let fullContext: AiContext;

  if (input.contextMode === "personal_brain") {
    return applyContextMode(
      {
        taskType: input.taskType,
        worldId: "",
        primaryPageId: "",
        pages: [],
        sources: [],
        promptContext: input.personalBrainPromptContext?.trim() ?? "",
        truncated: false,
        datenschutzMode: input.options?.datenschutzMode ?? true,
        allowDmOnly: true,
      },
      input.contextMode,
    );
  }

  if (input.contextMode === "general_chat") {
    if (!input.worldSlug?.trim()) {
      return applyContextMode(
        {
          taskType: input.taskType,
          worldId: "",
          primaryPageId: "",
          pages: [],
          sources: [],
          promptContext: "",
          truncated: false,
          datenschutzMode: input.options?.datenschutzMode ?? false,
          allowDmOnly: input.options?.allowDmOnly ?? false,
        },
        input.contextMode,
      );
    }

    const world = await repo.getWorldBySlug(input.worldSlug);
    if (!world) {
      throw new Error(`Welt ${input.worldSlug} nicht gefunden.`);
    }

    if (input.pageSlug) {
      fullContext = await builder.buildBySlug(
        input.taskType,
        input.worldSlug,
        input.pageSlug,
        input.options,
      );
    } else {
      fullContext = {
        taskType: input.taskType,
        worldId: world.id,
        primaryPageId: world.id,
        world: {
          worldId: world.id,
          name: world.name,
          slug: world.slug,
          description: world.description,
        },
        pages: [],
        sources: [],
        promptContext: "",
        truncated: false,
        datenschutzMode: input.options?.datenschutzMode ?? false,
        allowDmOnly: input.options?.allowDmOnly ?? false,
      };
    }
  } else if (input.pageSlug && input.worldSlug) {
    fullContext = await builder.buildBySlug(
      input.taskType,
      input.worldSlug,
      input.pageSlug,
      input.options,
    );
  } else if (input.contextMode === "brain" && input.worldSlug) {
    const world = await repo.getWorldBySlug(input.worldSlug);
    if (!world) {
      throw new Error(`Welt ${input.worldSlug} nicht gefunden.`);
    }

    const brainRaw = await brainSource.findRelevant({
      worldId: world.id,
      taskType: input.taskType,
      allowDmOnly: input.options?.allowDmOnly ?? true,
      maxEntries: 8,
      query: input.options?.retrievalQuery?.trim() || undefined,
    });

    fullContext = {
      taskType: input.taskType,
      worldId: world.id,
      primaryPageId: world.id,
      world: {
        worldId: world.id,
        name: world.name,
        slug: world.slug,
        description: world.description,
      },
      brainEntries: brainRaw.map((entry) => ({
        entryId: entry.id,
        title: entry.title,
        content: entry.content,
        visibility: entry.visibility,
        sourceType: entry.sourceType,
        objectRef: entry.objectRef,
        trustLevel: entry.trustLevel,
      })),
      pages: [],
      sources: [],
      promptContext: "",
      truncated: false,
      datenschutzMode: input.options?.datenschutzMode ?? false,
      allowDmOnly: input.options?.allowDmOnly ?? true,
    };
  } else {
    throw new Error(
      `Kontextmodus erfordert pageSlug: ${input.contextMode}`,
    );
  }

  if (!contextModeUsesPages(input.contextMode) && input.contextMode !== "general_chat") {
    fullContext = { ...fullContext, pages: [] };
  }

  return applyContextMode(fullContext, input.contextMode);
}
