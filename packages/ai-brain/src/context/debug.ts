import type {
  AiContext,
  AiContextBrainEntry,
  AiContextCampaign,
  AiContextDebug,
  AiContextDebugItem,
  AiContextPage,
  AiContextSession,
  AiContextWorld,
} from "../types";
import { serializePageForBudget } from "./budget";
import { serializeBrainEntries } from "./brain-knowledge-source";
import { serializeSession } from "./sessionContext";

export interface BuildDebugInput {
  maxChars: number;
  totalChars: number;
  truncated: boolean;
  world?: AiContextWorld;
  campaign?: AiContextCampaign;
  session?: AiContextSession;
  pages: AiContextPage[];
  brainEntries: AiContextBrainEntry[];
  excludedPages?: Array<{ pageId: string; title: string; reason: string }>;
}

export function buildContextDebug(input: BuildDebugInput): AiContextDebug {
  const items: AiContextDebugItem[] = [];

  if (input.world) {
    const charCount = (input.world.description?.length ?? 0) + input.world.name.length;
    items.push({
      kind: "world",
      id: input.world.worldId,
      title: input.world.name,
      charCount,
      included: true,
    });
  }

  if (input.campaign) {
    const charCount = (input.campaign.description?.length ?? 0) + input.campaign.name.length;
    items.push({
      kind: "campaign",
      id: input.campaign.campaignId,
      title: input.campaign.name,
      charCount,
      included: true,
    });
  }

  if (input.session) {
    const serialized = serializeSession(input.session);
    items.push({
      kind: "session",
      id: input.session.sessionId,
      title: input.session.title,
      charCount: serialized.length,
      included: true,
    });
  }

  for (const page of input.pages) {
    items.push({
      kind: "page",
      id: page.pageId,
      title: page.title,
      charCount: serializePageForBudget(page).length,
      included: true,
    });
  }

  for (const excluded of input.excludedPages ?? []) {
    items.push({
      kind: "page",
      id: excluded.pageId,
      title: excluded.title,
      charCount: 0,
      included: false,
      reason: excluded.reason,
    });
  }

  for (const entry of input.brainEntries) {
    items.push({
      kind: "brain",
      id: entry.entryId,
      title: entry.title,
      charCount: entry.content.length,
      included: true,
    });
  }

  return {
    maxChars: input.maxChars,
    totalChars: input.totalChars,
    truncated: input.truncated,
    items,
    collectedAt: new Date().toISOString(),
  };
}

/** Serializable snapshot for AI Run History (promptContext + source trace). */
export function toAiRunContextSnapshot(context: AiContext): Record<string, unknown> {
  return {
    taskType: context.taskType,
    worldId: context.worldId,
    primaryPageId: context.primaryPageId,
    sessionId: context.sessionId ?? null,
    truncated: context.truncated,
    promptContext: context.promptContext,
    sources: context.sources,
    brainSources: (context.brainEntries ?? []).map((entry) => ({
      entryId: entry.entryId,
      title: entry.title,
      sourceType: entry.sourceType,
    })),
    debug: context.debug ?? null,
    stats: {
      pageCount: context.pages.length,
      brainEntryCount: context.brainEntries?.length ?? 0,
      totalChars: context.debug?.totalChars ?? context.promptContext.length,
      maxChars: context.debug?.maxChars ?? null,
    },
  };
}

export function estimatePromptContextLength(parts: {
  world?: AiContextWorld;
  campaign?: AiContextCampaign;
  session?: AiContextSession;
  pages: AiContextPage[];
  brainEntries: AiContextBrainEntry[];
}): number {
  const worldBlock = parts.world
    ? [`# Welt: ${parts.world.name}`, parts.world.description ?? ""].filter(Boolean).join("\n")
    : "";
  const campaignBlock = parts.campaign
    ? [`# Kampagne: ${parts.campaign.name}`, parts.campaign.description ?? ""].filter(Boolean).join("\n")
    : "";
  const sessionBlock = parts.session
    ? serializeSession(parts.session)
    : "";
  const pageContext = parts.pages.map(serializePageForBudget).join("\n\n");
  const brainContext = serializeBrainEntries(parts.brainEntries);

  return [worldBlock, campaignBlock, sessionBlock, brainContext, pageContext]
    .filter(Boolean)
    .join("\n\n").length;
}
