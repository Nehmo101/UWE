import type { PageType, Visibility } from "./generated/prisma/client";

/** Graph filter categories aligned with UWE content types. */
export type GraphNodeCategory =
  | "npc"
  | "location"
  | "faction"
  | "session"
  | "dungeon"
  | "item"
  | "lore"
  | "quest"
  | "handout";

export const GRAPH_NODE_CATEGORIES: GraphNodeCategory[] = [
  "npc",
  "location",
  "faction",
  "session",
  "dungeon",
  "item",
  "lore",
  "quest",
  "handout",
];

export const GRAPH_NODE_CATEGORY_LABELS: Record<GraphNodeCategory, string> = {
  npc: "NPC",
  location: "Ort",
  faction: "Fraktion",
  session: "Session",
  dungeon: "Dungeon",
  item: "Item",
  lore: "Lore",
  quest: "Quest",
  handout: "Handout",
};

export type GraphEdgeKind = "relation" | "wiki" | "hierarchy";

export type GraphViewMode = "full" | "focus" | "neighbors" | "backlinks";

export interface GraphNode {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  category: GraphNodeCategory;
  visibility: Visibility;
  tags: string[];
  href: string;
  campaignId: string | null;
  isFocus?: boolean;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: GraphEdgeKind;
  relationType: string;
  label: string;
}

export interface GraphFilters {
  campaignId?: string | null;
  categories?: GraphNodeCategory[];
  tags?: string[];
  visibilities?: Visibility[];
  focusPageId?: string;
  mode?: GraphViewMode;
}

export interface WorldGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusPageId?: string;
  mode: GraphViewMode;
}

export function graphNodeCategoryLabel(category: GraphNodeCategory): string {
  return GRAPH_NODE_CATEGORY_LABELS[category];
}
