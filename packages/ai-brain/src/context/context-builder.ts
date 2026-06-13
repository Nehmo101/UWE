import type { UweRepository } from "@uwe/database/server";
import type {
  AiContext,
  AiContextBlock,
  AiContextCampaign,
  AiContextPage,
  AiContextSource,
  AiContextWorld,
  AiTaskType,
  BuildAiContextOptions,
} from "../types";
import { SESSION_AWARE_TASKS } from "../types";
import { truncateContextPages, serializePageForBudget } from "./budget";
import {
  type BrainKnowledgeSource,
  emptyBrainKnowledgeSource,
  serializeBrainEntries,
  toContextBrainEntry,
} from "./brain-knowledge-source";
import { resolveContextBuilderConfig } from "./config";
import { buildContextDebug, estimatePromptContextLength } from "./debug";
import { loadSessionContext, serializeSession } from "./sessionContext";
import {
  filterBrainVisibility,
  resolveContextAudience,
  shouldIncludeVisibility,
} from "./visibility";

const DM_ONLY_VISIBILITIES = new Set(["dm_only"]);

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export interface ContextBuilderInput {
  taskType: AiTaskType;
  worldId: string;
  pageId: string;
  options?: BuildAiContextOptions;
}

export interface ContextBuilderService {
  build(input: ContextBuilderInput): Promise<AiContext>;
  buildBySlug(
    taskType: AiTaskType,
    worldSlug: string,
    pageSlug: string,
    options?: BuildAiContextOptions,
  ): Promise<AiContext>;
}

export interface ContextBuilderDeps {
  brainSource?: BrainKnowledgeSource;
}

export function createContextBuilder(
  repo: UweRepository,
  deps: ContextBuilderDeps = {},
): ContextBuilderService {
  const brainSource = deps.brainSource ?? emptyBrainKnowledgeSource;

  return {
    build: (input) => buildContext(repo, brainSource, input),
    buildBySlug: (taskType, worldSlug, pageSlug, options) =>
      buildContextBySlug(repo, brainSource, taskType, worldSlug, pageSlug, options),
  };
}

async function buildContextPage(
  repo: UweRepository,
  pageId: string,
  allowDmOnly: boolean,
): Promise<AiContextPage | null> {
  const page = await repo.getPageWithLinks(pageId);
  if (!page) {
    return null;
  }

  if (!shouldIncludeVisibility(page.visibility, allowDmOnly)) {
    return null;
  }

  const contentBlocks: AiContextBlock[] = page.contentBlocks
    .filter((block) => shouldIncludeVisibility(block.visibility, allowDmOnly))
    .map((block) => ({
      blockId: block.id,
      type: block.type,
      visibility: block.visibility,
      content: block.content,
    }));

  if (contentBlocks.length === 0 && !allowDmOnly && DM_ONLY_VISIBILITIES.has(page.visibility)) {
    return null;
  }

  const relations = [
    ...page.outgoingLinks.map((link) => ({
      targetPageId: link.targetPage.id,
      targetTitle: link.targetPage.title,
      relationType: link.relationType,
      label: link.label,
      direction: "outgoing" as const,
    })),
    ...page.incomingLinks.map((link) => ({
      targetPageId: link.sourcePage.id,
      targetTitle: link.sourcePage.title,
      relationType: link.relationType,
      label: link.label,
      direction: "incoming" as const,
    })),
  ];

  const backlinks = page.incomingLinks.map((link) => ({
    sourcePageId: link.sourcePage.id,
    sourceTitle: link.sourcePage.title,
  }));

  return {
    pageId: page.id,
    title: page.title,
    pageType: page.type,
    tags: parseStringArray(page.tags),
    aliases: parseStringArray(page.aliases),
    visibility: page.visibility,
    canonicalStatus: page.canonicalStatus,
    summary: page.summary,
    contentBlocks,
    relations,
    backlinks,
  };
}

async function resolveSessionId(
  repo: UweRepository,
  worldId: string,
  pageId: string,
  taskType: AiTaskType,
  explicitSessionId?: string,
): Promise<string | undefined> {
  if (explicitSessionId) {
    return explicitSessionId;
  }

  if (!SESSION_AWARE_TASKS.includes(taskType)) {
    return undefined;
  }

  const linked = await repo.findGameSessionsForPage(worldId, pageId);
  return linked[0]?.id;
}

function serializeWorld(world: AiContextWorld): string {
  return [
    `# Welt: ${world.name} (${world.worldId})`,
    world.description ? `Beschreibung: ${world.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function serializeCampaign(campaign: AiContextCampaign): string {
  return [
    `# Kampagne: ${campaign.name} (${campaign.campaignId})`,
    campaign.description ? `Beschreibung: ${campaign.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildContext(
  repo: UweRepository,
  brainSource: BrainKnowledgeSource,
  input: ContextBuilderInput,
): Promise<AiContext> {
  const { taskType, worldId, pageId, options = {} } = input;
  const config = resolveContextBuilderConfig({
    maxChars: options.maxChars,
  });

  const datenschutzMode = options.datenschutzMode ?? false;
  const localOnly = options.localOnly ?? datenschutzMode;
  const audience = resolveContextAudience(taskType, options.audience);
  let allowDmOnly = options.allowDmOnly ?? localOnly;
  if (!config.allowDmOnlyDefault) {
    allowDmOnly = false;
  }
  if (audience !== "dm_internal") {
    allowDmOnly = false;
  }
  const maxChars = config.maxChars;

  const primaryPage = await repo.getPageById(pageId);
  if (!primaryPage || primaryPage.worldId !== worldId) {
    throw new Error(`Seite ${pageId} gehört nicht zur Welt ${worldId} oder existiert nicht.`);
  }

  const worldRecord = (await repo.listWorlds()).find((w) => w.id === worldId);
  const world: AiContextWorld | undefined = worldRecord
    ? {
        worldId: worldRecord.id,
        name: worldRecord.name,
        slug: worldRecord.slug,
        description: worldRecord.description,
      }
    : undefined;

  const campaign: AiContextCampaign | undefined = primaryPage.campaign
    ? {
        campaignId: primaryPage.campaign.id,
        name: primaryPage.campaign.name,
        slug: primaryPage.campaign.slug,
        description: primaryPage.campaign.description,
      }
    : undefined;

  const sessionId = await resolveSessionId(repo, worldId, pageId, taskType, options.sessionId);
  const session = sessionId
    ? await loadSessionContext(repo, sessionId, { allowDmOnly })
    : null;

  const pageIds = new Set<string>([pageId]);
  for (const relatedId of options.includeRelatedPageIds ?? []) {
    pageIds.add(relatedId);
  }

  if (session) {
    for (const linkedPageId of session.linkedPageIds) {
      pageIds.add(linkedPageId);
    }
  }

  const primaryWithLinks = await repo.getPageWithLinks(pageId);
  const excludedPages: Array<{ pageId: string; title: string; visibility: string; reason: string }> =
    [];

  if (primaryWithLinks) {
    for (const link of primaryWithLinks.outgoingLinks) {
      if (shouldIncludeVisibility(link.targetPage.visibility, allowDmOnly)) {
        pageIds.add(link.targetPage.id);
      } else {
        excludedPages.push({
          pageId: link.targetPage.id,
          title: link.targetPage.title,
          visibility: link.targetPage.visibility,
          reason: "Sichtbarkeit ausgeschlossen",
        });
      }
    }
    for (const link of primaryWithLinks.incomingLinks) {
      if (shouldIncludeVisibility(link.sourcePage.visibility, allowDmOnly)) {
        pageIds.add(link.sourcePage.id);
      } else {
        excludedPages.push({
          pageId: link.sourcePage.id,
          title: link.sourcePage.title,
          visibility: link.sourcePage.visibility,
          reason: "Sichtbarkeit ausgeschlossen",
        });
      }
    }
  }

  const pages: AiContextPage[] = [];
  for (const id of pageIds) {
    const contextPage = await buildContextPage(repo, id, allowDmOnly);
    if (contextPage) {
      pages.push(contextPage);
    }
  }

  pages.sort((a, b) => {
    if (a.pageId === pageId) return -1;
    if (b.pageId === pageId) return 1;
    return a.title.localeCompare(b.title, "de");
  });

  const brainRaw = await brainSource.findRelevant({
    worldId,
    campaignId: campaign?.campaignId,
    sessionId,
    pageId,
    taskType,
    allowDmOnly,
    maxEntries: 20,
  });
  const brainEntries = filterBrainVisibility(
    brainRaw.map(toContextBrainEntry),
    allowDmOnly,
  );

  const { pages: limitedPages, truncated: pagesTruncated } = truncateContextPages(
    pages,
    Math.max(
      200,
      maxChars -
        estimatePromptContextLength({
          world,
          campaign,
          session: session ?? undefined,
          pages: [],
          brainEntries,
          allowDmOnly,
        }),
    ),
  );

  let truncated = pagesTruncated;

  const sources: AiContextSource[] = [
    ...limitedPages.map((page) => ({
      pageId: page.pageId,
      blockIds: page.contentBlocks.map((block) => block.blockId),
    })),
    ...brainEntries.map((entry) => ({
      pageId: pageId,
      brainEntryId: entry.entryId,
    })),
  ];

  const worldBlock = world ? serializeWorld(world) : "";
  const campaignBlock = campaign ? serializeCampaign(campaign) : "";
  const sessionBlock = session ? serializeSession(session, { allowDmOnly }) : "";
  const brainBlock = serializeBrainEntries(brainEntries);
  const pageContext = limitedPages.map(serializePageForBudget).join("\n\n");
  let promptContext = [worldBlock, campaignBlock, sessionBlock, brainBlock, pageContext]
    .filter(Boolean)
    .join("\n\n");

  if (promptContext.length > maxChars) {
    promptContext = `${promptContext.slice(0, Math.max(0, maxChars - 15))}\n… [gekürzt]`;
    truncated = true;
  }

  const totalChars = promptContext.length;

  const debug = buildContextDebug({
    audience,
    allowDmOnly,
    maxChars,
    totalChars,
    truncated,
    world,
    campaign,
    session: session ?? undefined,
    pages: limitedPages,
    brainEntries,
    excludedPages,
  });

  return {
    taskType,
    worldId,
    primaryPageId: pageId,
    sessionId,
    session: session ?? undefined,
    world,
    campaign,
    brainEntries,
    pages: limitedPages,
    sources,
    promptContext,
    truncated,
    datenschutzMode,
    allowDmOnly,
    debug,
  };
}

async function buildContextBySlug(
  repo: UweRepository,
  brainSource: BrainKnowledgeSource,
  taskType: AiTaskType,
  worldSlug: string,
  pageSlug: string,
  options: BuildAiContextOptions = {},
): Promise<AiContext> {
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error(`Welt ${worldSlug} nicht gefunden.`);
  }

  const page = await repo.getPageBySlug(worldSlug, pageSlug);
  if (!page) {
    throw new Error(`Seite ${pageSlug} in Welt ${worldSlug} nicht gefunden.`);
  }

  return buildContext(repo, brainSource, {
    taskType,
    worldId: world.id,
    pageId: page.id,
    options,
  });
}

export async function buildAiContext(
  repo: UweRepository,
  taskType: AiTaskType,
  worldId: string,
  pageId: string,
  options: BuildAiContextOptions = {},
): Promise<AiContext> {
  return createContextBuilder(repo).build({ taskType, worldId, pageId, options });
}

export async function buildAiContextBySlug(
  repo: UweRepository,
  taskType: AiTaskType,
  worldSlug: string,
  pageSlug: string,
  options: BuildAiContextOptions = {},
): Promise<AiContext> {
  return createContextBuilder(repo).buildBySlug(taskType, worldSlug, pageSlug, options);
}

export async function listSessionsForBrain(
  repo: UweRepository,
  worldSlug: string,
  pageId?: string,
): Promise<Array<{ id: string; title: string; sessionNumber: number }>> {
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) return [];

  const list = pageId
    ? await repo.findGameSessionsForPage(world.id, pageId)
    : await repo.listGameSessionsByWorldId(world.id);

  return list.map((session) => ({
    id: session.id,
    title: session.title,
    sessionNumber: session.sessionNumber,
  }));
}
