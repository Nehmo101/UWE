import type { UweRepository } from "@uwe/database/server";
import type {
  AiContext,
  AiContextBlock,
  AiContextPage,
  AiContextSource,
  AiTaskType,
  BuildAiContextOptions,
} from "../types";

const DEFAULT_MAX_CHARS = 24_000;
const DM_ONLY_VISIBILITIES = new Set(["dm_only"]);
const PORTAL_SAFE_VISIBILITIES = new Set(["public", "player_visible"]);

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function shouldIncludePageVisibility(
  visibility: string,
  allowDmOnly: boolean,
): boolean {
  if (allowDmOnly) {
    return visibility !== "archived";
  }
  return PORTAL_SAFE_VISIBILITIES.has(visibility);
}

function shouldIncludeBlockVisibility(
  visibility: string,
  allowDmOnly: boolean,
): boolean {
  if (allowDmOnly) {
    return visibility !== "archived";
  }
  return PORTAL_SAFE_VISIBILITIES.has(visibility);
}

function serializePage(page: AiContextPage): string {
  const blocks = page.contentBlocks.map((b) => `[${b.type}] ${b.content}`).join("\n");
  const relations = page.relations
    .map((r) => `- ${r.direction === "outgoing" ? "→" : "←"} ${r.targetTitle} (${r.targetPageId}): ${r.relationType}`)
    .join("\n");
  const backlinks = page.backlinks
    .map((b) => `- ← ${b.sourceTitle} (${b.sourcePageId})`)
    .join("\n");

  return [
    `## ${page.title} (${page.pageId})`,
    `Typ: ${page.pageType}`,
    `Sichtbarkeit: ${page.visibility}`,
    `Kanon: ${page.canonicalStatus}`,
    page.summary ? `Zusammenfassung: ${page.summary}` : "",
    page.tags.length ? `Tags: ${page.tags.join(", ")}` : "",
    page.aliases.length ? `Aliase: ${page.aliases.join(", ")}` : "",
    relations ? `Relationen:\n${relations}` : "",
    backlinks ? `Backlinks:\n${backlinks}` : "",
    blocks,
  ]
    .filter(Boolean)
    .join("\n");
}

function truncateContextPages(
  pages: AiContextPage[],
  maxChars: number,
): { pages: AiContextPage[]; truncated: boolean } {
  let total = 0;
  const result: AiContextPage[] = [];
  let truncated = false;

  for (const page of pages) {
    const serialized = serializePage(page);
    if (total + serialized.length > maxChars) {
      truncated = true;
      const remaining = maxChars - total;
      if (remaining > 200) {
        result.push({
          ...page,
          contentBlocks: [
            {
              blockId: "truncated",
              type: "truncated",
              visibility: page.visibility,
              content: `${serialized.slice(0, remaining - 20)}… [gekürzt]`,
            },
          ],
        });
      }
      break;
    }
    total += serialized.length;
    result.push(page);
  }

  return { pages: result, truncated };
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

  if (!shouldIncludePageVisibility(page.visibility, allowDmOnly)) {
    return null;
  }

  const contentBlocks: AiContextBlock[] = page.contentBlocks
    .filter((block) => shouldIncludeBlockVisibility(block.visibility, allowDmOnly))
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

export async function buildAiContext(
  repo: UweRepository,
  taskType: AiTaskType,
  worldId: string,
  pageId: string,
  options: BuildAiContextOptions = {},
): Promise<AiContext> {
  const datenschutzMode = options.datenschutzMode ?? false;
  const localOnly = options.localOnly ?? datenschutzMode;
  const allowDmOnly = options.allowDmOnly ?? localOnly;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  const primaryPage = await repo.getPageById(pageId);
  if (!primaryPage || primaryPage.worldId !== worldId) {
    throw new Error(`Seite ${pageId} gehört nicht zur Welt ${worldId} oder existiert nicht.`);
  }

  const pageIds = new Set<string>([pageId]);
  for (const relatedId of options.includeRelatedPageIds ?? []) {
    pageIds.add(relatedId);
  }

  const primaryWithLinks = await repo.getPageWithLinks(pageId);
  if (primaryWithLinks) {
    for (const link of primaryWithLinks.outgoingLinks) {
      if (shouldIncludePageVisibility(link.targetPage.visibility, allowDmOnly)) {
        pageIds.add(link.targetPage.id);
      }
    }
    for (const link of primaryWithLinks.incomingLinks) {
      if (shouldIncludePageVisibility(link.sourcePage.visibility, allowDmOnly)) {
        pageIds.add(link.sourcePage.id);
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

  const { pages: limitedPages, truncated } = truncateContextPages(pages, maxChars);

  const sources: AiContextSource[] = limitedPages.map((page) => ({
    pageId: page.pageId,
    blockIds: page.contentBlocks.map((block) => block.blockId),
  }));

  return {
    taskType,
    worldId,
    primaryPageId: pageId,
    pages: limitedPages,
    sources,
    promptContext: limitedPages.map(serializePage).join("\n\n"),
    truncated,
    datenschutzMode,
    allowDmOnly,
  };
}

export async function buildAiContextBySlug(
  repo: UweRepository,
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

  return buildAiContext(repo, taskType, world.id, page.id, options);
}
