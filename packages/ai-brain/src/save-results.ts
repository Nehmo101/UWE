import type { UweRepository } from "@uwe/database/server";
import type { AiContext, AiContextSource, AiProviderId, AiTaskType } from "./types";
import { extractDmOnlyPhrases, validatePlayerRecapContent } from "./privacy";

export interface SaveAiMetadata {
  taskType: AiTaskType;
  providerId: AiProviderId;
  model: string;
  sources: AiContextSource[];
  sessionId?: string;
  sourcePageId?: string;
}

function buildSaveMetadata(input: SaveAiMetadata): Record<string, unknown> {
  return {
    source: "ai_brain",
    taskType: input.taskType,
    provider: input.providerId,
    model: input.model,
    generatedAt: new Date().toISOString(),
    isCanon: false,
    contextSources: input.sources.map((source) => ({
      pageId: source.pageId,
      blockIds: source.blockIds ?? [],
    })),
    sessionId: input.sessionId ?? null,
    sourcePageId: input.sourcePageId ?? null,
  };
}

export async function saveAiResultAsIdea(
  repo: UweRepository,
  input: {
    worldId: string;
    sourcePageId: string;
    title: string;
    content: string;
    taskType: AiTaskType;
    pageType?: "note" | "lore" | "npc" | "location" | "encounter";
    sources?: AiContextSource[];
    sessionId?: string;
    providerId?: AiProviderId;
    model?: string;
  },
) {
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `idee-${slugBase}-${Date.now().toString(36)}`;

  return repo.createIdeaPage({
    worldId: input.worldId,
    title: input.title,
    slug,
    type: input.pageType ?? "note",
    content: input.content,
    sourcePageId: input.sourcePageId,
    taskType: input.taskType,
    visibility: "dm_only",
    metadata: buildSaveMetadata({
      taskType: input.taskType,
      providerId: input.providerId ?? "ollama",
      model: input.model ?? "unknown",
      sources: input.sources ?? [],
      sessionId: input.sessionId,
      sourcePageId: input.sourcePageId,
    }),
  });
}

export async function saveAiResultAsContentBlock(
  repo: UweRepository,
  input: {
    pageId: string;
    content: string;
    taskType: AiTaskType;
    providerId: AiProviderId;
    model: string;
    sources?: AiContextSource[];
    sessionId?: string;
    sourcePageId?: string;
  },
) {
  const sortOrder = await repo.getNextContentBlockSortOrder(input.pageId);
  return repo.addContentBlock(input.pageId, {
    type: "ai_summary",
    sortOrder,
    content: input.content,
    visibility: "dm_only",
    metadata: JSON.parse(
      JSON.stringify(
        buildSaveMetadata({
          taskType: input.taskType,
          providerId: input.providerId,
          model: input.model,
          sources: input.sources ?? [],
          sessionId: input.sessionId,
          sourcePageId: input.sourcePageId ?? input.pageId,
        }),
      ),
    ),
  });
}

export async function saveAiResultAsPlayerRecap(
  repo: UweRepository,
  input: {
    sessionId: string;
    content: string;
    taskType: AiTaskType;
    providerId: AiProviderId;
    model: string;
    sources?: AiContextSource[];
    sourcePageId?: string;
    context?: AiContext;
  },
) {
  if (input.context) {
    const forbidden = extractDmOnlyPhrases(input.context);
    validatePlayerRecapContent(input.content, forbidden);
  }

  const updated = await repo.updateGameSessionPlayerRecap(input.sessionId, input.content);

  return {
    session: updated,
    metadata: buildSaveMetadata({
      taskType: input.taskType,
      providerId: input.providerId,
      model: input.model,
      sources: input.sources ?? [],
      sessionId: input.sessionId,
      sourcePageId: input.sourcePageId,
    }),
  };
}
