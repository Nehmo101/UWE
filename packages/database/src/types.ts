/** Page categories map to URL segments: /worlds/{world}/{category}/{slug} */
export type PageCategory = "lore" | "locations" | "npcs" | "dungeons";

/** Who may see a page in the player portal. */
export type PageVisibility = "dm_only" | "player_visible" | "public";

export interface World {
  id: string;
  slug: string;
  name: string;
  description?: string;
}

export interface PageRelation {
  targetPageId: string;
  /** Relation label, e.g. "ally", "located_in", "enemy_of". */
  type: string;
}

export interface Page {
  id: string;
  worldId: string;
  title: string;
  slug: string;
  category: PageCategory;
  content: string;
  aliases: string[];
  tags: string[];
  relations: PageRelation[];
  visibility: PageVisibility;
}

export interface PagePath {
  worldSlug: string;
  category: PageCategory;
  slug: string;
}
