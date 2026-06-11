import type { PageType } from "./generated/prisma/client";
import { parseStringArray } from "./json-utils";
import { buildPageUrl } from "./page-types";
import {
  filterBlocksForContext,
  isPageAccessible,
  shouldHidePageTitle,
  type AccessContext,
} from "./permissions";
import {
  buildLookupIndex,
  combineBlockContent,
  normalizeLookupKey,
  pageToWikiNode,
  parseWikiLinks,
} from "./page-service";
import type { PageWithBlocks, UweRepository } from "./repository";
import {
  GRAPH_NODE_CATEGORY_LABELS,
  type GraphEdge,
  type GraphFilters,
  type GraphNode,
  type GraphNodeCategory,
  type GraphViewMode,
  type WorldGraphData,
} from "./graph-types";

export type {
  GraphEdge,
  GraphEdgeKind,
  GraphFilters,
  GraphNode,
  GraphNodeCategory,
  GraphViewMode,
  WorldGraphData,
} from "./graph-types";

export {
  GRAPH_NODE_CATEGORIES,
  GRAPH_NODE_CATEGORY_LABELS,
  graphNodeCategoryLabel,
} from "./graph-types";

const PAGE_TYPE_TO_GRAPH_CATEGORY: Record<PageType, GraphNodeCategory> = {
  npc: "npc",
  player_character: "npc",
  monster: "npc",
  location: "location",
  region: "location",
  faction: "faction",
  session: "session",
  encounter: "session",
  dungeon: "dungeon",
  dungeon_level: "dungeon",
  room: "dungeon",
  trap: "dungeon",
  puzzle: "dungeon",
  loot: "dungeon",
  secret: "dungeon",
  item: "item",
  lore: "lore",
  rule: "lore",
  note: "lore",
  quest: "quest",
  handout: "handout",
  map: "lore",
  sound: "lore",
};

export function graphCategoryForPageType(type: PageType): GraphNodeCategory {
  return PAGE_TYPE_TO_GRAPH_CATEGORY[type];
}

function pageTypesForGraphCategories(categories: GraphNodeCategory[]): PageType[] {
  return (Object.entries(PAGE_TYPE_TO_GRAPH_CATEGORY) as [PageType, GraphNodeCategory][])
    .filter(([, category]) => categories.includes(category))
    .map(([type]) => type);
}

function pageToGraphNode(
  worldSlug: string,
  page: PageWithBlocks,
): GraphNode {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type,
    category: graphCategoryForPageType(page.type),
    visibility: page.visibility,
    tags: parseStringArray(page.tags),
    href: buildPageUrl(worldSlug, page.type, page.slug),
    campaignId: page.campaignId,
  };
}

function edgeLabel(relationType: string, label?: string | null): string {
  return label?.trim() || relationType;
}

function collectWikiEdges(
  pages: PageWithBlocks[],
  worldSlug: string,
  context: AccessContext,
  nodeIds: Set<string>,
  allPages: PageWithBlocks[],
): GraphEdge[] {
  const visibleNodes = pages.map((page) => pageToWikiNode(worldSlug, page, context));
  const index = buildLookupIndex(visibleNodes, context, allPages);
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const blocks = filterBlocksForContext(page.contentBlocks, context);
    const content = combineBlockContent(blocks);
    const parsedLinks = parseWikiLinks(content);

    for (const raw of parsedLinks) {
      const targetNode = index.get(normalizeLookupKey(raw.target));
      if (!targetNode || !targetNode.href) continue;
      if (context !== "dm" && shouldHidePageTitle(targetNode, context)) continue;
      if (!nodeIds.has(page.id) || !nodeIds.has(targetNode.id)) continue;

      const relationType = "wikilink";
      const label = edgeLabel(relationType, raw.label ?? raw.target);
      const edgeKey = `${page.id}->${targetNode.id}:${relationType}:${label}`;
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);

      edges.push({
        id: edgeKey,
        sourceId: page.id,
        targetId: targetNode.id,
        kind: "wiki",
        relationType,
        label,
      });
    }
  }

  return edges;
}

function collectRelationEdges(
  pageLinks: Awaited<ReturnType<UweRepository["listPageLinksForWorld"]>>,
  context: AccessContext,
  nodeIds: Set<string>,
  pageById: Map<string, PageWithBlocks>,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const link of pageLinks) {
    const source = pageById.get(link.sourcePageId);
    const target = pageById.get(link.targetPageId);
    if (!source || !target) continue;

    if (context !== "dm") {
      if (!isPageAccessible(source, context) || !isPageAccessible(target, context)) {
        continue;
      }
    }

    if (!nodeIds.has(source.id) || !nodeIds.has(target.id)) continue;

    const label = edgeLabel(link.relationType, link.label);
    const edgeKey = `${source.id}->${target.id}:relation:${link.relationType}:${label}`;
    if (seen.has(edgeKey)) continue;
    seen.add(edgeKey);

    edges.push({
      id: edgeKey,
      sourceId: source.id,
      targetId: target.id,
      kind: "relation",
      relationType: link.relationType,
      label,
    });
  }

  return edges;
}

function collectHierarchyEdges(
  pages: PageWithBlocks[],
  nodeIds: Set<string>,
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const page of pages) {
    if (!page.parentPageId) continue;
    if (!nodeIds.has(page.id) || !nodeIds.has(page.parentPageId)) continue;

    const relationType = "parent";
    const label = edgeLabel(relationType);
    edges.push({
      id: `${page.parentPageId}->${page.id}:hierarchy:${relationType}`,
      sourceId: page.parentPageId,
      targetId: page.id,
      kind: "hierarchy",
      relationType,
      label,
    });
  }

  return edges;
}

function filterNodes(nodes: GraphNode[], filters: GraphFilters): GraphNode[] {
  let result = nodes;

  if (filters.campaignId) {
    result = result.filter((node) => node.campaignId === filters.campaignId);
  }

  if (filters.categories?.length) {
    result = result.filter((node) => filters.categories!.includes(node.category));
  }

  if (filters.tags?.length) {
    result = result.filter((node) =>
      filters.tags!.some((tag) => node.tags.includes(tag)),
    );
  }

  if (filters.visibilities?.length) {
    result = result.filter((node) => filters.visibilities!.includes(node.visibility));
  }

  return result;
}

function filterEdgesForNodes(edges: GraphEdge[], nodeIds: Set<string>): GraphEdge[] {
  return edges.filter(
    (edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId),
  );
}

function applyFocusMode(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusPageId: string | undefined,
  mode: GraphViewMode,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!focusPageId || mode === "full") {
    return { nodes, edges };
  }

  const focusNode = nodes.find((node) => node.id === focusPageId);
  if (!focusNode) {
    return { nodes: [], edges: [] };
  }

  if (mode === "focus") {
    return {
      nodes: [{ ...focusNode, isFocus: true }],
      edges: [],
    };
  }

  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    outgoing.set(edge.sourceId, [...(outgoing.get(edge.sourceId) ?? []), edge]);
    incoming.set(edge.targetId, [...(incoming.get(edge.targetId) ?? []), edge]);
  }

  const allowedIds = new Set<string>([focusPageId]);
  const allowedEdges: GraphEdge[] = [];

  if (mode === "neighbors") {
    for (const edge of outgoing.get(focusPageId) ?? []) {
      allowedIds.add(edge.targetId);
      allowedEdges.push(edge);
    }
    for (const edge of incoming.get(focusPageId) ?? []) {
      allowedIds.add(edge.sourceId);
      allowedEdges.push(edge);
    }
  } else if (mode === "backlinks") {
    for (const edge of incoming.get(focusPageId) ?? []) {
      allowedIds.add(edge.sourceId);
      allowedEdges.push(edge);
    }
  }

  return {
    nodes: nodes
      .filter((node) => allowedIds.has(node.id))
      .map((node) => ({
        ...node,
        isFocus: node.id === focusPageId,
      })),
    edges: allowedEdges,
  };
}

export async function buildWorldGraph(
  repo: UweRepository,
  worldSlug: string,
  context: AccessContext,
  filters: GraphFilters = {},
): Promise<WorldGraphData> {
  const mode = filters.mode ?? (filters.focusPageId ? "neighbors" : "full");
  const pages = await repo.listPagesWithBlocksForGraph(worldSlug, context, {
    campaignId: filters.campaignId,
    types: filters.categories?.length
      ? pageTypesForGraphCategories(filters.categories)
      : undefined,
  });

  const allPages = context === "dm"
    ? pages
    : pages.filter((page) => isPageAccessible(page, context));

  const nodes = allPages.map((page) => pageToGraphNode(worldSlug, page));
  const filteredNodes = filterNodes(nodes, filters);
  const nodeIds = new Set(filteredNodes.map((node) => node.id));
  const pageById = new Map(allPages.map((page) => [page.id, page]));

  const pageLinks = await repo.listPageLinksForWorld(worldSlug);
  const edges = [
    ...collectWikiEdges(allPages, worldSlug, context, nodeIds, allPages),
    ...collectRelationEdges(pageLinks, context, nodeIds, pageById),
    ...collectHierarchyEdges(allPages, nodeIds),
  ];

  const scopedEdges = filterEdgesForNodes(edges, nodeIds);
  const focused = applyFocusMode(filteredNodes, scopedEdges, filters.focusPageId, mode);

  return {
    nodes: focused.nodes,
    edges: focused.edges,
    focusPageId: filters.focusPageId,
    mode,
  };
}

export async function buildPageGraph(
  repo: UweRepository,
  worldSlug: string,
  pageId: string,
  context: AccessContext,
  mode: GraphViewMode = "neighbors",
): Promise<WorldGraphData> {
  return buildWorldGraph(repo, worldSlug, context, {
    focusPageId: pageId,
    mode,
  });
}
